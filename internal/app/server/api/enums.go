package api

import "CashewBlog/internal/pkg/database"

func UserStateName(state int) string {
	switch state {
	case database.UserStateRegistered:
		return "registered"
	case database.UserStateVerified:
		return "verified"
	case database.UserStateBanned:
		return "banned"
	case database.UserStateDeleted:
		return "deleted"
	default:
		return "unknown"
	}
}

func UserRoleName(role int) string {
	switch role {
	case database.UserRoleUser:
		return "user"
	case database.UserRoleAdmin:
		return "admin"
	case database.UserRoleSuperAdmin:
		return "super_admin"
	default:
		return "unknown"
	}
}

func GenderName(gender int) string {
	switch gender {
	case database.GenderMale:
		return "male"
	case database.GenderFemale:
		return "female"
	case database.GenderOther:
		return "other"
	default:
		return "unknown"
	}
}

func BlogStateName(state int) string {
	switch state {
	case database.BlogStateDraft:
		return "draft"
	case database.BlogStatePending:
		return "pending"
	case database.BlogStatePublic:
		return "public"
	case database.BlogStatePrivate:
		return "private"
	case database.BlogStateDeleted:
		return "deleted"
	default:
		return "unknown"
	}
}

func CommentStateName(state int) string {
	switch state {
	case database.CommentStateNormal:
		return "normal"
	case database.CommentStateHidden:
		return "hidden"
	case database.CommentStateDeleted:
		return "deleted"
	default:
		return "unknown"
	}
}

func AssetStateName(state int) string {
	switch state {
	case database.AssetStateNormal:
		return "normal"
	case database.AssetStateHidden:
		return "hidden"
	case database.AssetStateDeleted:
		return "deleted"
	default:
		return "unknown"
	}
}

func SettingTypeName(t int) string {
	switch t {
	case database.SettingTypeBool:
		return "bool"
	case database.SettingTypeInt:
		return "int"
	case database.SettingTypeString:
		return "string"
	case database.SettingTypeJSON:
		return "json"
	default:
		return "unknown"
	}
}
