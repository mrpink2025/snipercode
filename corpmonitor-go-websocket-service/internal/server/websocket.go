package server

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/corpmonitor/corpmonitor-go-websocket-service/internal/bridge"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024
)

type Client struct {
	Conn      *websocket.Conn
	Send      chan []byte
	MachineID string
	bridge    *bridge.SupabaseBridge
}

func HandleWebSocket(b *bridge.SupabaseBridge) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("❌ Erro ao fazer upgrade WebSocket:", err)
			return
		}

		client := &Client{
			Conn:   conn,
			Send:   make(chan []byte, 256),
			bridge: b,
		}

		// Registrar cliente no bridge
		b.RegisterClient(client)
		log.Println("✅ Novo cliente conectado")

		// Iniciar goroutines de leitura e escrita
		go client.writePump()
		go client.readPump()
	}
}

func (c *Client) readPump() {
	defer func() {
		c.bridge.UnregisterClient(c)
		c.Conn.Close()
		log.Printf("🔌 Cliente desconectado: %s", c.MachineID)
	}()

	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	c.Conn.SetReadLimit(maxMessageSize)

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("❌ Erro de conexão: %v", err)
			}
			break
		}

		// Processar mensagem do cliente Python
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("❌ Erro ao parsear mensagem: %v", err)
			continue
		}

		// Comando: subscribe
		if msgType, ok := msg["type"].(string); ok && msgType == "subscribe" {
			if machineID, ok := msg["machine_id"].(string); ok {
				c.MachineID = machineID
				log.Printf("📡 Cliente subscrito: %s", c.MachineID)

				// ✅ NOVO: Atualizar is_active = true no banco
				if err := c.bridge.UpdateWebSocketStatus(machineID, true); err != nil {
					log.Printf("⚠️ Erro ao atualizar status WebSocket: %v", err)
				} else {
					log.Printf("✅ Status WebSocket atualizado: %s = ONLINE", machineID)
				}

				// Enviar confirmação
				response := map[string]interface{}{
					"type":    "subscribed",
					"status":  "ok",
					"machine": machineID,
				}
				data, _ := json.Marshal(response)
				c.Send <- data
			}
		}

		// ✅ NOVO: Comando: ping (atualizar last_ping_at)
		if msgType, ok := msg["type"].(string); ok && msgType == "ping" {
			if c.MachineID != "" {
				if err := c.bridge.UpdateWebSocketPing(c.MachineID); err != nil {
					log.Printf("⚠️ Erro ao atualizar ping: %v", err)
				}
				
				// Enviar pong
				response := map[string]interface{}{
					"type":   "pong",
					"status": "ok",
				}
				data, _ := json.Marshal(response)
				c.Send <- data
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Adicionar mensagens enfileiradas ao frame atual
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
