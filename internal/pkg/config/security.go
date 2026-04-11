package config

import (
	"time"
)

// SecurityConfig holds request security guard settings.
type SecurityConfig struct {
	Enabled            bool          `yaml:"enabled"`
	MinRequestInterval time.Duration `yaml:"min_request_interval"`
	WindowSize         time.Duration `yaml:"window_size"`
	MaxRequestsPerIP   int           `yaml:"max_requests_per_ip"`
	DuplicateTTL       time.Duration `yaml:"duplicate_ttl"`
	MaxBodyBytes       int64         `yaml:"max_body_bytes"`
	LoginMinInterval   time.Duration `yaml:"login_min_interval"`
	LoginWindowSize    time.Duration `yaml:"login_window_size"`
	MaxLoginPerIP      int           `yaml:"max_login_per_ip"`
	MaxLoginFailures   int           `yaml:"max_login_failures"`
	MaxLoginUsersPerIP int           `yaml:"max_login_users_per_ip"`
}

// LoadSecurity loads security config from blog/security.yml.
func LoadSecurity() (SecurityConfig, error) {
	return LoadSecurityFrom("blog/security.yml")
}

// LoadSecurityFrom loads security config from target path.
func LoadSecurityFrom(path string) (SecurityConfig, error) {
	return LoadYAML(path, DefaultSecurity(), (*SecurityConfig).normalize)
}

// Save writes security configuration to YAML.
func (c *SecurityConfig) Save(path string) error {
	return SaveYAML(path, c)
}

// DefaultSecurity returns default security config.
func DefaultSecurity() SecurityConfig {
	cfg := SecurityConfig{
		Enabled:            true,
		MinRequestInterval: 120 * time.Millisecond,
		WindowSize:         time.Minute,
		MaxRequestsPerIP:   120,
		DuplicateTTL:       2 * time.Second,
		MaxBodyBytes:       64 * 1024,
		LoginMinInterval:   time.Second,
		LoginWindowSize:    5 * time.Minute,
		MaxLoginPerIP:      20,
		MaxLoginFailures:   6,
		MaxLoginUsersPerIP: 8,
	}
	cfg.normalize()
	return cfg
}

func (c *SecurityConfig) normalize() {
	if c == nil {
		return
	}
	if c.MinRequestInterval <= 0 {
		c.MinRequestInterval = 120 * time.Millisecond
	}
	if c.WindowSize <= 0 {
		c.WindowSize = time.Minute
	}
	if c.MaxRequestsPerIP <= 0 {
		c.MaxRequestsPerIP = 120
	}
	if c.DuplicateTTL <= 0 {
		c.DuplicateTTL = 2 * time.Second
	}
	if c.MaxBodyBytes <= 0 {
		c.MaxBodyBytes = 64 * 1024
	}
	if c.LoginMinInterval <= 0 {
		c.LoginMinInterval = time.Second
	}
	if c.LoginWindowSize <= 0 {
		c.LoginWindowSize = 5 * time.Minute
	}
	if c.MaxLoginPerIP <= 0 {
		c.MaxLoginPerIP = 20
	}
	if c.MaxLoginFailures <= 0 {
		c.MaxLoginFailures = 6
	}
	if c.MaxLoginUsersPerIP <= 0 {
		c.MaxLoginUsersPerIP = 8
	}
}

func (c *SecurityConfig) IsEnabled() bool {
	if c == nil {
		return false
	}
	return c.Enabled
}
