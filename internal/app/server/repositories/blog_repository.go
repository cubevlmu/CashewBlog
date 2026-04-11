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
	ErrBlogNotFound  = errors.New("blog not found")
	ErrBlogForbidden = errors.New("forbidden")
	ErrBlogConflict  = errors.New("blog conflict")
	ErrInvalidBlogRef = errors.New("invalid blog reference")
)

type BlogRepository struct {
	db *gorm.DB
}

// BlogListFilter describes supported blog-list query conditions.
type BlogListFilter struct {
	Page       int
	PageSize   int
	State      *int
	AuthorID   *uint
	TagID      *uint
	CategoryID *uint
	Keyword    string
	Sort       string
}

type CreateBlogInput struct {
	AuthorID         uint
	Title            string
	Slug             string
	Summary          string
	ContentMarkdown  string
	TitleImageID     *uint
	CategoryID       *uint
	TagIDs           []uint
	AllowComment     bool
	IsTop            bool
	State            int
}

type UpdateBlogInput struct {
	ID              uint
	RequesterID     uint
	Role            string
	Title           string
	Slug            string
	Summary         string
	ContentMarkdown string
	TitleImageID    *uint
	CategoryID      *uint
	TagIDs          []uint
	AllowComment    bool
	IsTop           bool
	State           int
}

type UpdateBlogStateInput struct {
	ID          uint
	RequesterID uint
	Role        string
	State       int
}

func NewBlogRepository(db *gorm.DB) *BlogRepository {
	if db == nil {
		return nil
	}
	return &BlogRepository{db: db}
}

// GetByID loads one blog by primary key and optionally constrains visible states.
func (r *BlogRepository) GetByID(ctx context.Context, id uint, allowedStates []int) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Blog{}).Where("id = ?", id)
	if len(allowedStates) > 0 {
		query = query.Where("state IN ?", allowedStates)
	}
	var item database.Blog
	if err := query.First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetBySlug loads one blog by slug and optionally constrains visible states.
func (r *BlogRepository) GetBySlug(ctx context.Context, slug string, allowedStates []int) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Blog{}).Where("slug = ?", slug)
	if len(allowedStates) > 0 {
		query = query.Where("state IN ?", allowedStates)
	}
	var item database.Blog
	if err := query.First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetByIDAndAuthor loads one blog owned by a specific author.
func (r *BlogRepository) GetByIDAndAuthor(ctx context.Context, id uint, authorID uint) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	var item database.Blog
	if err := r.db.WithContext(ctx).Where("id = ? AND author = ?", id, authorID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// Create inserts one blog and its tag relations after validating referenced rows.
func (r *BlogRepository) Create(ctx context.Context, in CreateBlogInput) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	now := time.Now()
	blog := &database.Blog{
		State:           in.State,
		Title:           strings.TrimSpace(in.Title),
		Slug:            strings.TrimSpace(in.Slug),
		Summary:         strings.TrimSpace(in.Summary),
		ContentMarkdown: in.ContentMarkdown,
		Author:          in.AuthorID,
		TitleImage:      in.TitleImageID,
		Category:        in.CategoryID,
		AllowComment:    in.AllowComment,
		IsTop:           in.IsTop,
		ViewCount:       0,
		LikeCount:       0,
		CommentCount:    0,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if in.State == database.BlogStatePublic {
		blog.PublishedAt = &now
	}

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tagIDs := uniqueUint(in.TagIDs)
		if err := validateBlogRefs(tx, in.TitleImageID, in.CategoryID, tagIDs); err != nil {
			return err
		}

		if err := tx.Create(blog).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrBlogConflict
			}
			return err
		}

		for _, tagID := range tagIDs {
			if err := tx.Create(&database.BlogTag{BlogID: blog.ID, TagID: tagID}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return blog, nil
}

// UpdateByID updates one blog after applying author/admin ownership checks.
func (r *BlogRepository) UpdateByID(ctx context.Context, in UpdateBlogInput) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	var blog database.Blog
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&blog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBlogNotFound
			}
			return err
		}
		if blog.State == database.BlogStateDeleted {
			return ErrBlogNotFound
		}
		if in.Role != authpkg.RoleAdmin && blog.Author != in.RequesterID {
			return ErrBlogForbidden
		}

		if err := validateBlogRefs(tx, in.TitleImageID, in.CategoryID, in.TagIDs); err != nil {
			return err
		}

		now := time.Now()
		isTop := blog.IsTop
		if in.Role == authpkg.RoleAdmin {
			isTop = in.IsTop
		}

		var publishedAt *time.Time
		if in.State == database.BlogStatePublic {
			if blog.PublishedAt != nil {
				publishedAt = blog.PublishedAt
			} else {
				publishedAt = &now
			}
		}

		updates := map[string]interface{}{
			"state":            in.State,
			"title":            strings.TrimSpace(in.Title),
			"slug":             strings.TrimSpace(in.Slug),
			"summary":          strings.TrimSpace(in.Summary),
			"content_markdown": in.ContentMarkdown,
			"title_image":      in.TitleImageID,
			"category":         in.CategoryID,
			"allow_comment":    in.AllowComment,
			"is_top":           isTop,
			"published_at":     publishedAt,
			"updated_at":       now,
		}
		if err := tx.Model(&database.Blog{}).Where("id = ?", blog.ID).Updates(updates).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrBlogConflict
			}
			return err
		}
		if err := tx.Where("blog_id = ?", blog.ID).Delete(&database.BlogTag{}).Error; err != nil {
			return err
		}
		for _, tagID := range uniqueUint(in.TagIDs) {
			if err := tx.Create(&database.BlogTag{BlogID: blog.ID, TagID: tagID}).Error; err != nil {
				return err
			}
		}
		return tx.Where("id = ?", blog.ID).First(&blog).Error
	})
	if err != nil {
		return nil, err
	}
	return &blog, nil
}

