package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

func LoadYAML[T any](path string, defaults T, normalize func(*T)) (T, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return defaults, fmt.Errorf("create config dir: %w", err)
	}

	cfg := defaults
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			if normalize != nil {
				normalize(&cfg)
			}
			if err := SaveYAML(path, &cfg); err != nil {
				return defaults, err
			}
			return cfg, nil
		}
		return defaults, fmt.Errorf("read config: %w", err)
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return defaults, fmt.Errorf("unmarshal config: %w", err)
	}
	if normalize != nil {
		normalize(&cfg)
	}
	return cfg, nil
}

func SaveYAML(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := yaml.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}
