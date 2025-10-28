package main

import (
	"context"
	"fmt"
	"os"

	"github.com/corpmonitor/corpmonitor-go/internal/auth"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"github.com/corpmonitor/corpmonitor-go/ui"
	"go.uber.org/zap"
)

var (
	version   = "dev"
	buildTime = ""
)

func main() {
	if err := logger.Init(); err != nil {
		fmt.Println("falha ao iniciar logger:", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Log.Info("Iniciando CorpMonitor Go",
		zap.String("version", version),
		zap.String("buildTime", buildTime),
	)

	sb, err := supabase.NewClient()
	if err != nil {
		logger.Log.Fatal("Erro Supabase (verifique .env)", zap.Error(err))
	}

	authMgr := auth.NewManager(sb)

	// Login automático via variáveis de ambiente (opcional)
	email := os.Getenv("ADMIN_EMAIL")
	pass := os.Getenv("ADMIN_PASSWORD")
	if email != "" && pass != "" {
		ok, msg := authMgr.SignIn(context.Background(), email, pass)
		logger.Log.Info("Login env", zap.Bool("ok", ok), zap.String("msg", msg))
	}

	mw := ui.NewMainWindow(authMgr, sb)
	defer mw.Close()
	mw.ShowAndRun()
}
