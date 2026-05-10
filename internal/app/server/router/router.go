package router

import (
	"github.com/gin-gonic/gin"

	"CashewBlog/internal/app/server/handlers"
	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/repositories"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/pkg/auth"
	"CashewBlog/internal/pkg/cache"
	"CashewBlog/internal/pkg/database"
	"CashewBlog/internal/pkg/logger"
)

type SecurityOptions struct {
	Enabled bool
	Guard   middleware.GuardConfig
	Login   services.LoginGuardConfig
}

// New builds the HTTP router.
func New(log *logger.Logger, authSvc *auth.Service, db *database.Client, sec SecurityOptions, readCache *cache.Store, logPath string, assetUploadDir string, assetCacheMaxBytes int64) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if sec.Enabled {
		securityGuard := middleware.NewSecurityGuard(log, sec.Guard)
		r.Use(securityGuard.Handler())
	}
	r.Use(middleware.ZapLogger(log))

	readRepo := repositories.NewReadRepository(db.DB())
	blogRepo := repositories.NewBlogRepository(db.DB())
	userRepo := repositories.NewUserRepository(db.DB())
	assetRepo := repositories.NewAssetRepository(db.DB(), assetUploadDir, assetCacheMaxBytes)
	commentRepo := repositories.NewCommentRepository(db.DB())
	categoryRepo := repositories.NewCategoryRepository(db.DB())
	tagRepo := repositories.NewTagRepository(db.DB())
	blogRepo.BindTaxonomyRepositories(categoryRepo, tagRepo)
	blogRepo.BindReadRepository(readRepo)
	blogRepo.StartViewSyncJob(0, 0, log)
	commentRepo.BindReadRepository(readRepo)
	settingRepo := repositories.NewSettingRepository(db.DB())
	readService := services.NewReadService(readRepo, blogRepo, assetRepo, userRepo, commentRepo, settingRepo, tagRepo, categoryRepo, readCache)
	logService := services.NewLogService(logPath)
	authHandler := &handlers.AuthHandler{Auth: authSvc, Read: readService, LoginGuard: services.NewLoginGuard(sec.Login)}
	healthHandler := &handlers.HealthHandler{DB: db}
	userHandler := &handlers.UserHandler{Read: readService, Users: userRepo}
	blogHandler := &handlers.BlogHandler{Read: readService, Blogs: blogRepo, Auth: authSvc}
	tagHandler := &handlers.TagHandler{Read: readService, Tags: tagRepo}
	categoryHandler := &handlers.CategoryHandler{Read: readService, Categories: categoryRepo}
	assetHandler := &handlers.AssetHandler{Read: readService, Assets: assetRepo, Settings: settingRepo}
	commentHandler := &handlers.CommentHandler{Read: readService, Comments: commentRepo}
	settingHandler := &handlers.SettingHandler{Read: readService, Settings: settingRepo}
	adminHandler := &handlers.AdminHandler{Read: readService, Logs: logService}

	v1 := r.Group("/api/v1")

	// Public routes.
	v1.GET("/health", healthHandler.Health)
	v1.POST("/auth/login", authHandler.Login)
	v1.POST("/auth/refresh", authHandler.Refresh)
	v1.GET("/settings/public", settingHandler.GetPublicSettings)
	v1.GET("/site/home", settingHandler.GetHomeSite)

	v1.GET("/blogs", blogHandler.ListBlogs)
	v1.GET("/blogs/slug/:slug/context", blogHandler.GetBlogContextBySlug)
	v1.GET("/blogs/slug/:slug", blogHandler.GetBlogBySlug)
	v1.GET("/blogs/:id/context", blogHandler.GetBlogContext)
	v1.GET("/blogs/:id/comments", commentHandler.ListBlogComments)
	v1.GET("/blogs/:id", blogHandler.GetBlog)
	v1.GET("/home/posts", blogHandler.ListHomePosts)
	v1.GET("/search", blogHandler.Search)

	v1.GET("/tags", tagHandler.ListTags)
	v1.GET("/tags/:id", tagHandler.GetTag)
	v1.GET("/tags/:id/blogs", tagHandler.ListTagBlogs)
	v1.GET("/tags/slug/:slug/blogs", tagHandler.ListTagBlogsBySlug)

	v1.GET("/categories", categoryHandler.ListCategories)
	v1.GET("/categories/:id", categoryHandler.GetCategory)
	v1.GET("/categories/:id/blogs", categoryHandler.ListCategoryBlogs)
	v1.GET("/categories/slug/:slug/blogs", categoryHandler.ListCategoryBlogsBySlug)
	// Gin requires one wildcard name for the /users/:id branch; this path still accepts a username value.
	v1.GET("/users/:id/blogs", userHandler.ListUserBlogsByUsername)
	v1.GET("/assets/:id", assetHandler.GetAssetContent)

	v1Protected := v1.Group("/")
	v1Protected.Use(middleware.Authenticate(authSvc))
	v1Protected.GET("/me", authHandler.Me)
	v1Protected.GET("/auth/me", authHandler.Me)
	v1Protected.GET("/users/me", middleware.Authorize(auth.RoleAdmin), userHandler.GetCurrentUser)

	v1User := v1Protected.Group("/")
	v1User.Use(middleware.RequireUser())
	v1User.GET("/me/dashboard", adminHandler.GetMyDashboard)
	v1User.PATCH("/users/me", userHandler.UpdateCurrentUser)
	v1User.PATCH("/users/me/password", userHandler.UpdateCurrentUserPassword)
	v1User.PATCH("/users/me/avatar", userHandler.UpdateCurrentUserAvatar)

	v1User.POST("/blogs", blogHandler.CreateBlog)
	v1User.PUT("/blogs/:id", blogHandler.UpdateBlog)
	v1User.DELETE("/blogs/:id", blogHandler.DeleteBlog)
	v1User.PATCH("/blogs/:id/state", blogHandler.UpdateBlogState)
	v1User.POST("/blogs/:id/publish", blogHandler.PublishBlog)
	v1User.POST("/blogs/:id/unpublish", blogHandler.UnpublishBlog)

	v1User.GET("/me/blogs", blogHandler.ListMyBlogs)
	v1User.GET("/me/blogs/:id", blogHandler.GetMyBlog)
	v1User.POST("/me/blogs", blogHandler.CreateMyBlog)
	v1User.PUT("/me/blogs/:id", blogHandler.UpdateMyBlog)
	v1User.DELETE("/me/blogs/:id", blogHandler.DeleteMyBlog)

	v1User.POST("/blogs/:id/comments", commentHandler.CreateBlogComment)
	v1User.POST("/blogs/:id/comments/:commentId/reply", commentHandler.ReplyBlogComment)
	v1User.PATCH("/comments/:id", commentHandler.UpdateComment)
	v1User.PATCH("/comments/:id/state", commentHandler.UpdateCommentState)
	v1User.DELETE("/comments/:id", commentHandler.DeleteComment)

	v1User.POST("/assets/upload", assetHandler.UploadAsset)
	v1User.POST("/assets/images", assetHandler.UploadImage)
	v1User.POST("/assets/files", assetHandler.UploadFile)
	v1User.GET("/assets/upload-limit", assetHandler.GetUploadLimit)
	v1User.GET("/assets", assetHandler.ListAssets)
	v1User.GET("/assets/:id/meta", assetHandler.GetAsset)
	v1User.DELETE("/assets/:id", assetHandler.DeleteAsset)
	v1User.GET("/admin/comments", commentHandler.ListAdminComments)

	admin := v1Protected.Group("/admin")
	admin.Use(middleware.Authorize(auth.RoleAdmin))
	admin.GET("/dashboard", adminHandler.GetDashboard)
	admin.GET("/stats", adminHandler.GetStats)
	admin.GET("/logs", adminHandler.ListLogs)
	admin.GET("/blogs", blogHandler.ListBlogs)
	admin.GET("/blogs/:id", blogHandler.GetAdminBlog)
	admin.PATCH("/blogs/:id/state", blogHandler.UpdateBlogState)
	admin.POST("/blogs/:id/restore", blogHandler.RestoreBlog)
	admin.GET("/users", userHandler.ListUsers)
	admin.PATCH("/users/:id/state", userHandler.UpdateUserState)
	admin.PATCH("/site/home", settingHandler.UpdateHomeSite)

	adminUsers := v1Protected.Group("/users")
	adminUsers.Use(middleware.Authorize(auth.RoleAdmin))
	adminUsers.GET("", userHandler.ListUsers)
	adminUsers.GET("/:id", userHandler.GetUser)
	adminUsers.POST("", userHandler.CreateUser)
	adminUsers.PATCH("/:id", userHandler.UpdateUser)
	adminUsers.DELETE("/:id", userHandler.DeleteUser)
	adminUsers.PATCH("/:id/state", userHandler.UpdateUserState)
	adminUsers.PATCH("/:id/role", userHandler.UpdateUserRole)

	adminTags := v1Protected.Group("/tags")
	adminTags.Use(middleware.Authorize(auth.RoleAdmin))
	adminTags.POST("", tagHandler.CreateTag)
	adminTags.PATCH("/:id", tagHandler.UpdateTag)
	adminTags.DELETE("/:id", tagHandler.DeleteTag)

	adminCategories := v1Protected.Group("/categories")
	adminCategories.Use(middleware.Authorize(auth.RoleAdmin))
	adminCategories.POST("", categoryHandler.CreateCategory)
	adminCategories.PATCH("/:id", categoryHandler.UpdateCategory)
	adminCategories.DELETE("/:id", categoryHandler.DeleteCategory)

	adminSettings := v1Protected.Group("/admin/settings")
	adminSettings.Use(middleware.Authorize(auth.RoleAdmin))
	adminSettings.GET("", settingHandler.ListAdminSettings)
	adminSettings.PATCH("", settingHandler.UpdateAdminSettings)
	adminSettings.GET("/:key", settingHandler.GetAdminSetting)
	adminSettings.PUT("/:key", settingHandler.PutAdminSetting)
	adminSettings.DELETE("/:key", settingHandler.DeleteAdminSetting)

	return r
}
