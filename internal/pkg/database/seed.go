package database

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"CashewBlog/internal/pkg/utils/cryptoutil"
)

func seedDefaultUsers(db *gorm.DB) error {
	if db == nil {
		return errors.New("database not initialized")
	}

	type seedUser struct {
		Username string
		Nickname string
		Email    string
		State    int
		Role     int
	}

	defaultUsers := []seedUser{
		{
			Username: "admin",
			Nickname: "Administrator",
			Email:    "admin@cashew.local",
			State:    UserStateVerified,
			Role:     UserRoleAdmin,
		},
		{
			Username: "user",
			Nickname: "Default User",
			Email:    "user@cashew.local",
			State:    UserStateVerified,
			Role:     UserRoleUser,
		},
		{
			Username: "registered",
			Nickname: "Registered User",
			Email:    "registered@cashew.local",
			State:    UserStateRegistered,
			Role:     UserRoleUser,
		},
		{
			Username: "banned",
			Nickname: "Banned User",
			Email:    "banned@cashew.local",
			State:    UserStateBanned,
			Role:     UserRoleUser,
		},
	}

	passwordSHA256 := cryptoutil.SHA256Hex("123456")
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(passwordSHA256), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	now := time.Now()
	for _, item := range defaultUsers {
		var existing User
		err := db.Where("username = ?", item.Username).First(&existing).Error
		if err == nil {
			updates := map[string]any{
				"state":      item.State,
				"role":       item.Role,
				"nickname":   item.Nickname,
				"email":      item.Email,
				"updated_at": now,
			}
			if bcrypt.CompareHashAndPassword([]byte(existing.PasswordHash), []byte(passwordSHA256)) != nil {
				updates["password_hash"] = string(hashedPassword)
			}
			if err := db.Model(&existing).Updates(updates).Error; err != nil {
				return err
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		user := User{
			State:         item.State,
			Role:          item.Role,
			Username:      item.Username,
			Nickname:      item.Nickname,
			PasswordHash:  string(hashedPassword),
			Gender:        GenderUnknown,
			Email:         item.Email,
			Bio:           "seed user",
			Website:       "",
			RegisterDate:  now,
			EmailVerified: true,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := db.Create(&user).Error; err != nil {
			return err
		}
	}

	adminUser, err := findUserByUsername(db, "admin")
	if err != nil {
		return err
	}
	defaultUser, err := findUserByUsername(db, "user")
	if err != nil {
		return err
	}

	tagIDs, err := seedDefaultTags(db, now)
	if err != nil {
		return err
	}
	categoryIDs, err := seedDefaultCategories(db, now)
	if err != nil {
		return err
	}
	assetIDs, err := seedDefaultAssets(db, adminUser.ID, defaultUser.ID, now)
	if err != nil {
		return err
	}
	if err := seedDefaultUserAvatars(db, adminUser.ID, defaultUser.ID, assetIDs, now); err != nil {
		return err
	}
	blogIDs, err := seedDefaultBlogs(db, adminUser.ID, defaultUser.ID, assetIDs, categoryIDs, tagIDs, now)
	if err != nil {
		return err
	}
	if err := seedDefaultComments(db, adminUser.ID, defaultUser.ID, blogIDs, now); err != nil {
		return err
	}
	if err := seedDefaultSettings(db, now); err != nil {
		return err
	}
	if err := seedDefaultAuditLogs(db, adminUser.ID, blogIDs, now); err != nil {
		return err
	}
	return nil
}

func findUserByUsername(db *gorm.DB, username string) (*User, error) {
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func seedDefaultTags(db *gorm.DB, now time.Time) (map[string]uint, error) {
	defaultTags := []Tag{
		{Name: "Go", Slug: "go", Color: "#00ADD8", CreatedAt: now},
		{Name: "Gin", Slug: "gin", Color: "#009688", CreatedAt: now},
		{Name: "REST", Slug: "rest", Color: "#FF7043", CreatedAt: now},
		{Name: "Cashew", Slug: "cashew", Color: "#8D6E63", CreatedAt: now},
	}

	result := make(map[string]uint, len(defaultTags))
	for _, item := range defaultTags {
		var tag Tag
		err := db.Where("slug = ?", item.Slug).First(&tag).Error
		if err == nil {
			result[item.Slug] = tag.ID
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err := db.Create(&item).Error; err != nil {
			return nil, err
		}
		result[item.Slug] = item.ID
	}
	return result, nil
}

func seedDefaultUserAvatars(db *gorm.DB, adminID uint, userID uint, assetIDs map[string]uint, now time.Time) error {
	adminAvatarID := assetIDs["admin-avatar.png"]
	userAvatarID := assetIDs["user-avatar.png"]

	if err := db.Model(&User{}).Where("id = ? AND avatar IS NULL", adminID).Updates(map[string]any{
		"avatar":     adminAvatarID,
		"updated_at": now,
	}).Error; err != nil {
		return err
	}
	if err := db.Model(&User{}).Where("id = ? AND avatar IS NULL", userID).Updates(map[string]any{
		"avatar":     userAvatarID,
		"updated_at": now,
	}).Error; err != nil {
		return err
	}
	return nil
}

func seedDefaultCategories(db *gorm.DB, now time.Time) (map[string]uint, error) {
	defaultCategories := []Category{
		{Name: "Backend", Slug: "backend", Desc: "Backend engineering notes", CreatedAt: now},
		{Name: "Product", Slug: "product", Desc: "Product and project notes", CreatedAt: now},
	}

	result := make(map[string]uint, len(defaultCategories))
	for _, item := range defaultCategories {
		var category Category
		err := db.Where("slug = ?", item.Slug).First(&category).Error
		if err == nil {
			result[item.Slug] = category.ID
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err := db.Create(&item).Error; err != nil {
			return nil, err
		}
		result[item.Slug] = item.ID
	}
	return result, nil
}

func seedDefaultAssets(db *gorm.DB, adminID uint, userID uint, now time.Time) (map[string]uint, error) {
	defaultAssets := []Asset{
		{
			FileName:         "admin-avatar.png",
			OriginalFileName: "admin-avatar.png",
			MimeType:         "image/png",
			FileExtension:    ".png",
			FilePath:         "admin-avatar.png",
			FileHash:         cryptoutil.SHA256Hex("seed:admin-avatar"),
			FileSize:         2048,
			Width:            256,
			Height:           256,
			Uploader:         adminID,
			State:            AssetStateNormal,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			FileName:         "default-cover.png",
			OriginalFileName: "default-cover.png",
			MimeType:         "image/png",
			FileExtension:    ".png",
			FilePath:         "default-cover.png",
			FileHash:         cryptoutil.SHA256Hex("seed:default-cover"),
			FileSize:         8192,
			Width:            1280,
			Height:           720,
			Uploader:         adminID,
			State:            AssetStateNormal,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			FileName:         "user-avatar.png",
			OriginalFileName: "user-avatar.png",
			MimeType:         "image/png",
			FileExtension:    ".png",
			FilePath:         "user-avatar.png",
			FileHash:         cryptoutil.SHA256Hex("seed:user-avatar"),
			FileSize:         1980,
			Width:            256,
			Height:           256,
			Uploader:         userID,
			State:            AssetStateNormal,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
	}

	result := make(map[string]uint, len(defaultAssets))
	for _, item := range defaultAssets {
		var asset Asset
		err := db.Where("file_hash = ?", item.FileHash).First(&asset).Error
		if err == nil {
			result[item.FileName] = asset.ID
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err := db.Create(&item).Error; err != nil {
			return nil, err
		}
		result[item.FileName] = item.ID
	}

	return result, nil
}

func seedDefaultBlogs(db *gorm.DB, adminID uint, userID uint, assetIDs map[string]uint, categoryIDs map[string]uint, tagIDs map[string]uint, now time.Time) (map[string]uint, error) {
	backendCategoryID := categoryIDs["backend"]
	productCategoryID := categoryIDs["product"]
	coverID := assetIDs["default-cover.png"]
	defaultBlogs := []Blog{
		{
			State:           BlogStatePublic,
			Title:           "Getting Started With CashewBlog",
			Slug:            "getting-started-with-cashewblog",
			Summary:         "Project bootstrap notes and current API status.",
			ContentMarkdown: "# Getting Started\n\nThis seeded article explains the current CashewBlog API scaffold.",
			Author:          adminID,
			TitleImage:      &coverID,
			Category:        &backendCategoryID,
			AllowComment:    true,
			IsTop:           true,
			ViewCount:       128,
			LikeCount:       12,
			CommentCount:    2,
			CreatedAt:       now.Add(-72 * time.Hour),
			UpdatedAt:       now.Add(-48 * time.Hour),
			PublishedAt:     timePtr(now.Add(-48 * time.Hour)),
		},
		{
			State:           BlogStateDraft,
			Title:           "Designing A Clean MVC API Layer",
			Slug:            "designing-clean-mvc-api-layer",
			Summary:         "Notes on splitting handlers, services, and repositories cleanly.",
			ContentMarkdown: "# MVC API\n\nHandlers stay thin, services hold orchestration, repositories stay query-focused.",
			Author:          adminID,
			TitleImage:      &coverID,
			Category:        &backendCategoryID,
			AllowComment:    false,
			IsTop:           false,
			ViewCount:       0,
			LikeCount:       0,
			CommentCount:    0,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now.Add(-12 * time.Hour),
		},
		{
			State:           BlogStatePublic,
			Title:           "Weekly Product Log",
			Slug:            "weekly-product-log",
			Summary:         "A sample public post from the default user.",
			ContentMarkdown: "# Product Log\n\nThis post exists so `/api/v1/me/blogs` and public list queries have more than one author.",
			Author:          userID,
			TitleImage:      &coverID,
			Category:        &productCategoryID,
			AllowComment:    true,
			IsTop:           false,
			ViewCount:       64,
			LikeCount:       6,
			CommentCount:    1,
			CreatedAt:       now.Add(-96 * time.Hour),
			UpdatedAt:       now.Add(-72 * time.Hour),
			PublishedAt:     timePtr(now.Add(-72 * time.Hour)),
		},
	}

	result := make(map[string]uint, len(defaultBlogs))
	for _, item := range defaultBlogs {
		var blog Blog
		err := db.Where("slug = ?", item.Slug).First(&blog).Error
		if err == nil {
			result[item.Slug] = blog.ID
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err := db.Create(&item).Error; err != nil {
			return nil, err
		}
		result[item.Slug] = item.ID
	}

	blogTagMap := map[string][]string{
		"getting-started-with-cashewblog": {"go", "gin", "cashew"},
		"designing-clean-mvc-api-layer":   {"go", "rest"},
		"weekly-product-log":              {"cashew"},
	}
	for blogSlug, tagSlugs := range blogTagMap {
		blogID := result[blogSlug]
		for _, tagSlug := range tagSlugs {
			rel := BlogTag{BlogID: blogID, TagID: tagIDs[tagSlug]}
			if err := db.Where("blog_id = ? AND tag_id = ?", rel.BlogID, rel.TagID).FirstOrCreate(&rel).Error; err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

func seedDefaultComments(db *gorm.DB, adminID uint, userID uint, blogIDs map[string]uint, now time.Time) error {
	defaultComments := []Comment{
		{
			BlogID:    blogIDs["getting-started-with-cashewblog"],
			UserID:    userID,
			Content:   "This seeded comment is useful for comment list testing.",
			State:     CommentStateNormal,
			IP:        "127.0.0.1",
			CreatedAt: now.Add(-36 * time.Hour),
			UpdatedAt: now.Add(-36 * time.Hour),
		},
		{
			BlogID:    blogIDs["getting-started-with-cashewblog"],
			UserID:    adminID,
			Content:   "Admin reply seeded for nested-comment follow-up work.",
			State:     CommentStateNormal,
			IP:        "127.0.0.1",
			CreatedAt: now.Add(-35 * time.Hour),
			UpdatedAt: now.Add(-35 * time.Hour),
		},
		{
			BlogID:    blogIDs["weekly-product-log"],
			UserID:    adminID,
			Content:   "Cross-user sample comment.",
			State:     CommentStateNormal,
			IP:        "127.0.0.1",
			CreatedAt: now.Add(-70 * time.Hour),
			UpdatedAt: now.Add(-70 * time.Hour),
		},
	}

	for _, item := range defaultComments {
		var comment Comment
		err := db.Where("blog_id = ? AND user_id = ? AND content = ?", item.BlogID, item.UserID, item.Content).First(&comment).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := db.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedDefaultSettings(db *gorm.DB, now time.Time) error {
	defaultSettings := []Setting{
		{Key: "site_name", Value: "CashewBlog", Type: SettingTypeString, Group: "public", Description: "Site name shown in public pages", UpdatedAt: now},
		{Key: "site_desc", Value: "A seeded demo blog API project", Type: SettingTypeString, Group: "public", Description: "Public site description", UpdatedAt: now},
		{Key: "site_keywords", Value: "go,gin,blog,api", Type: SettingTypeString, Group: "public", Description: "Public SEO keywords", UpdatedAt: now},
		{Key: "home.banner_title", Value: "CashewBlog", Type: SettingTypeString, Group: "public", Description: "Home banner title", UpdatedAt: now},
		{Key: "home.banner_subtitle", Value: "A seeded demo blog API project", Type: SettingTypeString, Group: "public", Description: "Home banner subtitle", UpdatedAt: now},
		{Key: "home.banner_image", Value: "", Type: SettingTypeString, Group: "public", Description: "Home banner image", UpdatedAt: now},
		{Key: "home.typing_animation", Value: "true", Type: SettingTypeBool, Group: "public", Description: "Whether home typing animation is enabled", UpdatedAt: now},
		{Key: "allow_register", Value: "true", Type: SettingTypeBool, Group: "system", Description: "Whether registration is enabled", UpdatedAt: now},
		{Key: "default_user_role", Value: "user", Type: SettingTypeString, Group: "system", Description: "Default role for new users", UpdatedAt: now},
		{Key: "upload_max_size", Value: "10485760", Type: SettingTypeInt, Group: "system", Description: "Max upload size in bytes", UpdatedAt: now},
	}

	for _, item := range defaultSettings {
		var setting Setting
		err := db.Where("`key` = ?", item.Key).First(&setting).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := db.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedDefaultAuditLogs(db *gorm.DB, adminID uint, blogIDs map[string]uint, now time.Time) error {
	defaultLogs := []AuditLog{
		{
			UserID:     &adminID,
			Action:     "seed.blog.publish",
			TargetType: "blog",
			TargetID:   blogIDs["getting-started-with-cashewblog"],
			Detail:     datatypes.JSON([]byte(`{"state":"public","source":"seed"}`)),
			IP:         "127.0.0.1",
			CreatedAt:  now.Add(-48 * time.Hour),
		},
		{
			UserID:     &adminID,
			Action:     "seed.settings.init",
			TargetType: "setting",
			TargetID:   0,
			Detail:     datatypes.JSON([]byte(`{"count":6,"source":"seed"}`)),
			IP:         "127.0.0.1",
			CreatedAt:  now.Add(-47 * time.Hour),
		},
	}

	for _, item := range defaultLogs {
		var log AuditLog
		err := db.Where("action = ? AND target_type = ? AND target_id = ?", item.Action, item.TargetType, item.TargetID).First(&log).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := db.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func timePtr(t time.Time) *time.Time {
	return &t
}
