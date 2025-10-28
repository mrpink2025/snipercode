package ui

import (
	"context"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/auth"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type LoginWindow struct {
	app         fyne.App
	window      fyne.Window
	authManager *auth.Manager
	loggedIn    bool

	emailEntry    *widget.Entry
	passwordEntry *widget.Entry
	loginBtn      *widget.Button
	errorLabel    *widget.Label
}

func NewLoginWindow(authManager *auth.Manager) *LoginWindow {
	a := app.New()
	w := a.NewWindow("CorpMonitor - Login")

	lw := &LoginWindow{
		app:         a,
		window:      w,
		authManager: authManager,
		loggedIn:    false,
	}

	lw.buildUI()
	w.Resize(fyne.NewSize(400, 300))
	w.CenterOnScreen()

	return lw
}

func (lw *LoginWindow) buildUI() {
	// Logo/Título
	title := widget.NewLabel("CorpMonitor Desktop")
	title.TextStyle = fyne.TextStyle{Bold: true}
	title.Alignment = fyne.TextAlignCenter

	// Email
	lw.emailEntry = widget.NewEntry()
	lw.emailEntry.SetPlaceHolder("Email")

	// Senha
	lw.passwordEntry = widget.NewPasswordEntry()
	lw.passwordEntry.SetPlaceHolder("Senha")

	// Error label
	lw.errorLabel = widget.NewLabel("")
	lw.errorLabel.Wrapping = fyne.TextWrapWord
	lw.errorLabel.Importance = widget.DangerImportance

	// Botão login
	lw.loginBtn = widget.NewButton("Entrar", lw.handleLogin)
	lw.loginBtn.Importance = widget.HighImportance

	// Enter key binding
	lw.passwordEntry.OnSubmitted = func(string) {
		lw.handleLogin()
	}

	// Layout
	content := container.NewVBox(
		widget.NewLabel(""), // spacer
		title,
		widget.NewLabel(""), // spacer
		widget.NewLabel("Email:"),
		lw.emailEntry,
		widget.NewLabel("Senha:"),
		lw.passwordEntry,
		widget.NewLabel(""), // spacer
		lw.loginBtn,
		lw.errorLabel,
	)

	lw.window.SetContent(container.NewCenter(content))
}

func (lw *LoginWindow) handleLogin() {
	email := lw.emailEntry.Text
	password := lw.passwordEntry.Text

	// Validação básica
	if email == "" || password == "" {
		lw.showError("Por favor, preencha email e senha")
		return
	}

	// Desabilitar botão durante login
	lw.loginBtn.Disable()
	lw.errorLabel.SetText("Autenticando...")

	// Login em goroutine
	go lw.performLogin(email, password)
}

func (lw *LoginWindow) performLogin(email, password string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	success, message := lw.authManager.SignIn(ctx, email, password)

	// Atualizar UI na main thread
	lw.window.Canvas().Refresh(lw.errorLabel)

	if success {
		lw.loggedIn = true
		logger.Log.Info("Login bem-sucedido", zap.String("user", lw.authManager.GetUserName()))

		lw.errorLabel.SetText("Login realizado! Abrindo painel...")
		time.Sleep(1 * time.Second)
		lw.window.Close()
	} else {
		lw.showError(message)
		lw.loginBtn.Enable()
	}
}

func (lw *LoginWindow) showError(message string) {
	lw.errorLabel.SetText(message)
	lw.window.Canvas().Refresh(lw.errorLabel)
}

func (lw *LoginWindow) ShowAndRun() {
	lw.window.ShowAndRun()
}

func (lw *LoginWindow) IsLoggedIn() bool {
	return lw.loggedIn
}

func (lw *LoginWindow) GetAuthManager() *auth.Manager {
	return lw.authManager
}
