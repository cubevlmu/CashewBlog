package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"CashewBlog/internal/pkg/database"
	"CashewBlog/internal/pkg/utils/cryptoutil"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrUserConflict        = errors.New("user conflict")
	ErrUserForbidden       = errors.New("forbidden")
	ErrInvalidUserRef      = errors.New("invalid user reference")
	ErrInvalidUserPassword = errors.New("invalid user password")
)

type UserRepository struct {
	db *gorm.DB
}

// UserListFilter describes supported user-list query conditions.
type UserListFilter struct {
	Page     int
	PageSize int
	Keyword  string
	State    *int
	Role     *int
}

type CreateUserInput struct {
	Username string
	Nickname string
	Email    string
	Role     int
	Gender   int
	Bio      string
	Website  string
	AvatarID *uint
	Password string
}

type UpdateUserInput struct {
	ID       uint
	Nickname string
	Email    string
	Role     *int
	Gender   int
	Bio      string
	Website  string
	AvatarSet bool
	AvatarID *uint
}

type UpdateUserProfileInput struct {
	ID       uint
	Nickname string
	Email    string
	Gender   int
	Bio      string
	Website  string
	AvatarSet bool
	AvatarID *uint
}

type UpdateUserPasswordInput struct {
	ID              uint
	CurrentPassword string
	NextPassword    string
}

type UpdateUserRoleInput struct {
	ID          uint
	RequesterID uint
	Role        int
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	if db == nil {
		return nil
	}
	return &UserRepository{db: db}
}

// GetByID loads one user by primary key.
func (r *UserRepository) GetByID(ctx context.Context, id uint) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var item database.User
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetByUsername loads one user by unique username.
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var item database.User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// List returns paginated users with optional keyword/state/role filtering.
func (r *UserRepository) List(ctx context.Context, filter UserListFilter) ([]database.User, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, fmt.Errorf("user repository not initialized")
	}

	query := r.db.WithContext(ctx).Model(&database.User{})
	if filter.Keyword != "" {
		query = query.Where("username LIKE ? OR nickname LIKE ? OR email LIKE ?", filter.Keyword, filter.Keyword, filter.Keyword)
	}
	if filter.State != nil {
		query = query.Where("state = ?", *filter.State)
	}
	if filter.Role != nil {
		query = query.Where("role = ?", *filter.Role)
	}
	return paginateQuery[database.User](query, filter.Page, filter.PageSize, "id DESC")
}

// ListRecent returns the newest users for dashboard-style views.
func (r *UserRepository) ListRecent(ctx context.Context, limit int) ([]database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var items []database.User
	if err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// LoadByIDs batch-loads users and returns them keyed by user id.
func (r *UserRepository) LoadByIDs(ctx context.Context, ids []uint) (map[uint]database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	result := make(map[uint]database.User, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var items []database.User
	if err := r.db.WithContext(ctx).Where("id IN ?", uniqueUint(ids)).Find(&items).Error; err != nil {
		return nil, err
	}
	for _, item := range items {
		result[item.ID] = item
	}
	return result, nil
}

// Create inserts one user after validating avatar and unique fields.
func (r *UserRepository) Create(ctx context.Context, in CreateUserInput) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	passwordHash, err := hashUserPassword(in.Password)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := &database.User{
		State:         database.UserStateRegistered,
		Role:          in.Role,
		Username:      strings.TrimSpace(in.Username),
		Nickname:      strings.TrimSpace(in.Nickname),
		PasswordHash:  passwordHash,
		Avatar:        normalizeUserAvatar(in.AvatarID),
		Gender:        in.Gender,
		Email:         strings.TrimSpace(in.Email),
		Bio:           strings.TrimSpace(in.Bio),
		Website:       strings.TrimSpace(in.Website),
		RegisterDate:  now,
		EmailVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := validateUserAvatar(tx, user.Avatar); err != nil {
			return err
		}
		if err := tx.Create(user).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrUserConflict
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return user, nil
}

// UpdateByID updates one admin-managed user's editable fields.
func (r *UserRepository) UpdateByID(ctx context.Context, in UpdateUserInput) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var user database.User
	avatarID := normalizeUserAvatar(in.AvatarID)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}
		if in.AvatarSet {
			if err := validateUserAvatar(tx, avatarID); err != nil {
				return err
			}
		}

		updates := map[string]interface{}{
			"nickname":   strings.TrimSpace(in.Nickname),
			"email":      strings.TrimSpace(in.Email),
			"gender":     in.Gender,
			"bio":        strings.TrimSpace(in.Bio),
			"website":    strings.TrimSpace(in.Website),
			"updated_at": time.Now(),
		}
		if in.AvatarSet {
			updates["avatar"] = avatarID
		}
		if in.Role != nil {
			updates["role"] = *in.Role
		}
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
			if isUniqueConstraintError(err) {
				return ErrUserConflict
			}
			return err
		}
		return tx.Where("id = ?", user.ID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateProfileByID updates one user's self-editable profile fields.
func (r *UserRepository) UpdateProfileByID(ctx context.Context, in UpdateUserProfileInput) (*database.User, error) {
	return r.UpdateByID(ctx, UpdateUserInput{
		ID:       in.ID,
		Nickname: in.Nickname,
		Email:    in.Email,
		Gender:   in.Gender,
		Bio:      in.Bio,
		Website:  in.Website,
		AvatarSet: in.AvatarSet,
		AvatarID: in.AvatarID,
	})
}

// UpdateAvatarByID updates one user's avatar.
func (r *UserRepository) UpdateAvatarByID(ctx context.Context, id uint, avatarID *uint) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var user database.User
	avatarID = normalizeUserAvatar(avatarID)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", id).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}
		if err := validateUserAvatar(tx, avatarID); err != nil {
			return err
		}
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"avatar":     avatarID,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", user.ID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdatePasswordByID verifies the current password and replaces it with the next password.
func (r *UserRepository) UpdatePasswordByID(ctx context.Context, in UpdateUserPasswordInput) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("user repository not initialized")
	}

	currentSHA256 := normalizeUserPassword(in.CurrentPassword)
	nextHash, err := hashUserPassword(in.NextPassword)
	if err != nil {
		return err
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user database.User
		if err := tx.Where("id = ?", in.ID).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}
		if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentSHA256)) != nil {
			return ErrInvalidUserPassword
		}
		return tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"password_hash": nextHash,
			"updated_at":    time.Now(),
		}).Error
	})
}

