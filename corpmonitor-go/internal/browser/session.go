package browser

import (
	"context"
	"time"
)

// Session representa uma sessão de browser
type Session struct {
	ID        string
	Ctx       context.Context
	Cancel    context.CancelFunc
	Incident  map[string]interface{}
	URL       string
	StartedAt time.Time
	LastActivity time.Time
}

// IsActive verifica se a sessão está ativa
func (s *Session) IsActive() bool {
	select {
	case <-s.Ctx.Done():
		return false
	default:
		return true
	}
}

// UpdateActivity atualiza timestamp de última atividade
func (s *Session) UpdateActivity() {
	s.LastActivity = time.Now()
}

// Duration retorna duração da sessão
func (s *Session) Duration() time.Duration {
	return time.Since(s.StartedAt)
}
