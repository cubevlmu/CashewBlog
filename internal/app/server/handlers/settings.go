package handlers

import (
	"encoding/json"
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
// It loads child settings by root key when present, otherwise one setting by exact key.
func (h *SettingHandler) GetAdminSetting(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "key is required")
		return
	}

	children, err := h.Settings.ListByRoot(c.Request.Context(), key)
	if err != nil {
		respondSettingError(c, err)
		return
	}
	if len(children) > 0 {
		list := make([]serverapi.SettingItem, 0, len(children))
		for _, child := range children {
			list = append(list, serverapi.SettingItemFromModel(&child))
		}
		webutil.RespondOK(c, gin.H{"root": key, "items": list})
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
			Key:         "navbar.head_text",
			Value:       req.NavbarHeadText,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Navbar brand text",
		},
		{
			Key:         "navbar.links",
			Value:       mustMarshalSettingJSON(req.NavbarLinks),
			Type:        database.SettingTypeJSON,
			Group:       "public",
			Description: "Navbar links",
		},
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
		{
			Key:         "announcement.content",
			Value:       req.Announcement,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Home announcement content",
		},
		{
			Key:         "intro.blog_name",
			Value:       req.IntroBlogName,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Intro blog name",
		},
		{
			Key:         "intro.hitokoto",
			Value:       req.IntroHitokoto,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Intro quote",
		},
		{
			Key:         "sidebar.custom_html",
			Value:       req.SidebarHTML,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Sidebar custom HTML",
		},
		{
			Key:         "owner.name",
			Value:       req.OwnerName,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Owner display name",
		},
		{
			Key:         "owner.avatar",
			Value:       req.OwnerAvatar,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Owner avatar URL",
		},
		{
			Key:         "owner.bio",
			Value:       req.OwnerBio,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Owner bio",
		},
		{
			Key:         "owner.links",
			Value:       mustMarshalSettingJSON(req.OwnerLinks),
			Type:        database.SettingTypeJSON,
			Group:       "public",
			Description: "Owner links",
		},
		{
			Key:         "footer.text",
			Value:       req.FooterText,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Footer text",
		},
		{
			Key:         "footer.extra_html",
			Value:       req.FooterExtraHTML,
			Type:        database.SettingTypeString,
			Group:       "public",
			Description: "Footer extra HTML",
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
		"navbar": gin.H{
			"head_text": settingValue(items, "navbar.head_text", "site_name", "CashewBlog"),
			"links":     settingJSONValue[[]serverapi.HomeNavLink](items, "navbar.links", []serverapi.HomeNavLink{}),
		},
		"announcement": gin.H{
			"content": settingValue(items, "announcement.content", "site_desc", ""),
		},
		"intro": gin.H{
			"blog_name": settingValue(items, "intro.blog_name", "site_name", "CashewBlog"),
			"hitokoto":  settingValue(items, "intro.hitokoto", "site_desc", ""),
		},
		"sidebar": gin.H{
			"custom_html": settingValue(items, "sidebar.custom_html", "", ""),
		},
		"owner": gin.H{
			"name":   settingValue(items, "owner.name", "site_name", "CashewBlog"),
			"avatar": settingValue(items, "owner.avatar", "site.logo", ""),
			"bio":    settingValue(items, "owner.bio", "site_desc", ""),
			"links":  settingJSONValue[[]serverapi.HomeOwnerLink](items, "owner.links", []serverapi.HomeOwnerLink{}),
		},
		"footer": gin.H{
			"text":       settingValue(items, "footer.text", "site.icp", ""),
			"extra_html": settingValue(items, "footer.extra_html", "", ""),
		},
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

func settingJSONValue[T any](items []database.Setting, key string, fallback T) T {
	raw := settingValue(items, key, "", "")
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	var result T
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return fallback
	}
	return result
}

func mustMarshalSettingJSON(value interface{}) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func respondSettingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrSettingNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "setting not found")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}
