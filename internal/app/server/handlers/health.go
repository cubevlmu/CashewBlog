package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"CashewBlog/internal/app/server/webutil"
	"CashewBlog/internal/pkg/database"
)

type HealthHandler struct {
	DB *database.Client
}

// Health reports whether the service is healthy.
//
// It optionally verifies database connectivity before returning a static "ok"
// payload for public health checks.
func (h *HealthHandler) Health(c *gin.Context) {
	if h.DB != nil {
		if err := h.DB.Ping(); err != nil {
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
			return
		}
	}
	webutil.RespondOK(c, gin.H{"status": "ok"})
}
