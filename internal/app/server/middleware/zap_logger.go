package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"CashewBlog/internal/pkg/logger"
)

// ZapLogger logs HTTP requests with zap.
func ZapLogger(log *logger.Logger) gin.HandlerFunc {
	zlog := log.GetZap()
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		if raw != "" {
			path = path + "?" + raw
		}

		zlog.Info("http",
			zap.Int("status", c.Writer.Status()),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("client_ip", c.ClientIP()),
			zap.Duration("latency", time.Since(start)),
			zap.String("user_agent", c.Request.UserAgent()),
			zap.Int("size", c.Writer.Size()),
		)
	}
}
