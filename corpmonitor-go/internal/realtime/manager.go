package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// AlertCallback é chamado quando um alerta é recebido
type AlertCallback func(payload map[string]interface{})

// StatusCallback é chamado quando o status da conexão muda
type StatusCallback func(connected bool)

// RealtimeManager gerencia conexões WebSocket com Supabase Realtime
type RealtimeManager struct {
	url           string
	apiKey        string
	machineID     string
	conn          *websocket.Conn
	mu            sync.RWMutex
	connected     bool
	alertCbs      []AlertCallback
	statusCbs     []StatusCallback
	heartbeatStop chan struct{}
	readStop      chan struct{}
	reconnectCtx  context.Context
	reconnectStop context.CancelFunc
	logger        *zap.Logger
}

// RealtimeMessage representa uma mensagem do Supabase Realtime
type RealtimeMessage struct {
	Event   string                 `json:"event"`
	Topic   string                 `json:"topic"`
	Payload map[string]interface{} `json:"payload"`
	Ref     string                 `json:"ref"`
}

// NewManager cria um novo RealtimeManager
func NewManager(url, apiKey, machineID string) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		url:           fmt.Sprintf("%s/realtime/v1/websocket", url),
		apiKey:        apiKey,
		machineID:     machineID,
		connected:     false,
		alertCbs:      []AlertCallback{},
		statusCbs:     []StatusCallback{},
		heartbeatStop: make(chan struct{}),
		readStop:      make(chan struct{}),
		reconnectCtx:  ctx,
		reconnectStop: cancel,
		logger:        logger.Log,
	}
}

// Connect estabelece conexão WebSocket
func (m *Manager) Connect() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.connected {
		return nil
	}

	// Adicionar parâmetros de autenticação
	wsURL := fmt.Sprintf("%s?apikey=%s&vsn=1.0.0", m.url, m.apiKey)

	m.logger.Info("Conectando ao Realtime", zap.String("url", m.url))

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("erro ao conectar WebSocket: %w", err)
	}

	m.conn = conn
	m.connected = true

	// Enviar mensagem de join para o canal
	if err := m.joinChannel(); err != nil {
		m.conn.Close()
		m.connected = false
		return err
	}

	// Iniciar goroutines
	go m.readPump()
	go m.heartbeatLoop()

	m.notifyStatus(true)
	m.logger.Info("Realtime conectado com sucesso")

	return nil
}

// joinChannel envia mensagem para entrar no canal
func (m *Manager) joinChannel() error {
	topic := fmt.Sprintf("realtime:public:remote_commands:target_machine_id=eq.%s", m.machineID)
	msg := RealtimeMessage{
		Topic: topic,
		Event: "phx_join",
		Payload: map[string]interface{}{
			"config": map[string]interface{}{
				"postgres_changes": []map[string]interface{}{
					{
						"event":  "*",
						"schema": "public",
						"table":  "remote_commands",
						"filter": fmt.Sprintf("target_machine_id=eq.%s", m.machineID),
					},
				},
			},
		},
		Ref: "1",
	}

	return m.sendMessage(msg)
}

// readPump lê mensagens do WebSocket continuamente
func (m *Manager) readPump() {
	defer func() {
		m.logger.Info("readPump finalizado")
		m.handleDisconnect()
	}()

	for {
		select {
		case <-m.readStop:
			return
		default:
			_, message, err := m.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					m.logger.Error("Erro ao ler mensagem WebSocket", zap.Error(err))
				}
				return
			}

			m.handleMessage(message)
		}
	}
}

// handleMessage processa mensagens recebidas
func (m *Manager) handleMessage(data []byte) {
	var msg RealtimeMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		m.logger.Error("Erro ao decodificar mensagem", zap.Error(err))
		return
	}

	m.logger.Debug("Mensagem recebida",
		zap.String("event", msg.Event),
		zap.String("topic", msg.Topic),
	)

	// Processar eventos específicos
	switch msg.Event {
	case "postgres_changes":
		if record, ok := msg.Payload["record"].(map[string]interface{}); ok {
			m.notifyAlert(record)
		}
	case "phx_reply":
		// Confirmação de join
		m.logger.Info("Canal subscrito com sucesso")
	case "phx_error":
		m.logger.Error("Erro no canal", zap.Any("payload", msg.Payload))
	}
}

