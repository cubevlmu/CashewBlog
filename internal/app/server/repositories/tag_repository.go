package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"CashewBlog/internal/pkg/database"
)

var (
	ErrTagNotFound = errors.New("tag not found")
	ErrTagConflict = errors.New("tag conflict")
)

type TagRepository struct {
	db            *gorm.DB
	articleCounts *articleCountCache
}

type CreateTagInput struct {
	Name  string
	Slug  string
	Desc  string
	Color string
}

type UpdateTagInput struct {
	ID    uint
	Name  string
	Slug  string
	Desc  string
	Color string
}

func NewTagRepository(db *gorm.DB) *TagRepository {
	if db == nil {
		return nil
	}
	repo := &TagRepository{db: db, articleCounts: newArticleCountCache()}
	_ = repo.RefreshArticleCounts(context.Background())
	return repo
}

// ArticleCount returns the cached public article count for one tag.
func (r *TagRepository) ArticleCount(id uint) int64 {
	if r == nil || r.articleCounts == nil {
		return 0
	}
	return r.articleCounts.Get(id)
}

// RefreshArticleCounts rebuilds the cached public article counts grouped by tag.
func (r *TagRepository) RefreshArticleCounts(ctx context.Context) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("tag repository not initialized")
	}
	type row struct {
		ID    uint
		Count int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).
		Table("blog_tags").
		Select("blog_tags.tag_id AS id, COUNT(DISTINCT blogs.id) AS count").
		Joins("JOIN blogs ON blogs.id = blog_tags.blog_id").
		Where("blogs.state = ? AND blogs.deleted_at IS NULL", database.BlogStatePublic).
		Group("blog_tags.tag_id").
		Scan(&rows).Error; err != nil {
		return err
	}
	counts := make(map[uint]int64, len(rows))
	for _, item := range rows {
		counts[item.ID] = item.Count
	}
	r.articleCounts.SetAll(counts)
	return nil
}

// Create inserts one tag with editable tag fields.
func (r *TagRepository) Create(ctx context.Context, in CreateTagInput) (*database.Tag, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("tag repository not initialized")
	}

	tag := &database.Tag{
		Name:      strings.TrimSpace(in.Name),
		Slug:      strings.TrimSpace(in.Slug),
		Desc:      strings.TrimSpace(in.Desc),
		Color:     strings.TrimSpace(in.Color),
		CreatedAt: time.Now(),
	}
	if err := r.db.WithContext(ctx).Create(tag).Error; err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrTagConflict
		}
		return nil, err
	}
	if err := r.RefreshArticleCounts(ctx); err != nil {
		return nil, err
	}
	return tag, nil
}

// UpdateByID updates one tag's editable fields.
func (r *TagRepository) UpdateByID(ctx context.Context, in UpdateTagInput) (*database.Tag, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("tag repository not initialized")
	}

	var tag database.Tag
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&tag).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTagNotFound
			}
			return err
		}

		updates := map[string]interface{}{
			"name":  strings.TrimSpace(in.Name),
			"slug":  strings.TrimSpace(in.Slug),
			"desc":  strings.TrimSpace(in.Desc),
			"color": strings.TrimSpace(in.Color),
		}
		if err := tx.Model(&database.Tag{}).Where("id = ?", tag.ID).Updates(updates).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrTagConflict
			}
			return err
		}
		return tx.Where("id = ?", tag.ID).First(&tag).Error
	})
	if err != nil {
		return nil, err
	}
	if err := r.RefreshArticleCounts(ctx); err != nil {
		return nil, err
	}
	return &tag, nil
}

// DeleteByID deletes one tag and removes its blog-tag relations.
func (r *TagRepository) DeleteByID(ctx context.Context, id uint) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("tag repository not initialized")
	}

	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var tag database.Tag
		if err := tx.Where("id = ?", id).First(&tag).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTagNotFound
			}
			return err
		}
		if err := tx.Where("tag_id = ?", tag.ID).Delete(&database.BlogTag{}).Error; err != nil {
			return err
		}
		return tx.Delete(&database.Tag{}, tag.ID).Error
	}); err != nil {
		return err
	}
	return r.RefreshArticleCounts(ctx)
}
