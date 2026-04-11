package auth

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"CashewBlog/internal/pkg/database"
	"CashewBlog/internal/pkg/utils/cryptoutil"
)

var (
	ErrSessionNotFound   = errors.New("session not found")
	ErrTokenNotFound     = errors.New("user token not found")
	ErrTokenAlreadyUsed  = errors.New("user token already used")
	ErrTokenStoreExpired = errors.New("user token expired")
)

type SessionMeta struct {
	DeviceInfo string
	IP         string
	UserAgent  string
}

type Persistence struct {
	db  *gorm.DB
	now func() time.Time
}

func NewPersistence(db *gorm.DB) *Persistence {
	if db == nil {
		return nil
	}
	return &Persistence{
		db:  db,
		now: time.Now,
	}
}

func (p *Persistence) CreateSession(userID uint, accessToken, refreshToken string, meta SessionMeta, expiresAt time.Time) (*database.UserSession, error) {
	if p == nil || p.db == nil {
		return nil, fmt.Errorf("auth persistence not initialized")
	}

	session := &database.UserSession{
		UserID:           userID,
		TokenHash:        hashToken(accessToken),
		RefreshTokenHash: hashToken(refreshToken),
		DeviceInfo:       meta.DeviceInfo,
		IP:               meta.IP,
		UserAgent:        meta.UserAgent,
		ExpiresAt:        expiresAt,
		CreatedAt:        p.now(),
	}

	if err := p.db.Create(session).Error; err != nil {
		return nil, fmt.Errorf("create user session: %w", err)
	}

	return session, nil
}

func (p *Persistence) GetActiveSessionByRefreshToken(refreshToken string) (*database.UserSession, error) {
	if p == nil || p.db == nil {
		return nil, fmt.Errorf("auth persistence not initialized")
	}

	var session database.UserSession
	err := p.db.
		Where("refresh_token_hash = ?", hashToken(refreshToken)).
		Where("revoked_at IS NULL").
		Where("expires_at > ?", p.now()).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("query user session: %w", err)
	}

	return &session, nil
}

func (p *Persistence) RotateSessionTokens(sessionID uint, accessToken, refreshToken string, meta SessionMeta, expiresAt time.Time) error {
	if p == nil || p.db == nil {
		return fmt.Errorf("auth persistence not initialized")
	}

	now := p.now()
	updates := map[string]any{
		"token_hash":         hashToken(accessToken),
		"refresh_token_hash": hashToken(refreshToken),
		"device_info":        meta.DeviceInfo,
		"ip":                 meta.IP,
		"user_agent":         meta.UserAgent,
		"expires_at":         expiresAt,
		"last_used_at":       now,
	}

	result := p.db.Model(&database.UserSession{}).
		Where("id = ?", sessionID).
		Where("revoked_at IS NULL").
		Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("rotate user session: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (p *Persistence) TouchSessionByAccessToken(accessToken string) error {
	if p == nil || p.db == nil {
		return fmt.Errorf("auth persistence not initialized")
	}

	now := p.now()
	result := p.db.Model(&database.UserSession{}).
		Where("token_hash = ?", hashToken(accessToken)).
		Where("revoked_at IS NULL").
		Where("expires_at > ?", now).
		Update("last_used_at", now)
	if result.Error != nil {
		return fmt.Errorf("touch user session: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (p *Persistence) RevokeSessionByRefreshToken(refreshToken string) error {
	if p == nil || p.db == nil {
		return fmt.Errorf("auth persistence not initialized")
	}

	now := p.now()
	result := p.db.Model(&database.UserSession{}).
		Where("refresh_token_hash = ?", hashToken(refreshToken)).
		Where("revoked_at IS NULL").
		Update("revoked_at", now)
	if result.Error != nil {
		return fmt.Errorf("revoke user session: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (p *Persistence) CreateUserToken(userID uint, tokenType int, rawToken string, expiresAt time.Time) (*database.UserToken, error) {
	if p == nil || p.db == nil {
		return nil, fmt.Errorf("auth persistence not initialized")
	}

	token := &database.UserToken{
		UserID:    userID,
		Type:      tokenType,
		TokenHash: hashToken(rawToken),
		ExpiresAt: expiresAt,
		CreatedAt: p.now(),
	}

	if err := p.db.Create(token).Error; err != nil {
		return nil, fmt.Errorf("create user token: %w", err)
	}

	return token, nil
}

func (p *Persistence) ConsumeUserToken(rawToken string, tokenType int) (*database.UserToken, error) {
	if p == nil || p.db == nil {
		return nil, fmt.Errorf("auth persistence not initialized")
	}

	var token database.UserToken
	err := p.db.Where("token_hash = ?", hashToken(rawToken)).
		Where("type = ?", tokenType).
		First(&token).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, fmt.Errorf("query user token: %w", err)
	}

	if token.UsedAt != nil {
		return nil, ErrTokenAlreadyUsed
	}
	if !token.ExpiresAt.After(p.now()) {
		return nil, ErrTokenStoreExpired
	}

	now := p.now()
	if err := p.db.Model(&token).Update("used_at", now).Error; err != nil {
		return nil, fmt.Errorf("consume user token: %w", err)
	}
	token.UsedAt = &now

	return &token, nil
}

func (p *Persistence) WriteAuditLog(userID *uint, action, targetType string, targetID uint, detail datatypes.JSON, ip string) (*database.AuditLog, error) {
	if p == nil || p.db == nil {
		return nil, fmt.Errorf("auth persistence not initialized")
	}

	logEntry := &database.AuditLog{
		UserID:     userID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
		IP:         ip,
		CreatedAt:  p.now(),
	}

	if err := p.db.Create(logEntry).Error; err != nil {
		return nil, fmt.Errorf("create audit log: %w", err)
	}

	return logEntry, nil
}

func hashToken(token string) string {
	return cryptoutil.SHA256Hex(token)
}
