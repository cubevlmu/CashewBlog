package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	serverapi "CashewBlog/internal/app/server/api"
	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/repositories"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/app/server/webutil"
	authpkg "CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/database"
)

type BlogHandler struct {
	Read  *services.ReadService
	Blogs *repositories.BlogRepository
	Auth  *authpkg.Service
}

// ListBlogs handles GET /api/v1/blogs and GET /api/v1/admin/blogs.
// It parses list filters, constrains non-admin reads to public blogs, and returns a paginated blog list.
func (h *BlogHandler) ListBlogs(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.BlogListFilter{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    webutil.LikeKeyword(c.Query("keyword")),
		TagID:      webutil.ParseOptionalUint(c.Query("tag_id")),
		CategoryID: webutil.ParseOptionalUint(c.Query("category_id")),
		AuthorID:   webutil.ParseOptionalUint(c.Query("author_id")),
	}

	state, ok := parseBlogState(c.Query("state"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	publicState := database.BlogStatePublic
	if !webutil.IsAdminRequest(c) {
		filter.State = &publicState
	} else {
		filter.State = state
	}

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "blog_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// GetBlog handles GET /api/v1/blogs/:id.
// It loads one blog by id, applies visibility rules, and hides unauthorized reads as not found.
//
// Visibility rules:
//   - public blogs are returned to anyone
//   - private blogs are returned only to the author or an admin
//   - pending blogs are returned only to the author or an admin
//   - draft blogs are returned only to the author
//   - deleted blogs are never returned
//
// Unauthorized access is intentionally normalized to "404 blog not found".
func (h *BlogHandler) GetBlog(c *gin.Context) {
	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}
	h.respondBlogDetail(c, func() (*services.BlogDetailResult, error) {
		return h.Read.GetBlogDetailByID(c.Request.Context(), blogID, webutil.CacheKey(c, "blog_detail"))
	})
}

// GetBlogBySlug handles GET /api/v1/blogs/slug/:slug.
// It loads one blog by slug, applies visibility rules, and returns the blog detail.
func (h *BlogHandler) GetBlogBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "slug is required")
		return
	}
	h.respondBlogDetail(c, func() (*services.BlogDetailResult, error) {
		return h.Read.GetBlogDetailBySlug(c.Request.Context(), slug, webutil.CacheKey(c, "blog_detail_slug"))
	})
}

// GetBlogContextBySlug handles GET /api/v1/blogs/slug/:slug/context.
// It loads the blog detail, comments, and adjacent public blogs after applying visibility rules.
func (h *BlogHandler) GetBlogContextBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "slug is required")
		return
	}

	detail, contextData, err := h.Read.GetBlogContextBySlug(c.Request.Context(), slug, webutil.CacheKey(c, "blog_context_slug"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil || detail.State == database.BlogStateDeleted || contextData == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}
	if !services.CanViewBlog(detail.State, detail.AuthorID, h.resolveBlogViewer(c)) {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}

	webutil.RespondOK(c, gin.H{
		"blog":      contextData.Blog,
		"comments":  contextData.Comments,
		"prev_blog": contextData.PrevBlog,
		"next_blog": contextData.NextBlog,
	})
}