// UpdateStateByID updates one blog's state after applying author/admin ownership checks.
func (r *BlogRepository) UpdateStateByID(ctx context.Context, in UpdateBlogStateInput) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	var blog database.Blog
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&blog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBlogNotFound
			}
			return err
		}
		if blog.State == database.BlogStateDeleted {
			return ErrBlogNotFound
		}
		if in.Role != authpkg.RoleAdmin && blog.Author != in.RequesterID {
			return ErrBlogForbidden
		}

		now := time.Now()
		var publishedAt *time.Time
		if in.State == database.BlogStatePublic {
			if blog.PublishedAt != nil {
				publishedAt = blog.PublishedAt
			} else {
				publishedAt = &now
			}
		}

		updates := map[string]interface{}{
			"state":        in.State,
			"published_at": publishedAt,
			"updated_at":   now,
		}
		if err := tx.Model(&database.Blog{}).Where("id = ?", blog.ID).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", blog.ID).First(&blog).Error
	})
	if err != nil {
		return nil, err
	}
	return &blog, nil
}

// RestoreByID restores a soft-deleted blog row and moves it back to draft.
func (r *BlogRepository) RestoreByID(ctx context.Context, id uint) (*database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	var blog database.Blog
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("id = ?", id).First(&blog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBlogNotFound
			}
			return err
		}

		now := time.Now()
		updates := map[string]interface{}{
			"state":        database.BlogStateDraft,
			"published_at": nil,
			"deleted_at":   nil,
			"updated_at":   now,
		}
		if err := tx.Unscoped().Model(&database.Blog{}).Where("id = ?", blog.ID).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", blog.ID).First(&blog).Error
	})
	if err != nil {
		return nil, err
	}
	return &blog, nil
}

// List returns paginated blogs with optional state, ownership, relation, keyword, and sort filters.
func (r *BlogRepository) List(ctx context.Context, filter BlogListFilter) ([]database.Blog, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, fmt.Errorf("blog repository not initialized")
	}

	base := r.db.WithContext(ctx).Model(&database.Blog{})
	if filter.State != nil {
		base = base.Where("state = ?", *filter.State)
	}
	if filter.AuthorID != nil {
		base = base.Where("author = ?", *filter.AuthorID)
	}
	if filter.CategoryID != nil {
		base = base.Where("category = ?", *filter.CategoryID)
	}
	if filter.Keyword != "" {
		base = base.Where("title LIKE ? OR summary LIKE ? OR content_markdown LIKE ?", filter.Keyword, filter.Keyword, filter.Keyword)
	}
	if filter.TagID != nil {
		base = base.Joins("JOIN blog_tags ON blog_tags.blog_id = blogs.id").Where("blog_tags.tag_id = ?", *filter.TagID)
	}
	return paginateQueryWithOrder[database.Blog](base, filter.Page, filter.PageSize, func(query *gorm.DB) *gorm.DB {
		return applyBlogSort(query, filter.Sort)
	})
}

// ListRecent returns the newest blogs for dashboard-style views.
func (r *BlogRepository) ListRecent(ctx context.Context, limit int) ([]database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("blog repository not initialized")
	}

	var items []database.Blog
	if err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// GetAdjacentPublic returns the nearest public blogs around the current blog.
