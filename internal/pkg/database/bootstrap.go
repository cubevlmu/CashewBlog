package database

import (
	"fmt"

	pkglogger "CashewBlog/internal/pkg/logger"
)

const defaultConfigPath = "blog/database.yml"

// BootstrapResult contains the initialized database client and resolved config.
type BootstrapResult struct {
	Client *Client
	Config Config
}

// Bootstrap loads config, opens the database, and runs schema migration.
func Bootstrap(ginMode string, log *pkglogger.Logger) (*BootstrapResult, error) {
	return BootstrapFrom(defaultConfigPath, ginMode, log)
}

// BootstrapFrom loads config from the given path, opens the database, and runs schema migration.
func BootstrapFrom(path, ginMode string, log *pkglogger.Logger) (*BootstrapResult, error) {
	cfg, err := LoadFrom(path)
	if err != nil {
		return nil, fmt.Errorf("load database config: %w", err)
	}

	client, err := Open(cfg, ginMode, log)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := client.Migrate(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	if err := seedDefaultUsers(client.DB()); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("seed default users: %w", err)
	}
	client.StartSoftCleanupJob(cfg.CleanupInterval, log)

	return &BootstrapResult{
		Client: client,
		Config: cfg,
	}, nil
}
