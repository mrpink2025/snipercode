package tunnel

import (
	"testing"
	"time"
)

// TestTunnelClientCreation testa criação do client
func TestTunnelClientCreation(t *testing.T) {
	// Mock do supabase client
	client := &Client{
		machineID: "test-machine",
		stats:     Stats{},
	}

	if client.machineID != "test-machine" {
		t.Error("MachineID não foi definido corretamente")
	}

	stats := client.GetStats()
	if stats.TotalRequests != 0 {
		t.Error("Stats devem começar zeradas")
	}
}

// TestStatsTracking testa tracking de estatísticas
func TestStatsTracking(t *testing.T) {
	client := &Client{
		machineID: "test-machine",
		stats:     Stats{},
	}

	// Simular requisições
	client.updateStats(true, 1024)
	client.updateStats(true, 2048)
	client.updateStats(false, 0)

	stats := client.GetStats()

	if stats.TotalRequests != 3 {
		t.Errorf("Esperado 3 requisições, obtido %d", stats.TotalRequests)
	}

	if stats.SuccessfulRequests != 2 {
		t.Errorf("Esperado 2 requisições bem-sucedidas, obtido %d", stats.SuccessfulRequests)
	}

	if stats.FailedRequests != 1 {
		t.Errorf("Esperado 1 requisição falhada, obtido %d", stats.FailedRequests)
	}

	expectedBytes := int64(3072)
	if stats.TotalBytesReceived != expectedBytes {
		t.Errorf("Esperado %d bytes, obtido %d", expectedBytes, stats.TotalBytesReceived)
	}

	if stats.LastRequestAt.IsZero() {
		t.Error("LastRequestAt não deve estar zerado")
	}
}

// TestStatsReset testa reset de estatísticas
func TestStatsReset(t *testing.T) {
	client := &Client{
		machineID: "test-machine",
		stats:     Stats{},
	}

	client.updateStats(true, 1024)
	client.ResetStats()

	stats := client.GetStats()
	if stats.TotalRequests != 0 {
		t.Error("Stats devem estar zeradas após reset")
	}
}

// TestFetchOptions testa aplicação de opções
func TestFetchOptions(t *testing.T) {
	opts := &fetchOptions{
		method:  "GET",
		headers: map[string]string{},
		timeout: 60 * time.Second,
	}

	// Aplicar opções
	WithMethod("POST")(opts)
	WithHeaders(map[string]string{"Content-Type": "application/json"})(opts)
	WithBody(`{"test": "data"}`)(opts)
	WithTimeout(30 * time.Second)(opts)

	if opts.method != "POST" {
		t.Error("Método não foi aplicado corretamente")
	}

	if opts.headers["Content-Type"] != "application/json" {
		t.Error("Headers não foram aplicados corretamente")
	}

	if opts.body != `{"test": "data"}` {
		t.Error("Body não foi aplicado corretamente")
	}

	if opts.timeout != 30*time.Second {
		t.Error("Timeout não foi aplicado corretamente")
	}
}
