package bridge

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client interface {
	GetMachineID() string
	SendMessage([]byte)
}

type SupabaseBridge struct {
	supabaseURL  string
	apiKey       string
	supabaseConn *websocket.Conn
	clients      map[Client]bool
	clientsMu    sync.RWMutex
	broadcast    chan []byte
	stopChan     chan struct{}
	reconnecting bool
}

func NewSupabaseBridge(url, key string) *SupabaseBridge {
	// Construir URL WebSocket do Supabase
	wsURL := strings.Replace(url, "https://", "wss://", 1)
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)
	wsURL = wsURL + "/realtime/v1/websocket"

	return &SupabaseBridge{
		supabaseURL: wsURL,
		apiKey:      key,
		clients:     make(map[Client]bool),
		broadcast:   make(chan []byte, 256),
		stopChan:    make(chan struct{}),
	}
}

func (b *SupabaseBridge) Start() {
	log.Println("🔌 Conectando ao Supabase Realtime...")

	// Conectar com retry
	for {
		if err := b.connect(); err != nil {
			log.Printf("❌ Erro ao conectar: %v. Tentando novamente em 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}
		break
	}

	// Iniciar broadcast loop
	go b.broadcastLoop()

	// Ler mensagens do Supabase
	b.readLoop()
}

func (b *SupabaseBridge) connect() error {
	wsURL := b.supabaseURL + "?apikey=" + b.apiKey + "&vsn=1.0.0"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return err
	}

	b.supabaseConn = conn
	log.Println("✅ Conectado ao Supabase Realtime")

	// Aguardar session.created
	time.Sleep(1 * time.Second)

	// Join channel admin_alerts
	b.joinChannel()

	return nil
}

func (b *SupabaseBridge) joinChannel() {
	msg := map[string]interface{}{
		"topic": "realtime:public:admin_alerts",
		"event": "phx_join",
		"payload": map[string]interface{}{
			"config": map[string]interface{}{
				"postgres_changes": []map[string]interface{}{
					{
						"event":  "INSERT",
						"schema": "public",
						"table":  "admin_alerts",
					},
					{
						"event":  "UPDATE",
						"schema": "public",
						"table":  "admin_alerts",
					},
				},
			},
		},
		"ref": "1",
	}

	data, _ := json.Marshal(msg)
	if err := b.supabaseConn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("❌ Erro ao enviar phx_join: %v", err)
	} else {
		log.Println("📡 Subscrito ao canal admin_alerts")
	}
}

func (b *SupabaseBridge) readLoop() {
	defer func() {
		if b.supabaseConn != nil {
			b.supabaseConn.Close()
		}
		if !b.reconnecting {
			b.reconnect()
		}
	}()

	// Configurar heartbeat
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	go func() {
		for range ticker.C {
			heartbeat := map[string]interface{}{
				"topic":   "phoenix",
				"event":   "heartbeat",
				"payload": map[string]interface{}{},
				"ref":     time.Now().Unix(),
			}
			data, _ := json.Marshal(heartbeat)
			if b.supabaseConn != nil {
				b.supabaseConn.WriteMessage(websocket.TextMessage, data)
			}
		}
	}()

	for {
		_, message, err := b.supabaseConn.ReadMessage()
		if err != nil {
			log.Printf("❌ Erro ao ler do Supabase: %v", err)
			break
		}

		// Parsear mensagem
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		// Verificar se é evento postgres_changes
		if event, ok := msg["event"].(string); ok && event == "postgres_changes" {
			log.Printf("📬 Novo alerta recebido do Supabase")
			b.broadcast <- message
		}
	}
}

func (b *SupabaseBridge) reconnect() {
	b.reconnecting = true
	log.Println("🔄 Tentando reconectar ao Supabase...")

	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		if err := b.connect(); err != nil {
			log.Printf("❌ Falha na reconexão: %v. Tentando novamente em %v...", err, backoff)
			time.Sleep(backoff)

			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		b.reconnecting = false
		log.Println("✅ Reconectado com sucesso!")
		b.readLoop()
		break
	}
}

func (b *SupabaseBridge) broadcastLoop() {
	for {
		select {
		case message := <-b.broadcast:
			b.clientsMu.RLock()
			for client := range b.clients {
				client.SendMessage(message)
			}
			b.clientsMu.RUnlock()
		case <-b.stopChan:
			return
		}
	}
}

func (b *SupabaseBridge) RegisterClient(c Client) {
	b.clientsMu.Lock()
	b.clients[c] = true
	b.clientsMu.Unlock()
	log.Printf("👤 Cliente registrado (total: %d)", len(b.clients))
}

func (b *SupabaseBridge) UnregisterClient(c Client) {
	b.clientsMu.Lock()
	delete(b.clients, c)
	b.clientsMu.Unlock()
	log.Printf("👤 Cliente removido (total: %d)", len(b.clients))
}

func (b *SupabaseBridge) Stop() {
	close(b.stopChan)
	if b.supabaseConn != nil {
		b.supabaseConn.Close()
	}
}

// ✅ NOVO: Atualizar status WebSocket (is_active)
func (b *SupabaseBridge) UpdateWebSocketStatus(machineID string, isActive bool) error {
	import (
		"bytes"
		"fmt"
		"net/http"
	)
	
	// Extrair URL base do Supabase (remover /realtime/v1/websocket)
	baseURL := strings.Replace(b.supabaseURL, "/realtime/v1/websocket", "", 1)
	url := baseURL + "/rest/v1/websocket_connections"
	
	payload := map[string]interface{}{
		"machine_id":   machineID,
		"is_active":    isActive,
		"last_ping_at": time.Now().Format(time.RFC3339),
		"connected_at": time.Now().Format(time.RFC3339),
	}
	
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", b.apiKey)
	req.Header.Set("Authorization", "Bearer "+b.apiKey)
	req.Header.Set("Prefer", "resolution=merge-duplicates")
	
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Error updating websocket status: %v", err)
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		log.Printf("❌ Supabase error updating status: %d", resp.StatusCode)
		return fmt.Errorf("supabase error: %d", resp.StatusCode)
	}
	
	log.Printf("✅ WebSocket status updated: %s -> is_active=%v", machineID, isActive)
	return nil
}

// ✅ NOVO: Atualizar ping WebSocket (last_ping_at)
func (b *SupabaseBridge) UpdateWebSocketPing(machineID string) error {
	import (
		"bytes"
		"fmt"
		"net/http"
	)
	
	// Extrair URL base do Supabase
	baseURL := strings.Replace(b.supabaseURL, "/realtime/v1/websocket", "", 1)
	url := baseURL + "/rest/v1/websocket_connections?machine_id=eq." + machineID
	
	payload := map[string]interface{}{
		"last_ping_at": time.Now().Format(time.RFC3339),
		"is_active":    true,
	}
	
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create ping request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", b.apiKey)
	req.Header.Set("Authorization", "Bearer "+b.apiKey)
	
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	return nil
}
