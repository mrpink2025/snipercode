package protocol

import "time"

// Mensagens Python -> Go
type SubscribeMessage struct {
	Type      string `json:"type"`
	MachineID string `json:"machine_id"`
}

type UnsubscribeMessage struct {
	Type      string `json:"type"`
	MachineID string `json:"machine_id"`
}

// Mensagens Go -> Python
type SubscribedResponse struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Machine string `json:"machine"`
}

type AlertMessage struct {
	Event   string                 `json:"event"`
	Payload map[string]interface{} `json:"payload"`
}

type StatusMessage struct {
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

type ErrorMessage struct {
	Type    string `json:"type"`
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}
