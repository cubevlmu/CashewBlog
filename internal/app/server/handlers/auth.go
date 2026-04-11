package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	serverapi "CashewBlog/internal/app/server/api"
	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/app/server/webutil"
	"CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/utils/cryptoutil"
)

type AuthHandler struct {
	Auth       *auth.Service
	Read       *services.ReadService
	LoginGuard *services.LoginGuard
}

// Login authenticates a user and issues access and refresh tokens.
//
// The incoming password must already be a valid SHA-256 hex digest. Login
// attempts are throttled and tracked to reduce credential stuffing and account
// enumeration.
func (h *AuthHandler) Login(c *gin.Context) {
	var req serverapi.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	if username == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "username is required")
		return
	}
	if _, ok := cryptoutil.NormalizeSHA256Hex(password); !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "password must be sha256 hex")
		return
	}

	now := time.Now()
	if h.LoginGuard != nil {
		if allowed, reason := h.LoginGuard.Check(c.ClientIP(), username, now); !allowed {
			webutil.RespondError(c, http.StatusTooManyRequests, 42900, reason)
			return
		}
	}

	result, err := h.Auth.Login(c.Request.Context(), auth.LoginInput{
		Username:   username,
		Password:   password,
		DeviceInfo: c.GetHeader("X-Device-Info"),
		IP:         c.ClientIP(),
		UserAgent:  c.Request.UserAgent(),
	})
	if err != nil {
		if h.LoginGuard != nil {
			h.LoginGuard.RecordFailure(c.ClientIP(), username, now)
		}
		if errors.Is(err, auth.ErrInvalidCredentials) || errors.Is(err, auth.ErrInvalidPassword) {
			webutil.RespondError(c, http.StatusUnauthorized, 40100, err.Error())
			return
		}
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if h.LoginGuard != nil {
		h.LoginGuard.RecordSuccess(c.ClientIP(), username, now)
	}

	user, err := h.Read.GetAuthUserLite(c.Request.Context(), result.UserID, webutil.CacheKey(c, "auth_login_user"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondOK(c, gin.H{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    int(h.Auth.AccessTokenTTL().Seconds()),
		"user":          user,
	})
}

// Refresh validates a refresh token and rotates the current token pair.
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req serverapi.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	result, err := h.Auth.Refresh(c.Request.Context(), auth.RefreshInput{
		RefreshToken: strings.TrimSpace(req.RefreshToken),
		DeviceInfo:   c.GetHeader("X-Device-Info"),
		IP:           c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	})
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalidToken), errors.Is(err, auth.ErrExpiredToken), errors.Is(err, auth.ErrInvalidSession):
			webutil.RespondError(c, http.StatusUnauthorized, 40100, err.Error())
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}

	webutil.RespondOK(c, gin.H{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    int(h.Auth.AccessTokenTTL().Seconds()),
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}
	webutil.RespondOK(c, gin.H{"user_id": userID})
}
