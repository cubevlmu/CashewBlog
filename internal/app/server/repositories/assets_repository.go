package repositories

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	authpkg "CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/database"
	"CashewBlog/internal/pkg/utils/fsutil"

	"gorm.io/gorm"
)

var (
	ErrAssetNotFound   = errors.New("asset not found")
	ErrAssetForbidden  = errors.New("forbidden")
	ErrDuplicateUpload = errors.New("duplicate upload")
)

type AssetRepository struct {
	db        *gorm.DB
	uploadDir string
	maxBytes  int64

	mu         sync.Mutex
	cache      map[uint]assetCacheEntry
	cacheBytes int64
	lastGC     time.Time
}

type assetCacheEntry struct {
	Content    []byte
	AccessedAt time.Time
}

// AssetListFilter describes supported asset-list query conditions.
type AssetListFilter struct {
	Page       int
	PageSize   int
	Keyword    string
	Type       string
	State      *int
	UploaderID *uint
}

type UploadAssetInput struct {
	UploaderID       uint
	OriginalFileName string
	Data             []byte
	RestrictToImages bool
}

func NewAssetRepository(db *gorm.DB, uploadDir string, maxBytes int64) *AssetRepository {
	resolvedDir := resolveAssetBaseDir(uploadDir)
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}
	return &AssetRepository{
		db:        db,
		uploadDir: resolvedDir,
		maxBytes:  maxBytes,
		cache:     make(map[uint]assetCacheEntry),
		lastGC:    time.Now(),
	}
}

func (r *AssetRepository) Upload(ctx context.Context, in UploadAssetInput) (*database.Asset, bool, error) {
	if r == nil || r.db == nil {
		return nil, false, fmt.Errorf("asset repository not initialized")
	}
	if len(in.Data) == 0 {
		return nil, false, fmt.Errorf("empty upload data")
	}
	if err := fsutil.EnsureDir(r.uploadDir); err != nil {
		return nil, false, err
	}

	hash := sha256.Sum256(in.Data)
	fileHash := hex.EncodeToString(hash[:])

	var existing database.Asset
	err := r.db.WithContext(ctx).Where("file_hash = ?", fileHash).First(&existing).Error
	if err == nil {
		if existing.Uploader != in.UploaderID {
			return nil, false, ErrDuplicateUpload
		}
		return &existing, false, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	mimeType := http.DetectContentType(in.Data)
	if in.RestrictToImages && !strings.HasPrefix(mimeType, "image/") {
		return nil, false, fmt.Errorf("file must be an image")
	}

	fileExt := detectFileExtension(in.OriginalFileName, mimeType)
	fileName := fileHash + fileExt
	diskPath, err := r.safeAssetPath(fileName)
	if err != nil {
		return nil, false, err
	}
	if err := os.WriteFile(diskPath, in.Data, 0o644); err != nil {
		return nil, false, err
	}

	width, height := 0, 0
	if strings.HasPrefix(mimeType, "image/") {
		cfg, _, err := image.DecodeConfig(bytes.NewReader(in.Data))
		if err == nil {
			width, height = cfg.Width, cfg.Height
		}
	}

	now := time.Now()
	asset := &database.Asset{
		FileName:         fileName,
		OriginalFileName: strings.TrimSpace(in.OriginalFileName),
		MimeType:         mimeType,
		FileExtension:    fileExt,
		FilePath:         fileName,
		FileHash:         fileHash,
		FileSize:         int64(len(in.Data)),
		Width:            width,
		Height:           height,
		Uploader:         in.UploaderID,
		State:            database.AssetStateNormal,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := r.db.WithContext(ctx).Create(asset).Error; err != nil {
		_ = os.Remove(diskPath)
		return nil, false, err
	}

	r.cachePut(asset.ID, in.Data)
	return asset, true, nil
}

func (r *AssetRepository) GetByID(ctx context.Context, id uint) (*database.Asset, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("asset repository not initialized")
	}
	var asset database.Asset
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAssetNotFound
		}
		return nil, err
	}
	return &asset, nil
}

