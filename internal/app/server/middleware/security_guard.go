package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"CashewBlog/internal/pkg/logger"
)

type GuardConfig struct {
	MinRequestInterval time.Duration
	WindowSize         time.Duration
	MaxRequestsPerIP   int
	DuplicateTTL       time.Duration
	MaxBodyBytes       int64
}

type ipState struct {
	windowStart   time.Time
	count         int
	lastSeen      time.Time
	lastRequestAt time.Time
}

type duplicateState struct {
	lastSeen time.Time
}

type SecurityGuard struct {
	log        *logger.Logger
	cfg        GuardConfig
	mu         sync.Mutex
	ipWindows  map[string]*ipState
	duplicates map[string]*duplicateState
	lastClean  time.Time
}

func DefaultGuardConfig() GuardConfig {
	return GuardConfig{
		MinRequestInterval: 120 * time.Millisecond,
		WindowSize:         time.Minute,
		MaxRequestsPerIP:   120,
		DuplicateTTL:       2 * time.Second,
		MaxBodyBytes:       64 * 1024,
	}
}

func NewSecurityGuard(log *logger.Logger, cfg GuardConfig) *SecurityGuard {
	if log == nil {
		log = &logger.Logger{}
	}
	if cfg.MinRequestInterval <= 0 {
		cfg.MinRequestInterval = 120 * time.Millisecond
	}
	if cfg.WindowSize <= 0 {
		cfg.WindowSize = time.Minute
	}
	if cfg.MaxRequestsPerIP <= 0 {
		cfg.MaxRequestsPerIP = 120
	}
	if cfg.DuplicateTTL <= 0 {
		cfg.DuplicateTTL = 2 * time.Second
	}
	if cfg.MaxBodyBytes <= 0 {
		cfg.MaxBodyBytes = 64 * 1024
	}

	return &SecurityGuard{
		log:        log,
		cfg:        cfg,
		ipWindows:  make(map[string]*ipState),
		duplicates: make(map[string]*duplicateState),
		lastClean:  time.Now(),
	}
}

func (g *SecurityGuard) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		ip := c.ClientIP()
		method := c.Request.Method
		path := c.Request.URL.Path
		rawQuery := c.Request.URL.RawQuery

		if reason := detectMalicious(c); reason != "" {
			g.log.GetZap().Warn("security blocked",
				zap.String("reason", "malicious"),
				zap.String("detail", reason),
				zap.String("ip", ip),
				zap.String("method", method),
				zap.String("path", path),
			)
			abortWithError(c, http.StatusForbidden, "forbidden request")
			return
		}

		g.mu.Lock()
		g.cleanup(now)
		blocked, reason := g.checkIP(ip, now, !isStaticAssetRead(method, path))
		g.mu.Unlock()
		if blocked && reason == "too_fast" {
			g.log.GetZap().Warn("security blocked",
				zap.String("reason", "too_fast"),
				zap.String("ip", ip),
				zap.String("method", method),
				zap.String("path", path),
			)
			abortWithError(c, http.StatusTooManyRequests, "request too frequent")
			return
		}
		if blocked && reason == "rate_limit" {
			g.log.GetZap().Warn("security blocked",
				zap.String("reason", "rate_limit"),
				zap.String("ip", ip),
				zap.String("method", method),
				zap.String("path", path),
			)
			abortWithError(c, http.StatusTooManyRequests, "too many requests")
			return
		}

		if isWriteMethod(method) {
			bodyHash := hashBodyWithRestore(c, g.cfg.MaxBodyBytes)
			key := strings.Join([]string{ip, method, path, rawQuery, bodyHash}, "|")
			g.mu.Lock()
			if g.isDuplicate(key, now) {
				g.mu.Unlock()
				g.log.GetZap().Warn("security blocked",
					zap.String("reason", "duplicate"),
					zap.String("ip", ip),
					zap.String("method", method),
					zap.String("path", path),
				)
				abortWithError(c, http.StatusTooManyRequests, "duplicate request")
				return
			}
			g.mu.Unlock()
		}

		c.Next()
	}
}

func (g *SecurityGuard) checkIP(ip string, now time.Time, enforceMinInterval bool) (bool, string) {
	state, ok := g.ipWindows[ip]
	if !ok {
		lastRequestAt := time.Time{}
		if enforceMinInterval {
			lastRequestAt = now
		}
		g.ipWindows[ip] = &ipState{
			windowStart:   now,
			count:         1,
			lastSeen:      now,
			lastRequestAt: lastRequestAt,
		}
		return false, ""
	}

	state.lastSeen = now
	tooFast := false
	if enforceMinInterval {
		tooFast = !state.lastRequestAt.IsZero() && now.Sub(state.lastRequestAt) < g.cfg.MinRequestInterval
		state.lastRequestAt = now
	}

	if now.Sub(state.windowStart) >= g.cfg.WindowSize {
		state.windowStart = now
		state.count = 0
	}
	state.count++
	if state.count > g.cfg.MaxRequestsPerIP {
		return true, "rate_limit"
	}
	if tooFast {
		return true, "too_fast"
	}
	return false, ""
}

func (g *SecurityGuard) isDuplicate(key string, now time.Time) bool {
	if prev, ok := g.duplicates[key]; ok {
		if now.Sub(prev.lastSeen) <= g.cfg.DuplicateTTL {
			prev.lastSeen = now
			return true
		}
		prev.lastSeen = now
		return false
	}
	g.duplicates[key] = &duplicateState{lastSeen: now}
	return false
}

func (g *SecurityGuard) cleanup(now time.Time) {
	if now.Sub(g.lastClean) < time.Minute {
		return
	}
	ipTTL := g.cfg.WindowSize * 2
	dupTTL := g.cfg.DuplicateTTL * 4
	for ip, state := range g.ipWindows {
		if now.Sub(state.lastSeen) > ipTTL {
			delete(g.ipWindows, ip)
		}
	}
	for key, state := range g.duplicates {
		if now.Sub(state.lastSeen) > dupTTL {
			delete(g.duplicates, key)
		}
	}
	g.lastClean = now
}

func detectMalicious(c *gin.Context) string {
	path := strings.ToLower(c.Request.URL.Path)
	query := strings.ToLower(c.Request.URL.RawQuery)
	ua := strings.ToLower(c.Request.UserAgent())

	maliciousTokens := []string{
		"../", "%2e%2e", "<script", "union select", "drop table", " or 1=1", "sleep(",
		"../../", "/etc/passwd", "\\x", "%00",
	}

	for _, token := range maliciousTokens {
		if strings.Contains(path, token) || strings.Contains(query, token) {
			return "malicious pattern in path/query"
		}
	}
	if strings.Contains(ua, "sqlmap") || strings.Contains(ua, "nmap") || strings.Contains(ua, "nikto") {
		return "scanner user agent"
	}
	return ""
}

func hashBodyWithRestore(c *gin.Context, maxBytes int64) string {
	if c.Request == nil || c.Request.Body == nil {
		return ""
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return ""
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	sample := body
	if int64(len(sample)) > maxBytes {
		sample = sample[:maxBytes]
	}
	sum := sha256.Sum256(sample)
	return hex.EncodeToString(sum[:])
}

func isWriteMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func isStaticAssetRead(method string, path string) bool {
	return method == http.MethodGet && strings.HasPrefix(path, "/api/v1/assets/")
}
