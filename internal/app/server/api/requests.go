package api

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type BlogUpsertRequest struct {
	Title           string `json:"title" binding:"required"`
	Slug            string `json:"slug" binding:"required"`
	Summary         string `json:"summary"`
	ContentMarkdown string `json:"content_markdown"`
	TitleImageID    *uint  `json:"title_image_id"`
	CategoryID      *uint  `json:"category_id"`
	TagIDs          []uint `json:"tag_ids"`
	AllowComment    bool   `json:"allow_comment"`
	IsTop           bool   `json:"is_top"`
	State           string `json:"state"`
}

type BlogStateRequest struct {
	State string `json:"state" binding:"required"`
}

type CommentCreateRequest struct {
	Content  string `json:"content" binding:"required"`
	ParentID uint   `json:"parent_id"`
}

type CommentUpdateRequest struct {
	Content string `json:"content" binding:"required"`
}

type CommentStateRequest struct {
	State string `json:"state" binding:"required"`
}

type TagUpsertRequest struct {
	Name  string `json:"name" binding:"required"`
	Slug  string `json:"slug" binding:"required"`
	Color string `json:"color"`
}

type CategoryUpsertRequest struct {
	Name     string `json:"name" binding:"required"`
	Slug     string `json:"slug" binding:"required"`
	ParentID uint   `json:"parent_id"`
	Desc     string `json:"desc"`
}

type UserProfileUpdateRequest struct {
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Gender   string `json:"gender"`
	Bio      string `json:"bio"`
	Website  string `json:"website"`
	AvatarID *uint  `json:"avatar_id"`
}

type PasswordUpdateRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NextPassword    string `json:"next_password" binding:"required"`
}

type AvatarUpdateRequest struct {
	AvatarID uint `json:"avatar_id" binding:"required"`
}

type UserCreateRequest struct {
	Username string `json:"username" binding:"required"`
	Nickname string `json:"nickname" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Role     string `json:"role"`
	Gender   string `json:"gender"`
	Bio      string `json:"bio"`
	Website  string `json:"website"`
	AvatarID *uint  `json:"avatar_id"`
	Password string `json:"password" binding:"required"`
}

type UserUpdateRequest struct {
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Gender   string `json:"gender"`
	Bio      string `json:"bio"`
	Website  string `json:"website"`
	AvatarID *uint  `json:"avatar_id"`
}

type UserStateRequest struct {
	State string `json:"state" binding:"required"`
}

type UserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

type AdminSettingsUpdateItem struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value"`
}

type AdminSettingsUpdateRequest struct {
	Items []AdminSettingsUpdateItem `json:"items" binding:"required"`
}

type AdminSettingPutRequest struct {
	Value string `json:"value"`
}

type HomeSiteUpdateRequest struct {
	BannerTitle     string `json:"banner_title"`
	BannerSubtitle  string `json:"banner_subtitle"`
	BannerImage     string `json:"banner_image"`
	TypingAnimation bool   `json:"typing_animation"`
}