// heartbeatLoop envia pings periódicos
func (m *Manager) heartbeatLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.heartbeatStop:
			m.logger.Info("Heartbeat finalizado")
			return
		case <-ticker.C:
			if err := m.sendHeartbeat(); err != nil {
				m.logger.Error("Erro ao enviar heartbeat", zap.Error(err))
				m.handleDisconnect()
				return
			}
		}
	}
}

// sendHeartbeat envia ping ao servidor
func (m *Manager) sendHeartbeat() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if !m.connected {
		return fmt.Errorf("não conectado")
	}

	msg := RealtimeMessage{
		Topic: "phoenix",
		Event: "heartbeat",
		Payload: map[string]interface{}{},
		Ref:     fmt.Sprintf("%d", time.Now().Unix()),
	}

	return m.sendMessage(msg)
}

// sendMessage envia mensagem pelo WebSocket
func (m *Manager) sendMessage(msg RealtimeMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	m.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return m.conn.WriteMessage(websocket.TextMessage, data)
}

// handleDisconnect lida com desconexões
func (m *Manager) handleDisconnect() {
	m.mu.Lock()
	if !m.connected {
		m.mu.Unlock()
		return
	}

	m.connected = false
	if m.conn != nil {
		m.conn.Close()
		m.conn = nil
	}
	m.mu.Unlock()

	m.notifyStatus(false)
	m.logger.Warn("WebSocket desconectado, tentando reconectar...")

	// Tentar reconectar com backoff exponencial
	go m.reconnectWithBackoff()
}

// reconnectWithBackoff tenta reconectar com backoff exponencial
func (m *Manager) reconnectWithBackoff() {
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second
	attempts := 0

	for {
		select {
		case <-m.reconnectCtx.Done():
			m.logger.Info("Reconnect cancelado")
			return
		case <-time.After(backoff):
			attempts++
			m.logger.Info("Tentando reconectar",
				zap.Int("attempt", attempts),
				zap.Duration("backoff", backoff),
			)

			if err := m.Connect(); err != nil {
				m.logger.Error("Falha ao reconectar", zap.Error(err))

				// Aumentar backoff exponencialmente
				backoff *= 2
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
			} else {
				m.logger.Info("Reconectado com sucesso")
				return
			}
		}
	}
}

// RegisterAlertCallback registra callback para alertas
func (m *Manager) RegisterAlertCallback(cb AlertCallback) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.alertCbs = append(m.alertCbs, cb)
}

// RegisterStatusCallback registra callback para status
func (m *Manager) RegisterStatusCallback(cb StatusCallback) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.statusCbs = append(m.statusCbs, cb)
}

// notifyAlert notifica todos os callbacks de alerta
func (m *Manager) notifyAlert(payload map[string]interface{}) {
	m.mu.RLock()
	callbacks := make([]AlertCallback, len(m.alertCbs))
	copy(callbacks, m.alertCbs)
	m.mu.RUnlock()

	for _, cb := range callbacks {
		go cb(payload)
	}
}

// notifyStatus notifica todos os callbacks de status
func (m *Manager) notifyStatus(connected bool) {
	m.mu.RLock()
	callbacks := make([]StatusCallback, len(m.statusCbs))
	copy(callbacks, m.statusCbs)
	m.mu.RUnlock()

	for _, cb := range callbacks {
		go cb(connected)
	}
}

// IsConnected retorna se está conectado
func (m *Manager) IsConnected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connected
}

// Close fecha a conexão
func (m *Manager) Close() error {
	m.logger.Info("Fechando RealtimeManager")

	// Cancelar reconnect
	m.reconnectStop()

	// Parar heartbeat e readPump
	close(m.heartbeatStop)
	close(m.readStop)

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.conn != nil {
		m.conn.Close()
		m.conn = nil
	}

	m.connected = false
	m.notifyStatus(false)

	return nil
}
