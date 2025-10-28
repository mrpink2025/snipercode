package dialogs

import (
	"context"
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/domain"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type BlockDomainDialog struct {
	domainManager *domain.Manager
	userID        string
	window        fyne.Window
}

func NewBlockDomainDialog(dm *domain.Manager, userID string, win fyne.Window) *BlockDomainDialog {
	return &BlockDomainDialog{
		domainManager: dm,
		userID:        userID,
		window:        win,
	}
}

func (d *BlockDomainDialog) Show(onSuccess func()) {
	domainEntry := widget.NewEntry()
	domainEntry.SetPlaceHolder("example.com")

	reasonEntry := widget.NewEntry()
	reasonEntry.SetPlaceHolder("Motivo do bloqueio")

	expiresCheck := widget.NewCheck("Bloqueio temporário", func(checked bool) {})

	form := &widget.Form{
		Items: []*widget.FormItem{
			{Text: "Domínio", Widget: domainEntry},
			{Text: "Motivo", Widget: reasonEntry},
			{Text: "Opções", Widget: expiresCheck},
		},
		OnSubmit: func() {
			domain := domainEntry.Text
			reason := reasonEntry.Text

			if domain == "" {
				dialog.ShowError(fmt.Errorf("Domínio é obrigatório"), d.window)
				return
			}

			if reason == "" {
				dialog.ShowError(fmt.Errorf("Motivo é obrigatório"), d.window)
				return
			}

			// Calcular expiração se temporário
			var expiresAt *time.Time
			if expiresCheck.Checked {
				exp := time.Now().Add(7 * 24 * time.Hour) // 7 dias
				expiresAt = &exp
			}

			// Bloquear domínio
			ctx := context.Background()
			err := d.domainManager.BlockDomain(ctx, domain, reason, d.userID, expiresAt)
			if err != nil {
				dialog.ShowError(err, d.window)
				logger.Log.Error("Erro ao bloquear domínio", zap.Error(err))
				return
			}

			dialog.ShowInformation(
				"Sucesso",
				fmt.Sprintf("Domínio %s bloqueado com sucesso", domain),
				d.window,
			)

			if onSuccess != nil {
				onSuccess()
			}
		},
		OnCancel: func() {},
	}

	dialog.ShowForm("Bloquear Domínio", "Bloquear", "Cancelar", form.Items, form.OnSubmit, d.window)
}
