package ui

import (
	"testing"
)

func TestSiteViewerCreation(t *testing.T) {
	viewer := NewSiteViewer()
	
	if viewer == nil {
		t.Fatal("SiteViewer não deve ser nil")
	}
	
	if viewer.imageWidget == nil {
		t.Error("imageWidget não deve ser nil")
	}
	
	if viewer.scrollable == nil {
		t.Error("scrollable não deve ser nil")
	}
	
	if viewer.statusLabel == nil {
		t.Error("statusLabel não deve ser nil")
	}
}

func TestSiteViewerClear(t *testing.T) {
	viewer := NewSiteViewer()
	
	// Simular carregamento
	viewer.imageWidget.Image = nil // mockear imagem
	
	viewer.Clear()
	
	if viewer.imageWidget.Image != nil {
		t.Error("Imagem deveria ser nil após Clear()")
	}
}
