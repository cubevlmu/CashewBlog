package api

import "time"

type AssetRef struct {
	ID  uint   `json:"id"`
	URL string `json:"url"`
}

type UserLite struct {
	ID       uint      `json:"id"`
	Username string    `json:"username"`
	Nickname string    `json:"nickname"`
	Avatar   *AssetRef `json:"avatar,omitempty"`
}

type UserSummary struct {
	ID       uint      `json:"id"`
	Username string    `json:"username"`
	Nickname string    `json:"nickname"`
	Avatar   *AssetRef `json:"avatar,omitempty"`
	Gender   string    `json:"gender"`
	Bio      string    `json:"bio"`
	Website  string    `json:"website"`
	Role     string    `json:"role"`
}

type UserProfile struct {
	ID            uint       `json:"id"`
	State         string     `json:"state"`
	Role          string     `json:"role"`
	Username      string     `json:"username"`
	Nickname      string     `json:"nickname"`
	Avatar        *AssetRef  `json:"avatar,omitempty"`
	Gender        string     `json:"gender"`
	Email         string     `json:"email"`
	Bio           string     `json:"bio"`
	Website       string     `json:"website"`
	RegisterDate  time.Time  `json:"register_date"`
	LastLogin     *time.Time `json:"last_login"`
	EmailVerified bool       `json:"email_verified"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type TagItem struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Desc      string    `json:"desc"`
	Color     string    `json:"color"`
	PostCount int64     `json:"post_count"`
	CreatedAt time.Time `json:"created_at"`
}

type CategoryParent struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type CategoryItem struct {
	ID        uint           `json:"id"`
	Name      string         `json:"name"`
	Slug      string         `json:"slug"`
	Parent    CategoryParent `json:"parent"`
	Desc      string         `json:"desc"`
	PostCount int64          `json:"post_count"`
	CreatedAt time.Time      `json:"created_at"`
}

type AssetItem struct {
	ID               uint      `json:"id"`
	FileName         string    `json:"file_name"`
	OriginalFileName string    `json:"original_file_name"`
	MimeType         string    `json:"mime_type"`
	FileExtension    string    `json:"file_extension"`
	URL              string    `json:"url"`
	FileHash         string    `json:"file_hash"`
	FileSize         int64     `json:"file_size"`
	Width            int       `json:"width"`
	Height           int       `json:"height"`
	Uploader         UserLite  `json:"uploader"`
	State            string    `json:"state"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type BlogCategoryRef struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	Desc string `json:"desc,omitempty"`
}

type BlogAuthor struct {
	ID       uint      `json:"id"`
	Username string    `json:"username"`
	Nickname string    `json:"nickname"`
	Avatar   *AssetRef `json:"avatar,omitempty"`
	Bio      string    `json:"bio,omitempty"`
	Website  string    `json:"website,omitempty"`
}

type BlogTag struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Desc  string `json:"desc,omitempty"`
	Color string `json:"color"`
}

type BlogListItem struct {
	ID           uint             `json:"id"`
	State        string           `json:"state"`
	Title        string           `json:"title"`
	Slug         string           `json:"slug"`
	Summary      string           `json:"summary"`
	TitleImage   *AssetRef        `json:"title_image,omitempty"`
	Author       BlogAuthor       `json:"author"`
	Category     *BlogCategoryRef `json:"category"`
	Tags         []BlogTag        `json:"tags"`
	AllowComment bool             `json:"allow_comment"`
	IsTop        bool             `json:"is_top"`
	ViewCount    uint64           `json:"view_count"`
	LikeCount    uint64           `json:"like_count"`
	CommentCount uint64           `json:"comment_count"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
	PublishedAt  *time.Time       `json:"published_at"`
}

type BlogDetail struct {
	BlogListItem
	ContentMarkdown string `json:"content_markdown"`
}

type CommentItem struct {
	ID        uint          `json:"id"`
	BlogID    uint          `json:"blog_id"`
	ParentID  uint          `json:"parent_id"`
	Content   string        `json:"content"`
	State     string        `json:"state"`
	User      UserLite      `json:"user"`
	Children  []CommentItem `json:"children"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type SettingItem struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Type        string `json:"type"`
	Group       string `json:"group"`
	Description string `json:"description"`
}

type AuditLogItem struct {
	ID         uint        `json:"id"`
	UserID     *uint       `json:"user_id"`
	Action     string      `json:"action"`
	TargetType string      `json:"target_type"`
	TargetID   uint        `json:"target_id"`
	Detail     interface{} `json:"detail"`
	IP         string      `json:"ip"`
	CreatedAt  time.Time   `json:"created_at"`
}

type TrendPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type DashboardSummary struct {
	BlogCount     int64 `json:"blog_count"`
	UserCount     int64 `json:"user_count"`
	CommentCount  int64 `json:"comment_count"`
	TagCount      int64 `json:"tag_count"`
	CategoryCount int64 `json:"category_count"`
	AssetCount    int64 `json:"asset_count"`
	TodayViews    int64 `json:"today_views"`
	TodayComments int64 `json:"today_comments"`
}

type AdminStats struct {
	BlogTrend    []TrendPoint `json:"blog_trend"`
	ViewTrend    []TrendPoint `json:"view_trend"`
	CommentTrend []TrendPoint `json:"comment_trend"`
}

type HomeSiteConfig struct {
	BannerTitle     string `json:"banner_title"`
	BannerSubtitle  string `json:"banner_subtitle"`
	BannerImageID   *uint  `json:"banner_image_id,omitempty"`
	TypingAnimation bool   `json:"typing_animation"`
}
