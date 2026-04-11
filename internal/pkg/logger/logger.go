package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	rotatelogs "github.com/lestrrat-go/file-rotatelogs"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Logger struct {
	logger *zap.Logger
	level  zapcore.Level
}

func Nop() *Logger {
	return &Logger{
		logger: zap.NewNop(),
		level:  zapcore.InfoLevel,
	}
}

func (l *Logger) GetZap() *zap.Logger {
	if l == nil || l.logger == nil {
		return zap.NewNop()
	}
	return l.logger
}

func (l *Logger) Level() zapcore.Level {
	if l == nil {
		return zapcore.InfoLevel
	}
	return l.level
}

func (l *Logger) Info(tmp string, args ...interface{}) {
	if l == nil || l.logger == nil {
		return
	}
	l.logger.Info(fmt.Sprintf(tmp, args...))
}

func (l *Logger) Warn(tmp string, args ...interface{}) {
	if l == nil || l.logger == nil {
		return
	}
	l.logger.Warn(fmt.Sprintf(tmp, args...))
}

func (l *Logger) Error(tmp string, args ...interface{}) {
	if l == nil || l.logger == nil {
		return
	}
	l.logger.Error(fmt.Sprintf(tmp, args...))
}

func (l *Logger) Debug(tmp string, args ...interface{}) {
	if l == nil || l.logger == nil {
		return
	}
	l.logger.Debug(fmt.Sprintf(tmp, args...))
}

// New builds a custom logger with colored console output and file output.
func New(logPath, level string) (*Logger, func(), error) {
	if err := os.MkdirAll(filepath.Dir(logPath), 0o755); err != nil {
		return nil, func() {}, fmt.Errorf("create log dir: %w", err)
	}

	rotateWriter, err := rotatelogs.New(
		strings.TrimSuffix(logPath, filepath.Ext(logPath))+"-%Y-%m-%d.log",
		rotatelogs.WithLinkName(logPath),
		rotatelogs.WithMaxAge(30*24*time.Hour),
		rotatelogs.WithRotationTime(24*time.Hour),
		rotatelogs.WithClock(rotatelogs.Local),
	)
	if err != nil {
		return nil, func() {}, fmt.Errorf("create rotate writer: %w", err)
	}
	writeSessionHeader(rotateWriter)

	lvl := parseLevel(level)
	consoleEncoderCfg := zapcore.EncoderConfig{
		TimeKey:        "T",
		LevelKey:       "L",
		NameKey:        "N",
		CallerKey:      "",
		MessageKey:     "M",
		EncodeTime:     customTimeEncoder,
		EncodeLevel:    customLevelEncoder,
		EncodeName:     zapcore.FullNameEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		ConsoleSeparator: " ",
	}
	fileEncoderCfg := consoleEncoderCfg
	fileEncoderCfg.EncodeLevel = customLevelEncoderWithoutColor

	consoleEncoder := zapcore.NewConsoleEncoder(consoleEncoderCfg)
	fileEncoder := zapcore.NewConsoleEncoder(fileEncoderCfg)

	core := zapcore.NewTee(
		zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), lvl),
		zapcore.NewCore(fileEncoder, zapcore.AddSync(rotateWriter), lvl),
	)

	base := zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	log := &Logger{
		logger: base.Named("cashew"),
		level:  lvl,
	}
	cleanup := func() {
		_ = log.GetZap().Sync()
	}
	return log, cleanup, nil
}

func writeSessionHeader(rotateWriter *rotatelogs.RotateLogs) {
	if rotateWriter == nil {
		return
	}
	now := time.Now().Format("2006-01-02 15:04:05 -0700")
	header := fmt.Sprintf("\n==================== SESSION START %s ====================\n", now)
	_, _ = rotateWriter.Write([]byte(header))
}

func parseLevel(level string) zapcore.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return zapcore.DebugLevel
	case "warn", "warning":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	case "dpanic":
		return zapcore.DPanicLevel
	case "panic":
		return zapcore.PanicLevel
	case "fatal":
		return zapcore.FatalLevel
	default:
		return zapcore.InfoLevel
	}
}

func customTimeEncoder(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
	enc.AppendString(t.Format("15:04:05 -0700"))
}

func customLevelEncoder(level zapcore.Level, enc zapcore.PrimitiveArrayEncoder) {
	switch level {
	case zapcore.DebugLevel:
		enc.AppendString("\x1b[36m[D]\x1b[0m")
	case zapcore.InfoLevel:
		enc.AppendString("\x1b[32m[I]\x1b[0m")
	case zapcore.WarnLevel:
		enc.AppendString("\x1b[33m[W]\x1b[0m")
	case zapcore.ErrorLevel:
		enc.AppendString("\x1b[31m[E]\x1b[0m")
	default:
		enc.AppendString(fmt.Sprintf("[%s]", strings.ToUpper(level.String())))
	}
}

func customLevelEncoderWithoutColor(level zapcore.Level, enc zapcore.PrimitiveArrayEncoder) {
	switch level {
	case zapcore.DebugLevel:
		enc.AppendString("[DEBUG]")
	case zapcore.InfoLevel:
		enc.AppendString("[INFO]")
	case zapcore.WarnLevel:
		enc.AppendString("[WARN]")
	case zapcore.ErrorLevel:
		enc.AppendString("[ERROR]")
	default:
		enc.AppendString(fmt.Sprintf("[%s]", strings.ToUpper(level.String())))
	}
}
