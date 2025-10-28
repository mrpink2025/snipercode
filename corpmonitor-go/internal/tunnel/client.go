package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Client gerencia requisições via túnel reverso
type Client struct {
	supabase  *supabase.Client
	machineID string
	stats     Stats
	mu        sync.RWMutex
	logger    *zap.Logger
}

// Stats rastreia estatísticas do túnel
type Stats struct {
	TotalRequests      int
	SuccessfulRequests int
	FailedRequests     int
	TotalBytesReceived int64
	LastRequestAt      time.Time
}

// Command representa um comando de túnel
type Command struct {
	ID              string                 `json:"id"`
	CommandType     string                 `json:"command_type"`
	TargetMachineID string                 `json:"target_machine_id"`
	Payload         map[string]interface{} `json:"payload"`
	Status          string                 `json:"status"`
	CreatedAt       time.Time              `json:"created_at"`
}

// Response representa uma resposta do túnel
type Response struct {
	ID          string                 `json:"id"`
	CommandID   string                 `json:"command_id"`
	MachineID   string                 `json:"machine_id"`
	Success     bool                   `json:"success"`
	StatusCode  int                    `json:"status_code"`
	Body        string                 `json:"body"`
	Headers     map[string]interface{} `json:"headers"`
	ContentType string                 `json:"content_type"`
	Error       string                 `json:"error"`
	ElapsedMS   int                    `json:"elapsed_ms"`
	CreatedAt   time.Time              `json:"created_at"`
}

// FetchOption configura opções de fetch
type FetchOption func(*fetchOptions)

type fetchOptions struct {
	method  string
	headers map[string]string
	body    string
	timeout time.Duration
}

// WithMethod define o método HTTP
func WithMethod(method string) FetchOption {
	return func(o *fetchOptions) {
		o.method = method
	}
}

// WithHeaders define headers customizados
func WithHeaders(headers map[string]string) FetchOption {
	return func(o *fetchOptions) {
		o.headers = headers
	}
}

// WithBody define o body da requisição
func WithBody(body string) FetchOption {
	return func(o *fetchOptions) {
		o.body = body
	}
}

// WithTimeout define timeout customizado
func WithTimeout(timeout time.Duration) FetchOption {
	return func(o *fetchOptions) {
		o.timeout = timeout
	}
}

// NewClient cria um novo TunnelClient
func NewClient(sb *supabase.Client, machineID string) *Client {
	return &Client{
		supabase:  sb,
		machineID: machineID,
		stats:     Stats{},
		logger:    logger.Log,
	}
}

// Fetch faz uma requisição via túnel
func (c *Client) Fetch(ctx context.Context, url string, opts ...FetchOption) (*Response, error) {
	// Aplicar opções
	options := &fetchOptions{
		method:  "GET",
		headers: map[string]string{},
		timeout: 60 * time.Second,
	}
	for _, opt := range opts {
		opt(options)
	}

	// Criar comando
	cmd, err := c.createCommand(ctx, url, options)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar comando: %w", err)
	}

	c.logger.Info("Comando de túnel criado",
		zap.String("command_id", cmd.ID),
		zap.String("url", url),
	)

	// Poll por resultado
	result, err := c.pollResult(ctx, cmd.ID, options.timeout)
	if err != nil {
		c.updateStats(false, 0)
		return nil, err
	}

	c.updateStats(result.Success, len(result.Body))
	return result, nil
}

// createCommand cria um comando no banco
func (c *Client) createCommand(ctx context.Context, url string, opts *fetchOptions) (*Command, error) {
	cmdID := uuid.New().String()

	payload := map[string]interface{}{
		"url":     url,
		"method":  opts.method,
		"headers": opts.headers,
	}

	if opts.body != "" {
		payload["body"] = opts.body
	}

	// Inserir comando
	insertData := map[string]interface{}{
		"id":                cmdID,
		"command_type":      "tunnel_fetch",
		"target_machine_id": c.machineID,
		"payload":           payload,
		"status":            "pending",
		"executed_by":       "00000000-0000-0000-0000-000000000000", // System user
	}

	data, err := json.Marshal(insertData)
	if err != nil {
		return nil, err
	}

	_, _, err = c.supabase.From("remote_commands").
		Insert(string(data), false, "", "", "").
		Execute()

	if err != nil {
		return nil, err
	}

	return &Command{
		ID:              cmdID,
		CommandType:     "tunnel_fetch",
		TargetMachineID: c.machineID,
		Payload:         payload,
		Status:          "pending",
		CreatedAt:       time.Now(),
	}, nil
}

// pollResult faz polling por resultado com backoff
func (c *Client) pollResult(ctx context.Context, cmdID string, timeout time.Duration) (*Response, error) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	timeoutTimer := time.NewTimer(timeout)
	defer timeoutTimer.Stop()

	attempts := 0
	backoff := 500 * time.Millisecond
	maxBackoff := 5 * time.Second

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()

		case <-timeoutTimer.C:
			c.logger.Error("Timeout ao aguardar resultado do túnel",
				zap.String("command_id", cmdID),
				zap.Int("attempts", attempts),
			)
			return nil, fmt.Errorf("timeout após %v", timeout)

		case <-ticker.C:
			attempts++

			result, err := c.checkResult(cmdID)
			if err != nil {
				c.logger.Error("Erro ao checar resultado",
					zap.Error(err),
					zap.String("command_id", cmdID),
				)

				// Aumentar backoff
				backoff *= 2
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				ticker.Reset(backoff)
				continue
			}

			if result != nil {
				c.logger.Info("Resultado do túnel recebido",
					zap.String("command_id", cmdID),
					zap.Int("attempts", attempts),
					zap.Bool("success", result.Success),
				)
				return result, nil
			}

			// Log de progresso a cada 10 tentativas
			if attempts%10 == 0 {
				c.logger.Debug("Aguardando resultado do túnel",
					zap.String("command_id", cmdID),
					zap.Int("attempts", attempts),
				)
			}
		}
	}
}

// checkResult verifica se há resultado disponível
func (c *Client) checkResult(cmdID string) (*Response, error) {
	resp, _, err := c.supabase.From("tunnel_fetch_results").
		Select("*", "", false).
		Eq("command_id", cmdID).
		Single().
		Execute()

	if err != nil {
		// Se não encontrou, retorna nil sem erro
		if err.Error() == "resource not found" {
			return nil, nil
		}
		return nil, err
	}

	var result Response
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// updateStats atualiza estatísticas
func (c *Client) updateStats(success bool, bytesReceived int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.stats.TotalRequests++
	if success {
		c.stats.SuccessfulRequests++
	} else {
		c.stats.FailedRequests++
	}
	c.stats.TotalBytesReceived += int64(bytesReceived)
	c.stats.LastRequestAt = time.Now()
}

// GetStats retorna estatísticas atuais
func (c *Client) GetStats() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.stats
}

// ResetStats reseta estatísticas
func (c *Client) ResetStats() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stats = Stats{}
}

// WaitForConnection aguarda até que o túnel esteja pronto
func (c *Client) WaitForConnection(ctx context.Context, timeout time.Duration) error {
	// Verificar se existe conexão WebSocket ativa para esta máquina
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		resp, _, err := c.supabase.From("websocket_connections").
			Select("is_active", "", false).
			Eq("machine_id", c.machineID).
			Eq("is_active", "true").
			Single().
			Execute()

		if err == nil && resp != nil {
			c.logger.Info("Túnel pronto", zap.String("machine_id", c.machineID))
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(1 * time.Second):
			// Continue tentando
		}
	}

	return fmt.Errorf("timeout aguardando conexão do túnel")
}
