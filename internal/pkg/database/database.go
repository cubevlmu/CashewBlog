package database

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap/zapcore"
	mysqlDriver "gorm.io/driver/mysql"
	sqliteDriver "gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"CashewBlog/internal/pkg/config"
	"CashewBlog/internal/pkg/logger"
)

const (
	ModeSQLite = "sqlite"
	ModeMySQL  = "mysql"
)

// Config holds database settings for both sqlite and mysql.
type Config struct {
	Mode            string        `yaml:"mode"`
	CleanupInterval time.Duration `yaml:"cleanup_interval"`
	SQLite          SQLiteConfig  `yaml:"sqlite"`
	MySQL           MySQLConfig   `yaml:"mysql"`
}

// SQLiteConfig holds sqlite specific settings.
type SQLiteConfig struct {
	Path string `yaml:"path"`
}

// MySQLConfig holds mysql specific settings.
type MySQLConfig struct {
	Host            string        `yaml:"host"`
	Port            int           `yaml:"port"`
	User            string        `yaml:"user"`
	Password        string        `yaml:"password"`
	Database        string        `yaml:"database"`
	Charset         string        `yaml:"charset"`
	Loc             string        `yaml:"loc"`
	ParseTime       bool          `yaml:"parse_time"`
	MaxIdleConns    int           `yaml:"max_idle_conns"`
	MaxOpenConns    int           `yaml:"max_open_conns"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime"`
}

// Client wraps a gorm connection.
type Client struct {
	db   *gorm.DB
	sql  *sql.DB
	mode string

	cleanupMu   sync.Mutex
	cleanupStop chan struct{}
	cleanupDone chan struct{}
}

// Load loads database configuration from blog/database.yml.
func Load() (Config, error) {
	return LoadFrom(defaultConfigPath)
}

// LoadFrom loads database configuration from the given file path.
func LoadFrom(path string) (Config, error) {
	cfg, err := config.LoadYAML(path, Default(), nil)
	if err != nil {
		return Config{}, fmt.Errorf("load database config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// Save writes the database configuration to a YAML file.
func (c Config) Save(path string) error {
	if err := config.SaveYAML(path, c); err != nil {
		return fmt.Errorf("save database config: %w", err)
	}
	return nil
}

// Default returns the default database configuration.
func Default() Config {
	return Config{
		Mode:            ModeSQLite,
		CleanupInterval: defaultCleanupInterval,
		SQLite: SQLiteConfig{
			Path: "blog/data/cashew.db",
		},
		MySQL: MySQLConfig{
			Host:            "127.0.0.1",
			Port:            3306,
			User:            "root",
			Password:        "change-me",
			Database:        "cashew_blog",
			Charset:         "utf8mb4",
			Loc:             "Local",
			ParseTime:       true,
			MaxIdleConns:    10,
			MaxOpenConns:    100,
			ConnMaxLifetime: time.Hour,
		},
	}
}

// RuntimeMode selects sqlite in debug/test mode and mysql in release mode.
func (c Config) RuntimeMode(ginMode string) string {
	switch ginMode {
	case gin.ReleaseMode:
		return ModeMySQL
	case gin.DebugMode, gin.TestMode:
		return ModeSQLite
	default:
		if c.Mode == ModeMySQL {
			return ModeMySQL
		}
		return ModeSQLite
	}
}

// Open initializes a gorm connection for the current runtime mode.
func Open(cfg Config, ginMode string, log *logger.Logger) (*Client, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	mode := cfg.RuntimeMode(ginMode)
	gormCfg := &gorm.Config{
		Logger: logger.NewGormLogger(log, resolveGormLogLevel(ginMode, log)),
	}

	var dialector gorm.Dialector
	switch mode {
	case ModeSQLite:
		if err := os.MkdirAll(filepath.Dir(cfg.SQLite.Path), 0o755); err != nil {
			return nil, fmt.Errorf("create sqlite dir: %w", err)
		}
		dialector = sqliteDriver.Open(cfg.SQLite.Path)
	case ModeMySQL:
		dialector = mysqlDriver.Open(cfg.MySQL.dsn())
	default:
		return nil, fmt.Errorf("unsupported database mode: %s", mode)
	}

	db, err := gorm.Open(dialector, gormCfg)
	if err != nil {
		return nil, fmt.Errorf("open %s database: %w", mode, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	if mode == ModeMySQL {
		sqlDB.SetMaxIdleConns(cfg.MySQL.MaxIdleConns)
		sqlDB.SetMaxOpenConns(cfg.MySQL.MaxOpenConns)
		sqlDB.SetConnMaxLifetime(cfg.MySQL.ConnMaxLifetime)
	}

	if err := sqlDB.Ping(); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping %s database: %w", mode, err)
	}

	return &Client{
		db:   db,
		sql:  sqlDB,
		mode: mode,
	}, nil
}

// DB returns the underlying gorm DB.
func (c *Client) DB() *gorm.DB {
	if c == nil {
		return nil
	}
	return c.db
}

// Migrate creates or updates the application tables.
func (c *Client) Migrate() error {
	if c == nil || c.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return AutoMigrate(c.db)
}

// Mode returns the active database mode.
func (c *Client) Mode() string {
	if c == nil {
		return ""
	}
	return c.mode
}

// Ping verifies the database connection.
func (c *Client) Ping() error {
	if c == nil || c.sql == nil {
		return fmt.Errorf("database not initialized")
	}
	return c.sql.Ping()
}

// Close closes the underlying database connection.
func (c *Client) Close() error {
	if c == nil || c.sql == nil {
		return nil
	}
	c.stopSoftCleanupJob()
	return c.sql.Close()
}

func (c Config) validate() error {
	mode := strings.ToLower(strings.TrimSpace(c.Mode))
	if mode != "" && mode != ModeSQLite && mode != ModeMySQL {
		return fmt.Errorf("unsupported configured database mode: %s", c.Mode)
	}

	if strings.TrimSpace(c.SQLite.Path) == "" {
		return fmt.Errorf("sqlite.path is required")
	}

	if strings.TrimSpace(c.MySQL.Host) == "" {
		return fmt.Errorf("mysql.host is required")
	}
	if c.MySQL.Port <= 0 {
		return fmt.Errorf("mysql.port must be greater than zero")
	}
	if strings.TrimSpace(c.MySQL.User) == "" {
		return fmt.Errorf("mysql.user is required")
	}
	if strings.TrimSpace(c.MySQL.Database) == "" {
		return fmt.Errorf("mysql.database is required")
	}
	if c.CleanupInterval <= 0 {
		return fmt.Errorf("cleanup_interval must be greater than zero")
	}

	return nil
}

func (c MySQLConfig) dsn() string {
	charset := c.Charset
	if charset == "" {
		charset = "utf8mb4"
	}

	loc := c.Loc
	if loc == "" {
		loc = "Local"
	}

	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=%t&loc=%s",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.Database,
		charset,
		c.ParseTime,
		url.QueryEscape(loc),
	)
}

func resolveGormLogLevel(ginMode string, log *logger.Logger) gormlogger.LogLevel {
	if log != nil {
		switch log.Level() {
		case zapcore.DebugLevel:
			return gormlogger.Info
		case zapcore.InfoLevel:
			return gormlogger.Warn
		case zapcore.WarnLevel:
			return gormlogger.Warn
		case zapcore.ErrorLevel:
			return gormlogger.Error
		default:
			return gormlogger.Error
		}
	}

	level := gormlogger.Warn
	if ginMode == gin.DebugMode {
		level = gormlogger.Info
	}
	if ginMode == gin.ReleaseMode {
		level = gormlogger.Error
	}
	return level
}
