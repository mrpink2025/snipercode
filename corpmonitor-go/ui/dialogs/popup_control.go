package dialogs

import (
	"context"
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/internal/domain"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type PopupControlDialog struct {
	domainManager *domain.Manager
	userID        string
	window        fyne.Window
}

func NewPopupControlDialog(dm *domain.Manager, userID string, win fyne.Window) *PopupControlDialog {
	return &PopupControlDialog{
		domainManager: dm,
		userID:        userID,
		window:        win,
	}
}

func (d *PopupControlDialog) Show(onSuccess func()) {
	domainEntry := widget.NewEntry()
	domainEntry.SetPlaceHolder("example.com")

	alertTypeSelect := widget.NewSelect([]string{"sound", "visual", "both", "silent"}, func(string) {})
	alertTypeSelect.SetSelected("sound")

	frequencyEntry := widget.NewEntry()
	frequencyEntry.SetPlaceHolder("60")
	frequencyEntry.SetText("60")

	form := &widget.Form{
		Items: []*widget.FormItem{
			{Text: "Domínio", Widget: domainEntry},
			{Text: "Tipo de Alerta", Widget: alertTypeSelect},
			{Text: "Frequência (segundos)", Widget: frequencyEntry},
		},
		OnSubmit: func() {
			domain := domainEntry.Text
			alertType := alertTypeSelect.Selected
			frequency := 60 // Default

			if domain == "" {
				dialog.ShowError(fmt.Errorf("Domínio é obrigatório"), d.window)
				return
			}

			// Adicionar domínio monitorado
			ctx := context.Background()
			err := d.domainManager.AddMonitoredDomain(ctx, domain, alertType, frequency, d.userID)
			if err != nil {
				dialog.ShowError(err, d.window)
				logger.Log.Error("Erro ao adicionar domínio monitorado", zap.Error(err))
				return
			}

			dialog.ShowInformation(
				"Sucesso",
				fmt.Sprintf("Domínio %s adicionado ao monitoramento", domain),
				d.window,
			)

			if onSuccess != nil {
				onSuccess()
			}
		},
		OnCancel: func() {},
	}

	dialog.ShowForm("Monitorar Domínio", "Adicionar", "Cancelar", form.Items, form.OnSubmit, d.window)
}
