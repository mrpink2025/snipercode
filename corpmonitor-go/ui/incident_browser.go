package ui

import (
	"context"
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/incident"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type IncidentBrowser struct {
	window      *MainWindow
	incident    *incident.Incident
	sessionID   string
	urlEntry    *widget.Entry
	statusLabel *widget.Label
	screenshot  *SiteViewer
}

func NewIncidentBrowser(w *MainWindow, inc *incident.Incident) *IncidentBrowser {
	return &IncidentBrowser{
		window:      w,
		incident:    inc,
		statusLabel: widget.NewLabel("Inicializando..."),
		screenshot:  NewSiteViewer(),
	}
}

func (ib *IncidentBrowser) Show() {
	// Criar janela de browser
	win := ib.window.app.NewWindow(fmt.Sprintf("Browser - %s", ib.incident.IncidentID))
	win.Resize(fyne.NewSize(1200, 800))

	// Iniciar sessão
	go ib.startSession()

	// URL entry
	ib.urlEntry = widget.NewEntry()
	ib.urlEntry.SetPlaceHolder("URL")
	ib.urlEntry.SetText(ib.incident.TabURL)

	navigateBtn := widget.NewButton("🌐 Navigate", func() {
		ib.navigate(ib.urlEntry.Text)
	})

	screenshotBtn := widget.NewButton("📷 Screenshot", func() {
		ib.captureScreenshot()
	})

	closeBtn := widget.NewButton("❌ Close", func() {
		ib.closeSession()
		win.Close()
	})

	toolbar := container.NewBorder(
		nil,
		nil,
		container.NewHBox(navigateBtn, screenshotBtn),
		closeBtn,
		ib.urlEntry,
	)

	// Layout
	content := container.NewBorder(
		container.NewVBox(toolbar, ib.statusLabel),
		nil,
		nil,
		nil,
		ib.screenshot.Build(),
	)

	win.SetContent(content)
	win.Show()
}

func (ib *IncidentBrowser) startSession() {
	ib.statusLabel.SetText("🔄 Iniciando sessão...")

	// Converter incident para map
	incidentMap := map[string]interface{}{
		"id":                ib.incident.ID,
		"incident_id":       ib.incident.IncidentID,
		"machine_id":        ib.incident.MachineID,
		"host":              ib.incident.Host,
		"tab_url":           ib.incident.TabURL,
		"full_cookie_data":  ib.incident.FullCookieData,
		"local_storage":     ib.incident.LocalStorage,
		"session_storage":   ib.incident.SessionStorage,
	}

	sessionID, screenshot, err := ib.window.browserManager.StartSession(incidentMap)
	if err != nil {
		ib.statusLabel.SetText(fmt.Sprintf("❌ Erro: %v", err))
		logger.Log.Error("Erro ao iniciar sessão", zap.Error(err))
		return
	}

	ib.sessionID = sessionID
	ib.statusLabel.SetText(fmt.Sprintf("✅ Sessão ativa: %s", sessionID))

	// Exibir screenshot inicial
	if screenshot != nil {
		ib.screenshot.LoadImage(screenshot)
	}

	logger.Log.Info("Sessão de browser iniciada",
		zap.String("session_id", sessionID),
		zap.String("incident_id", ib.incident.IncidentID),
	)
}

func (ib *IncidentBrowser) navigate(url string) {
	if ib.sessionID == "" {
		dialog.ShowError(fmt.Errorf("Sessão não iniciada"), ib.window.window)
		return
	}

	ib.statusLabel.SetText(fmt.Sprintf("🔄 Navegando para %s...", url))

	go func() {
		err := ib.window.browserManager.Navigate(ib.sessionID, url)
		if err != nil {
			ib.statusLabel.SetText(fmt.Sprintf("❌ Erro: %v", err))
			return
		}

		ib.statusLabel.SetText(fmt.Sprintf("✅ Navegado para %s", url))
		
		// Capturar screenshot após navegação
		ib.captureScreenshot()
	}()
}

func (ib *IncidentBrowser) captureScreenshot() {
	if ib.sessionID == "" {
		return
	}

	go func() {
		screenshot, err := ib.window.browserManager.GetScreenshot(ib.sessionID)
		if err != nil {
			logger.Log.Error("Erro ao capturar screenshot", zap.Error(err))
			return
		}

		ib.screenshot.LoadImage(screenshot)
	}()
}

func (ib *IncidentBrowser) closeSession() {
	if ib.sessionID != "" {
		ib.window.browserManager.CloseSession(ib.sessionID)
		ib.sessionID = ""
		ib.statusLabel.SetText("❌ Sessão encerrada")
	}
}
