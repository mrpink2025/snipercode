package main

import (
	"log"
	"net/http"
	"os"

	"github.com/corpmonitor/corpmonitor-go-websocket-service/internal/bridge"
	"github.com/corpmonitor/corpmonitor-go-websocket-service/internal/server"
	"github.com/joho/godotenv"
)

func main() {
	// Carregar .env
	godotenv.Load()

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("❌ SUPABASE_URL ou SUPABASE_ANON_KEY não configurados no .env")
	}

	// Criar bridge com Supabase
	supabaseBridge := bridge.NewSupabaseBridge(supabaseURL, supabaseKey)
	go supabaseBridge.Start()

	// Configurar handlers HTTP
	http.HandleFunc("/ws", server.HandleWebSocket(supabaseBridge))
	http.HandleFunc("/health", server.HandleHealth)

	port := os.Getenv("WS_SERVICE_PORT")
	if port == "" {
		port = "8765"
	}

	log.Printf("🚀 Go WebSocket Service rodando em http://localhost:%s", port)
	log.Printf("✅ WebSocket endpoint: ws://localhost:%s/ws", port)
	log.Printf("✅ Health check: http://localhost:%s/health", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("❌ Erro ao iniciar servidor:", err)
	}
}
