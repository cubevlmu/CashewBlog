package handlers

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	serverapi "CashewBlog/internal/app/server/api"
	"CashewBlog/internal/app/server/middleware"
	"CashewBlog/internal/app/server/repositories"
	"CashewBlog/internal/app/server/services"
	"CashewBlog/internal/app/server/webutil"
	"CashewBlog/internal/pkg/database"
)

type AssetHandler struct {
	Read   *services.ReadService
	Assets *repositories.AssetRepository
}

// UploadAsset stores one uploaded asset on local disk and creates the asset-db mapping.
func (h *AssetHandler) UploadAsset(c *gin.Context) {
	h.upload(c, false)
}

// UploadImage stores one uploaded image on local disk and creates the asset-db mapping.
func (h *AssetHandler) UploadImage(c *gin.Context) {
	h.upload(c, true)
}

// UploadFile stores one uploaded non-image asset on local disk and creates the asset-db mapping.
func (h *AssetHandler) UploadFile(c *gin.Context) {
	h.upload(c, false)
}

// ListAssets returns the authenticated user's asset list.
//
// Supported filters include pagination, keyword, type, and state. Results are
// always constrained to assets uploaded by the current user.
func (h *AssetHandler) ListAssets(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	page, pageSize := webutil.ParsePageParams(c)
	filter := repositories.AssetListFilter{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    webutil.LikeKeyword(c.Query("keyword")),
		Type:       strings.TrimSpace(strings.ToLower(c.Query("type"))),
		UploaderID: ptrUint(uint(uid)),
	}

	if filter.Type != "" && filter.Type != "image" && filter.Type != "file" {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid type")
		return
	}

	state, valid := parseAssetState(c.Query("state"))
	if !valid {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "invalid state")
		return
	}
	filter.State = state

	result, err := h.Read.ListAssets(c.Request.Context(), filter, webutil.CacheKey(c, "asset_list"))
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	webutil.RespondPage(c, result.List, result.Total, result.Page, result.PageSize)
}

func (h *AssetHandler) GetAsset(c *gin.Context) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}
	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	item, err := h.Assets.GetByID(c.Request.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrAssetNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "asset not found")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}
	if item.Uploader != uint(uid) {
		webutil.RespondError(c, http.StatusNotFound, 40400, "asset not found")
		return
	}

	detail, err := h.Read.GetAssetDetailFromModel(c.Request.Context(), item)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil {
		webutil.RespondError(c, http.StatusNotFound, 40400, "asset not found")
		return
	}

	webutil.RespondOK(c, gin.H{"asset": detail})
}

// DeleteAsset removes one asset record and its local file when the caller is allowed to do so.
func (h *AssetHandler) DeleteAsset(c *gin.Context) {
	userID, role, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}
	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}
	id, err := webutil.ParseUintParam(c, "id")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		return
	}

	if err := h.Assets.DeleteByID(c.Request.Context(), id, uint(uid), role); err != nil {
		switch {
		case errors.Is(err, repositories.ErrAssetNotFound):
			webutil.RespondError(c, http.StatusNotFound, 40400, "asset not found")
		case errors.Is(err, repositories.ErrAssetForbidden):
			webutil.RespondError(c, http.StatusForbidden, 40300, "forbidden")
		default:
			webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		}
		return
	}

	webutil.RespondOK(c, gin.H{"deleted": true, "id": id})
}

func parseAssetState(raw string) (*int, bool) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "":
		return nil, true
	case serverapi.AssetStateName(database.AssetStateNormal):
		return new(database.AssetStateNormal), true
	case serverapi.AssetStateName(database.AssetStateHidden):
		return new(database.AssetStateHidden), true
	case serverapi.AssetStateName(database.AssetStateDeleted):
		return new(database.AssetStateDeleted), true
	default:
		return nil, false
	}
}

func ptrUint(v uint) *uint {
	return &v
}

func (h *AssetHandler) upload(c *gin.Context, restrictToImages bool) {
	userID, _, ok := middleware.UserFromContext(c)
	if !ok {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}
	uid, err := strconv.ParseUint(userID, 10, 64)
	if err != nil {
		webutil.RespondError(c, http.StatusUnauthorized, 40100, "invalid user")
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "file is required")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		webutil.RespondError(c, http.StatusBadRequest, 40000, "failed to open file")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, "failed to read file")
		return
	}

	item, _, err := h.Assets.Upload(c.Request.Context(), repositories.UploadAssetInput{
		UploaderID:       uint(uid),
		OriginalFileName: fileHeader.Filename,
		Data:             data,
		RestrictToImages: restrictToImages,
	})
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrDuplicateUpload):
			webutil.RespondError(c, http.StatusConflict, 40900, "duplicate upload")
		default:
			webutil.RespondError(c, http.StatusBadRequest, 40000, err.Error())
		}
		return
	}

	detail, err := h.Read.GetAssetDetailFromModel(c.Request.Context(), item)
	if err != nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if detail == nil {
		webutil.RespondError(c, http.StatusInternalServerError, 50000, "asset detail unavailable")
		return
	}

	webutil.RespondCreated(c, gin.H{"asset": detail})
}
