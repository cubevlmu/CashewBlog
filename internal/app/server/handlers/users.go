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

type UserHandler struct {
	Read  *services.ReadService
	Users *repositories.UserRepository
}

type userAvatarUpdateRequest struct {
	AvatarID *uint `json:"avatar_id" binding:"required"`
}

// GetCurrentUser returns the current authenticated user's full profile.
func (h *UserHandler) GetCurrentUser(c *gin.Context) {
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

	profile, err := h.Read.GetCurrentUserProfile(c.Request.Context(), uint(uid), webutil.CacheKey(c, "current_user_profile"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if profile == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}

	webutil.RespondOK(c, gin.H{"user": profile})
}

// ListUsers returns the admin user list with pagination and optional filters.
//
// Supported filters include keyword, state, and role. The response uses the
// full user-profile shape expected by admin views.
func (h *UserHandler) ListUsers(c *gin.Context) {
	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.UserListFilter{
		Page:     page,
		PageSize: pageSize,
		Keyword:  webutil.LikeKeyword(c.Query("keyword")),
	}

	state, ok := parseUserState(c.Query("state"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	role, ok := parseUserRole(c.Query("role"))
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid role")
		return
	}
	filter.State = state
	filter.Role = role

	result, err := h.Read.ListAdminUsers(c.Request.Context(), filter, webutil.CacheKey(c, "admin_user_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

// GetUser returns one full user profile for admin callers.
func (h *UserHandler) GetUser(c *gin.Context) {
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	profile, err := h.Read.GetAdminUserProfile(c.Request.Context(), id, webutil.CacheKey(c, "admin_user_detail"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if profile == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}

	webutil.RespondOK(c, gin.H{"user": profile})
}

// UpdateCurrentUser handles PATCH /api/v1/users/me.
// It updates the authenticated user's self-editable profile fields and returns the updated profile.
func (h *UserHandler) UpdateCurrentUser(c *gin.Context) {
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

	var req serverapi.UserProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	nickname := strings.TrimSpace(req.Nickname)
	email := strings.TrimSpace(req.Email)
	if nickname == "" || email == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "nickname and email are required")
		return
	}
	gender, ok := parseUserGender(req.Gender)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid gender")
		return
	}

	user, err := h.Users.UpdateProfileByID(c.Request.Context(), repositories.UpdateUserProfileInput{
		ID:        uint(uid),
		Nickname:  nickname,
		Email:     email,
		Gender:    gender,
		Bio:       req.Bio,
		Website:   req.Website,
		AvatarSet: req.AvatarID != nil,
		AvatarID:  req.AvatarID,
	})
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()
	h.respondUserProfile(c, user, "current_user_profile_updated")
}

// UpdateCurrentUserPassword handles PATCH /api/v1/users/me/password.
// It verifies the authenticated user's current password and replaces it with the next password.
func (h *UserHandler) UpdateCurrentUserPassword(c *gin.Context) {
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

	var req serverapi.PasswordUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	if strings.TrimSpace(req.CurrentPassword) == "" || strings.TrimSpace(req.NextPassword) == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "current_password and next_password are required")
		return
	}

	if err := h.Users.UpdatePasswordByID(c.Request.Context(), repositories.UpdateUserPasswordInput{
		ID:              uint(uid),
		CurrentPassword: req.CurrentPassword,
		NextPassword:    req.NextPassword,
	}); err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"updated": true})
}

// UpdateCurrentUserAvatar handles PATCH /api/v1/users/me/avatar.
// It updates the authenticated user's avatar and returns the updated avatar reference.
func (h *UserHandler) UpdateCurrentUserAvatar(c *gin.Context) {
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

	var req userAvatarUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	user, err := h.Users.UpdateAvatarByID(c.Request.Context(), uint(uid), req.AvatarID)
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()
	profile, err := h.loadUserProfile(c, user, "current_user_avatar_updated")
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if profile == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}

	webutil.RespondOK(c, gin.H{"avatar": profile.Avatar})
}

// CreateUser handles POST /api/v1/users.
// It creates an admin-managed user with validated profile, role, avatar, and password fields.
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req serverapi.UserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	username := strings.TrimSpace(req.Username)
	nickname := strings.TrimSpace(req.Nickname)
	email := strings.TrimSpace(req.Email)
	if username == "" || nickname == "" || email == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "username, nickname and email are required")
		return
	}
	role, ok := parseUserRole(req.Role)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid role")
		return
	}
	roleValue := database.UserRoleUser
	if role != nil {
		roleValue = *role
	}
	gender, ok := parseUserGender(req.Gender)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid gender")
		return
	}

	user, err := h.Users.Create(c.Request.Context(), repositories.CreateUserInput{
		Username: username,
		Nickname: nickname,
		Email:    email,
		Role:     roleValue,
		Gender:   gender,
		Bio:      req.Bio,
		Website:  req.Website,
		AvatarID: req.AvatarID,
		Password: req.Password,
	})
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()
	profile, err := h.loadUserProfile(c, user, "admin_user_created")
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if profile == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}
	webutil.RespondCreated(c, gin.H{"user": profile})
}

// UpdateUser handles PATCH /api/v1/users/:id.
// It updates an admin-managed user's editable profile and role fields.
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	nickname := strings.TrimSpace(req.Nickname)
	email := strings.TrimSpace(req.Email)
	if nickname == "" || email == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "nickname and email are required")
		return
	}
	role, ok := parseUserRole(req.Role)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid role")
		return
	}
	gender, ok := parseUserGender(req.Gender)
	if !ok {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid gender")
		return
	}

	user, err := h.Users.UpdateByID(c.Request.Context(), repositories.UpdateUserInput{
		ID:        id,
		Nickname:  nickname,
		Email:     email,
		Role:      role,
		Gender:    gender,
		Bio:       req.Bio,
		Website:   req.Website,
		AvatarSet: req.AvatarID != nil,
		AvatarID:  req.AvatarID,
	})
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()
	h.respondUserProfile(c, user, "admin_user_updated")
}

