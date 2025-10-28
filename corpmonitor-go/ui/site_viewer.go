package ui

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"os"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"go.uber.org/zap"
)

type SiteViewer struct {
	imageWidget *canvas.Image
	scrollable  *container.Scroll
	statusLabel *widget.Label
}

func NewSiteViewer() *SiteViewer {
	img := canvas.NewImageFromImage(nil)
	img.FillMode = canvas.ImageFillContain
	img.SetMinSize(fyne.NewSize(800, 600))

	return &SiteViewer{
		imageWidget: img,
		scrollable:  container.NewScroll(img),
		statusLabel: widget.NewLabel("Aguardando screenshot..."),
	}
}

func (sv *SiteViewer) Build() fyne.CanvasObject {
	return container.NewBorder(
		sv.statusLabel,
		nil,
		nil,
		nil,
		sv.scrollable,
	)
}

func (sv *SiteViewer) LoadImage(data []byte) {
	if len(data) == 0 {
		sv.statusLabel.SetText("❌ Nenhum screenshot disponível")
		return
	}

	// Decodificar imagem
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		logger.Log.Error("Erro ao decodificar screenshot", zap.Error(err))
		sv.statusLabel.SetText(fmt.Sprintf("❌ Erro ao carregar: %v", err))
		return
	}

	sv.imageWidget.Image = img
	sv.imageWidget.Refresh()
	sv.statusLabel.SetText(fmt.Sprintf("✅ Screenshot carregado (%d bytes)", len(data)))

	logger.Log.Info("Screenshot carregado", zap.Int("size", len(data)))
}

func (sv *SiteViewer) SaveImage(filename string) error {
	if sv.imageWidget.Image == nil {
		return fmt.Errorf("nenhuma imagem carregada")
	}

	// Criar arquivo
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	// Salvar como PNG
	return png.Encode(file, sv.imageWidget.Image)
}

func (sv *SiteViewer) Clear() {
	sv.imageWidget.Image = nil
	sv.imageWidget.Refresh()
	sv.statusLabel.SetText("Aguardando screenshot...")
}
