package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	serverapi "CashewBlog/internal/app/server/api"
	"CashewBlog/internal/app/server/repositories"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/app/server/webutil"
	"CashewBlog/internal/pkg/database"
)

type SettingHandler struct {
	Read     *services.ReadService
	Settings *repositories.SettingRepository
}

type adminSettingPutRequest struct {
	Value       string `json:"value"`
	Type        string `json:"type"`
	Group       string `json:"group"`
	Description string `json:"description"`
	Desc        string `json:"desc"`
}

// GetPublicSettings handles GET /api/v1/settings/public.
// It returns public settings grouped into the site/home shape consumed by the frontend.
func (h *SettingHandler) GetPublicSettings(c *gin.Context) {
	settings, err := h.Settings.ListPublic(c.Request.Context())
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, publicSettingsPayload(settings))
}

// ListAdminSettings handles GET /api/v1/admin/settings.
// It returns paginated settings with optional key and group filters.
func (h *SettingHandler) ListAdminSettings(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.SettingListFilter{
		Page:     page,
		PageSize: pageSize,
		Key:      webutil.LikeKeyword(c.Query("key")),
		Group:    strings.TrimSpace(c.Query("group")),
	}

	items, total, err := h.Settings.List(c.Request.Context(), filter)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	list := make([]serverapi.SettingItem, 0, len(items))
	for _, item := range items {
		list = append(list, serverapi.SettingItemFromModel(&item))
	}
	webutil.RespondPage(c, list, total, page, pageSize)
}

// UpdateAdminSettings handles PATCH /api/v1/admin/settings.
// It updates existing setting values in batch and returns the affected count.
func (h *SettingHandler) UpdateAdminSettings(c *gin.Context) {
	var req serverapi.AdminSettingsUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	values := make(map[string]string, len(req.Items))
	for _, item := range req.Items {
		key := strings.TrimSpace(item.Key)
		if key == "" {
			webutil.RespondError(c, http.StatusBadRequest, 40000, "key is required")
			return
		}
		values[key] = item.Value
	}

	updated, err := h.Settings.UpdateValues(c.Request.Context(), values)
	if err != nil {
		respondSettingError(c, err)
		return
	}
	webutil.RespondOK(c, gin.H{"updated_count": updated})
}

// GetAdminSetting handles GET /api/v1/admin/settings/:key.
// It loads one setting by key using the setting repository cache.
func (h *SettingHandler) GetAdminSetting(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "key is required")
		return
	}

	item, err := h.Settings.GetByKey(c.Request.Context(), key)
	if err != nil {
		respondSettingError(c, err)
		return
	}
	if item == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "setting not found")
		return
	}
	webutil.RespondOK(c, gin.H{"item": serverapi.SettingItemFromModel(item)})
}

// PutAdminSetting handles PUT /api/v1/admin/settings/:key.
// It creates or overwrites one setting value and returns the stored item.
func (h *SettingHandler) PutAdminSetting(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "key is required")
		return
	}

	var req adminSettingPutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	settingType, ok := parseSettingType(req.Type)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid type")
		return
	}
	desc := req.Description
	if strings.TrimSpace(desc) == "" {
		desc = req.Desc
	}

	item, err := h.Settings.UpsertByKey(c.Request.Context(), repositories.UpsertSettingInput{
		Key:         key,
		Value:       req.Value,
		Type:        settingType,
		Group:       req.Group,
		Description: desc,
	})
	if err != nil {
		respondSettingError(c, err)
		return
	}
	webutil.RespondOK(c, gin.H{"item": serverapi.SettingItemFromModel(item)})
}

// DeleteAdminSetting handles DELETE /api/v1/admin/settings/:key.
// It deletes one setting by key and removes the cached row.
func (h *SettingHandler) DeleteAdminSetting(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "key is required")
		return
	}
	if err := h.Settings.DeleteByKey(c.Request.Context(), key); err != nil {
		respondSettingError(c, err)
		return
	}
	webutil.RespondOK(c, gin.H{"deleted": true, "key": key})
}

// GetHomeSite handles GET /api/v1/site/home.
// It returns only the public home-site settings.
func (h *SettingHandler) GetHomeSite(c *gin.Context) {
	settings, err := h.Settings.ListPublic(c.Request.Context())
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, gin.H{"home": homeSettingsPayload(settings)})
}

// UpdateHomeSite handles PATCH /api/v1/admin/site/home.
// It creates or updates public home settings and returns the updated home payload.
func (h *SettingHandler) UpdateHomeSite(c *gin.Context) {
	var req serverapi.HomeSiteUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	values := []repositories.UpsertSettingInput{
		{
			Key:         "home.banner_title",
			Value:       req.BannerTitle,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Home banner title",
		},
		{
			Key:         "home.banner_subtitle",
			Value:       req.BannerSubtitle,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Home banner subtitle",
		},
		{
			Key:         "home.banner_image",
			Value:       req.BannerImage,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Home banner image",
		},
		{
			Key:         "home.typing_animation",
			Value:       strconv.FormatBool(req.TypingAnimation),
			Type:        database.SettingTypeBool,
			Group:       "public",
			Description: "Whether home typing animation is enabled",
		},
	}
	for _, item := range values {
		if _, err := h.Settings.UpsertByKey(c.Request.Context(), item); err != nil {
			respondSettingError(c, err)
			return
		}
	}

	settings, err := h.Settings.ListPublic(c.Request.Context())
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, gin.H{"home": homeSettingsPayload(settings)})
}

func parseSettingType(raw string) (int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return 0, true
	case serverapi.SettingTypeName(database.SettingTypeBool):
		return database.SettingTypeBool, true
	case serverapi.SettingTypeName(database.SettingTypeInt):
		return database.SettingTypeInt, true
	case serverapi.SettingTypeName(database.SettingTypeString):
		return database.SettingTypeString, true
	case serverapi.SettingTypeName(database.SettingTypeJSON):
		return database.SettingTypeJSON, true
	default:
		return 0, false
	}
}

func publicSettingsPayload(items []database.Setting) gin.H {
	return gin.H{
		"site": gin.H{
			"title":    settingValue(items, "site.title", "site_name", "CashewBlog"),
			"subtitle": settingValue(items, "site.subtitle", "site_desc", ""),
			"logo":     settingValue(items, "site.logo", "", ""),
			"icp":      settingValue(items, "site.icp", "", ""),
			"theme":    settingValue(items, "site.theme", "", "light"),
		},
		"home": homeSettingsPayload(items),
	}
}

func homeSettingsPayload(items []database.Setting) gin.H {
	return gin.H{
		"banner_title":     settingValue(items, "home.banner_title", "site_name", "CashewBlog"),
		"banner_subtitle":  settingValue(items, "home.banner_subtitle", "site_desc", ""),
		"banner_image":     settingValue(items, "home.banner_image", "", ""),
		"typing_animation": settingBoolValue(items, "home.typing_animation", "", true),
	}
}

func settingValue(items []database.Setting, key string, legacyKey string, fallback string) string {
	for _, item := range items {
		if item.Key == key {
			return item.Value
		}
	}
	if legacyKey != "" {
		for _, item := range items {
			if item.Key == legacyKey {
				return item.Value
			}
		}
	}
	return fallback
}

func settingBoolValue(items []database.Setting, key string, legacyKey string, fallback bool) bool {
	raw := settingValue(items, key, legacyKey, strconv.FormatBool(fallback))
	val, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return val
}

func respondSettingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrSettingNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "setting not found")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}
