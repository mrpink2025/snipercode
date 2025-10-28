package realtime

import (
	"testing"
	"time"
)

// TestRealtimeManagerCreation testa criação do manager
func TestRealtimeManagerCreation(t *testing.T) {
	manager := NewManager(
		"https://vxvcquifgwtbjghrcjbp.supabase.co",
		"test-key",
		"test-machine",
	)

	if manager == nil {
		t.Fatal("Manager não deve ser nil")
	}

	if manager.IsConnected() {
		t.Fatal("Manager não deve estar conectado inicialmente")
	}
}

// TestCallbackRegistration testa registro de callbacks
func TestCallbackRegistration(t *testing.T) {
	manager := NewManager(
		"https://vxvcquifgwtbjghrcjbp.supabase.co",
		"test-key",
		"test-machine",
	)

	alertCalled := false
	statusCalled := false

	manager.RegisterAlertCallback(func(payload map[string]interface{}) {
		alertCalled = true
	})

	manager.RegisterStatusCallback(func(connected bool) {
		statusCalled = true
	})

	// Simular notificações
	manager.notifyAlert(map[string]interface{}{"test": "data"})
	manager.notifyStatus(true)

	time.Sleep(100 * time.Millisecond)

	if !alertCalled {
		t.Error("Alert callback não foi chamado")
	}

	if !statusCalled {
		t.Error("Status callback não foi chamado")
	}
}
