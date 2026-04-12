package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/app/server/webutil"
)

type AdminHandler struct {
	Read *services.ReadService
	Logs *services.LogService
}

// GetDashboard returns the admin dashboard summary counters from database data.
func (h *AdminHandler) GetDashboard(c *gin.Context) {
	result, err := h.Read.GetAdminDashboard(c.Request.Context(), webutil.CacheKey(c, "admin_dashboard"))
	if err != nil {
		webutil.RespondError(c, 500, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, result)
}

// GetMyDashboard returns dashboard counters scoped to the authenticated user.
func (h *AdminHandler) GetMyDashboard(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, 401, 40100, "unauthorized")
		return
	}
	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, 401, 40100, "invalid user")
		return
	}

	result, err := h.Read.GetUserDashboard(c.Request.Context(), uint(uid), webutil.CacheKey(c, "my_dashboard"))
	if err != nil {
		webutil.RespondError(c, 500, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, result)
}

// GetStats returns admin trend statistics built directly from database data.
func (h *AdminHandler) GetStats(c *gin.Context) {
	result, err := h.Read.GetAdminStats(c.Request.Context(), webutil.CacheKey(c, "admin_stats"))
	if err != nil {
		webutil.RespondError(c, 500, 50000, err.Error())
		return
	}
	webutil.RespondOK(c, result)
}

// ListLogs returns paginated system logs from the local log text file.
//
// Results are read from newest to oldest and support optional level and
// keyword filtering.
func (h *AdminHandler) ListLogs(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := services.LogListFilter{
		Page:     page,
		PageSize: pageSize,
		Level:    c.Query("level"),
		Keyword:  c.Query("keyword"),
	}

	result, err := h.Logs.ListLogs(c.Request.Context(), filter)
	if err != nil {
		webutil.RespondError(c, 500, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}
