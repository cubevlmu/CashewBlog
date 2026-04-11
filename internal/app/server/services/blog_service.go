package services

import (
	authpkg "CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/database"
)

// BlogViewer describes the current caller for blog-visibility checks.
type BlogViewer struct {
	UserID uint
	Role   string
}

// CanViewBlog reports whether the viewer may access a blog in the given state.
func CanViewBlog(state int, authorID uint, viewer BlogViewer) bool {
	switch state {
	case database.BlogStatePublic:
		return true
	case database.BlogStatePrivate:
		return viewer.Role == authpkg.RoleAdmin || viewer.UserID == authorID
	case database.BlogStatePending:
		return viewer.Role == authpkg.RoleAdmin || viewer.UserID == authorID
	case database.BlogStateDraft:
		return viewer.UserID == authorID
	default:
		return false
	}
}
