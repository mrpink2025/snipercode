package ui

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type RealtimePanel struct {
	window     *MainWindow
	statusText *widget.Label
	eventsList *widget.List
	events     []string
}

func NewRealtimePanel(w *MainWindow) *RealtimePanel {
	panel := &RealtimePanel{
		window:     w,
		statusText: widget.NewLabel("⚪ Desconectado"),
		events:     []string{},
	}

	// Registrar callbacks de realtime
	w.realtimeManager.RegisterStatusCallback(func(connected bool) {
		if connected {
			panel.statusText.SetText("🟢 Conectado")
		} else {
			panel.statusText.SetText("🔴 Desconectado")
		}
	})

	w.realtimeManager.RegisterAlertCallback(func(payload map[string]interface{}) {
		eventStr := fmt.Sprintf("🔔 Novo comando: %v", payload)
		panel.addEvent(eventStr)
	})

	return panel
}

func (p *RealtimePanel) Build() fyne.CanvasObject {
	// Header com status
	header := container.NewHBox(
		widget.NewLabel("Status:"),
		p.statusText,
	)

	// Lista de eventos
	p.eventsList = widget.NewList(
		func() int { return len(p.events) },
		func() fyne.CanvasObject {
			return widget.NewLabel("Template")
		},
		func(i widget.ListItemID, o fyne.CanvasObject) {
			label := o.(*widget.Label)
			label.SetText(p.events[len(p.events)-1-i]) // Mais recentes primeiro
		},
	)

	clearBtn := widget.NewButton("🗑️ Clear", func() {
		p.events = []string{}
		p.eventsList.Refresh()
	})

	return container.NewBorder(
		container.NewVBox(header, clearBtn),
		nil,
		nil,
		nil,
		p.eventsList,
	)
}

func (p *RealtimePanel) addEvent(event string) {
	p.events = append(p.events, event)
	
	// Manter apenas últimos 100 eventos
	if len(p.events) > 100 {
		p.events = p.events[len(p.events)-100:]
	}

	if p.eventsList != nil {
		p.eventsList.Refresh()
	}

	logger.Log.Debug("Evento realtime adicionado", zap.String("event", event))
}
