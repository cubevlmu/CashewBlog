package database

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	UserStateRegistered = 1
	UserStateVerified   = 2
	UserStateBanned     = 3
	UserStateDeleted    = 4
)

const (
	UserRoleUser       = 1
	UserRoleAdmin      = 2
	UserRoleSuperAdmin = 3
)

const (
	GenderUnknown = 0
	GenderMale    = 1
	GenderFemale  = 2
	GenderOther   = 3
)

const (
	BlogStateDraft   = 1
	BlogStatePublic  = 2
	BlogStatePrivate = 3
	BlogStateDeleted = 4
	BlogStatePending = 5
)

const (
	CommentStateNormal  = 1
	CommentStateHidden  = 2
	CommentStateDeleted = 3
)

const (
	AssetStateNormal  = 1
	AssetStateDeleted = 2
	AssetStateHidden  = 3
)

const (
	UserTokenTypeEmailVerify   = 1
	UserTokenTypeResetPassword = 2
	UserTokenTypeChangeEmail   = 3
)

const (
	SettingTypeBool   = 1
	SettingTypeInt    = 2
	SettingTypeString = 3
	SettingTypeJSON   = 4
)

type User struct {
	ID            uint           `gorm:"primaryKey"`
	State         int            `gorm:"not null;default:1;index"`
	Role          int            `gorm:"not null;default:1;index"`
	Username      string         `gorm:"size:64;not null;uniqueIndex"`
	Nickname      string         `gorm:"size:128;not null"`
	PasswordHash  string         `gorm:"size:255;not null"`
	Avatar        *uint          `gorm:"index"`
	Gender        int            `gorm:"not null;default:0"`
	Email         string         `gorm:"size:255;not null;uniqueIndex"`
	Bio           string         `gorm:"type:text"`
	Website       string         `gorm:"size:255"`
	RegisterDate  time.Time      `gorm:"not null;index"`
	LastLogin     *time.Time     `gorm:"index"`
	LastLoginIP   string         `gorm:"column:last_login_ip;size:64"`
	EmailVerified bool           `gorm:"not null;default:false"`
	CreatedAt     time.Time      `gorm:"not null"`
	UpdatedAt     time.Time      `gorm:"not null"`
	DeletedAt     gorm.DeletedAt `gorm:"index"`
}

type Blog struct {
	ID              uint           `gorm:"primaryKey"`
	State           int            `gorm:"not null;default:1;index"`
	Title           string         `gorm:"size:255;not null"`
	Slug            string         `gorm:"size:255;not null;uniqueIndex"`
	Summary         string         `gorm:"type:text"`
	ContentMarkdown string         `gorm:"type:longtext;not null"`
	Author          uint           `gorm:"not null;index"`
	TitleImage      *uint          `gorm:"index"`
	Category        *uint          `gorm:"index"`
	AllowComment    bool           `gorm:"not null;default:true"`
	IsTop           bool           `gorm:"not null;default:false;index"`
	ViewCount       uint64         `gorm:"not null;default:0"`
	LikeCount       uint64         `gorm:"not null;default:0"`
	CommentCount    uint64         `gorm:"not null;default:0"`
	CreatedAt       time.Time      `gorm:"not null"`
	UpdatedAt       time.Time      `gorm:"not null"`
	PublishedAt     *time.Time     `gorm:"index"`
	DeletedAt       gorm.DeletedAt `gorm:"index"`
}

type Tag struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"size:64;not null;uniqueIndex"`
	Slug      string    `gorm:"size:64;not null;uniqueIndex"`
	Desc      string    `gorm:"column:desc;type:text"`
	Color     string    `gorm:"size:32"`
	CreatedAt time.Time `gorm:"not null"`
}

type BlogTag struct {
	BlogID uint `gorm:"primaryKey"`
	TagID  uint `gorm:"primaryKey"`
}

type Category struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"size:128;not null;uniqueIndex"`
	Slug      string    `gorm:"size:128;not null;uniqueIndex"`
	Parent    *uint     `gorm:"index"`
	Desc      string    `gorm:"column:desc;type:text"`
	CreatedAt time.Time `gorm:"not null"`
}

