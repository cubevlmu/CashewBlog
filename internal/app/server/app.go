package server

import (
	"fmt"

	"go.uber.org/zap"

	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/router"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/cache"
	"CashewBlog/internal/pkg/core"
)

// Run starts the HTTP server component.
func Run() error {
	if err := core.InitCommon(); err != nil {
		return err
	}
	defer core.ShutdownCommon()

	common := core.Common
	if common == nil {
		return fmt.Errorf("common is not initialized")
	}

	authSvc := auth.NewService(
		common.Config.JWTSecret,
		common.Config.JWTIssuer,
		common.Config.AccessTTL,
		common.Config.RefreshTTL,
	)
	authSvc.BindPersistence(auth.NewPersistence(common.Database.DB()))
	authSvc.BindUserRepository(auth.NewUserRepository(common.Database.DB()))

	readCache := cache.New(
		common.Config.Cache.Enabled,
		common.Config.Cache.MaxEntries,
		common.Config.Cache.TTL,
	)

	r := router.New(common.Logger, authSvc, common.Database, router.SecurityOptions{
		Enabled: common.Security.IsEnabled(),
		Guard: middleware.GuardConfig{
			MinRequestInterval: common.Security.MinRequestInterval,
			WindowSize:         common.Security.WindowSize,
			MaxRequestsPerIP:   common.Security.MaxRequestsPerIP,
			DuplicateTTL:       common.Security.DuplicateTTL,
			MaxBodyBytes:       common.Security.MaxBodyBytes,
		},
		Login: services.LoginGuardConfig{
			MinInterval:   common.Security.LoginMinInterval,
			WindowSize:    common.Security.LoginWindowSize,
			MaxPerIP:      common.Security.MaxLoginPerIP,
			MaxFailures:   common.Security.MaxLoginFailures,
			MaxUsersPerIP: common.Security.MaxLoginUsersPerIP,
		},
	}, readCache, common.Config.LogPath, common.Config.Asset.UploadDir, common.Config.Asset.CacheMaxMemoryBytes)

	common.Logger.GetZap().Info("server starting",
		zap.String("addr", common.Config.Addr),
		zap.String("env", common.Config.Env),
		zap.String("gin_mode", common.GinMode),
		zap.String("db_mode", common.Database.Mode()),
		zap.String("log_path", common.Config.LogPath),
		zap.String("jwt_issuer", common.Config.JWTIssuer),
		zap.Bool("security_enabled", common.Security.IsEnabled()),
		zap.Bool("cache_enabled", common.Config.Cache.Enabled),
		zap.Int("cache_max_entries", common.Config.Cache.MaxEntries),
		zap.Duration("cache_ttl", common.Config.Cache.TTL),
	)

	if err := r.Run(common.Config.Addr); err != nil {
		common.Logger.GetZap().Error("server stopped", zap.Error(err))
		return err
	}
	return nil
}