// UpdateStateByID updates one user's account state.
func (r *UserRepository) UpdateStateByID(ctx context.Context, id uint, state int) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var user database.User
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", id).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"state":      state,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", user.ID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateRoleByID updates another user's role and rejects self-role changes.
func (r *UserRepository) UpdateRoleByID(ctx context.Context, in UpdateUserRoleInput) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}
	if in.ID == in.RequesterID {
		return nil, ErrUserForbidden
	}

	var user database.User
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", in.ID).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"role":       in.Role,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", user.ID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// DeleteByID soft-deletes one user while clearing user data and unique fields.
func (r *UserRepository) DeleteByID(ctx context.Context, id uint) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("user repository not initialized")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user database.User
		if err := tx.Where("id = ?", id).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrUserNotFound
			}
			return err
		}

		now := time.Now()
		placeholder := fmt.Sprintf("deleted-%d-%d", user.ID, now.Unix())
		updates := map[string]interface{}{
			"state":          database.UserStateDeleted,
			"role":           database.UserRoleUser,
			"username":       placeholder,
			"nickname":       "",
			"password_hash":  "",
			"avatar":         nil,
			"gender":         database.GenderUnknown,
			"email":          placeholder + "@deleted.local",
			"bio":            "",
			"website":        "",
			"last_login":     nil,
			"last_login_ip":  "",
			"email_verified": false,
			"updated_at":     now,
		}
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", user.ID).Delete(&database.UserSession{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", user.ID).Delete(&database.UserToken{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&database.User{}, user.ID).Error; err != nil {
			return err
		}
		return nil
	})
}

func normalizeUserAvatar(avatarID *uint) *uint {
	if avatarID == nil || *avatarID == 0 {
		return nil
	}
	return avatarID
}

func validateUserAvatar(tx *gorm.DB, avatarID *uint) error {
	if avatarID == nil {
		return nil
	}
	var count int64
	if err := tx.Model(&database.Asset{}).Where("id = ?", *avatarID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return ErrInvalidUserRef
	}
	return nil
}

func normalizeUserPassword(raw string) string {
	if passwordSHA256, ok := cryptoutil.NormalizeSHA256Hex(raw); ok {
		return passwordSHA256
	}
	return cryptoutil.SHA256Hex(strings.TrimSpace(raw))
}

func hashUserPassword(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ErrInvalidUserPassword
	}
	passwordSHA256 := normalizeUserPassword(raw)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(passwordSHA256), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}
