package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"CashewBlog/internal/pkg/database"
)

var ErrUserNotFound = errors.New("user not found")

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	if db == nil {
		return nil
	}
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var user database.User
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by username: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uint) (*database.User, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("user repository not initialized")
	}

	var user database.User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by id: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) UpdateLoginMeta(ctx context.Context, id uint, loginAt time.Time, loginIP string) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("user repository not initialized")
	}

	return r.db.WithContext(ctx).
		Model(&database.User{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"last_login":    loginAt,
			"last_login_ip": loginIP,
		}).Error
}
