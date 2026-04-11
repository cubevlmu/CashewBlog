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
	db *gorm.DB
}

type CreateTagInput struct {
	Name  string
	Slug  string
	Color string
}

type UpdateTagInput struct {
	ID    uint
	Name  string
	Slug  string
	Color string
}

func NewTagRepository(db *gorm.DB) *TagRepository {
	if db == nil {
		return nil
	}
	return &TagRepository{db: db}
}

// Create inserts one tag with editable tag fields.
func (r *TagRepository) Create(ctx context.Context, in CreateTagInput) (*database.Tag, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("tag repository not initialized")
	}

	tag := &database.Tag{
		Name:      strings.TrimSpace(in.Name),
		Slug:      strings.TrimSpace(in.Slug),
		Color:     strings.TrimSpace(in.Color),
		CreatedAt: time.Now(),
	}
	if err := r.db.WithContext(ctx).Create(tag).Error; err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrTagConflict
		}
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
	return &tag, nil
}

// DeleteByID deletes one tag and removes its blog-tag relations.
func (r *TagRepository) DeleteByID(ctx context.Context, id uint) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("tag repository not initialized")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
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
	})
}
