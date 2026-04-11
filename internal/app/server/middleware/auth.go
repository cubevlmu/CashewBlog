package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"CashewBlog/internal/pkg/auth"
)

type contextKey string

const (
	contextUserID contextKey = "user_id"
	contextRole   contextKey = "role"
)

// Authenticate validates access tokens and sets user info in context.
func Authenticate(authSvc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractBearer(c.GetHeader("Authorization"))
		if tokenStr == "" {
			abortWithError(c, http.StatusUnauthorized, "missing token")
			return
		}

		claims, err := authSvc.ParseAccess(tokenStr)
		if err != nil {
			status := http.StatusUnauthorized
			if errors.Is(err, auth.ErrExpiredToken) {
				status = http.StatusUnauthorized
			}
			abortWithError(c, status, err.Error())
			return
		}

		if store := authSvc.Store(); store != nil {
			if err := store.TouchSessionByAccessToken(tokenStr); err != nil {
				abortWithError(c, http.StatusUnauthorized, "invalid session")
				return
			}
		}

		c.Set(string(contextUserID), claims.Subject)
		c.Set(string(contextRole), claims.Role)
		c.Next()
	}
}

// Authorize checks if the user has one of the required roles.
func Authorize(roles ...string) gin.HandlerFunc {
	roleSet := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		roleSet[r] = struct{}{}
	}

	return func(c *gin.Context) {
		roleVal, ok := c.Get(string(contextRole))
		if !ok {
			abortWithError(c, http.StatusForbidden, "missing role")
			return
		}
		role, _ := roleVal.(string)
		if _, exists := roleSet[role]; !exists {
			abortWithError(c, http.StatusForbidden, "forbidden")
			return
		}
		c.Next()
	}
}

// UserFromContext returns the user id and role if set.
func UserFromContext(c *gin.Context) (string, string, bool) {
	userID, okID := c.Get(string(contextUserID))
	role, okRole := c.Get(string(contextRole))
	uid, _ := userID.(string)
	rol, _ := role.(string)
	return uid, rol, okID && okRole
}

func extractBearer(header string) string {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
