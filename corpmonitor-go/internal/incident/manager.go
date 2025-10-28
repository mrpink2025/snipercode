package incident

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

// Manager gerencia incidents
type Manager struct {
	supabase *supabase.Client
	logger   *zap.Logger
}

// Incident representa um incidente
type Incident struct {
	ID                  string                 `json:"id"`
	IncidentID          string                 `json:"incident_id"`
	MachineID           string                 `json:"machine_id"`
	Host                string                 `json:"host"`
	TabURL              string                 `json:"tab_url"`
	CookieExcerpt       string                 `json:"cookie_excerpt"`
	FullCookieData      map[string]interface{} `json:"full_cookie_data"`
	LocalStorage        map[string]interface{} `json:"local_storage"`
	SessionStorage      map[string]interface{} `json:"session_storage"`
	Severity            string                 `json:"severity"`
	Status              string                 `json:"status"`
	IsPhishingSuspected bool                   `json:"is_phishing_suspected"`
	AssignedTo          *string                `json:"assigned_to"`
	ViewedAt            *time.Time             `json:"viewed_at"`
	ResolvedAt          *time.Time             `json:"resolved_at"`
	ResolutionNotes     *string                `json:"resolution_notes"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

// ListOptions opções para listagem
type ListOptions struct {
	Status   string
	Severity string
	Limit    int
	Offset   int
	OrderBy  string
}

// NewManager cria novo IncidentManager
func NewManager(sb *supabase.Client) *Manager {
	return &Manager{
		supabase: sb,
		logger:   logger.Log,
	}
}

// List lista incidents com filtros
func (m *Manager) List(ctx context.Context, opts ListOptions) ([]Incident, error) {
	query := m.supabase.From("incidents").
		Select("*", "", false)

	if opts.Status != "" {
		query = query.Eq("status", opts.Status)
	}

	if opts.Severity != "" {
		query = query.Eq("severity", opts.Severity)
	}

	if opts.OrderBy == "" {
		opts.OrderBy = "created_at.desc"
	}
	query = query.Order(opts.OrderBy, nil)

	if opts.Limit > 0 {
		query = query.Limit(opts.Limit, "")
	}

	if opts.Offset > 0 {
		query = query.Range(opts.Offset, opts.Offset+opts.Limit-1, "")
	}

	resp, _, err := query.Execute()
	if err != nil {
		return nil, fmt.Errorf("erro ao listar incidents: %w", err)
	}

	var incidents []Incident
	if err := json.Unmarshal(resp, &incidents); err != nil {
		return nil, err
	}

	m.logger.Info("Incidents listados", zap.Int("count", len(incidents)))
	return incidents, nil
}

// GetByID busca incident por ID
func (m *Manager) GetByID(ctx context.Context, id string) (*Incident, error) {
	resp, _, err := m.supabase.From("incidents").
		Select("*", "", false).
		Eq("id", id).
		Single().
		Execute()

	if err != nil {
		return nil, fmt.Errorf("erro ao buscar incident: %w", err)
	}

	var incident Incident
	if err := json.Unmarshal(resp, &incident); err != nil {
		return nil, err
	}

	return &incident, nil
}

// Create cria novo incident
func (m *Manager) Create(ctx context.Context, incident *Incident) error {
	if incident.ID == "" {
		incident.ID = uuid.New().String()
	}

	incident.CreatedAt = time.Now()
	incident.UpdatedAt = time.Now()

	data, err := json.Marshal(incident)
	if err != nil {
		return err
	}

	_, _, err = m.supabase.From("incidents").
		Insert(string(data), false, "", "", "").
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao criar incident: %w", err)
	}

	m.logger.Info("Incident criado",
		zap.String("id", incident.ID),
		zap.String("incident_id", incident.IncidentID),
	)

	return nil
}

// Update atualiza incident
func (m *Manager) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()

	data, err := json.Marshal(updates)
	if err != nil {
		return err
	}

	_, _, err = m.supabase.From("incidents").
		Update(string(data), "", "").
		Eq("id", id).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao atualizar incident: %w", err)
	}

	m.logger.Info("Incident atualizado", zap.String("id", id))
	return nil
}

// UpdateStatus atualiza status do incident
func (m *Manager) UpdateStatus(ctx context.Context, id, status string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}

	if status == "resolved" || status == "closed" {
		now := time.Now()
		updates["resolved_at"] = now
	}

	return m.Update(ctx, id, updates)
}

// Assign atribui incident a um usuário
func (m *Manager) Assign(ctx context.Context, id, userID string) error {
	return m.Update(ctx, id, map[string]interface{}{
		"assigned_to": userID,
	})
}

// MarkAsViewed marca incident como visualizado
func (m *Manager) MarkAsViewed(ctx context.Context, id string) error {
	now := time.Now()
	return m.Update(ctx, id, map[string]interface{}{
		"viewed_at": now,
	})
}

// Resolve resolve incident
func (m *Manager) Resolve(ctx context.Context, id, notes string) error {
	now := time.Now()
	return m.Update(ctx, id, map[string]interface{}{
		"status":           "resolved",
		"resolved_at":      now,
		"resolution_notes": notes,
	})
}

// Delete deleta incident
func (m *Manager) Delete(ctx context.Context, id string) error {
	_, _, err := m.supabase.From("incidents").
		Delete("", "").
		Eq("id", id).
		Execute()

	if err != nil {
		return fmt.Errorf("erro ao deletar incident: %w", err)
	}

	m.logger.Info("Incident deletado", zap.String("id", id))
	return nil
}

// GetStats retorna estatísticas de incidents
func (m *Manager) GetStats(ctx context.Context) (map[string]int, error) {
	stats := make(map[string]int)

	// Total
	resp, _, err := m.supabase.From("incidents").
		Select("count", "exact", true).
		Execute()
	if err == nil {
		var result []map[string]int
		json.Unmarshal(resp, &result)
		if len(result) > 0 {
			stats["total"] = result[0]["count"]
		}
	}

	// Por status
	statuses := []string{"new", "in-progress", "resolved", "closed"}
	for _, status := range statuses {
		resp, _, err := m.supabase.From("incidents").
			Select("count", "exact", true).
			Eq("status", status).
			Execute()
		if err == nil {
			var result []map[string]int
			json.Unmarshal(resp, &result)
			if len(result) > 0 {
				stats[status] = result[0]["count"]
			}
		}
	}

	return stats, nil
}
