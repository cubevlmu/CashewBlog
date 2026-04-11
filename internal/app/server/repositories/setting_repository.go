package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"CashewBlog/internal/pkg/database"
)

var ErrSettingNotFound = errors.New("setting not found")

type SettingRepository struct {
	db *gorm.DB

	mu    sync.RWMutex
	cache map[string]database.Setting
	loaded bool
}

type UpsertSettingInput struct {
	Key         string
	Value       string
	Type        int
	Group       string
	Description string
}

// NewSettingRepository builds a settings repository with a key-value row cache.
func NewSettingRepository(db *gorm.DB) *SettingRepository {
	if db == nil {
		return nil
	}
	return &SettingRepository{db: db, cache: map[string]database.Setting{}}
}

// List returns paginated settings with optional key and group filters.
func (r *SettingRepository) List(ctx context.Context, filter SettingListFilter) ([]database.Setting, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, fmt.Errorf("setting repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Setting{})
	if filter.Key != "" {
		query = query.Where("`key` LIKE ?", filter.Key)
	}
	if filter.Group != "" {
		query = query.Where("group_name = ?", filter.Group)
	}
	return paginateQuery[database.Setting](query, filter.Page, filter.PageSize, "id DESC")
}

// ListPublic returns settings currently exposed to public reads.
func (r *SettingRepository) ListPublic(ctx context.Context) ([]database.Setting, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("setting repository not initialized")
	}

	items, err := r.cachedSettings(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]database.Setting, 0, len(items))
	for _, item := range items {
		if item.Group == "public" {
			result = append(result, item)
		}
	}
	return result, nil
}

// GetByKey loads one setting by key, using the repository key-value cache first.
func (r *SettingRepository) GetByKey(ctx context.Context, key string) (*database.Setting, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("setting repository not initialized")
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return nil, nil
	}
	items, err := r.cachedSettings(ctx)
	if err != nil {
		return nil, err
	}
	if item, ok := items[key]; ok {
		return &item, nil
	}
	return nil, nil
}

// UpdateValues updates existing setting values by key and fails when any key is missing.
func (r *SettingRepository) UpdateValues(ctx context.Context, values map[string]string) (int, error) {
	if r == nil || r.db == nil {
		return 0, fmt.Errorf("setting repository not initialized")
	}
	if len(values) == 0 {
		return 0, nil
	}

	updated := 0
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for key, value := range values {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			result := tx.Model(&database.Setting{}).Where("`key` = ?", key).Updates(map[string]interface{}{
				"value":      value,
				"updated_at": now,
			})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrSettingNotFound
			}
			updated++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	r.invalidateCache()
	return updated, nil
}

// UpsertByKey creates or updates one setting and refreshes the cached row.
func (r *SettingRepository) UpsertByKey(ctx context.Context, in UpsertSettingInput) (*database.Setting, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("setting repository not initialized")
	}

	key := strings.TrimSpace(in.Key)
	if key == "" {
		return nil, ErrSettingNotFound
	}
	var item database.Setting
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		err := tx.Where("`key` = ?", key).First(&item).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settingType := in.Type
			if settingType == 0 {
				settingType = database.SettingTypeString
			}
			group := strings.TrimSpace(in.Group)
			if group == "" {
				group = settingGroupFromKey(key)
			}
			item = database.Setting{
				Key:         key,
				Value:       in.Value,
				Type:        settingType,
				Group:       group,
				Description: strings.TrimSpace(in.Description),
				UpdatedAt:   now,
			}
			return tx.Create(&item).Error
		}

		settingType := in.Type
		if settingType == 0 {
			settingType = item.Type
		}
		group := strings.TrimSpace(in.Group)
		if group == "" {
			group = item.Group
		}
		updates := map[string]interface{}{
			"value":      in.Value,
			"type":       settingType,
			"group_name": group,
			"updated_at": now,
		}
		if strings.TrimSpace(in.Description) != "" {
			updates["description"] = strings.TrimSpace(in.Description)
		}
		if err := tx.Model(&database.Setting{}).Where("id = ?", item.ID).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", item.ID).First(&item).Error
	})
	if err != nil {
		return nil, err
	}
	r.putCache(item)
	return &item, nil
}

// DeleteByKey deletes one setting and removes it from the repository cache.
func (r *SettingRepository) DeleteByKey(ctx context.Context, key string) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("setting repository not initialized")
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return ErrSettingNotFound
	}
	result := r.db.WithContext(ctx).Where("`key` = ?", key).Delete(&database.Setting{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSettingNotFound
	}
	r.deleteCache(key)
	return nil
}

func (r *SettingRepository) cachedSettings(ctx context.Context) (map[string]database.Setting, error) {
	r.mu.RLock()
	if r.loaded {
		result := cloneSettingCache(r.cache)
		r.mu.RUnlock()
		return result, nil
	}
	r.mu.RUnlock()

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.loaded {
		return cloneSettingCache(r.cache), nil
	}

	var items []database.Setting
	if err := r.db.WithContext(ctx).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	r.cache = make(map[string]database.Setting, len(items))
	for _, item := range items {
		r.cache[item.Key] = item
	}
	r.loaded = true
	return cloneSettingCache(r.cache), nil
}

func (r *SettingRepository) putCache(item database.Setting) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cache[item.Key] = item
}

func (r *SettingRepository) deleteCache(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cache, key)
}

func (r *SettingRepository) invalidateCache() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cache = map[string]database.Setting{}
	r.loaded = false
}

func cloneSettingCache(items map[string]database.Setting) map[string]database.Setting {
	result := make(map[string]database.Setting, len(items))
	for key, item := range items {
		result[key] = item
	}
	return result
}

func settingGroupFromKey(key string) string {
	if idx := strings.IndexByte(key, '.'); idx > 0 {
		return key[:idx]
	}
	return "public"
}
