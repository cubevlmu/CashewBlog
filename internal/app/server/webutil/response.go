package webutil

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type apiResponse struct {
	Status  int         `json:"status"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

type pageResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// RespondOK writes the standard success response envelope with HTTP 200.
func RespondOK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, apiResponse{
		Status: http.StatusOK,
		Data:   data,
	})
}

// RespondCreated writes the standard success response envelope with HTTP 201.
func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, apiResponse{
		Status: http.StatusCreated,
		Data:   data,
	})
}

// RespondPage writes the standard paginated response payload in the data field.
func RespondPage(c *gin.Context, list interface{}, total int64, page int, pageSize int) {
	RespondOK(c, pageResponse{
		List:     list,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// RespondNoContent writes HTTP 204 when the operation succeeds without a body.
func RespondNoContent(c *gin.Context) {
	c.JSON(http.StatusNoContent, apiResponse{
		Status: http.StatusNoContent,
	})
}

// RespondError writes the standard error envelope with a business error code and message.
func RespondError(c *gin.Context, status int, code int, message string) {
	c.JSON(status, apiResponse{
		Status:  status,
		Message: message,
	})
}

// RespondNotImplemented writes a placeholder response for endpoints that are scaffolded but unfinished.
func RespondNotImplemented(c *gin.Context, todo string) {
	c.JSON(http.StatusNotImplemented, apiResponse{
		Status:  http.StatusNotImplemented,
		Message: "not implemented: " + todo,
	})
}
