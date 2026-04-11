package logger

import (
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap/zapcore"
)

type zapWriter struct {
	log    *Logger
	level  zapcore.Level
	source string
}

func (w *zapWriter) Write(p []byte) (int, error) {
	msg := strings.TrimSpace(string(p))
	if msg == "" || w == nil || w.log == nil {
		return len(p), nil
	}

	localLevel := w.level
	if strings.Contains(strings.ToLower(msg), "error") {
		localLevel = zapcore.ErrorLevel
	} else if strings.Contains(strings.ToLower(msg), "warn") {
		localLevel = zapcore.WarnLevel
	} else if strings.Contains(strings.ToLower(msg), "debug") {
		localLevel = zapcore.DebugLevel
	}

	switch localLevel {
	case zapcore.DebugLevel:
		w.log.Debug("[%s] %s", w.source, msg)
	case zapcore.WarnLevel:
		w.log.Warn("[%s] %s", w.source, msg)
	case zapcore.ErrorLevel:
		w.log.Error("[%s] %s", w.source, msg)
	default:
		w.log.Info("[%s] %s", w.source, msg)
	}
	return len(p), nil
}

// RedirectGinLogs redirects gin internal logs to zap.
func RedirectGinLogs(log *Logger) {
	if log == nil {
		return
	}

	gin.DefaultWriter = &zapWriter{
		log:    log,
		level:  zapcore.InfoLevel,
		source: "gin",
	}
	gin.DefaultErrorWriter = &zapWriter{
		log:    log,
		level:  zapcore.ErrorLevel,
		source: "gin",
	}

	gin.DebugPrintRouteFunc = func(httpMethod, absolutePath, handlerName string, nuHandlers int) {
		log.Debug("gin route method=%s path=%s handler=%s handlers=%d", httpMethod, absolutePath, handlerName, nuHandlers)
	}
}