// CreateBlog handles POST /api/v1/blogs.
// It validates the authenticated user and request body, resolves the allowed initial state, creates the blog, and returns its detail.
func (h *BlogHandler) CreateBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	var req serverapi.BlogUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	title := strings.TrimSpace(req.Title)
	slug := strings.TrimSpace(req.Slug)
	if title == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "title and slug are required")
		return
	}

	state, err := resolveCreateBlogState(role, req.State)
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	blog, err := h.Blogs.Create(c.Request.Context(), repositories.CreateBlogInput{
		AuthorID:        uint(uid),
		Title:           title,
		Slug:            slug,
		Summary:         strings.TrimSpace(req.Summary),
		ContentMarkdown: req.ContentMarkdown,
		TitleImageID:    req.TitleImageID,
		CategoryID:      req.CategoryID,
		TagIDs:          req.TagIDs,
		AllowComment:    req.AllowComment,
		IsTop:           req.IsTop && role == authpkg.RoleAdmin,
		State:           state,
	})
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrInvalidBlogRef):
			webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid title_image_id, category_id, or tag_ids")
		case errors.Is(err, repositories.ErrBlogConflict):
			webutil.RespondError(c, http.StatusConflict, 40900, "slug already exists")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	detailKey := webutil.CacheKey(c, "create_blog_detail") + "|blog_id=" + strconv.FormatUint(uint64(blog.ID), 10)
	detail, err := h.Read.GetMyBlog(c.Request.Context(), uint(uid), blog.ID, detailKey)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, "blog detail unavailable")
		return
	}

	webutil.RespondCreated(c, gin.H{"blog": detail})
}

// UpdateBlog handles PUT /api/v1/blogs/:id.
// It validates ownership or admin access, updates editable blog fields and tag relations, and returns the updated detail.
func (h *BlogHandler) UpdateBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.BlogUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	title := strings.TrimSpace(req.Title)
	slug := strings.TrimSpace(req.Slug)
	if title == "" || slug == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "title and slug are required")
		return
	}

	state, err := resolveCreateBlogState(role, req.State)
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	blog, err := h.Blogs.UpdateByID(c.Request.Context(), repositories.UpdateBlogInput{
		ID:              blogID,
		RequesterID:     uint(uid),
		Role:            role,
		Title:           title,
		Slug:            slug,
		Summary:         strings.TrimSpace(req.Summary),
		ContentMarkdown: req.ContentMarkdown,
		TitleImageID:    req.TitleImageID,
		CategoryID:      req.CategoryID,
		TagIDs:          req.TagIDs,
		AllowComment:    req.AllowComment,
		IsTop:           req.IsTop,
		State:           state,
	})
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrInvalidBlogRef):
			webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid title_image_id, category_id, or tag_ids")
		case errors.Is(err, repositories.ErrBlogConflict):
			webutil.RespondError(c, http.StatusConflict, 40900, "slug already exists")
		case errors.Is(err, repositories.ErrBlogNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		case errors.Is(err, repositories.ErrBlogForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	detail, err := h.Read.GetBlogDetailFromModel(c.Request.Context(), blog)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, "blog detail unavailable")
		return
	}

	webutil.RespondOK(c, gin.H{"blog": detail})
}

// DeleteBlog handles DELETE /api/v1/blogs/:id.
// It soft-deletes the blog after author or admin authorization and returns the deleted id.
func (h *BlogHandler) DeleteBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Blogs.DeleteByID(c.Request.Context(), blogID, uint(uid), role); err != nil {
		switch {
		case errors.Is(err, repositories.ErrBlogNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		case errors.Is(err, repositories.ErrBlogForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"deleted": true, "id": blogID})
}

// UpdateBlogState handles PATCH /api/v1/blogs/:id/state and PATCH /api/v1/admin/blogs/:id/state.
// It resolves the requested state according to the caller role and updates only state metadata.
func (h *BlogHandler) UpdateBlogState(c *gin.Context) {
	var req serverapi.BlogStateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	state, err := resolveCreateBlogState(role, req.State)
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	h.updateBlogState(c, userID, role, state, false)
}

// PublishBlog handles POST /api/v1/blogs/:id/publish.
// It moves admin blogs directly to public and normal user blogs to pending review.
func (h *BlogHandler) PublishBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	state := database.BlogStatePublic
	if role != authpkg.RoleAdmin {
		state = database.BlogStatePending
	}
	h.updateBlogState(c, userID, role, state, true)
}

// UnpublishBlog handles POST /api/v1/blogs/:id/unpublish.
// It moves the authorized blog to private and clears publication metadata.
func (h *BlogHandler) UnpublishBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	h.updateBlogState(c, userID, role, database.BlogStatePrivate, false)
}

