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
// Estados: "websocket", "polling", "disconnected"
type StatusCallback func(status string)

// RealtimeManager gerencia conexões WebSocket com Supabase Realtime
type RealtimeManager struct {
	url                string
	apiKey             string
	machineID          string
	conn               *websocket.Conn
	mu                 sync.RWMutex
	connected          bool
	alertCbs           []AlertCallback
	statusCbs          []StatusCallback
	heartbeatStop      chan struct{}
	readStop           chan struct{}
	reconnectCtx       context.Context
	reconnectStop      context.CancelFunc
	logger             *zap.Logger
	lastAlertTimestamp time.Time
	pollingTicker      *time.Ticker
	pollingStop        chan struct{}
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

	m.notifyStatus("websocket")
	m.logger.Info("Realtime conectado com sucesso")

	return nil
}

// joinChannel envia mensagem para entrar no canal
func (m *Manager) joinChannel() error {
	// Canal único por conexão usando timestamp
	channelID := fmt.Sprintf("alerts-%d", time.Now().UnixNano())
	topic := fmt.Sprintf("realtime:public:admin_alerts:machine_id=eq.%s", m.machineID)

	msg := RealtimeMessage{
		Topic: topic,
		Event: "phx_join",
		Payload: map[string]interface{}{
			"config": map[string]interface{}{
				"postgres_changes": []map[string]interface{}{
					{
						"event":  "INSERT",
						"schema": "public",
						"table":  "admin_alerts",
						"filter": fmt.Sprintf("machine_id=eq.%s", m.machineID),
					},
				},
			},
		},
		Ref: channelID,
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

	m.notifyStatus("polling")
	m.logger.Warn("WebSocket desconectado, iniciando polling fallback...")

	// Iniciar polling como fallback
	m.startPollingFallback()

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
				m.stopPollingFallback()
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

	// Verificar se é alerta crítico
	isCritical := false
	if metadata, ok := payload["metadata"].(map[string]interface{}); ok {
		if critical, ok := metadata["is_critical"].(bool); ok {
			isCritical = critical
		}
	}

	// Mostrar notificação e tocar som
	m.showSystemNotification(payload)
	if isCritical {
		m.playCriticalAlertSound()
	} else {
		m.playAlertSound()
	}

	// Executar callbacks
	for _, cb := range callbacks {
		go cb(payload)
	}
}

// notifyStatus notifica todos os callbacks de status
func (m *Manager) notifyStatus(status string) {
	m.mu.RLock()
	callbacks := make([]StatusCallback, len(m.statusCbs))
	copy(callbacks, m.statusCbs)
	m.mu.RUnlock()

	m.logger.Info("Status alterado", zap.String("status", status))

	for _, cb := range callbacks {
		go cb(status)
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
	m.stopPollingFallback()
	m.notifyStatus("disconnected")

	return nil
}

// startPollingFallback inicia polling como fallback quando WebSocket cai
func (m *Manager) startPollingFallback() {
	m.pollingTicker = time.NewTicker(2 * time.Second)
	m.pollingStop = make(chan struct{})

	go func() {
		m.logger.Info("🔄 Polling fallback iniciado")
		for {
			select {
			case <-m.pollingStop:
				return
			case <-m.pollingTicker.C:
				m.pollAlerts()
			}
		}
	}()
}

// stopPollingFallback para o polling fallback
func (m *Manager) stopPollingFallback() {
	if m.pollingTicker != nil {
		m.pollingTicker.Stop()
	}
	if m.pollingStop != nil {
		close(m.pollingStop)
	}
}

// pollAlerts consulta alertas via polling (fallback quando WebSocket falha)
func (m *Manager) pollAlerts() {
	// Esta é uma implementação simplificada
	// Em produção, deveria consultar o Supabase diretamente
	m.logger.Debug("Polling alertas...")
}

// playAlertSound toca som de alerta normal
func (m *Manager) playAlertSound() {
	go func() {
		m.logger.Info("🔊 Som de alerta normal")
		// Implementação específica por OS seria necessária
		// Windows: exec.Command("rundll32", "user32.dll,MessageBeep", "0")
		// Linux: exec.Command("paplay", "/usr/share/sounds/...)
		// macOS: exec.Command("afplay", "/System/Library/Sounds/...")
	}()
}

// playCriticalAlertSound toca som de alerta crítico
func (m *Manager) playCriticalAlertSound() {
	go func() {
		m.logger.Info("🔊🔊🔊 Som de alerta CRÍTICO")
		// 5 beeps com frequência alta
		for i := 0; i < 5; i++ {
			// Beep logic aqui
			time.Sleep(200 * time.Millisecond)
		}
	}()
}

// showSystemNotification mostra notificação do sistema operacional
func (m *Manager) showSystemNotification(alert map[string]interface{}) {
	domain := "N/A"
	machineID := m.machineID
	isCritical := false

	if d, ok := alert["domain"].(string); ok {
		domain = d
	}
	if metadata, ok := alert["metadata"].(map[string]interface{}); ok {
		if critical, ok := metadata["is_critical"].(bool); ok {
			isCritical = critical
		}
	}

	title := "🚨 Alerta CorpMonitor"
	if isCritical {
		title = "🚨🚨🚨 ALERTA CRÍTICO"
	}

	message := fmt.Sprintf("Domínio: %s\nMáquina: %s", domain, machineID)

	m.logger.Info(title, zap.String("message", message))
	// Implementação com github.com/gen2brain/beeep seria necessária:
	// beeep.Notify(title, message, "")
}
