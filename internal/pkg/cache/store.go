package cache

import (
	"container/list"
	"sync"
	"time"
)

// Store is an in-memory LRU cache with a global TTL per item.
type Store struct {
	enabled    bool
	maxEntries int
	ttl        time.Duration

	mu    sync.Mutex
	ll    *list.List
	items map[string]*list.Element
}

type entry struct {
	key       string
	value     any
	expiresAt time.Time
}

// New creates a cache store. Disabled caches behave like a no-op store.
func New(enabled bool, maxEntries int, ttl time.Duration) *Store {
	if maxEntries <= 0 {
		maxEntries = 1
	}
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &Store{
		enabled:    enabled,
		maxEntries: maxEntries,
		ttl:        ttl,
		ll:         list.New(),
		items:      make(map[string]*list.Element, maxEntries),
	}
}

// Enabled reports whether the cache is active.
func (s *Store) Enabled() bool {
	return s != nil && s.enabled
}

// Get returns a cached value when present and not expired.
func (s *Store) Get(key string) (any, bool) {
	if s == nil || !s.enabled {
		return nil, false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	elem, ok := s.items[key]
	if !ok {
		return nil, false
	}

	item := elem.Value.(*entry)
	if time.Now().After(item.expiresAt) {
		s.removeElement(elem)
		return nil, false
	}

	s.ll.MoveToFront(elem)
	return item.value, true
}

// Set saves a value in the cache.
func (s *Store) Set(key string, value any) {
	if s == nil || !s.enabled {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if elem, ok := s.items[key]; ok {
		item := elem.Value.(*entry)
		item.value = value
		item.expiresAt = time.Now().Add(s.ttl)
		s.ll.MoveToFront(elem)
		return
	}

	elem := s.ll.PushFront(&entry{
		key:       key,
		value:     value,
		expiresAt: time.Now().Add(s.ttl),
	})
	s.items[key] = elem

	for s.ll.Len() > s.maxEntries {
		s.removeOldest()
	}
}

// Clear removes all cached keys.
func (s *Store) Clear() {
	if s == nil || !s.enabled {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.ll.Init()
	s.items = make(map[string]*list.Element, s.maxEntries)
}

// DeletePrefix removes cached keys under the same prefix.
func (s *Store) DeletePrefix(prefix string) {
	if s == nil || !s.enabled {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for key, elem := range s.items {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			s.removeElement(elem)
		}
	}
}

func (s *Store) removeOldest() {
	elem := s.ll.Back()
	if elem == nil {
		return
	}
	s.removeElement(elem)
}

func (s *Store) removeElement(elem *list.Element) {
	s.ll.Remove(elem)
	item := elem.Value.(*entry)
	delete(s.items, item.key)
}
