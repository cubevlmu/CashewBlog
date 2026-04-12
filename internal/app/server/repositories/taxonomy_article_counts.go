package repositories

import "sync"

type articleCountCache struct {
	mu     sync.RWMutex
	counts map[uint]int64
}

func newArticleCountCache() *articleCountCache {
	return &articleCountCache{counts: map[uint]int64{}}
}

func (c *articleCountCache) SetAll(counts map[uint]int64) {
	if c == nil {
		return
	}
	next := make(map[uint]int64, len(counts))
	for id, count := range counts {
		next[id] = count
	}

	c.mu.Lock()
	c.counts = next
	c.mu.Unlock()
}

func (c *articleCountCache) Get(id uint) int64 {
	if c == nil {
		return 0
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.counts[id]
}
