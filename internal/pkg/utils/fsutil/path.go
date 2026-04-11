package fsutil

import (
	"os"
	"path/filepath"
)

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func AbsPath(path string) (string, error) {
	return filepath.Abs(path)
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func WorkingDir() (string, error) {
	return os.Getwd()
}
