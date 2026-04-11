package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	authpkg "CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/database"

	"gorm.io/gorm"
)

var (
	ErrCommentNotFound  = errors.New("comment not found")
	ErrCommentForbidden = errors.New("forbidden")
)

type CommentRepository struct {
	db *gorm.DB
}

// CommentListFilter describes supported comment-list query conditions.
type CommentListFilter struct {
	Page     int
	PageSize int
	BlogID   uint
	State    *int
}

type CreateCommentInput struct {
	BlogID   uint
	UserID   uint
	ParentID *uint
	Content  string
	IP       string
}

type UpdateCommentInput struct {
	ID          uint
	RequesterID uint
	Role        string
	Content     string
}

type UpdateCommentStateInput struct {
	ID    uint
	State int
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	if db == nil {
		return nil
	}
	return &CommentRepository{db: db}
}

// Create inserts one comment under a blog after validating blog and parent state.
func (r *CommentRepository) Create(ctx context.Context, in CreateCommentInput) (*database.Comment, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("comment repository not initialized")
	}

	var comment *database.Comment
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var blog database.Blog
		if err := tx.Where("id = ?", in.BlogID).First(&blog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBlogNotFound
			}
			return err
		}
		if blog.State == database.BlogStateDeleted || !blog.AllowComment {
			return ErrCommentForbidden
		}

		if in.ParentID != nil {
			var parent database.Comment
			if err := tx.Where("id = ? AND blog_id = ? AND state <> ?", *in.ParentID, in.BlogID, database.CommentStateDeleted).First(&parent).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrCommentNotFound
				}
				return err
			}
		}

		now := time.Now()
		item := &database.Comment{
			BlogID:    in.BlogID,
			UserID:    in.UserID,
			ParentID:  in.ParentID,
			Content:   strings.TrimSpace(in.Content),
			State:     database.CommentStateNormal,
			IP:        strings.TrimSpace(in.IP),
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := tx.Create(item).Error; err != nil {
			return err
		}
		if err := tx.Model(&database.Blog{}).Where("id = ?", in.BlogID).Update("comment_count", gorm.Expr("comment_count + ?", 1)).Error; err != nil {
			return err
		}
		comment = item
		return nil
	})
	if err != nil {
		return nil, err
	}
	return comment, nil
}

// ListByBlogID returns paginated visible comments under a blog.
func (r *CommentRepository) ListByBlogID(ctx context.Context, filter CommentListFilter) ([]database.Comment, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, fmt.Errorf("comment repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Comment{}).Where("blog_id = ?", filter.BlogID)
	if filter.State != nil {
		query = query.Where("state = ?", *filter.State)
	} else {
		query = query.Where("state = ?", database.CommentStateNormal)
	}
	return paginateQuery[database.Comment](query, filter.Page, filter.PageSize, "id ASC")
}

// ListAllByBlogID returns all comments under a blog with optional state filtering.
func (r *CommentRepository) ListAllByBlogID(ctx context.Context, blogID uint, state *int) ([]database.Comment, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("comment repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Comment{}).Where("blog_id = ?", blogID)
	if state != nil {
		query = query.Where("state = ?", *state)
	} else {
		query = query.Where("state = ?", database.CommentStateNormal)
	}
	var items []database.Comment
	if err := query.Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// UpdateByID updates a comment after applying author/admin ownership checks.
func (r *CommentRepository) UpdateByID(ctx context.Context, in UpdateCommentInput) (*database.Comment, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("comment repository not initialized")
	}

	var comment database.Comment
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&comment).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCommentNotFound
			}
			return err
		}

		if in.Role != authpkg.RoleAdmin && comment.UserID != in.RequesterID {
			return ErrCommentForbidden
		}
		if comment.State == database.CommentStateDeleted {
			return ErrCommentNotFound
		}

		updates := map[string]interface{}{
			"content":    strings.TrimSpace(in.Content),
			"updated_at": time.Now(),
		}
		if err := tx.Model(&database.Comment{}).Where("id = ?", comment.ID).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", comment.ID).First(&comment).Error
	})
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

// DeleteByID soft-deletes one comment after applying author/admin ownership checks.
func (r *CommentRepository) DeleteByID(ctx context.Context, id uint, requesterID uint, role string) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("comment repository not initialized")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var comment database.Comment
		if err := tx.Where("id = ?", id).First(&comment).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCommentNotFound
			}
			return err
		}

		if role != authpkg.RoleAdmin && comment.UserID != requesterID {
			return ErrCommentForbidden
		}

		now := time.Now()
		updates := map[string]interface{}{
			"state":      database.CommentStateDeleted,
			"content":    "",
			"updated_at": now,
		}
		if err := tx.Model(&database.Comment{}).Where("id = ?", comment.ID).Updates(updates).Error; err != nil {
			return err
		}
		if comment.State == database.CommentStateNormal {
			if err := tx.Model(&database.Blog{}).
				Where("id = ? AND comment_count > 0", comment.BlogID).
				Update("comment_count", gorm.Expr("comment_count - ?", 1)).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&database.Comment{}, comment.ID).Error; err != nil {
			return err
		}
		return nil
	})
}

// UpdateStateByID updates one comment's moderation state and keeps blog comment counts in sync.
func (r *CommentRepository) UpdateStateByID(ctx context.Context, in UpdateCommentStateInput) (*database.Comment, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("comment repository not initialized")
	}

	var comment database.Comment
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&comment).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCommentNotFound
			}
			return err
		}

		now := time.Now()
		updates := map[string]interface{}{
			"state":      in.State,
			"updated_at": now,
		}
		if in.State == database.CommentStateDeleted {
			updates["content"] = ""
		}

		if comment.State == database.CommentStateNormal && in.State != database.CommentStateNormal {
			if err := tx.Model(&database.Blog{}).
				Where("id = ? AND comment_count > 0", comment.BlogID).
				Update("comment_count", gorm.Expr("comment_count - ?", 1)).Error; err != nil {
				return err
			}
		}
		if comment.State != database.CommentStateNormal && in.State == database.CommentStateNormal {
			if err := tx.Model(&database.Blog{}).
				Where("id = ?", comment.BlogID).
				Update("comment_count", gorm.Expr("comment_count + ?", 1)).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&database.Comment{}).Where("id = ?", comment.ID).Updates(updates).Error; err != nil {
			return err
		}
		if in.State == database.CommentStateDeleted {
			if err := tx.Delete(&database.Comment{}, comment.ID).Error; err != nil {
				return err
			}
			comment.State = database.CommentStateDeleted
			comment.Content = ""
			comment.UpdatedAt = now
			return nil
		}
		return tx.Where("id = ?", comment.ID).First(&comment).Error
	})
	if err != nil {
		return nil, err
	}
	return &comment, nil
}
