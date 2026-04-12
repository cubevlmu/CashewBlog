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

type TagHandler struct {
	Read *services.ReadService
	Tags *repositories.TagRepository
}

// ListTags handles GET /api/v1/tags.
// It returns a paginated public tag list with optional keyword filtering.
func (h *TagHandler) ListTags(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.TagListFilter{
		Page:     page,
		PageSize: pageSize,
		Keyword:  webutil.LikeKeyword(c.Query("keyword")),
	}

	result, err := h.Read.ListTags(c.Request.Context(), filter, webutil.CacheKey(c, "tag_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// GetTag handles GET /api/v1/tags/:id.
// It loads one public tag detail by id.
func (h *TagHandler) GetTag(c *gin.Context) {
	tagID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	tag, err := h.Read.GetTag(c.Request.Context(), tagID, webutil.CacheKey(c, "tag_detail")+fmtTagCacheSuffix(tagID))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if tag == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "tag not found")
		return
	}

	webutil.RespondOK(c, gin.H{"tag": tag})
}

// ListTagBlogs handles GET /api/v1/tags/:id/blogs.
// It loads the tag by id and returns paginated public blogs under it.
func (h *TagHandler) ListTagBlogs(c *gin.Context) {
	tagID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}
	cacheKey := webutil.CacheKey(c, "tag_id_blogs") + fmtTagCacheSuffix(tagID)
	h.respondTagBlogs(c, func() (gin.H, error) {
		return h.Read.GetTagRefByID(c.Request.Context(), tagID, cacheKey+"|tag")
	})
}

// ListTagBlogsBySlug handles GET /api/v1/tags/slug/:slug/blogs.
// It loads the tag by slug and returns paginated public blogs under it.
func (h *TagHandler) ListTagBlogsBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "slug is required")
		return
	}
	cacheKey := webutil.CacheKey(c, "tag_slug_blogs") + "|slug=" + slug
	h.respondTagBlogs(c, func() (gin.H, error) {
		return h.Read.GetTagRefBySlug(c.Request.Context(), slug, cacheKey+"|tag")
	})
}

// CreateTag handles POST /api/v1/tags.
// It validates editable tag fields, creates the tag, and returns its detail.
func (h *TagHandler) CreateTag(c *gin.Context) {
	var req serverapi.TagUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "name and slug are required")
		return
	}

	tag, err := h.Tags.Create(c.Request.Context(), repositories.CreateTagInput{
		Name:  name,
		Slug:  slug,
		Desc:  req.Desc,
		Color: req.Color,
	})
	if err != nil {
		respondTagWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondCreated(c, gin.H{"tag": h.tagItem(tag)})
}

// UpdateTag handles PATCH /api/v1/tags/:id.
// It validates editable tag fields, updates the tag, and returns its detail.
func (h *TagHandler) UpdateTag(c *gin.Context) {
	tagID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.TagUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "name and slug are required")
		return
	}

	tag, err := h.Tags.UpdateByID(c.Request.Context(), repositories.UpdateTagInput{
		ID:    tagID,
		Name:  name,
		Slug:  slug,
		Desc:  req.Desc,
		Color: req.Color,
	})
	if err != nil {
		respondTagWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"tag": h.tagItem(tag)})
}

// DeleteTag handles DELETE /api/v1/tags/:id.
// It deletes the tag, removes blog-tag relations, and returns the deleted id.
func (h *TagHandler) DeleteTag(c *gin.Context) {
	tagID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Tags.DeleteByID(c.Request.Context(), tagID); err != nil {
		respondTagWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"deleted": true, "id": tagID})
}

// respondTagBlogs loads one tag reference and writes the tag blog-list response.
func (h *TagHandler) respondTagBlogs(c *gin.Context, loadTag func() (gin.H, error)) {
	tag, err := loadTag()
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if tag == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "tag not found")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	publicState := database.BlogStatePublic
	tagID, _ := tag["id"].(uint)
	filter := repositories.BlogListFilter{
		Page:     page,
		PageSize: pageSize,
		TagID:    &tagID,
		State:    &publicState,
	}

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "tag_blog_list")+fmtTagCacheSuffix(tagID))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondOK(c, gin.H{
		"tag":       tag,
		"list":      result.List,
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
	})
}

// fmtTagCacheSuffix formats a tag id suffix for read cache keys.
func fmtTagCacheSuffix(tagID uint) string {
	return "|tag_id=" + strconv.FormatUint(uint64(tagID), 10)
}

func (h *TagHandler) tagItem(tag *database.Tag) serverapi.TagItem {
	item := serverapi.TagItemFromModel(tag)
	if tag != nil && h.Tags != nil {
		item.PostCount = h.Tags.ArticleCount(tag.ID)
	}
	return item
}

// respondTagWriteError maps repository tag errors to the standard API error payload.
func respondTagWriteError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrTagNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "tag not found")
	case errors.Is(err, repositories.ErrTagConflict):
		webutil.RespondError(c, http.StatusConflict, 40900, "name or slug already exists")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}
