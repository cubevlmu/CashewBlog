package api

import (
	"encoding/json"
	"fmt"

	"CashewBlog/internal/pkg/database"
)

func AssetRefFromModel(asset *database.Asset) *AssetRef {
	if asset == nil {
		return nil
	}
	return &AssetRef{
		ID:  asset.ID,
		URL: assetURL(asset.ID),
	}
}

func assetURL(id uint) string {
	if id == 0 {
		return ""
	}
	return fmt.Sprintf("/api/v1/assets/%d", id)
}

func UserLiteFromModel(user *database.User, avatar *database.Asset) UserLite {
	if user == nil {
		return UserLite{}
	}
	return UserLite{
		ID:       user.ID,
		Username: user.Username,
		Nickname: user.Nickname,
		Avatar:   AssetRefFromModel(avatar),
	}
}

func UserSummaryFromModel(user *database.User, avatar *database.Asset) UserSummary {
	if user == nil {
		return UserSummary{}
	}
	return UserSummary{
		ID:       user.ID,
		Username: user.Username,
		Nickname: user.Nickname,
		Avatar:   AssetRefFromModel(avatar),
		Gender:   GenderName(user.Gender),
		Bio:      user.Bio,
		Website:  user.Website,
		Role:     UserRoleName(user.Role),
	}
}

func UserProfileFromModel(user *database.User, avatar *database.Asset) UserProfile {
	if user == nil {
		return UserProfile{}
	}
	return UserProfile{
		ID:            user.ID,
		State:         UserStateName(user.State),
		Role:          UserRoleName(user.Role),
		Username:      user.Username,
		Nickname:      user.Nickname,
		Avatar:        AssetRefFromModel(avatar),
		Gender:        GenderName(user.Gender),
		Email:         user.Email,
		Bio:           user.Bio,
		Website:       user.Website,
		RegisterDate:  user.RegisterDate,
		LastLogin:     user.LastLogin,
		EmailVerified: user.EmailVerified,
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
	}
}

func TagItemFromModel(tag *database.Tag) TagItem {
	if tag == nil {
		return TagItem{}
	}
	return TagItem{
		ID:        tag.ID,
		Name:      tag.Name,
		Slug:      tag.Slug,
		Desc:      tag.Desc,
		Color:     tag.Color,
		CreatedAt: tag.CreatedAt,
	}
}

func BlogTagFromModel(tag database.Tag) BlogTag {
	return BlogTag{
		ID:    tag.ID,
		Name:  tag.Name,
		Slug:  tag.Slug,
		Desc:  tag.Desc,
		Color: tag.Color,
	}
}

func CategoryItemFromModel(category *database.Category, parent *database.Category) CategoryItem {
	if category == nil {
		return CategoryItem{}
	}
	parentRef := CategoryParent{}
	if parent != nil {
		parentRef = CategoryParent{
			ID:   parent.ID,
			Name: parent.Name,
			Slug: parent.Slug,
		}
	}
	return CategoryItem{
		ID:        category.ID,
		Name:      category.Name,
		Slug:      category.Slug,
		Parent:    parentRef,
		Desc:      category.Desc,
		CreatedAt: category.CreatedAt,
	}
}

func BlogCategoryRefFromModel(category *database.Category) *BlogCategoryRef {
	if category == nil {
		return nil
	}
	return &BlogCategoryRef{
		ID:   category.ID,
		Name: category.Name,
		Slug: category.Slug,
		Desc: category.Desc,
	}
}

func BlogAuthorFromModel(user *database.User, avatar *database.Asset, includeProfile bool) BlogAuthor {
	if user == nil {
		return BlogAuthor{}
	}
	author := BlogAuthor{
		ID:       user.ID,
		Username: user.Username,
		Nickname: user.Nickname,
		Avatar:   AssetRefFromModel(avatar),
	}
	if includeProfile {
		author.Bio = user.Bio
		author.Website = user.Website
	}
	return author
}

