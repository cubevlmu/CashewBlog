package middleware

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/database"
)

// RequireUser allows any authenticated application user role to proceed.
// It is the route-level gate used for endpoints that require login but do not
// need finer-grained resource ownership checks.
func RequireUser() gin.HandlerFunc {
	return Authorize(auth.RoleAdmin, auth.RoleSubscriber, auth.RoleCreator)
}

// RequireBlogOwnerOrAdmin allows admins or the blog's author to proceed.
// This middleware is currently kept as an optional building block and is not
// wired into the router while the project uses route-level permissions only.
func RequireBlogOwnerOrAdmin(db *gorm.DB) gin.HandlerFunc {
	return requireOwnerOrAdmin(db, func(tx *gorm.DB, id uint) (uint, error) {
		var blog database.Blog
		if err := tx.Model(&database.Blog{}).Where("id = ?", id).First(&blog).Error; err != nil {
			return 0, err
		}
		return blog.Author, nil
	})
}

// RequireAssetOwnerOrAdmin allows admins or the asset's uploader to proceed.
// This middleware is currently reserved for future resource-level permission
// enforcement and is not wired into the router.
func RequireAssetOwnerOrAdmin(db *gorm.DB) gin.HandlerFunc {
	return requireOwnerOrAdmin(db, func(tx *gorm.DB, id uint) (uint, error) {
		var asset database.Asset
		if err := tx.Model(&database.Asset{}).Where("id = ?", id).First(&asset).Error; err != nil {
			return 0, err
		}
		return asset.Uploader, nil
	})
}

// RequireCommentOwnerOrAdmin allows admins or the comment's author to proceed.
// This middleware is currently reserved for future resource-level permission
// enforcement and is not wired into the router.
func RequireCommentOwnerOrAdmin(db *gorm.DB) gin.HandlerFunc {
	return requireOwnerOrAdmin(db, func(tx *gorm.DB, id uint) (uint, error) {
		var comment database.Comment
		if err := tx.Model(&database.Comment{}).Where("id = ?", id).First(&comment).Error; err != nil {
			return 0, err
		}
		return comment.UserID, nil
	})
}

// requireOwnerOrAdmin is the shared implementation for resource-level owner
// checks. It resolves the resource owner from the database and compares it to
// the authenticated user unless the user is already an admin.
func requireOwnerOrAdmin(db *gorm.DB, resolveOwner func(tx *gorm.DB, id uint) (uint, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		if db == nil {
			abortWithError(c, http.StatusInternalServerError, "database unavailable")
			return
		}

		userID, role, ok := UserFromContext(c)
		if !ok {
			abortWithError(c, http.StatusUnauthorized, "unauthorized")
			return
		}
		if role == auth.RoleAdmin {
			c.Next()
			return
		}

		resourceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil {
			abortWithError(c, http.StatusBadRequest, "invalid id")
			return
		}
		ownerID, err := resolveOwner(db.WithContext(c.Request.Context()), uint(resourceID))
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				abortWithError(c, http.StatusNotFound, "resource not found")
				return
			}
			abortWithError(c, http.StatusInternalServerError, "permission check failed")
			return
		}

		currentUserID, err := strconv.ParseUint(userID, 10, 64)
		if err != nil {
			abortWithError(c, http.StatusUnauthorized, "invalid user id")
			return
		}
		if uint(currentUserID) != ownerID {
			abortWithError(c, http.StatusForbidden, "forbidden")
			return
		}
		c.Next()
	}
}
