package ui

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/auth"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type MainWindow struct {
	app         fyne.App
	window      fyne.Window
	authManager *auth.Manager
}

func NewMainWindow(authManager *auth.Manager) *MainWindow {
	a := app.New()
	w := a.NewWindow("CorpMonitor - Dashboard")

	mw := &MainWindow{
		app:         a,
		window:      w,
		authManager: authManager,
	}

	mw.buildUI()
	w.Resize(fyne.NewSize(1200, 800))
	w.CenterOnScreen()

	return mw
}

func (mw *MainWindow) buildUI() {
	// Header
	userName := mw.authManager.GetUserName()
	userRole := mw.authManager.GetUserRole()

	header := widget.NewLabel("Bem-vindo, " + userName + " (" + userRole + ")")
	header.TextStyle = fyne.TextStyle{Bold: true}

	// Placeholder para tabs (Semana 5)
	content := container.NewVBox(
		header,
		widget.NewLabel(""),
		widget.NewLabel("Dashboard em desenvolvimento..."),
		widget.NewLabel("Funcionalidades serão implementadas nas próximas semanas"),
	)

	mw.window.SetContent(container.NewCenter(content))

	logger.Log.Info("Dashboard aberto", zap.String("user", userName))
}

func (mw *MainWindow) ShowAndRun() {
	mw.window.ShowAndRun()
}