// DeleteUser handles DELETE /api/v1/users/:id.
// It soft-deletes one admin-managed user and returns the deleted id.
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Users.DeleteByID(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, repositories.ErrUserNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{"deleted": true, "id": id})
}

// UpdateUserState handles PATCH /api/v1/users/:id/state.
// It updates one admin-managed user's account state and returns the updated id and state.
func (h *UserHandler) UpdateUserState(c *gin.Context) {
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.UserStateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	state, ok := parseUserState(req.State)
	if !ok || state == nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}

	user, err := h.Users.UpdateStateByID(c.Request.Context(), id, *state)
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{
		"id":    user.ID,
		"state": serverapi.UserStateName(user.State),
	})
}

// UpdateUserRole handles PATCH /api/v1/users/:id/role.
// It updates another user's role for admin callers and rejects self-role changes.
func (h *UserHandler) UpdateUserRole(c *gin.Context) {
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

	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	var req serverapi.UserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	role, ok := parseUserRole(req.Role)
	if !ok || role == nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid role")
		return
	}

	user, err := h.Users.UpdateRoleByID(c.Request.Context(), repositories.UpdateUserRoleInput{
		ID:          id,
		RequesterID: uint(uid),
		Role:        *role,
	})
	if err != nil {
		respondUserWriteError(c, err)
		return
	}
	h.Read.InvalidateAll()

	webutil.RespondOK(c, gin.H{
		"id":   user.ID,
		"role": serverapi.UserRoleName(user.Role),
	})
}

// ListUserBlogsByUsername returns one author's public blog list together with basic author info.
func (h *UserHandler) ListUserBlogsByUsername(c *gin.Context) {
	username := strings.TrimSpace(c.Param("username"))
	if username == "" {
		username = strings.TrimSpace(c.Param("id"))
	}
	if username == "" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "username is required")
		return
	}
	cacheScope := webutil.CacheKey(c, "author_blog_page") + "|username=" + username

	user, err := h.Read.GetUserLiteByUsername(c.Request.Context(), username, cacheScope+"|user")
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if user == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	publicState := database.BlogStatePublic
	filter := repositories.BlogListFilter{
		Page:     page,
		PageSize: pageSize,
		AuthorID: &user.ID,
		State:    &publicState,
	}

	result, err := h.Read.ListPublicBlogs(c.Request.Context(), filter, cacheScope+"|blogs")
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondOK(c, gin.H{
		"user":      user,
		"list":      result.List,
		"page":      result.Page,
		"page_size": result.PageSize,
		"total":     result.Total,
	})
}

func parseUserState(raw string) (*int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return nil, true
	case serverapi.UserStateName(database.UserStateRegistered):
		state := database.UserStateRegistered
		return &state, true
	case serverapi.UserStateName(database.UserStateVerified):
		state := database.UserStateVerified
		return &state, true
	case serverapi.UserStateName(database.UserStateBanned):
		state := database.UserStateBanned
		return &state, true
	case serverapi.UserStateName(database.UserStateDeleted):
		state := database.UserStateDeleted
		return &state, true
	default:
		return nil, false
	}
}

func parseUserRole(raw string) (*int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return nil, true
	case serverapi.UserRoleName(database.UserRoleUser):
		role := database.UserRoleUser
		return &role, true
	case serverapi.UserRoleName(database.UserRoleAdmin):
		role := database.UserRoleAdmin
		return &role, true
	case serverapi.UserRoleName(database.UserRoleSuperAdmin):
		role := database.UserRoleSuperAdmin
		return &role, true
	default:
		return nil, false
	}
}

func parseUserGender(raw string) (int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "", serverapi.GenderName(database.GenderUnknown):
		return database.GenderUnknown, true
	case serverapi.GenderName(database.GenderMale):
		return database.GenderMale, true
	case serverapi.GenderName(database.GenderFemale):
		return database.GenderFemale, true
	case serverapi.GenderName(database.GenderOther):
		return database.GenderOther, true
	default:
		return 0, false
	}
}

// respondUserProfile serializes one user profile and writes the standard response payload.
func (h *UserHandler) respondUserProfile(c *gin.Context, user *database.User, scope string) {
	profile, err := h.loadUserProfile(c, user, scope)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if profile == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
		return
	}
	webutil.RespondOK(c, gin.H{"user": profile})
}

// loadUserProfile reloads a user profile through the read service with a write-aware cache key.
func (h *UserHandler) loadUserProfile(c *gin.Context, user *database.User, scope string) (*serverapi.UserProfile, error) {
	if user == nil {
		return nil, nil
	}
	key := webutil.CacheKey(c, scope) + "|user_id=" + strconv.FormatUint(uint64(user.ID), 10) + "|updated_at=" + strconv.FormatInt(user.UpdatedAt.UnixNano(), 10)
	return h.Read.GetAdminUserProfile(c.Request.Context(), user.ID, key)
}

func respondUserWriteError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrUserNotFound):
		webutil.RespondError(c, http.StatusNotFound, 40400, "user not found")
	case errors.Is(err, repositories.ErrUserConflict):
		webutil.RespondError(c, http.StatusConflict, 40900, "username or email already exists")
	case errors.Is(err, repositories.ErrUserForbidden):
		webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
	case errors.Is(err, repositories.ErrInvalidUserRef):
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid avatar_id")
	case errors.Is(err, repositories.ErrInvalidUserPassword):
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid password")
	default:
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
	}
}
