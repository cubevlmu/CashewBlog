package webutil

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"CashewBlog/internal/app/server/middleware"
)

const (
	DefaultPage     = 1
	DefaultPageSize = 20
	MaxPageSize     = 100
)

// ParsePageParams reads common pagination query params and applies sane bounds.
func ParsePageParams(c *gin.Context) (int, int) {
	page := parsePositiveInt(c.Query("page"), DefaultPage)
	pageSize := parsePositiveInt(c.Query("page_size"), DefaultPageSize)
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}
	return page, pageSize
}

// ParseUintParam parses a required unsigned integer path param such as :id.
func ParseUintParam(c *gin.Context, name string) (uint, error) {
	raw := strings.TrimSpace(c.Param(name))
	if raw == "" {
		return 0, fmt.Errorf("%s is required", name)
	}
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return uint(v), nil
}

// ParseOptionalInt parses an optional integer query value and returns nil on empty or invalid input.
func ParseOptionalInt(raw string) *int {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return nil
	}
	return &v
}

// ParseOptionalUint parses an optional unsigned integer query value and returns nil on empty or invalid input.
func ParseOptionalUint(raw string) *uint {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return nil
	}
	u := uint(v)
	return &u
}

// LikeKeyword converts a raw keyword into a SQL LIKE pattern used by list endpoints.
func LikeKeyword(raw string) string {
	keyword := strings.TrimSpace(raw)
	if keyword == "" {
		return ""
	}
	return "%" + keyword + "%"
}

// CacheKey builds a stable cache key from route, scope, user identity, role, and normalized query string.
func CacheKey(c *gin.Context, scope string) string {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		userID = "guest"
		role = "guest"
	}
	return fmt.Sprintf("%s|%s|uid=%s|role=%s|q=%s", c.FullPath(), scope, userID, role, normalizeQuery(c.Request.URL.Query()))
}

// IsAdminRequest reports whether the authenticated request is from an admin role.
func IsAdminRequest(c *gin.Context) bool {
	_, role, ok := middleware.UserFromContext(c)
	return ok && role == "admin"
}

// parsePositiveInt applies a fallback when the incoming value is empty, invalid, or non-positive.
func parsePositiveInt(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

// normalizeQuery encodes query params into a stable string for cache-key generation.
func normalizeQuery(values url.Values) string {
	if len(values) == 0 {
		return ""
	}
	return values.Encode()
}