func (r *BlogRepository) GetAdjacentPublic(ctx context.Context, blog database.Blog) (*database.Blog, *database.Blog, error) {
	if r == nil || r.db == nil {
		return nil, nil, fmt.Errorf("blog repository not initialized")
	}

	baseTime := blog.CreatedAt
	if blog.PublishedAt != nil {
		baseTime = *blog.PublishedAt
	}

	baseQuery := r.db.WithContext(ctx).Model(&database.Blog{}).
		Where("state = ?", database.BlogStatePublic).
		Where("id <> ?", blog.ID)

	var prev database.Blog
	prevQuery := baseQuery.Session(&gorm.Session{}).
		Where("(published_at IS NOT NULL AND published_at < ?) OR (published_at IS NULL AND created_at < ?)", baseTime, baseTime).
		Order("COALESCE(published_at, created_at) DESC")
	prevFound := true
	if err := prevQuery.First(&prev).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			prevFound = false
		} else {
			return nil, nil, err
		}
	}

	var next database.Blog
	nextQuery := baseQuery.Session(&gorm.Session{}).
		Where("(published_at IS NOT NULL AND published_at > ?) OR (published_at IS NULL AND created_at > ?)", baseTime, baseTime).
		Order("COALESCE(published_at, created_at) ASC")
	nextFound := true
	if err := nextQuery.First(&next).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			nextFound = false
		} else {
			return nil, nil, err
		}
	}

	var prevPtr *database.Blog
	var nextPtr *database.Blog
	if prevFound {
		prevPtr = &prev
	}
	if nextFound {
		nextPtr = &next
	}
	return prevPtr, nextPtr, nil
}

// DeleteByID soft-deletes one blog after applying author/admin ownership checks.
func (r *BlogRepository) DeleteByID(ctx context.Context, id uint, requesterID uint, role string) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("blog repository not initialized")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var blog database.Blog
		if err := tx.Where("id = ?", id).First(&blog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBlogNotFound
			}
			return err
		}

		if role != authpkg.RoleAdmin && blog.Author != requesterID {
			return ErrBlogForbidden
		}

		now := time.Now()
		placeholderSlug := fmt.Sprintf("deleted-%d-%d", blog.ID, now.Unix())
		updates := map[string]interface{}{
			"state":            database.BlogStateDeleted,
			"title":            "",
			"slug":             placeholderSlug,
			"summary":          "",
			"content_markdown": "",
			"title_image":      nil,
			"category":         nil,
			"allow_comment":    false,
			"is_top":           false,
			"view_count":       0,
			"like_count":       0,
			"comment_count":    0,
			"published_at":     nil,
			"updated_at":       now,
		}
		if err := tx.Model(&database.Blog{}).Where("id = ?", blog.ID).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Where("blog_id = ?", blog.ID).Delete(&database.BlogTag{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&database.Blog{}, blog.ID).Error; err != nil {
			return err
		}
		return nil
	})
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique constraint") || strings.Contains(msg, "duplicate entry") || strings.Contains(msg, "duplicated key")
}

func validateBlogRefs(tx *gorm.DB, titleImageID *uint, categoryID *uint, tagIDs []uint) error {
	if titleImageID != nil {
		var count int64
		if err := tx.Model(&database.Asset{}).Where("id = ?", *titleImageID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrInvalidBlogRef
		}
	}
	if categoryID != nil {
		var count int64
		if err := tx.Model(&database.Category{}).Where("id = ?", *categoryID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrInvalidBlogRef
		}
	}

	tagIDs = uniqueUint(tagIDs)
	if len(tagIDs) > 0 {
		var count int64
		if err := tx.Model(&database.Tag{}).Where("id IN ?", tagIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(tagIDs)) {
			return ErrInvalidBlogRef
		}
	}
	return nil
}

// applyBlogSort maps the external sort token to a safe database order clause.
func applyBlogSort(db *gorm.DB, sort string) *gorm.DB {
	raw := strings.TrimSpace(sort)
	if raw == "" {
		return db.Order("created_at DESC")
	}
	if raw == "home" {
		return db.Order("is_top DESC").Order("COALESCE(published_at, created_at) DESC").Order("id DESC")
	}
	desc := strings.HasPrefix(raw, "-")
	field := strings.TrimPrefix(raw, "-")
	direction := "ASC"
	if desc {
		direction = "DESC"
	}
	switch field {
	case "created_at", "updated_at", "published_at", "view_count", "like_count":
		return db.Order(field + " " + direction)
	default:
		return db.Order("created_at DESC")
	}
}