type Comment struct {
	ID        uint           `gorm:"primaryKey"`
	BlogID    uint           `gorm:"not null;index"`
	UserID    uint           `gorm:"not null;index"`
	ParentID  *uint          `gorm:"index"`
	Content   string         `gorm:"type:text;not null"`
	State     int            `gorm:"not null;default:1;index"`
	IP        string         `gorm:"column:ip;size:64"`
	CreatedAt time.Time      `gorm:"not null"`
	UpdatedAt time.Time      `gorm:"not null"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type Asset struct {
	ID               uint      `gorm:"primaryKey"`
	FileName         string    `gorm:"size:255;not null"`
	OriginalFileName string    `gorm:"size:255;not null"`
	MimeType         string    `gorm:"size:128;not null"`
	FileExtension    string    `gorm:"size:32;not null"`
	FilePath         string    `gorm:"size:1024;not null"`
	FileHash         string    `gorm:"size:255;not null;uniqueIndex"`
	FileSize         int64     `gorm:"not null"`
	Width            int       `gorm:"not null;default:0"`
	Height           int       `gorm:"not null;default:0"`
	Uploader         uint      `gorm:"not null;index"`
	State            int       `gorm:"not null;default:1;index"`
	CreatedAt        time.Time `gorm:"not null"`
	UpdatedAt        time.Time `gorm:"not null"`
}

type UserSession struct {
	ID               uint       `gorm:"primaryKey"`
	UserID           uint       `gorm:"not null;index"`
	TokenHash        string     `gorm:"size:255;not null;index"`
	RefreshTokenHash string     `gorm:"size:255;not null;index"`
	DeviceInfo       string     `gorm:"type:text"`
	IP               string     `gorm:"column:ip;size:64"`
	UserAgent        string     `gorm:"type:text"`
	ExpiresAt        time.Time  `gorm:"not null;index"`
	CreatedAt        time.Time  `gorm:"not null"`
	LastUsedAt       *time.Time `gorm:"index"`
	RevokedAt        *time.Time `gorm:"index"`
}

type UserToken struct {
	ID        uint       `gorm:"primaryKey"`
	UserID    uint       `gorm:"not null;index"`
	Type      int        `gorm:"not null;index"`
	TokenHash string     `gorm:"size:255;not null;uniqueIndex"`
	ExpiresAt time.Time  `gorm:"not null;index"`
	UsedAt    *time.Time `gorm:"index"`
	CreatedAt time.Time  `gorm:"not null"`
}

type Setting struct {
	ID          uint      `gorm:"primaryKey"`
	Key         string    `gorm:"size:128;not null;uniqueIndex"`
	Value       string    `gorm:"type:text;not null"`
	Type        int       `gorm:"not null;default:3;index"`
	Group       string    `gorm:"column:group_name;size:128;not null;index"`
	Description string    `gorm:"type:text"`
	UpdatedAt   time.Time `gorm:"not null"`
}

type AuditLog struct {
	ID         uint           `gorm:"primaryKey"`
	UserID     *uint          `gorm:"index"`
	Action     string         `gorm:"size:128;not null;index"`
	TargetType string         `gorm:"size:128;not null;index"`
	TargetID   uint           `gorm:"not null;default:0;index"`
	Detail     datatypes.JSON `gorm:"type:json"`
	IP         string         `gorm:"column:ip;size:64"`
	CreatedAt  time.Time      `gorm:"not null;index"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&Blog{},
		&Tag{},
		&BlogTag{},
		&Category{},
		&Comment{},
		&Asset{},
		&UserSession{},
		&UserToken{},
		&Setting{},
		&AuditLog{},
	)
}
