package logger

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"
	gormlogger "gorm.io/gorm/logger"
)

type zapGormLogger struct {
	log       *Logger
	level     gormlogger.LogLevel
	slowQuery time.Duration
}

func NewGormLogger(log *Logger, level gormlogger.LogLevel) gormlogger.Interface {
	return &zapGormLogger{
		log:       log,
		level:     level,
		slowQuery: 400 * time.Millisecond,
	}
}

func (l *zapGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	clone := *l
	clone.level = level
	return &clone
}

func (l *zapGormLogger) Info(_ context.Context, msg string, data ...interface{}) {
	if l.level < gormlogger.Info {
		return
	}
	l.log.Info("[gorm] "+msg, data...)
}

func (l *zapGormLogger) Warn(_ context.Context, msg string, data ...interface{}) {
	if l.level < gormlogger.Warn {
		return
	}
	l.log.Warn("[gorm] "+msg, data...)
}

func (l *zapGormLogger) Error(_ context.Context, msg string, data ...interface{}) {
	if l.level < gormlogger.Error {
		return
	}
	l.log.Error("[gorm] "+msg, data...)
}

func (l *zapGormLogger) Trace(_ context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if l.level <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	if err != nil && l.level >= gormlogger.Error && !errors.Is(err, gormlogger.ErrRecordNotFound) {
		l.log.GetZap().Error("[gorm] query error",
			zap.Error(err),
			zap.Duration("elapsed", elapsed),
			zap.Int64("rows", rows),
			zap.String("sql", sql),
		)
		return
	}

	if elapsed > l.slowQuery && l.level >= gormlogger.Warn {
		l.log.GetZap().Warn("[gorm] slow query",
			zap.Duration("elapsed", elapsed),
			zap.Int64("rows", rows),
			zap.String("sql", sql),
		)
		return
	}

	if l.level >= gormlogger.Info {
		l.log.Debug("[gorm] elapsed=%s rows=%d sql=%s", elapsed.String(), rows, sql)
	}
}
