package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"CashewBlog/internal/pkg/database"
)

type ReadRepository struct {
	db *gorm.DB
}

// TagListFilter describes supported tag-list query conditions.
type TagListFilter struct {
	Page     int
	PageSize int
	Keyword  string
}

// CategoryListFilter describes supported category-list query conditions.
type CategoryListFilter struct {
	Page     int
	PageSize int
	Keyword  string
}

// SettingListFilter describes supported setting-list query conditions.
type SettingListFilter struct {
	Page     int
	PageSize int
	Key      string
	Group    string
}

// AuditLogListFilter describes supported audit-log query conditions.
type AuditLogListFilter struct {
	Page       int
	PageSize   int
	UserID     *uint
	Action     string
	TargetType string
}

// NewReadRepository builds the read-only repository used by query-oriented services.
func NewReadRepository(db *gorm.DB) *ReadRepository {
	if db == nil {
		return nil
	}
	return &ReadRepository{db: db}
}

// DB exposes the underlying gorm handle for rare integration cases.
func (r *ReadRepository) DB() *gorm.DB {
	if r == nil {
		return nil
	}
	return r.db
}

// ListTags returns paginated tags with optional keyword filtering.
func (r *ReadRepository) ListTags(ctx context.Context, filter TagListFilter) ([]database.Tag, int64, error) {
	query := r.db.WithContext(ctx).Model(&database.Tag{})
	if filter.Keyword != "" {
		query = query.Where("name LIKE ? OR slug LIKE ?", filter.Keyword, filter.Keyword)
	}
	return paginateQuery[database.Tag](query, filter.Page, filter.PageSize, "id DESC")
}

