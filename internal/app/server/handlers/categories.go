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

type CategoryHandler struct {
	Read       *services.ReadService
	Categories *repositories.CategoryRepository
}

type categoryUpsertRequest struct {
	Name          string `json:"name" binding:"required"`
	Slug          string `json:"slug" binding:"required"`
	ParentID      *uint  `json:"parent_id"`
	ParentIDCamel *uint  `json:"parentId"`
	Desc          string `json:"desc"`
}

// ListCategories handles GET /api/v1/categories.
// It returns a paginated public category list with optional keyword filtering.
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.CategoryListFilter{
		Page:     page,
		PageSize: pageSize,
		Keyword:  webutil.LikeKeyword(c.Query("keyword")),
	}

	result, err := h.Read.ListPublicCategories(c.Request.Context(), filter, webutil.CacheKey(c, "category_list"))
	if err != nil {
		webutil.RespondError(c, 500, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// GetCategory handles GET /api/v1/categories/:id.
// It loads one public category detail by id.
func (h *CategoryHandler) GetCategory(c *gin.Context) {
	categoryID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	category, err := h.Read.GetPublicCategory(c.Request.Context(), categoryID, webutil.CacheKey(c, "category_detail")+fmtCategoryCacheSuffix(categoryID))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if category == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "category not found")
		return
	}

	webutil.RespondOK(c, gin.H{"category": category})
}

// ListCategoryBlogs handles GET /api/v1/categories/:id/blogs.
// It loads the category by id and returns paginated public blogs under it.
func (h *CategoryHandler) ListCategoryBlogs(c *gin.Context) {
	categoryID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}
	cacheKey := webutil.CacheKey(c, "category_id_blogs") + fmtCategoryCacheSuffix(categoryID)
	h.respondCategoryBlogs(c, func() (gin.H, error) {
		return h.Read.GetCategoryRefByID(c.Request.Context(), categoryID, cacheKey+"|category")
	})
}

// ListCategoryBlogsBySlug handles GET /api/v1/categories/slug/:slug/blogs.
// It loads the category by slug and returns paginated public blogs under it.
func (h *CategoryHandler) ListCategoryBlogsBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "slug is required")
		return
	}
	cacheKey := webutil.CacheKey(c, "category_slug_blogs") + "|slug=" + slug
	h.respondCategoryBlogs(c, func() (gin.H, error) {
		return h.Read.GetCategoryRefBySlug(c.Request.Context(), slug, cacheKey+"|category")
	})
}

// CreateCategory handles POST /api/v1/categories.
// It validates editable category fields, creates the category, and returns its detail.
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	var req categoryUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	parentID, ok := resolveCategoryParentID(c, req)
	if !ok {
		return
	}

	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "name and slug are required")
		return
	}

	category, err := h.Categories.Create(c.Request.Context(), repositories.CreateCategoryInput{
		Name:     name,
		Slug:     slug,
		ParentID: parentID,
		Desc:     req.Desc,
	})
	if err != nil {
		respondCategoryWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	parent, err := h.loadCategoryParent(c, category.Parent)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondCreated(c, gin.H{"category": h.categoryItem(category, parent)})
}

// UpdateCategory handles PATCH /api/v1/categories/:id.
// It validates editable category fields, updates the category, and returns its detail.
func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	categoryID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req categoryUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	parentID, ok := resolveCategoryParentID(c, req)
	if !ok {
		return
	}

	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "name and slug are required")
		return
	}

	category, err := h.Categories.UpdateByID(c.Request.Context(), repositories.UpdateCategoryInput{
		ID:       categoryID,
		Name:     name,
		Slug:     slug,
		ParentID: parentID,
		Desc:     req.Desc,
	})
	if err != nil {
		respondCategoryWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	parent, err := h.loadCategoryParent(c, category.Parent)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, gin.H{"category": h.categoryItem(category, parent)})
}

// DeleteCategory handles DELETE /api/v1/categories/:id.
// It deletes the category, reassigns affected blogs, clears child parent links, and returns the deleted id.
func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	categoryID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Categories.DeleteByID(c.Request.Context(), categoryID); err != nil {
		respondCategoryWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"deleted": true, "id": categoryID})
}

// respondCategoryBlogs loads one category reference and writes the category blog-list response.
func (h *CategoryHandler) respondCategoryBlogs(c *gin.Context, loadCategory func() (gin.H, error)) {
	category, err := loadCategory()
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if category == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "category not found")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	categoryID, ok := category["id"].(uint)
	if !ok {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, "invalid category id")
		return
	}
	filter := repositories.BlogListFilter{
		Page:       page,
		PageSize:   pageSize,
		CategoryID: &categoryID,
		State:      new(database.BlogStatePublic),
	}

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "category_blog_list")+fmtCategoryCacheSuffix(categoryID))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondOK(c, gin.H{
		"category":  category,
		"list":      result.List,
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
	})
}

// fmtCategoryCacheSuffix formats a category id suffix for read cache keys.
func fmtCategoryCacheSuffix(categoryID uint) string {
	return "|category_id=" + strconv.FormatUint(uint64(categoryID), 10)
}

// resolveCategoryParentID resolves parent_id and parentId request aliases into one parent id.
func resolveCategoryParentID(c *gin.Context, req categoryUpsertRequest) (*uint, bool) {
	if req.ParentID != nil && req.ParentIDCamel != nil && *req.ParentID != *req.ParentIDCamel {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "parent_id and parentId mismatch")
		return nil, false
	}
	if req.ParentIDCamel != nil {
		return req.ParentIDCamel, true
	}
	return req.ParentID, true
}

// loadCategoryParent loads the parent category used by category response serialization.
func (h *CategoryHandler) loadCategoryParent(c *gin.Context, parentID *uint) (*database.Category, error) {
	if parentID == nil {
		return nil, nil
	}
	return h.Categories.GetByID(c.Request.Context(), *parentID)
}

func (h *CategoryHandler) categoryItem(category *database.Category, parent *database.Category) serverapi.CategoryItem {
	item := serverapi.CategoryItemFromModel(category, parent)
	if category != nil && h.Categories != nil {
		item.PostCount = h.Categories.ArticleCount(category.ID)
	}
	return item
}

// respondCategoryWriteError maps repository category errors to the standard API error payload.
func respondCategoryWriteError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrCategoryNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "category not found")
	case errors.Is(err, repositories.ErrCategoryConflict):
		webutil.RespondError(c, http.StatusConflict, 40900, "name or slug already exists")
	case errors.Is(err, repositories.ErrInvalidCategoryRef):
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid parent_id")
	case errors.Is(err, repositories.ErrProtectedCategory):
		webutil.RespondError(c, http.StatusBadRequest, 40000, "protected category cannot be deleted")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}
