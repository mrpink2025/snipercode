package server

// Implementar interface Client do bridge
func (c *Client) GetMachineID() string {
	return c.MachineID
}

func (c *Client) SendMessage(data []byte) {
	select {
	case c.Send <- data:
	default:
		// Canal cheio, cliente pode estar lento
	}
}
