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
	ErrCategoryNotFound   = errors.New("category not found")
	ErrCategoryConflict   = errors.New("category conflict")
	ErrInvalidCategoryRef = errors.New("invalid category reference")
)

type CategoryRepository struct {
	db            *gorm.DB
	articleCounts *articleCountCache
}

type CreateCategoryInput struct {
	Name     string
	Slug     string
	ParentID *uint
	Desc     string
}

type UpdateCategoryInput struct {
	ID       uint
	Name     string
	Slug     string
	ParentID *uint
	Desc     string
}

func NewCategoryRepository(db *gorm.DB) *CategoryRepository {
	if db == nil {
		return nil
	}
	repo := &CategoryRepository{db: db, articleCounts: newArticleCountCache()}
	_ = repo.RefreshArticleCounts(context.Background())
	return repo
}

// ArticleCount returns the cached public article count for one category.
func (r *CategoryRepository) ArticleCount(id uint) int64 {
	if r == nil || r.articleCounts == nil {
		return 0
	}
	return r.articleCounts.Get(id)
}

// RefreshArticleCounts rebuilds the cached public article counts grouped by category.
func (r *CategoryRepository) RefreshArticleCounts(ctx context.Context) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("category repository not initialized")
	}
	type row struct {
		ID    uint
		Count int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).
		Model(&database.Blog{}).
		Select("category AS id, COUNT(*) AS count").
		Where("state = ? AND category IS NOT NULL", database.BlogStatePublic).
		Group("category").
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

// GetByID loads one category by primary key.
func (r *CategoryRepository) GetByID(ctx context.Context, id uint) (*database.Category, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("category repository not initialized")
	}

	var item database.Category
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// Create inserts one category after validating its optional parent.
func (r *CategoryRepository) Create(ctx context.Context, in CreateCategoryInput) (*database.Category, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("category repository not initialized")
	}

	parentID := normalizeCategoryParent(in.ParentID)
	category := &database.Category{
		Name:      strings.TrimSpace(in.Name),
		Slug:      strings.TrimSpace(in.Slug),
		Parent:    parentID,
		Desc:      strings.TrimSpace(in.Desc),
		CreatedAt: time.Now(),
	}

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := validateCategoryParent(tx, 0, parentID); err != nil {
			return err
		}
		if err := tx.Create(category).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrCategoryConflict
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if err := r.RefreshArticleCounts(ctx); err != nil {
		return nil, err
	}
	return category, nil
}

// UpdateByID updates one category's editable fields after validating its optional parent.
func (r *CategoryRepository) UpdateByID(ctx context.Context, in UpdateCategoryInput) (*database.Category, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("category repository not initialized")
	}

	parentID := normalizeCategoryParent(in.ParentID)
	var category database.Category
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&category).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCategoryNotFound
			}
			return err
		}
		if err := validateCategoryParent(tx, category.ID, parentID); err != nil {
			return err
		}

		updates := map[string]interface{}{
			"name":   strings.TrimSpace(in.Name),
			"slug":   strings.TrimSpace(in.Slug),
			"parent": parentID,
			"desc":   strings.TrimSpace(in.Desc),
		}
		if err := tx.Model(&database.Category{}).Where("id = ?", category.ID).Updates(updates).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrCategoryConflict
			}
			return err
		}
		return tx.Where("id = ?", category.ID).First(&category).Error
	})
	if err != nil {
		return nil, err
	}
	if err := r.RefreshArticleCounts(ctx); err != nil {
		return nil, err
	}
	return &category, nil
}

// DeleteByID deletes one category and reassigns affected blogs to the default category.
func (r *CategoryRepository) DeleteByID(ctx context.Context, id uint) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("category repository not initialized")
	}

	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var category database.Category
		if err := tx.Where("id = ?", id).First(&category).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCategoryNotFound
			}
			return err
		}

		fallbackID, err := ensureFallbackCategory(tx, category.ID)
		if err != nil {
			return err
		}
		var fallbackValue interface{}
		if fallbackID != nil {
			fallbackValue = *fallbackID
		}
		if err := tx.Model(&database.Blog{}).Where("category = ?", category.ID).Updates(map[string]interface{}{"category": fallbackValue}).Error; err != nil {
			return err
		}
		if err := tx.Model(&database.Category{}).Where("parent = ?", category.ID).Updates(map[string]interface{}{"parent": nil}).Error; err != nil {
			return err
		}
		return tx.Delete(&database.Category{}, category.ID).Error
	}); err != nil {
		return err
	}
	return r.RefreshArticleCounts(ctx)
}

func normalizeCategoryParent(parentID *uint) *uint {
	if parentID == nil || *parentID == 0 {
		return nil
	}
	return parentID
}

func validateCategoryParent(tx *gorm.DB, categoryID uint, parentID *uint) error {
	if parentID == nil {
		return nil
	}
	if categoryID != 0 && *parentID == categoryID {
		return ErrInvalidCategoryRef
	}

	currentID := *parentID
	seen := map[uint]struct{}{}
	for currentID != 0 {
		if _, ok := seen[currentID]; ok {
			return ErrInvalidCategoryRef
		}
		seen[currentID] = struct{}{}
		if categoryID != 0 && currentID == categoryID {
			return ErrInvalidCategoryRef
		}

		var parent database.Category
		if err := tx.Select("id", "parent").Where("id = ?", currentID).First(&parent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvalidCategoryRef
			}
			return err
		}
		if parent.Parent == nil {
			break
		}
		currentID = *parent.Parent
	}
	return nil
}

func ensureFallbackCategory(tx *gorm.DB, deletingID uint) (*uint, error) {
	var category database.Category
	err := tx.Where("slug = ? OR name = ?", "uncategorized", "Uncategorized").First(&category).Error
	if err == nil {
		if category.ID == deletingID {
			return nil, nil
		}
		return &category.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	category = database.Category{
		Name:      "Uncategorized",
		Slug:      "uncategorized",
		Desc:      "Uncategorized posts",
		CreatedAt: now,
	}
	if err := tx.Create(&category).Error; err != nil {
		if isUniqueConstraintError(err) {
			var loaded database.Category
			if loadErr := tx.Where("(slug = ? OR name = ?) AND id <> ?", "uncategorized", "Uncategorized", deletingID).First(&loaded).Error; loadErr != nil {
				return nil, loadErr
			}
			return &loaded.ID, nil
		}
		return nil, err
	}
	return &category.ID, nil
}
