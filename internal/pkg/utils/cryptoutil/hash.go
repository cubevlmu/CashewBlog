package cryptoutil

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// SHA256Hex returns lowercase SHA256 hex digest for input text.
func SHA256Hex(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// NormalizeSHA256Hex validates a SHA256 hex string and returns normalized lowercase form.
func NormalizeSHA256Hex(raw string) (string, bool) {
	val := strings.ToLower(strings.TrimSpace(raw))
	if len(val) != 64 {
		return "", false
	}
	if _, err := hex.DecodeString(val); err != nil {
		return "", false
	}
	return val, true
}
