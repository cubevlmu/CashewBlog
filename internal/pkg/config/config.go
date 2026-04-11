package config

import (
	"strings"
	"time"
)

// Config holds application configuration.
type Config struct {
	Env        string        `yaml:"env"`
	LogLevel   string        `yaml:"log_level"`
	LogPath    string        `yaml:"log_path"`
	Addr       string        `yaml:"addr"`
	JWTSecret  string        `yaml:"jwt_secret"`
	JWTIssuer  string        `yaml:"jwt_issuer"`
	AccessTTL  time.Duration `yaml:"access_ttl"`
	RefreshTTL time.Duration `yaml:"refresh_ttl"`
	Cache      CacheConfig   `yaml:"cache"`
	Asset      AssetConfig   `yaml:"asset"`
}

type CacheConfig struct {
	Enabled    bool          `yaml:"enabled"`
	MaxEntries int           `yaml:"max_entries"`
	TTL        time.Duration `yaml:"ttl"`
}

type AssetConfig struct {
	UploadDir           string `yaml:"upload_dir"`
	CacheMaxMemoryBytes int64  `yaml:"cache_max_memory_bytes"`
}

// Load loads configuration from blog/config.yml, creating it with defaults if missing.
func Load() (Config, error) {
	return LoadFrom("blog/config.yml")
}

// LoadFrom loads configuration from the given path, creating it with defaults if missing.
func LoadFrom(path string) (Config, error) {
	return LoadYAML(path, Default(), (*Config).applyLogLevelDefault)
}

// Save writes the configuration to a YAML file.
func (c *Config) Save(path string) error {
	return SaveYAML(path, c)
}

// Default returns the default configuration.
func Default() Config {
	cfg := Config{
		Env:        "development",
		LogLevel:   "",
		LogPath:    "blog/logs/app.log",
		Addr:       ":8080",
		JWTSecret:  "change-me",
		JWTIssuer:  "CashewBlog",
		AccessTTL:  mustParseDuration("30m"),
		RefreshTTL: mustParseDuration("720h"),
		Cache: CacheConfig{
			Enabled:    true,
			MaxEntries: 512,
			TTL:        mustParseDuration("30s"),
		},
		Asset: AssetConfig{
			UploadDir:           "blog/assets",
			CacheMaxMemoryBytes: 8 * 1024 * 1024,
		},
	}
	cfg.applyLogLevelDefault()
	return cfg
}

func mustParseDuration(val string) time.Duration {
	dur, err := time.ParseDuration(val)
	if err != nil {
		return 0
	}
	return dur
}

func (c *Config) applyLogLevelDefault() {
	if c == nil {
		return
	}
	if strings.TrimSpace(c.Env) == "" {
		c.Env = "development"
	}
	if strings.TrimSpace(c.LogLevel) == "" {
		if strings.EqualFold(strings.TrimSpace(c.Env), "production") {
			c.LogLevel = "info"
		} else {
			c.LogLevel = "debug"
		}
	}
	if c.Cache.MaxEntries <= 0 {
		c.Cache.MaxEntries = 512
	}
	if c.Cache.TTL <= 0 {
		c.Cache.TTL = mustParseDuration("30s")
	}
	if strings.TrimSpace(c.Asset.UploadDir) == "" {
		c.Asset.UploadDir = "blog/assets"
	}
	if c.Asset.CacheMaxMemoryBytes <= 0 {
		c.Asset.CacheMaxMemoryBytes = 8 * 1024 * 1024
	}
}
