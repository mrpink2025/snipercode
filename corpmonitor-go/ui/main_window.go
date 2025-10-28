package ui

import (
	"context"
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/auth"
	"github.com/corpmonitor/corpmonitor-go/internal/browser"
	"github.com/corpmonitor/corpmonitor-go/internal/domain"
	"github.com/corpmonitor/corpmonitor-go/internal/incident"
	"github.com/corpmonitor/corpmonitor-go/internal/machine"
	"github.com/corpmonitor/corpmonitor-go/internal/realtime"
	"github.com/corpmonitor/corpmonitor-go/internal/tunnel"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"go.uber.org/zap"
)

type MainWindow struct {
	app             fyne.App
	window          fyne.Window
	authManager     *auth.Manager
	supabase        *supabase.Client
	incidentManager *incident.Manager
	domainManager   *domain.Manager
	machineManager  *machine.Manager
	browserManager  *browser.Manager
	tunnelClient    *tunnel.Client
	realtimeManager *realtime.Manager
	
	// Tabs
	incidentsTab  *IncidentsTab
	alertsTab     *AlertsTab
	hostsTab      *HostsTab
	realtimePanel *RealtimePanel
}

func NewMainWindow(authManager *auth.Manager, sb *supabase.Client) *MainWindow {
	a := app.New()
	w := a.NewWindow("CorpMonitor - Dashboard")

	// Criar managers
	incidentMgr := incident.NewManager(sb)
	domainMgr := domain.NewManager(sb)
	machineMgr := machine.NewManager(sb)
	
	// Para túnel e browser, usar machine_id do usuário atual
	// Em produção, isso viria de um registro de máquina
	machineID := "desktop-" + authManager.GetUserID()
	tunnelClient := tunnel.NewClient(sb, machineID)
	browserMgr := browser.NewManager(tunnelClient)
	
	// Realtime
	realtimeMgr := realtime.NewManager(sb.URL, sb.Key, machineID)

	mw := &MainWindow{
		app:             a,
		window:          w,
		authManager:     authManager,
		supabase:        sb,
		incidentManager: incidentMgr,
		domainManager:   domainMgr,
		machineManager:  machineMgr,
		browserManager:  browserMgr,
		tunnelClient:    tunnelClient,
		realtimeManager: realtimeMgr,
	}

	// Conectar realtime
	if err := realtimeMgr.Connect(); err != nil {
		logger.Log.Error("Erro ao conectar realtime", zap.Error(err))
	}

	mw.buildUI()
	w.Resize(fyne.NewSize(1400, 900))
	w.CenterOnScreen()

	return mw
}

func (mw *MainWindow) buildUI() {
	userName := mw.authManager.GetUserName()
	userRole := mw.authManager.GetUserRole()

	// Header
	header := container.NewHBox(
		widget.NewLabel("CorpMonitor Desktop"),
		widget.NewLabel(""),
		widget.NewLabel(fmt.Sprintf("👤 %s (%s)", userName, userRole)),
	)

	// Criar tabs
	mw.incidentsTab = NewIncidentsTab(mw)
	mw.alertsTab = NewAlertsTab(mw)
	mw.hostsTab = NewHostsTab(mw)
	mw.realtimePanel = NewRealtimePanel(mw)

	// Tabs container
	tabs := container.NewAppTabs(
		container.NewTabItem("🔥 Incidents", mw.incidentsTab.Build()),
		container.NewTabItem("⚠️ Alerts", mw.alertsTab.Build()),
		container.NewTabItem("💻 Hosts", mw.hostsTab.Build()),
		container.NewTabItem("📡 Realtime", mw.realtimePanel.Build()),
	)

	// Layout principal
	content := container.NewBorder(
		header,
		nil,
		nil,
		nil,
		tabs,
	)

	mw.window.SetContent(content)
	logger.Log.Info("Dashboard aberto", zap.String("user", userName))
}

func (mw *MainWindow) ShowAndRun() {
	mw.window.ShowAndRun()
}

func (mw *MainWindow) Close() {
	if mw.realtimeManager != nil {
		mw.realtimeManager.Close()
	}
}

// ========== TABS ==========

type IncidentsTab struct {
	window *MainWindow
	list   *widget.List
	data   []incident.Incident
}

func NewIncidentsTab(w *MainWindow) *IncidentsTab {
	return &IncidentsTab{
		window: w,
		data:   []incident.Incident{},
	}
}

func (t *IncidentsTab) Build() fyne.CanvasObject {
	// Botão refresh
	refreshBtn := widget.NewButton("🔄 Refresh", t.loadIncidents)

	// Botão para abrir incident
	openBtn := widget.NewButton("🌐 Open Browser", func() {
		// Implementar abertura de browser
	})

	toolbar := container.NewHBox(refreshBtn, openBtn)

	// Lista de incidents
	t.list = widget.NewList(
		func() int { return len(t.data) },
		func() fyne.CanvasObject {
			return widget.NewLabel("Template")
		},
		func(i widget.ListItemID, o fyne.CanvasObject) {
			label := o.(*widget.Label)
			inc := t.data[i]
			label.SetText(fmt.Sprintf("[%s] %s - %s (%s)",
				inc.Severity, inc.IncidentID, inc.Host, inc.Status))
		},
	)

	// Carregar dados iniciais
	t.loadIncidents()

	return container.NewBorder(toolbar, nil, nil, nil, t.list)
}

func (t *IncidentsTab) loadIncidents() {
	ctx := context.Background()
	incidents, err := t.window.incidentManager.List(ctx, incident.ListOptions{
		Limit:   50,
		OrderBy: "created_at.desc",
	})

	if err != nil {
		logger.Log.Error("Erro ao carregar incidents", zap.Error(err))
		return
	}

	t.data = incidents
	if t.list != nil {
		t.list.Refresh()
	}
	logger.Log.Info("Incidents carregados", zap.Int("count", len(incidents)))
}

type AlertsTab struct {
	window *MainWindow
}

func NewAlertsTab(w *MainWindow) *AlertsTab {
	return &AlertsTab{window: w}
}

func (t *AlertsTab) Build() fyne.CanvasObject {
	label := widget.NewLabel("Alerts - Em desenvolvimento")
	return container.NewCenter(label)
}

type HostsTab struct {
	window *MainWindow
	list   *widget.List
	data   []string
}

func NewHostsTab(w *MainWindow) *HostsTab {
	return &HostsTab{
		window: w,
		data:   []string{},
	}
}

func (t *HostsTab) Build() fyne.CanvasObject {
	refreshBtn := widget.NewButton("🔄 Refresh", t.loadHosts)

	t.list = widget.NewList(
		func() int { return len(t.data) },
		func() fyne.CanvasObject {
			return widget.NewLabel("Template")
		},
		func(i widget.ListItemID, o fyne.CanvasObject) {
			label := o.(*widget.Label)
			label.SetText(fmt.Sprintf("💻 %s", t.data[i]))
		},
	)

	t.loadHosts()

	return container.NewBorder(refreshBtn, nil, nil, nil, t.list)
}

func (t *HostsTab) loadHosts() {
	ctx := context.Background()
	machines, err := t.window.machineManager.ListAllMachines(ctx)

	if err != nil {
		logger.Log.Error("Erro ao carregar máquinas", zap.Error(err))
		return
	}

	t.data = machines
	if t.list != nil {
		t.list.Refresh()
	}
	logger.Log.Info("Máquinas carregadas", zap.Int("count", len(machines)))
}