// GetTagByID loads one tag by primary key.
func (r *ReadRepository) GetTagByID(ctx context.Context, id uint) (*database.Tag, error) {
	var item database.Tag
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetTagBySlug loads one tag by unique slug.
func (r *ReadRepository) GetTagBySlug(ctx context.Context, slug string) (*database.Tag, error) {
	var item database.Tag
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// ListCategories returns paginated categories with optional keyword filtering.
func (r *ReadRepository) ListCategories(ctx context.Context, filter CategoryListFilter) ([]database.Category, int64, error) {
	query := r.db.WithContext(ctx).Model(&database.Category{})
	if filter.Keyword != "" {
		query = query.Where("name LIKE ? OR slug LIKE ? OR `desc` LIKE ?", filter.Keyword, filter.Keyword, filter.Keyword)
	}
	return paginateQuery[database.Category](query, filter.Page, filter.PageSize, "id DESC")
}

// GetCategoryByID loads one category by primary key.
func (r *ReadRepository) GetCategoryByID(ctx context.Context, id uint) (*database.Category, error) {
	var item database.Category
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetCategoryBySlug loads one category by unique slug.
func (r *ReadRepository) GetCategoryBySlug(ctx context.Context, slug string) (*database.Category, error) {
	var item database.Category
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// ListSettings returns paginated settings with optional key and group filters.
func (r *ReadRepository) ListSettings(ctx context.Context, filter SettingListFilter) ([]database.Setting, int64, error) {
	query := r.db.WithContext(ctx).Model(&database.Setting{})
	if filter.Key != "" {
		query = query.Where("`key` LIKE ?", filter.Key)
	}
	if filter.Group != "" {
		query = query.Where("group_name = ?", filter.Group)
	}
	return paginateQuery[database.Setting](query, filter.Page, filter.PageSize, "id DESC")
}

// ListPublicSettings returns settings currently exposed to public reads.
func (r *ReadRepository) ListPublicSettings(ctx context.Context) ([]database.Setting, error) {
	var items []database.Setting
	if err := r.db.WithContext(ctx).Where("group_name = ?", "public").Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// GetSettingByKey loads one setting by unique key.
func (r *ReadRepository) GetSettingByKey(ctx context.Context, key string) (*database.Setting, error) {
	var item database.Setting
	if err := r.db.WithContext(ctx).Where("`key` = ?", key).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// ListAuditLogs returns paginated audit logs with optional user/action/target filtering.
func (r *ReadRepository) ListAuditLogs(ctx context.Context, filter AuditLogListFilter) ([]database.AuditLog, int64, error) {
	query := r.db.WithContext(ctx).Model(&database.AuditLog{})
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.TargetType != "" {
		query = query.Where("target_type = ?", filter.TargetType)
	}
	return paginateQuery[database.AuditLog](query, filter.Page, filter.PageSize, "created_at DESC")
}

// LoadCategoriesByIDs batch-loads categories and returns them keyed by category id.
func (r *ReadRepository) LoadCategoriesByIDs(ctx context.Context, ids []uint) (map[uint]database.Category, error) {
	result := make(map[uint]database.Category, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var items []database.Category
	if err := r.db.WithContext(ctx).Where("id IN ?", uniqueUint(ids)).Find(&items).Error; err != nil {
		return nil, err
	}
	for _, item := range items {
		result[item.ID] = item
	}
	return result, nil
}

// LoadTagsByBlogIDs batch-loads blog-tag relations and groups tags by blog id.
func (r *ReadRepository) LoadTagsByBlogIDs(ctx context.Context, blogIDs []uint) (map[uint][]database.Tag, error) {
	result := make(map[uint][]database.Tag, len(blogIDs))
	if len(blogIDs) == 0 {
		return result, nil
	}
	type row struct {
		BlogID uint
		database.Tag
	}
	var rows []row
	if err := r.db.WithContext(ctx).
		Table("blog_tags").
		Select("blog_tags.blog_id, tags.id, tags.name, tags.slug, tags.color, tags.created_at").
		Joins("JOIN tags ON tags.id = blog_tags.tag_id").
		Where("blog_tags.blog_id IN ?", uniqueUint(blogIDs)).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, item := range rows {
		result[item.BlogID] = append(result[item.BlogID], item.Tag)
	}
	return result, nil
}

// CountAdminStats aggregates the dashboard counters needed by admin summary endpoints.
func (r *ReadRepository) CountAdminStats(ctx context.Context) (map[string]int64, error) {
	stats := map[string]int64{}
	counts := []struct {
		key   string
		model interface{}
		where func(*gorm.DB) *gorm.DB
	}{
		{"user_count", &database.User{}, nil},
		{"blog_count", &database.Blog{}, nil},
		{"public_blog_count", &database.Blog{}, func(db *gorm.DB) *gorm.DB { return db.Where("state = ?", database.BlogStatePublic) }},
		{"draft_blog_count", &database.Blog{}, func(db *gorm.DB) *gorm.DB { return db.Where("state = ?", database.BlogStateDraft) }},
		{"tag_count", &database.Tag{}, nil},
		{"category_count", &database.Category{}, nil},
		{"asset_count", &database.Asset{}, nil},
		{"comment_count", &database.Comment{}, nil},
	}
	for _, item := range counts {
		query := r.db.WithContext(ctx).Model(item.model)
		if item.where != nil {
			query = item.where(query)
		}
		var count int64
		if err := query.Count(&count).Error; err != nil {
			return nil, err
		}
		stats[item.key] = count
	}
	return stats, nil
}

// CountDashboardSummary aggregates the admin dashboard counters from database tables.
func (r *ReadRepository) CountDashboardSummary(ctx context.Context, today time.Time) (map[string]int64, error) {
	stats, err := r.CountAdminStats(ctx)
	if err != nil {
		return nil, err
	}

	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var todayComments int64
	if err := r.db.WithContext(ctx).Model(&database.Comment{}).
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Count(&todayComments).Error; err != nil {
		return nil, err
	}
	stats["today_comments"] = todayComments

	// The schema has no per-view event table yet, so today's views are approximated
	// from blogs updated today using their current cumulative view_count values.
	var todayViews int64
	type sumRow struct {
		Total int64
	}
	var row sumRow
	if err := r.db.WithContext(ctx).Model(&database.Blog{}).
		Select("COALESCE(SUM(view_count), 0) AS total").
		Where("updated_at >= ? AND updated_at < ?", startOfDay, endOfDay).
		Scan(&row).Error; err != nil {
		return nil, err
	}
	todayViews = row.Total
	stats["today_views"] = todayViews

	return stats, nil
}

// CountTrend returns daily counts for the last `days` days.
func (r *ReadRepository) CountTrend(ctx context.Context, model interface{}, dateColumn string, days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 7
	}
	startDate := time.Now().AddDate(0, 0, -(days - 1))
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())

	rows := make([]map[string]interface{}, 0, days)
	query := fmt.Sprintf("DATE(%s) AS date, COUNT(*) AS count", dateColumn)
	if err := r.db.WithContext(ctx).Model(model).
		Select(query).
		Where(dateColumn+" >= ?", startDate).
		Group("DATE(" + dateColumn + ")").
		Order("DATE(" + dateColumn + ") ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// ViewTrend returns a daily view-count proxy based on cumulative blog view_count.
func (r *ReadRepository) ViewTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 7
	}
	startDate := time.Now().AddDate(0, 0, -(days - 1))
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())

	rows := make([]map[string]interface{}, 0, days)
	if err := r.db.WithContext(ctx).Model(&database.Blog{}).
		Select("DATE(updated_at) AS date, COALESCE(SUM(view_count), 0) AS count").
		Where("updated_at >= ?", startDate).
		Group("DATE(updated_at)").
		Order("DATE(updated_at) ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// ListRecentAuditLogs returns the newest audit logs for dashboard-style views.
func (r *ReadRepository) ListRecentAuditLogs(ctx context.Context, limit int) ([]database.AuditLog, error) {
	var items []database.AuditLog
	if err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// paginateQuery executes the shared count + ordered page query flow for list endpoints.
func paginateQuery[T any](query *gorm.DB, page int, pageSize int, order string) ([]T, int64, error) {
	return paginateQueryWithOrder[T](query, page, pageSize, func(tx *gorm.DB) *gorm.DB {
		return tx.Order(order)
	})
}

// paginateQueryWithOrder executes the shared count + page query flow with caller-defined ordering.
func paginateQueryWithOrder[T any](query *gorm.DB, page int, pageSize int, applyOrder func(*gorm.DB) *gorm.DB) ([]T, int64, error) {
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	pageQuery := query.Session(&gorm.Session{})
	if applyOrder != nil {
		pageQuery = applyOrder(pageQuery)
	}

	var items []T
	if err := pageQuery.Offset((page-1)*pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// uniqueUint removes duplicate ids while preserving first-seen order.
func uniqueUint(values []uint) []uint {
	set := make(map[uint]struct{}, len(values))
	result := make([]uint, 0, len(values))
	for _, value := range values {
		if _, ok := set[value]; ok {
			continue
		}
		set[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
