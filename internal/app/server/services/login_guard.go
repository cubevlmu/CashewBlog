package services

import (
	"strings"
	"sync"
	"time"
)

type LoginGuardConfig struct {
	MinInterval   time.Duration
	WindowSize    time.Duration
	MaxPerIP      int
	MaxFailures   int
	MaxUsersPerIP int
}

type loginAttemptState struct {
	LastAttempt      time.Time
	WindowStart      time.Time
	Attempts         int
	Failures         int
	DistinctUsers    map[string]struct{}
	LastUserWindowAt time.Time
}

type loginKeyState struct {
	LastAttempt time.Time
	WindowStart time.Time
	Failures    int
}

type LoginGuard struct {
	cfg     LoginGuardConfig
	mu      sync.Mutex
	byIP    map[string]*loginAttemptState
	byKey   map[string]*loginKeyState
	lastGC  time.Time
}

func NewLoginGuard(cfg LoginGuardConfig) *LoginGuard {
	if cfg.MinInterval <= 0 {
		cfg.MinInterval = time.Second
	}
	if cfg.WindowSize <= 0 {
		cfg.WindowSize = 5 * time.Minute
	}
	if cfg.MaxPerIP <= 0 {
		cfg.MaxPerIP = 20
	}
	if cfg.MaxFailures <= 0 {
		cfg.MaxFailures = 6
	}
	if cfg.MaxUsersPerIP <= 0 {
		cfg.MaxUsersPerIP = 8
	}

	return &LoginGuard{
		cfg:    cfg,
		byIP:   make(map[string]*loginAttemptState),
		byKey:  make(map[string]*loginKeyState),
		lastGC: time.Now(),
	}
}

// Check reports whether a login attempt should be allowed before auth work begins.
func (g *LoginGuard) Check(ip, username string, now time.Time) (bool, string) {
	if g == nil {
		return true, ""
	}

	ip = strings.TrimSpace(strings.ToLower(ip))
	username = strings.TrimSpace(strings.ToLower(username))
	key := ip + "|" + username

	g.mu.Lock()
	defer g.mu.Unlock()
	g.gc(now)

	ipState := g.ensureIPState(ip, now)
	keyState := g.ensureKeyState(key, now)

	if now.Sub(ipState.LastAttempt) < g.cfg.MinInterval || now.Sub(keyState.LastAttempt) < g.cfg.MinInterval {
		return false, "login too frequent"
	}
	if ipState.Attempts >= g.cfg.MaxPerIP {
		return false, "too many login attempts"
	}
	if keyState.Failures >= g.cfg.MaxFailures {
		return false, "too many login failures"
	}

	if _, ok := ipState.DistinctUsers[username]; !ok && len(ipState.DistinctUsers) >= g.cfg.MaxUsersPerIP {
		return false, "too many login targets"
	}

	ipState.LastAttempt = now
	ipState.Attempts++
	ipState.DistinctUsers[username] = struct{}{}
	keyState.LastAttempt = now
	return true, ""
}

// RecordSuccess records a successful login attempt.
func (g *LoginGuard) RecordSuccess(ip, username string, now time.Time) {
	if g == nil {
		return
	}
	g.record(ip, username, now, false)
}

// RecordFailure records a failed login attempt.
func (g *LoginGuard) RecordFailure(ip, username string, now time.Time) {
	if g == nil {
		return
	}
	g.record(ip, username, now, true)
}

func (g *LoginGuard) record(ip, username string, now time.Time, failed bool) {
	ip = strings.TrimSpace(strings.ToLower(ip))
	username = strings.TrimSpace(strings.ToLower(username))
	key := ip + "|" + username

	g.mu.Lock()
	defer g.mu.Unlock()
	g.gc(now)

	ipState := g.ensureIPState(ip, now)
	keyState := g.ensureKeyState(key, now)

	ipState.LastAttempt = now
	ipState.DistinctUsers[username] = struct{}{}
	if failed {
		ipState.Failures++
		keyState.Failures++
	}
}

func (g *LoginGuard) ensureIPState(ip string, now time.Time) *loginAttemptState {
	state, ok := g.byIP[ip]
	if !ok {
		state = &loginAttemptState{
			LastAttempt:   time.Time{},
			WindowStart:   now,
			DistinctUsers: map[string]struct{}{},
		}
		g.byIP[ip] = state
		return state
	}
	if now.Sub(state.WindowStart) > g.cfg.WindowSize {
		state.WindowStart = now
		state.Attempts = 0
		state.Failures = 0
		state.DistinctUsers = map[string]struct{}{}
	}
	return state
}

func (g *LoginGuard) ensureKeyState(key string, now time.Time) *loginKeyState {
	state, ok := g.byKey[key]
	if !ok {
		state = &loginKeyState{WindowStart: now}
		g.byKey[key] = state
		return state
	}
	if now.Sub(state.WindowStart) > g.cfg.WindowSize {
		state.WindowStart = now
		state.Failures = 0
	}
	return state
}

func (g *LoginGuard) gc(now time.Time) {
	if now.Sub(g.lastGC) < time.Minute {
		return
	}
	ttl := g.cfg.WindowSize * 2
	for ip, state := range g.byIP {
		if now.Sub(state.LastAttempt) > ttl {
			delete(g.byIP, ip)
		}
	}
	for key, state := range g.byKey {
		if now.Sub(state.LastAttempt) > ttl {
			delete(g.byKey, key)
		}
	}
	g.lastGC = now
}
