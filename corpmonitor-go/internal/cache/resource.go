package cache

import (
	"sync"
	"time"
)

// ResourceCache armazena recursos em cache
type ResourceCache struct {
	items map[string]*CacheItem
	mu    sync.RWMutex
}

// CacheItem representa um item em cache
type CacheItem struct {
	URL       string
	Data      []byte
	MimeType  string
	CachedAt  time.Time
	ExpiresAt time.Time
}

// NewResourceCache cria um novo cache
func NewResourceCache() *ResourceCache {
	return &ResourceCache{
		items: make(map[string]*CacheItem),
	}
}

// Set adiciona item ao cache
func (c *ResourceCache) Set(url string, data []byte, mimeType string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[url] = &CacheItem{
		URL:       url,
		Data:      data,
		MimeType:  mimeType,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(ttl),
	}
}

// Get recupera item do cache
func (c *ResourceCache) Get(url string) (*CacheItem, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, exists := c.items[url]
	if !exists {
		return nil, false
	}

	// Verificar expiração
	if time.Now().After(item.ExpiresAt) {
		return nil, false
	}

	return item, true
}

// Delete remove item do cache
func (c *ResourceCache) Delete(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, url)
}

// Clear limpa todo o cache
func (c *ResourceCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]*CacheItem)
}

// CleanExpired remove itens expirados
func (c *ResourceCache) CleanExpired() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := 0
	now := time.Now()

	for url, item := range c.items {
		if now.After(item.ExpiresAt) {
			delete(c.items, url)
			count++
		}
	}

	return count
}

// Size retorna número de itens em cache
func (c *ResourceCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}
