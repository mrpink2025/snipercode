package domain

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Manager gerencia domínios (blocked, monitored, trusted)
type Manager struct {
	supabase *supabase.Client
	logger   *zap.Logger
}

// BlockedDomain representa um domínio bloqueado
type BlockedDomain struct {
	ID        string     `json:"id"`
	Domain    string     `json:"domain"`
	Reason    string     `json:"reason"`
	BlockedBy string     `json:"blocked_by"`
	IsActive  bool       `json:"is_active"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// MonitoredDomain representa um domínio monitorado
type MonitoredDomain struct {
	ID             string                 `json:"id"`
	Domain         string                 `json:"domain"`
	AlertType      string                 `json:"alert_type"`
	AlertFrequency int                    `json:"alert_frequency"`
	AddedBy        string                 `json:"added_by"`
	IsActive       bool                   `json:"is_active"`
	Metadata       map[string]interface{} `json:"metadata"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// TrustedDomain representa um domínio confiável
type TrustedDomain struct {
	ID         string                 `json:"id"`
	Domain     string                 `json:"domain"`
	Category   string                 `json:"category"`
	AddedBy    string                 `json:"added_by"`
	VerifiedAt *time.Time             `json:"verified_at"`
	IsActive   bool                   `json:"is_active"`
	Metadata   map[string]interface{} `json:"metadata"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// NewManager cria novo DomainManager
func NewManager(sb *supabase.Client) *Manager {
	return &Manager{
		supabase: sb,
		logger:   logger.Log,
	}
}

// ========== BLOCKED DOMAINS ==========

// BlockDomain bloqueia um domínio
func (m *Manager) BlockDomain(ctx context.Context, domain, reason, userID string, expiresAt *time.Time) error {
	blocked := BlockedDomain{
		ID:        uuid.New().String(),
		Domain:    domain,
		Reason:    reason,
		BlockedBy: userID,
		IsActive:  true,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	data, err := json.Marshal(blocked)
	if err != nil {
		return err
	}

	_, _, err = m.supabase.From("blocked_domains").
		Insert(string(data), false, "", "", "").
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao bloquear domínio: %w", err)
	}

	m.logger.Info("Domínio bloqueado",
		zap.String("domain", domain),
		zap.String("reason", reason),
	)

	return nil
}

// UnblockDomain desbloqueia um domínio
func (m *Manager) UnblockDomain(ctx context.Context, domain string) error {
	updates := map[string]interface{}{
		"is_active":  false,
		"updated_at": time.Now(),
	}

	data, err := json.Marshal(updates)
	if err != nil {
		return fmt.Errorf("erro ao serializar atualizações: %w", err)
	}

	_, _, err = m.supabase.From("blocked_domains").
		Update(string(data), "", "").
		Eq("domain", domain).
		Eq("is_active", true).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao desbloquear domínio: %w", err)
	}

	m.logger.Info("Domínio desbloqueado", zap.String("domain", domain))
	return nil
}

// IsBlocked verifica se domínio está bloqueado
func (m *Manager) IsBlocked(ctx context.Context, domain string) (bool, error) {
	resp, _, err := m.supabase.From("blocked_domains").
		Select("id", "", false).
		Eq("domain", domain).
		Eq("is_active", true).
		Execute()

	if err != nil {
		return false, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(resp, &results); err != nil {
		return false, err
	}

	return len(results) > 0, nil
}

// ListBlockedDomains lista domínios bloqueados
func (m *Manager) ListBlockedDomains(ctx context.Context, activeOnly bool) ([]BlockedDomain, error) {
	query := m.supabase.From("blocked_domains").
		Select("*", "", false).
		Order("created_at.desc", nil)

	if activeOnly {
		query = query.Eq("is_active", true)
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, err
	}

	var domains []BlockedDomain
	if err := json.Unmarshal(resp, &domains); err != nil {
		return nil, err
	}

	return domains, nil
}

// ========== MONITORED DOMAINS ==========

// AddMonitoredDomain adiciona domínio para monitoramento
func (m *Manager) AddMonitoredDomain(ctx context.Context, domain, alertType string, frequency int, userID string) error {
	monitored := MonitoredDomain{
		ID:             uuid.New().String(),
		Domain:         domain,
		AlertType:      alertType,
		AlertFrequency: frequency,
		AddedBy:        userID,
		IsActive:       true,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	data, err := json.Marshal(monitored)
	if err != nil {
		return err
	}

	_, _, err = m.supabase.From("monitored_domains").
		Insert(string(data), false, "", "", "").
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao adicionar domínio monitorado: %w", err)
	}

	m.logger.Info("Domínio monitorado adicionado", zap.String("domain", domain))
	return nil
}

// RemoveMonitoredDomain remove domínio do monitoramento
func (m *Manager) RemoveMonitoredDomain(ctx context.Context, domain string) error {
	updates := map[string]interface{}{
		"is_active":  false,
		"updated_at": time.Now(),
	}

	data, err := json.Marshal(updates)
	if err != nil {
		return fmt.Errorf("erro ao serializar atualizações: %w", err)
	}

	_, _, err = m.supabase.From("monitored_domains").
		Update(string(data), "", "").
		Eq("domain", domain).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao remover domínio monitorado: %w", err)
	}

	m.logger.Info("Domínio removido do monitoramento", zap.String("domain", domain))
	return nil
}

// ListMonitoredDomains lista domínios monitorados
func (m *Manager) ListMonitoredDomains(ctx context.Context, activeOnly bool) ([]MonitoredDomain, error) {
	query := m.supabase.From("monitored_domains").
		Select("*", "", false).
		Order("created_at.desc", nil)

	if activeOnly {
		query = query.Eq("is_active", true)
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, err
	}

	var domains []MonitoredDomain
	if err := json.Unmarshal(resp, &domains); err != nil {
		return nil, err
	}

	return domains, nil
}

// ========== TRUSTED DOMAINS ==========

// AddTrustedDomain adiciona domínio confiável
func (m *Manager) AddTrustedDomain(ctx context.Context, domain, category, userID string) error {
	now := time.Now()
	trusted := TrustedDomain{
		ID:         uuid.New().String(),
		Domain:     domain,
		Category:   category,
		AddedBy:    userID,
		VerifiedAt: &now,
		IsActive:   true,
		CreatedAt:  now,
	}

	data, err := json.Marshal(trusted)
	if err != nil {
		return err
	}

	_, _, err = m.supabase.From("trusted_domains").
		Insert(string(data), false, "", "", "").
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao adicionar domínio confiável: %w", err)
	}

	m.logger.Info("Domínio confiável adicionado", zap.String("domain", domain))
	return nil
}

// RemoveTrustedDomain remove domínio confiável
func (m *Manager) RemoveTrustedDomain(ctx context.Context, domain string) error {
	_, _, err := m.supabase.From("trusted_domains").
		Delete("", "").
		Eq("domain", domain).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao remover domínio confiável: %w", err)
	}

	m.logger.Info("Domínio confiável removido", zap.String("domain", domain))
	return nil
}

// IsTrusted verifica se domínio é confiável
func (m *Manager) IsTrusted(ctx context.Context, domain string) (bool, error) {
	resp, _, err := m.supabase.From("trusted_domains").
		Select("id", "", false).
		Eq("domain", domain).
		Eq("is_active", true).
		Execute()

	if err != nil {
		return false, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(resp, &results); err != nil {
		return false, err
	}

	return len(results) > 0, nil
}

// ListTrustedDomains lista domínios confiáveis
func (m *Manager) ListTrustedDomains(ctx context.Context) ([]TrustedDomain, error) {
	resp, _, err := m.supabase.From("trusted_domains").
		Select("*", "", false).
		Eq("is_active", true).
		Order("created_at.desc", nil).
		Execute()

	if err != nil {
		return nil, err
	}

	var domains []TrustedDomain
	if err := json.Unmarshal(resp, &domains); err != nil {
		return nil, err
	}

	return domains, nil
}
