package middleware

import "github.com/gin-gonic/gin"

type errorResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
}

func abortWithError(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, errorResponse{
		Status:  status,
		Message: message,
	})
}