func BlogListItemFromModel(
	blog *database.Blog,
	author *database.User,
	authorAvatar *database.Asset,
	titleImage *database.Asset,
	category *database.Category,
	tags []database.Tag,
) BlogListItem {
	if blog == nil {
		return BlogListItem{}
	}
	resultTags := make([]BlogTag, 0, len(tags))
	for _, tag := range tags {
		resultTags = append(resultTags, BlogTagFromModel(tag))
	}
	return BlogListItem{
		ID:           blog.ID,
		State:        BlogStateName(blog.State),
		Title:        blog.Title,
		Slug:         blog.Slug,
		Summary:      blog.Summary,
		TitleImage:   AssetRefFromModel(titleImage),
		Author:       BlogAuthorFromModel(author, authorAvatar, false),
		Category:     BlogCategoryRefFromModel(category),
		Tags:         resultTags,
		AllowComment: blog.AllowComment,
		IsTop:        blog.IsTop,
		ViewCount:    blog.ViewCount,
		LikeCount:    blog.LikeCount,
		CommentCount: blog.CommentCount,
		CreatedAt:    blog.CreatedAt,
		UpdatedAt:    blog.UpdatedAt,
		PublishedAt:  blog.PublishedAt,
	}
}

func BlogDetailFromModel(
	blog *database.Blog,
	author *database.User,
	authorAvatar *database.Asset,
	titleImage *database.Asset,
	category *database.Category,
	tags []database.Tag,
) BlogDetail {
	if blog == nil {
		return BlogDetail{}
	}
	item := BlogListItemFromModel(blog, author, authorAvatar, titleImage, category, tags)
	item.Author = BlogAuthorFromModel(author, authorAvatar, true)
	return BlogDetail{
		BlogListItem:    item,
		ContentMarkdown: blog.ContentMarkdown,
	}
}

func AssetItemFromModel(asset *database.Asset, uploader *database.User, uploaderAvatar *database.Asset) AssetItem {
	if asset == nil {
		return AssetItem{}
	}
	return AssetItem{
		ID:               asset.ID,
		FileName:         asset.FileName,
		OriginalFileName: asset.OriginalFileName,
		MimeType:         asset.MimeType,
		FileExtension:    asset.FileExtension,
		URL:              assetURL(asset.ID),
		FileHash:         asset.FileHash,
		FileSize:         asset.FileSize,
		Width:            asset.Width,
		Height:           asset.Height,
		Uploader:         UserLiteFromModel(uploader, uploaderAvatar),
		State:            AssetStateName(asset.State),
		CreatedAt:        asset.CreatedAt,
		UpdatedAt:        asset.UpdatedAt,
	}
}

func CommentItemFromModel(comment *database.Comment, user *database.User, avatar *database.Asset, children []CommentItem) CommentItem {
	if comment == nil {
		return CommentItem{}
	}
	var parentID uint
	if comment.ParentID != nil {
		parentID = *comment.ParentID
	}
	return CommentItem{
		ID:        comment.ID,
		BlogID:    comment.BlogID,
		ParentID:  parentID,
		Content:   comment.Content,
		State:     CommentStateName(comment.State),
		User:      UserLiteFromModel(user, avatar),
		Children:  children,
		CreatedAt: comment.CreatedAt,
		UpdatedAt: comment.UpdatedAt,
	}
}

func SettingItemFromModel(item *database.Setting) SettingItem {
	if item == nil {
		return SettingItem{}
	}
	return SettingItem{
		Key:         item.Key,
		Value:       item.Value,
		Type:        SettingTypeName(item.Type),
		Group:       item.Group,
		Description: item.Description,
	}
}

func AuditLogItemFromModel(item *database.AuditLog) AuditLogItem {
	if item == nil {
		return AuditLogItem{}
	}
	return AuditLogItem{
		ID:         item.ID,
		UserID:     item.UserID,
		Action:     item.Action,
		TargetType: item.TargetType,
		TargetID:   item.TargetID,
		Detail:     decodeAuditDetail(item.Detail),
		IP:         item.IP,
		CreatedAt:  item.CreatedAt,
	}
}

func decodeAuditDetail(raw []byte) interface{} {
	if len(raw) == 0 {
		return map[string]interface{}{}
	}
	var result interface{}
	if err := json.Unmarshal(raw, &result); err != nil {
		return string(raw)
	}
	return result
}
