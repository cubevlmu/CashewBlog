package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	serverapi "CashewBlog/internal/app/server/api"
	"CashewBlog/internal/app/server/repositories"
	"CashewBlog/internal/pkg/cache"
	"CashewBlog/internal/pkg/database"
)

type PageData struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

type ReadService struct {
	repo       *repositories.ReadRepository
	blogs      *repositories.BlogRepository
	assets     *repositories.AssetRepository
	users      *repositories.UserRepository
	comments   *repositories.CommentRepository
	settings   *repositories.SettingRepository
	tags       *repositories.TagRepository
	categories *repositories.CategoryRepository
	cache      *cache.Store
}

type BlogView struct {
	ID           uint        `json:"id"`
	Title        string      `json:"title"`
	Slug         string      `json:"slug"`
	Desc         string      `json:"desc"`
	Content      string      `json:"content,omitempty"`
	Author       interface{} `json:"author"`
	TitleImage   *uint       `json:"title_image"`
	CategoryID   *uint       `json:"category_id"`
	Tags         []TagView   `json:"tags"`
	State        int         `json:"state"`
	AllowComment bool        `json:"allow_comment"`
	IsTop        bool        `json:"is_top"`
	ViewCount    uint64      `json:"view_count"`
	LikeCount    uint64      `json:"like_count"`
	CommentCount uint64      `json:"comment_count"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
	PublishedAt  *time.Time  `json:"published_at"`
}

type TagView struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Desc      string    `json:"desc"`
	Color     string    `json:"color"`
	PostCount int64     `json:"post_count"`
	CreatedAt time.Time `json:"created_at"`
}

type CategoryView struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Desc      string    `json:"desc"`
	ParentID  *uint     `json:"parent_id"`
	PostCount int64     `json:"post_count"`
	CreatedAt time.Time `json:"created_at"`
}

type SettingView struct {
	ID          uint      `json:"id"`
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Type        int       `json:"type"`
	Group       string    `json:"group"`
	Description string    `json:"desc"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CommentView struct {
	ID        uint        `json:"id"`
	BlogID    uint        `json:"blog_id"`
	UserID    uint        `json:"user_id"`
	ParentID  *uint       `json:"parent_id"`
	Content   string      `json:"content"`
	State     int         `json:"state"`
	IP        string      `json:"ip"`
	User      interface{} `json:"user"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type AuditLogView struct {
	ID         uint        `json:"id"`
	UserID     *uint       `json:"user_id"`
	Action     string      `json:"action"`
	TargetType string      `json:"target_type"`
	TargetID   uint        `json:"target_id"`
	Detail     interface{} `json:"detail"`
	IP         string      `json:"ip"`
	CreatedAt  time.Time   `json:"created_at"`
	User       interface{} `json:"user,omitempty"`
}

type BlogDetailResult struct {
	Detail   serverapi.BlogDetail `json:"detail"`
	State    int                  `json:"state"`
	AuthorID uint                 `json:"author_id"`
}

type BlogContextResult struct {
	Blog     serverapi.BlogDetail    `json:"blog"`
	Comments []gin.H                 `json:"comments"`
	PrevBlog *serverapi.BlogListItem `json:"prev_blog"`
	NextBlog *serverapi.BlogListItem `json:"next_blog"`
}

func NewReadService(repo *repositories.ReadRepository, blogs *repositories.BlogRepository, assets *repositories.AssetRepository, users *repositories.UserRepository, comments *repositories.CommentRepository, settings *repositories.SettingRepository, tags *repositories.TagRepository, categories *repositories.CategoryRepository, store *cache.Store) *ReadService {
	return &ReadService{repo: repo, blogs: blogs, assets: assets, users: users, comments: comments, settings: settings, tags: tags, categories: categories, cache: store}
}

// InvalidateAll clears cached read payloads after write-side mutations.
func (s *ReadService) InvalidateAll() {
	if s == nil || s.cache == nil {
		return
	}
	s.cache.Clear()
}

func (s *ReadService) GetCurrentUser(ctx context.Context, userID uint, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		user, err := s.users.GetByID(ctx, userID)
		if err != nil || user == nil {
			return nil, err
		}
		return safeUserView(*user), nil
	})
}

func (s *ReadService) GetCurrentUserProfile(ctx context.Context, userID uint, key string) (*serverapi.UserProfile, error) {
	return cached(s.cache, key, func() (*serverapi.UserProfile, error) {
		user, err := s.users.GetByID(ctx, userID)
		if err != nil || user == nil {
			return nil, err
		}

		var avatar *database.Asset
		if user.Avatar != nil {
			assets, err := s.assets.LoadByIDs(ctx, []uint{*user.Avatar})
			if err != nil {
				return nil, err
			}
			if item, ok := assets[*user.Avatar]; ok {
				avatar = &item
			}
		}

		profile := serverapi.UserProfileFromModel(user, avatar)
		return &profile, nil
	})
}

func (s *ReadService) GetAuthUserLite(ctx context.Context, userID uint, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		user, err := s.users.GetByID(ctx, userID)
		if err != nil || user == nil {
			return nil, err
		}

		var avatar *database.Asset
		if user.Avatar != nil {
			assets, err := s.assets.LoadByIDs(ctx, []uint{*user.Avatar})
			if err != nil {
				return nil, err
			}
			if item, ok := assets[*user.Avatar]; ok {
				avatar = &item
			}
		}

		return gin.H{
			"id":       user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"role":     serverapi.UserRoleName(user.Role),
			"avatar":   serverapi.AssetRefFromModel(avatar),
		}, nil
	})
}

func (s *ReadService) ListAdminUsers(ctx context.Context, filter repositories.UserListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.users.List(ctx, filter)
		if err != nil {
			return nil, err
		}

		list, err := s.composeUserProfiles(ctx, items)
		if err != nil {
			return nil, err
		}

		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetAdminUserProfile(ctx context.Context, id uint, key string) (*serverapi.UserProfile, error) {
	return cached(s.cache, key, func() (*serverapi.UserProfile, error) {
		user, err := s.users.GetByID(ctx, id)
		if err != nil || user == nil {
			return nil, err
		}

		var avatar *database.Asset
		if user.Avatar != nil {
			assets, err := s.assets.LoadByIDs(ctx, []uint{*user.Avatar})
			if err != nil {
				return nil, err
			}
			if item, ok := assets[*user.Avatar]; ok {
				avatar = &item
			}
		}

		profile := serverapi.UserProfileFromModel(user, avatar)
		return &profile, nil
	})
}

func (s *ReadService) GetUserLiteByUsername(ctx context.Context, username string, key string) (*serverapi.UserLite, error) {
	return cached(s.cache, key, func() (*serverapi.UserLite, error) {
		user, err := s.users.GetByUsername(ctx, username)
		if err != nil || user == nil {
			return nil, err
		}

		var avatar *database.Asset
		if user.Avatar != nil {
			assets, err := s.assets.LoadByIDs(ctx, []uint{*user.Avatar})
			if err != nil {
				return nil, err
			}
			if item, ok := assets[*user.Avatar]; ok {
				avatar = &item
			}
		}

		profile := serverapi.UserLiteFromModel(user, avatar)
		return &profile, nil
	})
}

func (s *ReadService) ListUsers(ctx context.Context, filter repositories.UserListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.users.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list := make([]gin.H, 0, len(items))
		for _, item := range items {
			list = append(list, safeUserView(item))
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetUser(ctx context.Context, id uint, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		item, err := s.users.GetByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}
		return safeUserView(*item), nil
	})
}

func (s *ReadService) ListTags(ctx context.Context, filter repositories.TagListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.repo.ListTags(ctx, filter)
		if err != nil {
			return nil, err
		}
		if s.tags != nil {
			_ = s.tags.RefreshArticleCounts(ctx)
		}
		list := make([]TagView, 0, len(items))
		for _, item := range items {
			list = append(list, s.tagToView(item))
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetTag(ctx context.Context, id uint, key string) (*TagView, error) {
	return cached(s.cache, key, func() (*TagView, error) {
		item, err := s.repo.GetTagByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}
		view := s.tagToView(*item)
		return &view, nil
	})
}

func (s *ReadService) GetTagRefByID(ctx context.Context, id uint, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		item, err := s.repo.GetTagByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}
		if s.tags != nil {
			_ = s.tags.RefreshArticleCounts(ctx)
		}
		return gin.H{"id": item.ID, "name": item.Name, "slug": item.Slug, "desc": item.Desc, "color": item.Color, "post_count": s.tagArticleCount(item.ID)}, nil
	})
}

func (s *ReadService) GetTagRefBySlug(ctx context.Context, slug string, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		item, err := s.repo.GetTagBySlug(ctx, slug)
		if err != nil || item == nil {
			return nil, err
		}
		if s.tags != nil {
			_ = s.tags.RefreshArticleCounts(ctx)
		}
		return gin.H{"id": item.ID, "name": item.Name, "slug": item.Slug, "desc": item.Desc, "color": item.Color, "post_count": s.tagArticleCount(item.ID)}, nil
	})
}

func (s *ReadService) ListCategories(ctx context.Context, filter repositories.CategoryListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.repo.ListCategories(ctx, filter)
		if err != nil {
			return nil, err
		}
		list := make([]CategoryView, 0, len(items))
		for _, item := range items {
			list = append(list, s.categoryToView(item))
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) ListPublicCategories(ctx context.Context, filter repositories.CategoryListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.repo.ListCategories(ctx, filter)
		if err != nil {
			return nil, err
		}
		list, err := s.composePublicCategoryList(ctx, items)
		if err != nil {
			return nil, err
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetCategory(ctx context.Context, id uint, key string) (*CategoryView, error) {
	return cached(s.cache, key, func() (*CategoryView, error) {
		item, err := s.repo.GetCategoryByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}
		return new(s.categoryToView(*item)), nil
	})
}

func (s *ReadService) GetPublicCategory(ctx context.Context, id uint, key string) (*serverapi.CategoryItem, error) {
	return cached(s.cache, key, func() (*serverapi.CategoryItem, error) {
		item, err := s.repo.GetCategoryByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}

		var parent *database.Category
		if item.Parent != nil {
			parents, err := s.repo.LoadCategoriesByIDs(ctx, []uint{*item.Parent})
			if err != nil {
				return nil, err
			}
			if loaded, ok := parents[*item.Parent]; ok {
				parent = &loaded
			}
		}

		if s.categories != nil {
			_ = s.categories.RefreshArticleCounts(ctx)
		}

		result := serverapi.CategoryItemFromModel(item, parent)
		result.PostCount = s.categoryArticleCount(item.ID)
		return &result, nil
	})
}

func (s *ReadService) GetCategoryRefByID(ctx context.Context, id uint, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		item, err := s.repo.GetCategoryByID(ctx, id)
		if err != nil || item == nil {
			return nil, err
		}
		if s.categories != nil {
			_ = s.categories.RefreshArticleCounts(ctx)
		}
		return gin.H{"id": item.ID, "name": item.Name, "slug": item.Slug, "post_count": s.categoryArticleCount(item.ID)}, nil
	})
}

func (s *ReadService) GetCategoryRefBySlug(ctx context.Context, slug string, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		item, err := s.repo.GetCategoryBySlug(ctx, slug)
		if err != nil || item == nil {
			return nil, err
		}
		if s.categories != nil {
			_ = s.categories.RefreshArticleCounts(ctx)
		}
		return gin.H{"id": item.ID, "name": item.Name, "slug": item.Slug, "post_count": s.categoryArticleCount(item.ID)}, nil
	})
}

func (s *ReadService) ListBlogs(ctx context.Context, filter repositories.BlogListFilter, includeContent bool, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.blogs.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list, err := s.composeBlogs(ctx, items, includeContent)
		if err != nil {
			return nil, err
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) ListPublicBlogs(ctx context.Context, filter repositories.BlogListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.blogs.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list, err := s.composePublicBlogList(ctx, items)
		if err != nil {
			return nil, err
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) ListMyBlogs(ctx context.Context, filter repositories.BlogListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.blogs.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list, err := s.composePublicBlogList(ctx, items)
		if err != nil {
			return nil, err
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetBlog(ctx context.Context, id uint, allowedStates []int, includeContent bool, key string) (*BlogView, error) {
	return cached(s.cache, key, func() (*BlogView, error) {
		item, err := s.blogs.GetByID(ctx, id, allowedStates)
		if err != nil || item == nil {
			return nil, err
		}
		list, err := s.composeBlogs(ctx, []database.Blog{*item}, includeContent)
		if err != nil || len(list) == 0 {
			return nil, err
		}
		return &list[0], nil
	})
}

func (s *ReadService) GetBlogDetailByID(ctx context.Context, id uint, key string) (*BlogDetailResult, error) {
	return cached(s.cache, key, func() (*BlogDetailResult, error) {
		item, err := s.blogs.GetByID(ctx, id, nil)
		if err != nil || item == nil {
			return nil, err
		}

		detail, err := s.composeBlogDetail(ctx, *item)
		if err != nil {
			return nil, err
		}

		return &BlogDetailResult{
			Detail:   detail,
			State:    item.State,
			AuthorID: item.Author,
		}, nil
	})
}

func (s *ReadService) GetBlogDetailBySlug(ctx context.Context, slug string, key string) (*BlogDetailResult, error) {
	return cached(s.cache, key, func() (*BlogDetailResult, error) {
		item, err := s.blogs.GetBySlug(ctx, slug, nil)
		if err != nil || item == nil {
			return nil, err
		}

		detail, err := s.composeBlogDetail(ctx, *item)
		if err != nil {
			return nil, err
		}

		return &BlogDetailResult{
			Detail:   detail,
			State:    item.State,
			AuthorID: item.Author,
		}, nil
	})
}

func (s *ReadService) GetBlogDetailFromModel(ctx context.Context, blog *database.Blog) (*serverapi.BlogDetail, error) {
	if blog == nil {
		return nil, nil
	}
	detail, err := s.composeBlogDetail(ctx, *blog)
	if err != nil {
		return nil, err
	}
	return &detail, nil
}

func (s *ReadService) GetBlogContextBySlug(ctx context.Context, slug string, key string) (*BlogDetailResult, *BlogContextResult, error) {
	detail, err := s.GetBlogDetailBySlug(ctx, slug, key+":detail")
	if err != nil || detail == nil {
		return detail, nil, err
	}

	contextData, err := s.getBlogContext(ctx, detail, key)
	if err != nil {
		return detail, nil, err
	}

	return detail, contextData, nil
}

func (s *ReadService) GetBlogContextByID(ctx context.Context, id uint, key string) (*BlogDetailResult, *BlogContextResult, error) {
	detail, err := s.GetBlogDetailByID(ctx, id, key+":detail")
	if err != nil || detail == nil {
		return detail, nil, err
	}

	contextData, err := s.getBlogContext(ctx, detail, key)
	if err != nil {
		return detail, nil, err
	}

	return detail, contextData, nil
}

func (s *ReadService) getBlogContext(ctx context.Context, detail *BlogDetailResult, key string) (*BlogContextResult, error) {
	contextData, err := cached(s.cache, key+":context", func() (*BlogContextResult, error) {
		state := database.CommentStateNormal
		comments, err := s.comments.ListAllByBlogID(ctx, detail.Detail.ID, &state)
		if err != nil {
			return nil, err
		}
		users, err := s.users.LoadByIDs(ctx, collectCommentUserIDs(comments))
		if err != nil {
			return nil, err
		}
		commentViews := make([]CommentView, 0, len(comments))
		for _, item := range comments {
			view := CommentView{
				ID:        item.ID,
				BlogID:    item.BlogID,
				UserID:    item.UserID,
				ParentID:  item.ParentID,
				Content:   item.Content,
				State:     item.State,
				IP:        item.IP,
				CreatedAt: item.CreatedAt,
				UpdatedAt: item.UpdatedAt,
			}
			if user, ok := users[item.UserID]; ok {
				view.User = authorView(user)
			}
			commentViews = append(commentViews, view)
		}

		var prevItem *serverapi.BlogListItem
		var nextItem *serverapi.BlogListItem
		if detail.State == database.BlogStatePublic {
			prevBlog, nextBlog, err := s.blogs.GetAdjacentPublic(ctx, database.Blog{
				ID:          detail.Detail.ID,
				State:       detail.State,
				CreatedAt:   detail.Detail.CreatedAt,
				PublishedAt: detail.Detail.PublishedAt,
			})
			if err != nil {
				return nil, err
			}
			if prevBlog != nil {
				item, err := s.composePublicBlogList(ctx, []database.Blog{*prevBlog})
				if err != nil {
					return nil, err
				}
				if len(item) > 0 {
					prevItem = &item[0]
				}
			}
			if nextBlog != nil {
				item, err := s.composePublicBlogList(ctx, []database.Blog{*nextBlog})
				if err != nil {
					return nil, err
				}
				if len(item) > 0 {
					nextItem = &item[0]
				}
			}
		}

		return &BlogContextResult{
			Blog:     detail.Detail,
			Comments: buildCommentTree(commentViews),
			PrevBlog: prevItem,
			NextBlog: nextItem,
		}, nil
	})
	if err != nil {
		return nil, err
	}

	return contextData, nil
}

func (s *ReadService) GetMyBlog(ctx context.Context, userID uint, id uint, key string) (*serverapi.BlogDetail, error) {
	return cached(s.cache, key, func() (*serverapi.BlogDetail, error) {
		item, err := s.blogs.GetByIDAndAuthor(ctx, id, userID)
		if err != nil || item == nil {
			return nil, err
		}

		detail, err := s.composeBlogDetail(ctx, *item)
		if err != nil {
			return nil, err
		}

		detail.Author.Avatar = nil
		detail.Author.Bio = ""
		detail.Author.Website = ""
		return &detail, nil
	})
}

func (s *ReadService) ListAssets(ctx context.Context, filter repositories.AssetListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.assets.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list, err := s.composeAssetList(ctx, items)
		if err != nil {
			return nil, err
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetAssetDetailFromModel(ctx context.Context, asset *database.Asset) (*serverapi.AssetItem, error) {
	if asset == nil {
		return nil, nil
	}
	list, err := s.composeAssetList(ctx, []database.Asset{*asset})
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (s *ReadService) ListBlogComments(ctx context.Context, filter repositories.CommentListFilter) (*PageData, error) {
	items, total, err := s.comments.ListByBlogID(ctx, filter)
	if err != nil {
		return nil, err
	}
	users, err := s.users.LoadByIDs(ctx, collectCommentUserIDs(items))
	if err != nil {
		return nil, err
	}
	list := make([]CommentView, 0, len(items))
	for _, item := range items {
		view := CommentView{
			ID:        item.ID,
			BlogID:    item.BlogID,
			UserID:    item.UserID,
			ParentID:  item.ParentID,
			Content:   item.Content,
			State:     item.State,
			IP:        item.IP,
			CreatedAt: item.CreatedAt,
			UpdatedAt: item.UpdatedAt,
		}
		if user, ok := users[item.UserID]; ok {
			view.User = authorView(user)
		}
		list = append(list, view)
	}
	return &PageData{List: buildCommentTree(list), Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *ReadService) ListAdminComments(ctx context.Context, filter repositories.AdminCommentListFilter) (*PageData, error) {
	items, total, err := s.comments.ListAdmin(ctx, filter)
	if err != nil {
		return nil, err
	}
	users, err := s.users.LoadByIDs(ctx, collectCommentUserIDs(items))
	if err != nil {
		return nil, err
	}
	avatars, err := s.assets.LoadByIDs(ctx, collectUserAvatarIDs(users))
	if err != nil {
		return nil, err
	}
	blogs, err := s.blogs.LoadByIDs(ctx, collectCommentBlogIDs(items))
	if err != nil {
		return nil, err
	}

	list := make([]gin.H, 0, len(items))
	for _, item := range items {
		var user *database.User
		var avatar *database.Asset
		if loadedUser, ok := users[item.UserID]; ok {
			user = &loadedUser
			if loadedUser.Avatar != nil {
				if loadedAvatar, ok := avatars[*loadedUser.Avatar]; ok {
					avatar = &loadedAvatar
				}
			}
		}

		comment := serverapi.CommentItemFromModel(&item, user, avatar, []serverapi.CommentItem{})
		payload := gin.H{
			"id":         comment.ID,
			"blog_id":    comment.BlogID,
			"parent_id":  comment.ParentID,
			"content":    comment.Content,
			"state":      comment.State,
			"user":       comment.User,
			"children":   comment.Children,
			"created_at": comment.CreatedAt,
			"updated_at": comment.UpdatedAt,
		}
		if blog, ok := blogs[item.BlogID]; ok {
			payload["blog"] = gin.H{"id": blog.ID, "title": blog.Title, "slug": blog.Slug}
		}
		list = append(list, payload)
	}
	return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *ReadService) GetCommentItem(ctx context.Context, comment *database.Comment) (*serverapi.CommentItem, error) {
	if comment == nil {
		return nil, nil
	}

	users, err := s.users.LoadByIDs(ctx, []uint{comment.UserID})
	if err != nil {
		return nil, err
	}

	var user *database.User
	var avatar *database.Asset
	if item, ok := users[comment.UserID]; ok {
		user = &item
		if item.Avatar != nil {
			assets, err := s.assets.LoadByIDs(ctx, []uint{*item.Avatar})
			if err != nil {
				return nil, err
			}
			if loaded, ok := assets[*item.Avatar]; ok {
				avatar = &loaded
			}
		}
	}

	return new(serverapi.CommentItemFromModel(comment, user, avatar, []serverapi.CommentItem{})), nil
}

func (s *ReadService) GetPublicSettings(ctx context.Context, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		items, err := s.settings.ListPublic(ctx)
		if err != nil {
			return nil, err
		}
		result := make(gin.H, len(items))
		for _, item := range items {
			result[item.Key] = item.Value
		}
		return result, nil
	})
}

func (s *ReadService) ListAdminSettings(ctx context.Context, filter repositories.SettingListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.settings.List(ctx, filter)
		if err != nil {
			return nil, err
		}
		list := make([]SettingView, 0, len(items))
		for _, item := range items {
			list = append(list, settingToView(item))
		}
		return &PageData{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func (s *ReadService) GetAdminSetting(ctx context.Context, name string, key string) (*SettingView, error) {
	return cached(s.cache, key, func() (*SettingView, error) {
		item, err := s.settings.GetByKey(ctx, name)
		if err != nil || item == nil {
			return nil, err
		}
		view := settingToView(*item)
		return &view, nil
	})
}

func (s *ReadService) GetAdminStats(ctx context.Context, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		blogRows, err := s.repo.CountTrend(ctx, &database.Blog{}, "created_at", 7)
		if err != nil {
			return nil, err
		}
		viewRows, err := s.repo.ViewTrend(ctx, 7)
		if err != nil {
			return nil, err
		}
		commentRows, err := s.repo.CountTrend(ctx, &database.Comment{}, "created_at", 7)
		if err != nil {
			return nil, err
		}

		return gin.H{
			"blog_trend":    rowsToTrendPoints(blogRows, 7),
			"view_trend":    rowsToTrendPoints(viewRows, 7),
			"comment_trend": rowsToTrendPoints(commentRows, 7),
		}, nil
	})
}

func (s *ReadService) GetAdminDashboard(ctx context.Context, key string) (gin.H, error) {
	return cached(s.cache, key, func() (gin.H, error) {
		stats, err := s.repo.CountDashboardSummary(ctx, time.Now())
		if err != nil {
			return nil, err
		}
		result := make(gin.H, len(stats))
		for statKey, statValue := range stats {
			result[statKey] = statValue
		}
		posts, comments := s.repo.AdminDashboardRecent()
		result["recent_posts"] = posts
		result["recent_comments"] = comments
		return result, nil
	})
}

func (s *ReadService) GetUserDashboard(ctx context.Context, userID uint, key string) (gin.H, error) {
	_ = key
	stats, err := s.repo.CountUserDashboardSummary(ctx, userID, time.Now())
	if err != nil {
		return nil, err
	}
	posts, comments, err := s.repo.ListUserDashboardRecent(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make(gin.H, len(stats)+2)
	for statKey, statValue := range stats {
		result[statKey] = statValue
	}
	result["recent_posts"] = posts
	result["recent_comments"] = comments
	return result, nil
}

func (s *ReadService) ListAdminLogs(ctx context.Context, filter repositories.AuditLogListFilter, key string) (*PageData, error) {
	return cached(s.cache, key, func() (*PageData, error) {
		items, total, err := s.repo.ListAuditLogs(ctx, filter)
		if err != nil {
			return nil, err
		}
		users, err := s.users.LoadByIDs(ctx, collectAuditUserIDs(items))
		if err != nil {
			return nil, err
		}
		return &PageData{List: mapAuditLogs(items, users), Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
	})
}

func cached[T any](store *cache.Store, key string, fn func() (T, error)) (T, error) {
	var zero T
	if store != nil {
		if cachedValue, ok := store.Get(key); ok {
			if typed, ok := cachedValue.(T); ok {
				return typed, nil
			}
		}
	}
	result, err := fn()
	if err != nil {
		return zero, err
	}
	if store != nil {
		store.Set(key, result)
	}
	return result, nil
}

func (s *ReadService) composeBlogs(ctx context.Context, blogs []database.Blog, includeContent bool) ([]BlogView, error) {
	if len(blogs) == 0 {
		return []BlogView{}, nil
	}
	authors, err := s.users.LoadByIDs(ctx, collectAuthorIDs(blogs))
	if err != nil {
		return nil, err
	}
	tagsByBlogID, err := s.repo.LoadTagsByBlogIDs(ctx, collectBlogIDs(blogs))
	if err != nil {
		return nil, err
	}
	result := make([]BlogView, 0, len(blogs))
	for _, item := range blogs {
		view := BlogView{
			ID:           item.ID,
			Title:        item.Title,
			Slug:         item.Slug,
			Desc:         item.Summary,
			TitleImage:   item.TitleImage,
			CategoryID:   item.Category,
			State:        item.State,
			AllowComment: item.AllowComment,
			IsTop:        item.IsTop,
			ViewCount:    item.ViewCount,
			LikeCount:    item.LikeCount,
			CommentCount: item.CommentCount,
			CreatedAt:    item.CreatedAt,
			UpdatedAt:    item.UpdatedAt,
			PublishedAt:  item.PublishedAt,
		}
		if includeContent {
			view.Content = item.ContentMarkdown
		}
		if author, ok := authors[item.Author]; ok {
			view.Author = authorView(author)
		}
		for _, tag := range tagsByBlogID[item.ID] {
			view.Tags = append(view.Tags, s.tagToView(tag))
		}
		result = append(result, view)
	}
	return result, nil
}

func safeUserView(user database.User) gin.H {
	return gin.H{"id": user.ID, "state": user.State, "role": user.Role, "username": user.Username, "nickname": user.Nickname, "avatar": user.Avatar, "gender": user.Gender, "email": user.Email, "bio": user.Bio, "website": user.Website, "register_date": user.RegisterDate, "last_login": user.LastLogin, "last_login_ip": user.LastLoginIP, "email_verified": user.EmailVerified, "created_at": user.CreatedAt, "updated_at": user.UpdatedAt}
}

func authorView(user database.User) gin.H {
	return gin.H{"id": user.ID, "username": user.Username, "nickname": user.Nickname, "avatar": user.Avatar}
}

func (s *ReadService) tagToView(tag database.Tag) TagView {
	return TagView{ID: tag.ID, Name: tag.Name, Slug: tag.Slug, Desc: tag.Desc, Color: tag.Color, PostCount: s.tagArticleCount(tag.ID), CreatedAt: tag.CreatedAt}
}

func (s *ReadService) categoryToView(category database.Category) CategoryView {
	return CategoryView{ID: category.ID, Name: category.Name, Slug: category.Slug, Desc: category.Desc, ParentID: category.Parent, PostCount: s.categoryArticleCount(category.ID), CreatedAt: category.CreatedAt}
}

func (s *ReadService) tagArticleCount(id uint) int64 {
	if s == nil || s.tags == nil {
		return 0
	}
	return s.tags.ArticleCount(id)
}

func (s *ReadService) categoryArticleCount(id uint) int64 {
	if s == nil || s.categories == nil {
		return 0
	}
	return s.categories.ArticleCount(id)
}

func settingToView(item database.Setting) SettingView {
	return SettingView{ID: item.ID, Key: item.Key, Value: item.Value, Type: item.Type, Group: item.Group, Description: item.Description, UpdatedAt: item.UpdatedAt}
}

func collectAuthorIDs(items []database.Blog) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		result = append(result, item.Author)
	}
	return result
}

func collectBlogIDs(items []database.Blog) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func collectCommentUserIDs(items []database.Comment) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		result = append(result, item.UserID)
	}
	return result
}

func collectCommentBlogIDs(items []database.Comment) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		result = append(result, item.BlogID)
	}
	return result
}

func collectUserAvatarIDs(users map[uint]database.User) []uint {
	result := make([]uint, 0, len(users))
	for _, user := range users {
		if user.Avatar != nil {
			result = append(result, *user.Avatar)
		}
	}
	return result
}

func collectAuditUserIDs(items []database.AuditLog) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		if item.UserID != nil {
			result = append(result, *item.UserID)
		}
	}
	return result
}

func mapBlogsForDashboard(items []database.Blog) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		result = append(result, gin.H{"id": item.ID, "title": item.Title, "state": item.State, "author_id": item.Author, "created_at": item.CreatedAt, "published_at": item.PublishedAt})
	}
	return result
}

func mapUsersForDashboard(items []database.User) []gin.H {
	result := make([]gin.H, 0, len(items))
	for _, item := range items {
		result = append(result, gin.H{"id": item.ID, "username": item.Username, "nickname": item.Nickname, "state": item.State, "role": item.Role, "created_at": item.CreatedAt})
	}
	return result
}

func mapAuditLogs(items []database.AuditLog, users map[uint]database.User) []AuditLogView {
	result := make([]AuditLogView, 0, len(items))
	for _, item := range items {
		var detail interface{}
		if len(item.Detail) > 0 {
			_ = json.Unmarshal(item.Detail, &detail)
		}
		view := AuditLogView{ID: item.ID, UserID: item.UserID, Action: item.Action, TargetType: item.TargetType, TargetID: item.TargetID, Detail: detail, IP: item.IP, CreatedAt: item.CreatedAt}
		if item.UserID != nil && users != nil {
			if user, ok := users[*item.UserID]; ok {
				view.User = authorView(user)
			}
		}
		result = append(result, view)
	}
	return result
}

func buildCommentTree(items []CommentView) []gin.H {
	nodes := make(map[uint]gin.H, len(items))
	roots := make([]gin.H, 0, len(items))

	for _, item := range items {
		parentID := uint(0)
		if item.ParentID != nil {
			parentID = *item.ParentID
		}
		nodes[item.ID] = gin.H{
			"id":         item.ID,
			"blog_id":    item.BlogID,
			"parent_id":  parentID,
			"content":    item.Content,
			"state":      serverapi.CommentStateName(item.State),
			"user":       item.User,
			"children":   []gin.H{},
			"created_at": item.CreatedAt,
			"updated_at": item.UpdatedAt,
		}
	}

	for _, item := range items {
		node := nodes[item.ID]
		if item.ParentID != nil {
			if parent, ok := nodes[*item.ParentID]; ok {
				parent["children"] = append(parent["children"].([]gin.H), node)
				continue
			}
		}
		roots = append(roots, node)
	}

	return roots
}

func (s *ReadService) composePublicBlogList(ctx context.Context, blogs []database.Blog) ([]serverapi.BlogListItem, error) {
	if len(blogs) == 0 {
		return []serverapi.BlogListItem{}, nil
	}

	authors, err := s.users.LoadByIDs(ctx, collectAuthorIDs(blogs))
	if err != nil {
		return nil, err
	}
	assets, err := s.assets.LoadByIDs(ctx, collectBlogAssetIDs(blogs, authors))
	if err != nil {
		return nil, err
	}
	categories, err := s.repo.LoadCategoriesByIDs(ctx, collectBlogCategoryIDs(blogs))
	if err != nil {
		return nil, err
	}
	tagsByBlogID, err := s.repo.LoadTagsByBlogIDs(ctx, collectBlogIDs(blogs))
	if err != nil {
		return nil, err
	}

	result := make([]serverapi.BlogListItem, 0, len(blogs))
	for _, blog := range blogs {
		var titleImage *database.Asset
		if blog.TitleImage != nil {
			if item, ok := assets[*blog.TitleImage]; ok {
				titleImage = &item
			}
		}

		var author database.User
		var authorAvatar *database.Asset
		if item, ok := authors[blog.Author]; ok {
			author = item
			if item.Avatar != nil {
				if avatar, ok := assets[*item.Avatar]; ok {
					authorAvatar = &avatar
				}
			}
		}

		var category *database.Category
		if blog.Category != nil {
			if item, ok := categories[*blog.Category]; ok {
				category = &item
			}
		}

		result = append(result, serverapi.BlogListItemFromModel(
			&blog,
			&author,
			authorAvatar,
			titleImage,
			category,
			tagsByBlogID[blog.ID],
		))
	}

	return result, nil
}

func (s *ReadService) composeBlogDetail(ctx context.Context, blog database.Blog) (serverapi.BlogDetail, error) {
	authors, err := s.users.LoadByIDs(ctx, []uint{blog.Author})
	if err != nil {
		return serverapi.BlogDetail{}, err
	}
	assets, err := s.assets.LoadByIDs(ctx, collectBlogAssetIDs([]database.Blog{blog}, authors))
	if err != nil {
		return serverapi.BlogDetail{}, err
	}
	categories, err := s.repo.LoadCategoriesByIDs(ctx, collectBlogCategoryIDs([]database.Blog{blog}))
	if err != nil {
		return serverapi.BlogDetail{}, err
	}
	tagsByBlogID, err := s.repo.LoadTagsByBlogIDs(ctx, []uint{blog.ID})
	if err != nil {
		return serverapi.BlogDetail{}, err
	}

	var titleImage *database.Asset
	if blog.TitleImage != nil {
		if item, ok := assets[*blog.TitleImage]; ok {
			titleImage = &item
		}
	}

	var author *database.User
	var authorAvatar *database.Asset
	if item, ok := authors[blog.Author]; ok {
		author = &item
		if item.Avatar != nil {
			if avatar, ok := assets[*item.Avatar]; ok {
				authorAvatar = &avatar
			}
		}
	}

	var category *database.Category
	if blog.Category != nil {
		if item, ok := categories[*blog.Category]; ok {
			category = &item
		}
	}

	return serverapi.BlogDetailFromModel(&blog, author, authorAvatar, titleImage, category, tagsByBlogID[blog.ID]), nil
}

func collectBlogCategoryIDs(items []database.Blog) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		if item.Category != nil {
			result = append(result, *item.Category)
		}
	}
	return result
}

func collectBlogAssetIDs(blogs []database.Blog, authors map[uint]database.User) []uint {
	result := make([]uint, 0, len(blogs)*2)
	for _, item := range blogs {
		if item.TitleImage != nil {
			result = append(result, *item.TitleImage)
		}
		if author, ok := authors[item.Author]; ok && author.Avatar != nil {
			result = append(result, *author.Avatar)
		}
	}
	return result
}

func (s *ReadService) composeAssetList(ctx context.Context, assets []database.Asset) ([]serverapi.AssetItem, error) {
	if len(assets) == 0 {
		return []serverapi.AssetItem{}, nil
	}

	uploaderIDs := make([]uint, 0, len(assets))
	for _, item := range assets {
		uploaderIDs = append(uploaderIDs, item.Uploader)
	}

	users, err := s.users.LoadByIDs(ctx, uploaderIDs)
	if err != nil {
		return nil, err
	}

	avatarIDs := make([]uint, 0, len(users))
	for _, user := range users {
		if user.Avatar != nil {
			avatarIDs = append(avatarIDs, *user.Avatar)
		}
	}
	avatars, err := s.assets.LoadByIDs(ctx, avatarIDs)
	if err != nil {
		return nil, err
	}

	result := make([]serverapi.AssetItem, 0, len(assets))
	for _, item := range assets {
		var uploader *database.User
		var uploaderAvatar *database.Asset
		if user, ok := users[item.Uploader]; ok {
			uploader = &user
			if user.Avatar != nil {
				if avatar, ok := avatars[*user.Avatar]; ok {
					uploaderAvatar = &avatar
				}
			}
		}
		result = append(result, serverapi.AssetItemFromModel(&item, uploader, uploaderAvatar))
	}

	return result, nil
}

func (s *ReadService) composeUserProfiles(ctx context.Context, users []database.User) ([]serverapi.UserProfile, error) {
	if len(users) == 0 {
		return []serverapi.UserProfile{}, nil
	}

	avatarIDs := make([]uint, 0, len(users))
	for _, user := range users {
		if user.Avatar != nil {
			avatarIDs = append(avatarIDs, *user.Avatar)
		}
	}
	avatars, err := s.assets.LoadByIDs(ctx, avatarIDs)
	if err != nil {
		return nil, err
	}

	result := make([]serverapi.UserProfile, 0, len(users))
	for _, user := range users {
		var avatar *database.Asset
		if user.Avatar != nil {
			if item, ok := avatars[*user.Avatar]; ok {
				avatar = &item
			}
		}
		result = append(result, serverapi.UserProfileFromModel(&user, avatar))
	}

	return result, nil
}

func (s *ReadService) composePublicCategoryList(ctx context.Context, categories []database.Category) ([]serverapi.CategoryItem, error) {
	if len(categories) == 0 {
		return []serverapi.CategoryItem{}, nil
	}

	parents, err := s.repo.LoadCategoriesByIDs(ctx, collectCategoryParentIDs(categories))
	if err != nil {
		return nil, err
	}

	if s.categories != nil {
		_ = s.categories.RefreshArticleCounts(ctx)
	}

	result := make([]serverapi.CategoryItem, 0, len(categories))
	for _, category := range categories {
		var parent *database.Category
		if category.Parent != nil {
			if item, ok := parents[*category.Parent]; ok {
				parent = &item
			}
		}
		item := serverapi.CategoryItemFromModel(&category, parent)
		item.PostCount = s.categoryArticleCount(category.ID)
		result = append(result, item)
	}
	return result, nil
}

func collectCategoryParentIDs(items []database.Category) []uint {
	result := make([]uint, 0, len(items))
	for _, item := range items {
		if item.Parent != nil {
			result = append(result, *item.Parent)
		}
	}
	return result
}

func rowsToTrendPoints(rows []map[string]interface{}, days int) []serverapi.TrendPoint {
	if days <= 0 {
		days = 7
	}

	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		date := fmt.Sprint(row["date"])
		var count int64
		switch value := row["count"].(type) {
		case int64:
			count = value
		case int:
			count = int64(value)
		case float64:
			count = int64(value)
		case []uint8:
			fmt.Sscan(string(value), &count)
		case string:
			fmt.Sscan(value, &count)
		}
		counts[date] = count
	}

	result := make([]serverapi.TrendPoint, 0, days)
	startDate := time.Now().AddDate(0, 0, -(days - 1))
	for i := 0; i < days; i++ {
		date := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location()).AddDate(0, 0, i).Format("2006-01-02")
		result = append(result, serverapi.TrendPoint{
			Date:  date,
			Count: counts[date],
		})
	}
	return result
}
