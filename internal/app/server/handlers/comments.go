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
	"CashewBlog/internal/pkg/database"
)

type CommentHandler struct {
	Read     *services.ReadService
	Comments *repositories.CommentRepository
}

// ListBlogComments handles GET /api/v1/blogs/:id/comments.
// It loads a paginated comment tree for one blog with an optional state filter.
func (h *CommentHandler) ListBlogComments(c *gin.Context) {
	blogID, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.CommentListFilter{
		Page:     page,
		PageSize: pageSize,
		BlogID:   blogID,
	}

	state, ok := parseCommentState(c.Query("state"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	filter.State = state

	result, err := h.Read.ListBlogComments(c.Request.Context(), filter, webutil.CacheKey(c, "blog_comments"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// CreateBlogComment handles POST /api/v1/blogs/:id/comments.
// It creates a top-level comment for the authenticated user under one blog.
func (h *CommentHandler) CreateBlogComment(c *gin.Context) {
	h.createComment(c, "id", "parent_id")
}

// ReplyBlogComment handles POST /api/v1/blogs/:id/comments/:commentId/reply.
// It creates a child comment for the authenticated user under the target comment.
func (h *CommentHandler) ReplyBlogComment(c *gin.Context) {
	h.createComment(c, "id", "commentId")
}

// UpdateComment handles PATCH /api/v1/comments/:id.
// It updates a comment's content after author or admin authorization.
func (h *CommentHandler) UpdateComment(c *gin.Context) {
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

	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.CommentUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "content is required")
		return
	}

	comment, err := h.Comments.UpdateByID(c.Request.Context(), repositories.UpdateCommentInput{
		ID:          id,
		RequesterID: uint(uid),
		Role:        role,
		Content:     content,
	})
	if err != nil {
		h.respondCommentError(c, err)
		return
	}

	item, err := h.Read.GetCommentItem(c.Request.Context(), comment)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, gin.H{"comment": item})
}

// DeleteComment handles DELETE /api/v1/comments/:id.
// It soft-deletes a comment after author or admin authorization and returns the deleted id.
func (h *CommentHandler) DeleteComment(c *gin.Context) {
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

	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Comments.DeleteByID(c.Request.Context(), id, uint(uid), role); err != nil {
		switch {
		case errors.Is(err, repositories.ErrCommentNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "comment not found")
		case errors.Is(err, repositories.ErrCommentForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}

	webutil.RespondOK(c, gin.H{"deleted": true, "id": id})
}

// UpdateCommentState handles PATCH /api/v1/comments/:id/state.
// It updates one comment's moderation state for admin callers and returns the updated id and state.
func (h *CommentHandler) UpdateCommentState(c *gin.Context) {
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.CommentStateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	state, ok := parseCommentState(req.State)
	if !ok || state == nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}

	comment, err := h.Comments.UpdateStateByID(c.Request.Context(), repositories.UpdateCommentStateInput{
		ID:    id,
		State: *state,
	})
	if err != nil {
		h.respondCommentError(c, err)
		return
	}

	webutil.RespondOK(c, gin.H{
		"id":    comment.ID,
		"state": serverapi.CommentStateName(comment.State),
	})
}

// createComment applies the shared create flow for top-level comments and replies.
func (h *CommentHandler) createComment(c *gin.Context, blogParam string, parentParam string) {
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

	blogID, err := webutil.ParseUintParam(c, blogParam)
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.CommentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "content is required")
		return
	}

	var parentID *uint
	if parentParam == "commentId" {
		id, err := webutil.ParseUintParam(c, parentParam)
		if err != nil {
			webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
			return
		}
		parentID = &id
	} else if req.ParentID > 0 {
		parentID = &req.ParentID
	}

	comment, err := h.Comments.Create(c.Request.Context(), repositories.CreateCommentInput{
		BlogID:   blogID,
		UserID:   uint(uid),
		ParentID: parentID,
		Content:  content,
		IP:       c.ClientIP(),
	})
	if err != nil {
		h.respondCommentError(c, err)
		return
	}

	item, err := h.Read.GetCommentItem(c.Request.Context(), comment)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	webutil.RespondCreated(c, gin.H{"comment": item})
}

// respondCommentError maps repository comment errors to the standard API error payload.
func (h *CommentHandler) respondCommentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrBlogNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "blog not found")
	case errors.Is(err, repositories.ErrCommentNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "comment not found")
	case errors.Is(err, repositories.ErrCommentForbidden):
		webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}

// parseCommentState parses public comment state names into database enum values.
func parseCommentState(raw string) (*int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return nil, true
	case "approved":
		return new(database.CommentStateNormal), true
	case serverapi.CommentStateName(database.CommentStateNormal):
		return new(database.CommentStateNormal), true
	case serverapi.CommentStateName(database.CommentStateHidden):
		return new(database.CommentStateHidden), true
	case serverapi.CommentStateName(database.CommentStateDeleted):
		return new(database.CommentStateDeleted), true
	default:
		return nil, false
	}
}