// List returns paginated assets with optional type and uploader filters.
func (r *AssetRepository) List(ctx context.Context, filter AssetListFilter) ([]database.Asset, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, fmt.Errorf("asset repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.Asset{})
	if filter.Keyword != "" {
		query = query.Where("file_name LIKE ? OR original_file_name LIKE ? OR mime_type LIKE ?", filter.Keyword, filter.Keyword, filter.Keyword)
	}
	switch filter.Type {
	case "image":
		query = query.Where("mime_type LIKE ?", "image/%")
	case "file":
		query = query.Where("mime_type NOT LIKE ?", "image/%")
	}
	if filter.State != nil {
		query = query.Where("state = ?", *filter.State)
	}
	if filter.UploaderID != nil {
		query = query.Where("uploader = ?", *filter.UploaderID)
	}
	return paginateQuery[database.Asset](query, filter.Page, filter.PageSize, "id DESC")
}

// LoadByIDs batch-loads assets and returns them keyed by asset id.
func (r *AssetRepository) LoadByIDs(ctx context.Context, ids []uint) (map[uint]database.Asset, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("asset repository not initialized")
	}

	result := make(map[uint]database.Asset, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var items []database.Asset
	if err := r.db.WithContext(ctx).Where("id IN ?", uniqueUint(ids)).Find(&items).Error; err != nil {
		return nil, err
	}
	for _, item := range items {
		result[item.ID] = item
	}
	return result, nil
}

func (r *AssetRepository) LoadContentByID(ctx context.Context, id uint) (*database.Asset, []byte, error) {
	asset, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if data, ok := r.cacheGet(id); ok {
		return asset, data, nil
	}

	diskPath, err := r.safePathFromAsset(asset)
	if err != nil {
		return nil, nil, err
	}
	data, err := os.ReadFile(diskPath)
	if err != nil {
		return nil, nil, err
	}
	r.cachePut(id, data)
	return asset, data, nil
}

func (r *AssetRepository) DeleteByID(ctx context.Context, id uint, requesterID uint, role string) error {
	asset, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if role != authpkg.RoleAdmin && asset.Uploader != requesterID {
		return ErrAssetForbidden
	}

	if err := r.db.WithContext(ctx).Delete(&database.Asset{}, id).Error; err != nil {
		return err
	}
	r.cacheDelete(id)

	diskPath, err := r.safePathFromAsset(asset)
	if err != nil {
		return err
	}
	if err := os.Remove(diskPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (r *AssetRepository) cacheGet(id uint) ([]byte, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.cache[id]
	if !ok {
		return nil, false
	}
	entry.AccessedAt = time.Now()
	r.cache[id] = entry
	return append([]byte(nil), entry.Content...), true
}

func (r *AssetRepository) cachePut(id uint, data []byte) {
	if int64(len(data)) > r.maxBytes {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.gcLocked(time.Now())

	if old, ok := r.cache[id]; ok {
		r.cacheBytes -= int64(len(old.Content))
	}

	copied := append([]byte(nil), data...)
	r.cache[id] = assetCacheEntry{Content: copied, AccessedAt: time.Now()}
	r.cacheBytes += int64(len(copied))
	r.evictLocked()
}

func (r *AssetRepository) cacheDelete(id uint) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if old, ok := r.cache[id]; ok {
		r.cacheBytes -= int64(len(old.Content))
		delete(r.cache, id)
	}
}

func (r *AssetRepository) evictLocked() {
	if r.cacheBytes <= r.maxBytes {
		return
	}
	type victim struct {
		ID   uint
		Time time.Time
		Size int64
	}
	victims := make([]victim, 0, len(r.cache))
	for id, entry := range r.cache {
		victims = append(victims, victim{ID: id, Time: entry.AccessedAt, Size: int64(len(entry.Content))})
	}
	sort.Slice(victims, func(i, j int) bool { return victims[i].Time.Before(victims[j].Time) })
	for _, item := range victims {
		delete(r.cache, item.ID)
		r.cacheBytes -= item.Size
		if r.cacheBytes <= r.maxBytes {
			break
		}
	}
}

func (r *AssetRepository) gcLocked(now time.Time) {
	if now.Sub(r.lastGC) < time.Minute {
		return
	}
	for id, entry := range r.cache {
		if now.Sub(entry.AccessedAt) > 10*time.Minute {
			r.cacheBytes -= int64(len(entry.Content))
			delete(r.cache, id)
		}
	}
	r.lastGC = now
}

func detectFileExtension(originalFileName, mimeType string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(originalFileName)))
	if ext != "" {
		return ext
	}
	if exts, err := mime.ExtensionsByType(mimeType); err == nil && len(exts) > 0 {
		return exts[0]
	}
	return ""
}

func resolveAssetBaseDir(configured string) string {
	base := filepath.Join("blog", "assets")
	raw := strings.TrimSpace(configured)
	if raw == "" {
		return filepath.Clean(base)
	}

	clean := filepath.Clean(raw)
	baseClean := filepath.Clean(base)
	if clean == "." || clean == string(filepath.Separator) {
		return baseClean
	}
	if clean == baseClean || strings.HasPrefix(clean, baseClean+string(filepath.Separator)) {
		return clean
	}
	return baseClean
}

func (r *AssetRepository) safePathFromAsset(asset *database.Asset) (string, error) {
	if asset == nil {
		return "", fmt.Errorf("asset is nil")
	}
	name := strings.TrimSpace(asset.FileName)
	if name == "" {
		name = filepath.Base(strings.TrimSpace(asset.FilePath))
	}
	return r.safeAssetPath(name)
}

func (r *AssetRepository) safeAssetPath(name string) (string, error) {
	baseDir := filepath.Clean(r.uploadDir)
	fileName := strings.TrimSpace(filepath.Base(name))
	if fileName == "" || fileName == "." || fileName == string(filepath.Separator) {
		return "", fmt.Errorf("invalid asset path")
	}

	fullPath := filepath.Clean(filepath.Join(baseDir, fileName))
	rel, err := filepath.Rel(baseDir, fullPath)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("asset path escapes base dir")
	}
	return fullPath, nil
}
