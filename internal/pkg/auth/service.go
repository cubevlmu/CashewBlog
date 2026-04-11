package auth

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"CashewBlog/internal/pkg/database"
	"CashewBlog/internal/pkg/utils/cryptoutil"
)

const (
	RoleAdmin      = "admin"
	RoleSubscriber = "subscriber"
	RoleCreator    = "creator"
	RoleGuest      = "guest"

	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

var (
	ErrInvalidToken       = errors.New("invalid token")
	ErrExpiredToken       = errors.New("token expired")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid session")
	ErrInvalidPassword    = errors.New("password must be sha256 hash")
)

type LoginInput struct {
	Username   string
	Password   string
	DeviceInfo string
	IP         string
	UserAgent  string
}

type RefreshInput struct {
	RefreshToken string
	DeviceInfo   string
	IP           string
	UserAgent    string
}

type TokenOutput struct {
	AccessToken  string
	RefreshToken string
	Role         string
	UserID       uint
}

// Claims defines JWT claims.
type Claims struct {
	Role string `json:"role"`
	Type string `json:"typ"`
	jwt.RegisteredClaims
}

// Service issues and verifies JWTs.
type Service struct {
	secret     []byte
	issuer     string
	accessTTL  time.Duration
	refreshTTL time.Duration
	store      *Persistence
	users      *UserRepository
	now        func() time.Time
}

// NewService creates a JWT service.
func NewService(secret, issuer string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		secret:     []byte(secret),
		issuer:     issuer,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
		now:        time.Now,
	}
}

// BindPersistence attaches database-backed auth persistence helpers.
func (s *Service) BindPersistence(store *Persistence) {
	if s == nil {
		return
	}
	s.store = store
}

// BindUserRepository attaches database-backed user query/update helpers.
func (s *Service) BindUserRepository(repo *UserRepository) {
	if s == nil {
		return
	}
	s.users = repo
}

// Store returns the optional auth persistence adapter.
func (s *Service) Store() *Persistence {
	if s == nil {
		return nil
	}
	return s.store
}

// Login validates user credentials and issues tokens.
func (s *Service) Login(ctx context.Context, in LoginInput) (*TokenOutput, error) {
	if s == nil || s.users == nil {
		return nil, fmt.Errorf("auth service not initialized")
	}

	user, err := s.users.FindByUsername(ctx, in.Username)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if !isUserStateAllowed(user.State) {
		return nil, ErrInvalidCredentials
	}
	passwordSHA256, ok := cryptoutil.NormalizeSHA256Hex(in.Password)
	if !ok {
		return nil, ErrInvalidPassword
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(passwordSHA256)) != nil {
		return nil, ErrInvalidCredentials
	}

	role := roleFromUser(user.Role)
	userID := strconv.FormatUint(uint64(user.ID), 10)
	access, refresh, err := s.GenerateTokens(userID, role)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	refreshClaims, err := s.ParseRefresh(refresh)
	if err != nil || refreshClaims.ExpiresAt == nil {
		return nil, fmt.Errorf("parse refresh token: %w", err)
	}

	now := s.now()
	if err := s.users.UpdateLoginMeta(ctx, user.ID, now, in.IP); err != nil {
		return nil, fmt.Errorf("update login state: %w", err)
	}

	if s.store != nil {
		meta := SessionMeta{
			DeviceInfo: in.DeviceInfo,
			IP:         in.IP,
			UserAgent:  in.UserAgent,
		}
		if _, err := s.store.CreateSession(user.ID, access, refresh, meta, refreshClaims.ExpiresAt.Time); err != nil {
			return nil, fmt.Errorf("create session: %w", err)
		}
	}

	return &TokenOutput{
		AccessToken:  access,
		RefreshToken: refresh,
		Role:         role,
		UserID:       user.ID,
	}, nil
}

// Refresh validates refresh token/session and rotates tokens.
func (s *Service) Refresh(ctx context.Context, in RefreshInput) (*TokenOutput, error) {
	if s == nil || s.users == nil {
		return nil, fmt.Errorf("auth service not initialized")
	}

	claims, err := s.ParseRefresh(in.RefreshToken)
	if err != nil {
		return nil, err
	}

	var session *database.UserSession
	if s.store != nil {
		session, err = s.store.GetActiveSessionByRefreshToken(in.RefreshToken)
		if err != nil {
			return nil, ErrInvalidSession
		}
	}

	userID, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		return nil, ErrInvalidToken
	}
	if session != nil && uint64(session.UserID) != userID {
		return nil, ErrInvalidSession
	}

	user, err := s.users.FindByID(ctx, uint(userID))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if !isUserStateAllowed(user.State) {
		return nil, ErrInvalidToken
	}

	role := roleFromUser(user.Role)
	access, refresh, err := s.GenerateTokens(claims.Subject, role)
	if err != nil {
		return nil, fmt.Errorf("renew tokens: %w", err)
	}
	refreshClaims, err := s.ParseRefresh(refresh)
	if err != nil || refreshClaims.ExpiresAt == nil {
		return nil, fmt.Errorf("parse refresh token: %w", err)
	}

	if session != nil {
		meta := SessionMeta{
			DeviceInfo: in.DeviceInfo,
			IP:         in.IP,
			UserAgent:  in.UserAgent,
		}
		if err := s.store.RotateSessionTokens(session.ID, access, refresh, meta, refreshClaims.ExpiresAt.Time); err != nil {
			return nil, ErrInvalidSession
		}
	}

	return &TokenOutput{
		AccessToken:  access,
		RefreshToken: refresh,
		Role:         role,
		UserID:       user.ID,
	}, nil
}

// GenerateTokens creates access and refresh tokens.
func (s *Service) GenerateTokens(userID, role string) (string, string, error) {
	access, err := s.signToken(userID, role, TokenTypeAccess, s.accessTTL)
	if err != nil {
		return "", "", err
	}
	refresh, err := s.signToken(userID, role, TokenTypeRefresh, s.refreshTTL)
	if err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

// ParseAccess validates an access token.
func (s *Service) ParseAccess(tokenStr string) (*Claims, error) {
	claims, err := s.parse(tokenStr)
	if err != nil {
		return nil, err
	}
	if claims.Type != TokenTypeAccess {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ParseRefresh validates a refresh token.
func (s *Service) ParseRefresh(tokenStr string) (*Claims, error) {
	claims, err := s.parse(tokenStr)
	if err != nil {
		return nil, err
	}
	if claims.Type != TokenTypeRefresh {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// AccessTokenTTL returns the configured access-token lifetime.
func (s *Service) AccessTokenTTL() time.Duration {
	if s == nil {
		return 0
	}
	return s.accessTTL
}

func (s *Service) signToken(userID, role, tokenType string, ttl time.Duration) (string, error) {
	now := s.now()
	claims := Claims{
		Role: role,
		Type: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-1 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

func (s *Service) parse(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, ErrInvalidToken
		}
		return s.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func roleFromUser(role int) string {
	switch role {
	case database.UserRoleAdmin, database.UserRoleSuperAdmin:
		return RoleAdmin
	case database.UserRoleUser:
		return RoleSubscriber
	default:
		return RoleGuest
	}
}

func isUserStateAllowed(state int) bool {
	return state == database.UserStateRegistered || state == database.UserStateVerified
}