// RestoreBlog handles POST /api/v1/admin/blogs/:id/restore.
// It restores a soft-deleted blog row as a draft and returns the restored id and state.
func (h *BlogHandler) RestoreBlog(c *gin.Context) {
	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	blog, err := h.Blogs.RestoreByID(c.Request.Context(), blogID)
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrBlogNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{
		"id":       blog.ID,
		"restored": true,
		"state":    serverapi.BlogStateName(blog.State),
	})
}

// ListMyBlogs handles GET /api/v1/me/blogs.
// It lists the authenticated user's own blogs with optional filters.
func (h *BlogHandler) ListMyBlogs(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.BlogListFilter{
		Page:     page,
		PageSize: pageSize,
		Keyword:  webutil.LikeKeyword(c.Query("keyword")),
		AuthorID: ptrUint(uint(uid)),
	}

	state, ok := parseBlogState(c.Query("state"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	filter.State = state

	result, err := h.Read.ListMyBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "my_blog_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// GetMyBlog handles GET /api/v1/me/blogs/:id.
// It loads one blog detail owned by the authenticated user.
func (h *BlogHandler) GetMyBlog(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	detail, err := h.Read.GetMyBlog(c.Request.Context(), uint(uid), blogID, webutil.CacheKey(c, "my_blog_detail"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}

	webutil.RespondOK(c, gin.H{"blog": detail})
}

// GetAdminBlog handles GET /api/v1/admin/blogs/:id.
// It loads one non-deleted blog detail for admin editing without author scoping.
func (h *BlogHandler) GetAdminBlog(c *gin.Context) {
	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	result, err := h.Read.GetBlogDetailByID(c.Request.Context(), blogID, webutil.CacheKey(c, "admin_blog_detail"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if result == nil || result.State == database.BlogStateDeleted {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}

	webutil.RespondOK(c, gin.H{"blog": result.Detail})
}

// CreateMyBlog handles POST /api/v1/me/blogs.
// It creates a blog for the authenticated user by reusing the public create flow.
func (h *BlogHandler) CreateMyBlog(c *gin.Context) {
	h.CreateBlog(c)
}

// UpdateMyBlog handles PUT /api/v1/me/blogs/:id.
// It updates the authenticated user's blog by reusing the shared update flow.
func (h *BlogHandler) UpdateMyBlog(c *gin.Context) {
	h.UpdateBlog(c)
}

// DeleteMyBlog handles DELETE /api/v1/me/blogs/:id.
// It soft-deletes the authenticated user's blog and returns the deleted id.
func (h *BlogHandler) DeleteMyBlog(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Blogs.DeleteByID(c.Request.Context(), blogID, uint(uid), role); err != nil {
		switch {
		case errors.Is(err, repositories.ErrBlogNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		case errors.Is(err, repositories.ErrBlogForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"deleted": true, "id": blogID})
}

// ListHomePosts handles GET /api/v1/home/posts.
// It lists public home feed posts ordered with pinned posts first.
func (h *BlogHandler) ListHomePosts(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.BlogListFilter{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    webutil.LikeKeyword(c.Query("keyword")),
		TagID:      webutil.ParseOptionalUint(c.Query("tag_id")),
		CategoryID: webutil.ParseOptionalUint(c.Query("category_id")),
		AuthorID:   webutil.ParseOptionalUint(c.Query("author_id")),
		Sort:       "home",
	}

	state, ok := parseBlogState(c.Query("state"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	_ = state
	publicState := database.BlogStatePublic
	filter.State = &publicState

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "home_post_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// Search handles GET /api/v1/search.
// It validates the search keyword and returns paginated public blog results.
func (h *BlogHandler) Search(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("q"))
	if keyword == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "q is required")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.BlogListFilter{
		Page:     page,
		PageSize: pageSize,
		Keyword:  webutil.LikeKeyword(keyword),
		State:    new(database.BlogStatePublic),
	}

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, webutil.CacheKey(c, "search_blog_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondOK(c, gin.H{
		"keyword":   keyword,
		"list":      result.List,
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
	})
}

func parseBlogState(raw string) (*int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return nil, true
	case serverapi.BlogStateName(database.BlogStateDraft):
		return new(database.BlogStateDraft), true
	case serverapi.BlogStateName(database.BlogStatePending):
		return new(database.BlogStatePending), true
	case serverapi.BlogStateName(database.BlogStatePublic):
		return new(database.BlogStatePublic), true
	case serverapi.BlogStateName(database.BlogStatePrivate):
		return new(database.BlogStatePrivate), true
	case serverapi.BlogStateName(database.BlogStateDeleted):
		return new(database.BlogStateDeleted), true
	default:
		return nil, false
	}
}

func resolveCreateBlogState(role, raw string) (int, error) {
	stateRaw := strings.TrimSpace(strings.ToLower(raw))
	if stateRaw == "" {
		return database.BlogStateDraft, nil
	}

	state, ok := parseBlogState(stateRaw)
	if !ok || state == nil {
		return 0, errors.New("invalid state")
	}

	if role == authpkg.RoleAdmin {
		switch *state {
		case database.BlogStateDraft, database.BlogStatePending, database.BlogStatePublic, database.BlogStatePrivate:
			return *state, nil
		default:
			return 0, errors.New("invalid state")
		}
	}

	switch *state {
	case database.BlogStateDraft, database.BlogStatePending:
		return *state, nil
	case database.BlogStatePublic:
		return database.BlogStatePending, nil
	default:
		return 0, errors.New("invalid state")
	}
}

// updateBlogState applies the shared state transition flow for blog state, publish, and unpublish handlers.
func (h *BlogHandler) updateBlogState(c *gin.Context, userID string, role string, state int, includePublishedAt bool) {
	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	blog, err := h.Blogs.UpdateStateByID(c.Request.Context(), repositories.UpdateBlogStateInput{
		ID:          blogID,
		RequesterID: uint(uid),
		Role:        role,
		State:       state,
	})
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrBlogNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		case errors.Is(err, repositories.ErrBlogForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	data := gin.H{
		"id":    blog.ID,
		"state": serverapi.BlogStateName(blog.State),
	}
	if includePublishedAt {
		data["published_at"] = blog.PublishedAt
	}
	webutil.RespondOK(c, data)
}

// resolveBlogViewer resolves the current viewer from request context or optional bearer token.
// It is used by public blog detail handlers to apply visibility rules.
func (h *BlogHandler) resolveBlogViewer(c *gin.Context) services.BlogViewer {
	if userID, role, ok := middleware.UserFromContext(c); ok {
		if uid, err := strconv.ParseUint(userID, 10, 64); err == nil {
			return services.BlogViewer{UserID: uint(uid), Role: role}
		}
	}

	if h.Auth == nil {
		return services.BlogViewer{}
	}

	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if header == "" {
		return services.BlogViewer{}
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return services.BlogViewer{}
	}

	claims, err := h.Auth.ParseAccess(strings.TrimSpace(parts[1]))
	if err != nil {
		return services.BlogViewer{}
	}
	uid, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		return services.BlogViewer{}
	}
	return services.BlogViewer{UserID: uint(uid), Role: claims.Role}
}

// respondBlogDetail loads one blog detail, applies visibility checks, and writes the standard response payload.
func (h *BlogHandler) respondBlogDetail(c *gin.Context, load func() (*services.BlogDetailResult, error)) {
	detail, err := load()
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil || detail.State == database.BlogStateDeleted {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}
	if !services.CanViewBlog(detail.State, detail.AuthorID, h.resolveBlogViewer(c)) {
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
		return
	}

	webutil.RespondOK(c, gin.H{"blog": detail.Detail})
}
