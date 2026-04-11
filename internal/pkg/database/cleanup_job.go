package database

import (
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"CashewBlog/internal/pkg/logger"
)

const defaultCleanupInterval = 30 * time.Minute

type cleanupResult struct {
	Users           int64
	Blogs           int64
	Comments        int64
	ExpiredSessions int64
	ExpiredTokens   int64
}

// StartSoftCleanupJob starts a periodic cleanup task for deleted/expired data.
func (c *Client) StartSoftCleanupJob(interval time.Duration, log *logger.Logger) {
	if c == nil || c.db == nil {
		return
	}
	if interval <= 0 {
		interval = defaultCleanupInterval
	}
	if log == nil {
		log = logger.Nop()
	}

	c.cleanupMu.Lock()
	if c.cleanupStop != nil {
		c.cleanupMu.Unlock()
		return
	}
	stop := make(chan struct{})
	done := make(chan struct{})
	c.cleanupStop = stop
	c.cleanupDone = done
	c.cleanupMu.Unlock()

	runOnce := func() {
		result, err := c.runSoftCleanup(time.Now())
		if err != nil {
			log.GetZap().Warn("database cleanup failed", zap.Error(err))
			return
		}
		log.GetZap().Debug("database cleanup completed",
			zap.Int64("users", result.Users),
			zap.Int64("blogs", result.Blogs),
			zap.Int64("comments", result.Comments),
			zap.Int64("expired_sessions", result.ExpiredSessions),
			zap.Int64("expired_tokens", result.ExpiredTokens),
		)
	}

	go func() {
		defer close(done)
		runOnce()

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				runOnce()
			case <-stop:
				return
			}
		}
	}()
}

func (c *Client) stopSoftCleanupJob() {
	c.cleanupMu.Lock()
	stop := c.cleanupStop
	done := c.cleanupDone
	if stop == nil {
		c.cleanupMu.Unlock()
		return
	}
	c.cleanupStop = nil
	c.cleanupDone = nil
	close(stop)
	c.cleanupMu.Unlock()
	<-done
}

func (c *Client) runSoftCleanup(now time.Time) (cleanupResult, error) {
	if c == nil || c.db == nil {
		return cleanupResult{}, fmt.Errorf("database not initialized")
	}

	var result cleanupResult
	err := c.db.Transaction(func(tx *gorm.DB) error {
		userRes := tx.Model(&User{}).
			Where("state = ?", UserStateDeleted).
			Where("deleted_at IS NULL").
			Update("deleted_at", now)
		if userRes.Error != nil {
			return userRes.Error
		}
		result.Users = userRes.RowsAffected

		blogRes := tx.Model(&Blog{}).
			Where("state = ?", BlogStateDeleted).
			Where("deleted_at IS NULL").
			Update("deleted_at", now)
		if blogRes.Error != nil {
			return blogRes.Error
		}
		result.Blogs = blogRes.RowsAffected

		commentRes := tx.Model(&Comment{}).
			Where("state = ?", CommentStateDeleted).
			Where("deleted_at IS NULL").
			Update("deleted_at", now)
		if commentRes.Error != nil {
			return commentRes.Error
		}
		result.Comments = commentRes.RowsAffected

		sessionRes := tx.Model(&UserSession{}).
			Where("expires_at <= ?", now).
			Where("revoked_at IS NULL").
			Update("revoked_at", now)
		if sessionRes.Error != nil {
			return sessionRes.Error
		}
		result.ExpiredSessions = sessionRes.RowsAffected

		tokenRes := tx.Model(&UserToken{}).
			Where("expires_at <= ?", now).
			Where("used_at IS NULL").
			Update("used_at", now)
		if tokenRes.Error != nil {
			return tokenRes.Error
		}
		result.ExpiredTokens = tokenRes.RowsAffected

		return nil
	})
	return result, err
}
