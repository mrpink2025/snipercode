package machine

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"go.uber.org/zap"
)

// Manager gerencia máquinas/hosts
type Manager struct {
	supabase *supabase.Client
	logger   *zap.Logger
}

// ActiveSession representa uma sessão ativa
type ActiveSession struct {
	ID                string                 `json:"id"`
	MachineID         string                 `json:"machine_id"`
	TabID             string                 `json:"tab_id"`
	URL               string                 `json:"url"`
	Domain            string                 `json:"domain"`
	Title             string                 `json:"title"`
	IsActive          bool                   `json:"is_active"`
	BrowserFingerprint map[string]interface{} `json:"browser_fingerprint"`
	CreatedAt         time.Time              `json:"created_at"`
	LastActivity      time.Time              `json:"last_activity"`
}

// WebSocketConnection representa uma conexão WebSocket
type WebSocketConnection struct {
	MachineID  string    `json:"machine_id"`
	IsActive   bool      `json:"is_active"`
	ConnectedAt time.Time `json:"connected_at"`
	LastPingAt time.Time `json:"last_ping_at"`
}

// MachineStats estatísticas de uma máquina
type MachineStats struct {
	MachineID         string
	ActiveSessions    int
	TotalIncidents    int
	RecentIncidents   int
	IsConnected       bool
	LastActivity      time.Time
	BlockedDomains    int
}

// NewManager cria novo MachineManager
func NewManager(sb *supabase.Client) *Manager {
	return &Manager{
		supabase: sb,
		logger:   logger.Log,
	}
}

// GetActiveSessions lista sessões ativas de uma máquina
func (m *Manager) GetActiveSessions(ctx context.Context, machineID string) ([]ActiveSession, error) {
	query := m.supabase.From("active_sessions").
		Select("*", "", false).
		Eq("is_active", "true").
		Order("last_activity.desc", nil)

	if machineID != "" {
		query = query.Eq("machine_id", machineID)
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar sessões ativas: %w", err)
	}

	var sessions []ActiveSession
	if err := json.Unmarshal(resp, &sessions); err != nil {
		return nil, err
	}

	return sessions, nil
}

// GetWebSocketConnection verifica conexão WebSocket
func (m *Manager) GetWebSocketConnection(ctx context.Context, machineID string) (*WebSocketConnection, error) {
	resp, _, err := m.supabase.From("websocket_connections").
		Select("*", "", false).
		Eq("machine_id", machineID).
		Eq("is_active", "true").
		Single().
		Execute()

	if err != nil {
		return nil, err
	}

	var conn WebSocketConnection
	if err := json.Unmarshal(resp, &conn); err != nil {
		return nil, err
	}

	return &conn, nil
}

// IsConnected verifica se máquina está conectada
func (m *Manager) IsConnected(ctx context.Context, machineID string) (bool, error) {
	conn, err := m.GetWebSocketConnection(ctx, machineID)
	if err != nil {
		return false, nil // Não conectada
	}

	// Considerar conectada se último ping foi há menos de 2 minutos
	if time.Since(conn.LastPingAt) > 2*time.Minute {
		return false, nil
	}

	return conn.IsActive, nil
}

// GetStats retorna estatísticas de uma máquina
func (m *Manager) GetStats(ctx context.Context, machineID string) (*MachineStats, error) {
	stats := &MachineStats{
		MachineID: machineID,
	}

	// Sessões ativas
	sessions, err := m.GetActiveSessions(ctx, machineID)
	if err == nil {
		stats.ActiveSessions = len(sessions)
		if len(sessions) > 0 {
			stats.LastActivity = sessions[0].LastActivity
		}
	}

	// Incidents totais
	resp, _, err := m.supabase.From("incidents").
		Select("count", "exact", true).
		Eq("machine_id", machineID).
		Execute()
	if err == nil {
		var result []map[string]int
		json.Unmarshal(resp, &result)
		if len(result) > 0 {
			stats.TotalIncidents = result[0]["count"]
		}
	}

	// Incidents recentes (últimas 24h)
	yesterday := time.Now().Add(-24 * time.Hour).Format(time.RFC3339)
	resp, _, err = m.supabase.From("incidents").
		Select("count", "exact", true).
		Eq("machine_id", machineID).
		Gte("created_at", yesterday).
		Execute()
	if err == nil {
		var result []map[string]int
		json.Unmarshal(resp, &result)
		if len(result) > 0 {
			stats.RecentIncidents = result[0]["count"]
		}
	}

	// Domínios bloqueados
	resp, _, err = m.supabase.From("machine_blocked_domains").
		Select("count", "exact", true).
		Eq("machine_id", machineID).
		Eq("is_active", "true").
		Execute()
	if err == nil {
		var result []map[string]int
		json.Unmarshal(resp, &result)
		if len(result) > 0 {
			stats.BlockedDomains = result[0]["count"]
		}
	}

	// Status de conexão
	connected, _ := m.IsConnected(ctx, machineID)
	stats.IsConnected = connected

	return stats, nil
}

// ListAllMachines lista todas as máquinas com atividade recente
func (m *Manager) ListAllMachines(ctx context.Context) ([]string, error) {
	// Buscar máquinas únicas de sessões ativas
	resp, _, err := m.supabase.From("active_sessions").
		Select("machine_id", "", false).
		Execute()

	if err != nil {
		return nil, err
	}

	var sessions []struct {
		MachineID string `json:"machine_id"`
	}
	if err := json.Unmarshal(resp, &sessions); err != nil {
		return nil, err
	}

	// Extrair IDs únicos
	machineMap := make(map[string]bool)
	for _, s := range sessions {
		machineMap[s.MachineID] = true
	}

	machines := make([]string, 0, len(machineMap))
	for id := range machineMap {
		machines = append(machines, id)
	}

	return machines, nil
}

// CloseSession fecha uma sessão ativa
func (m *Manager) CloseSession(ctx context.Context, sessionID string) error {
	updates := map[string]interface{}{
		"is_active": false,
	}

	data, _ := json.Marshal(updates)

	_, _, err := m.supabase.From("active_sessions").
		Update(string(data), "", "").
		Eq("id", sessionID).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao fechar sessão: %w", err)
	}

	m.logger.Info("Sessão fechada", zap.String("session_id", sessionID))
	return nil
}
