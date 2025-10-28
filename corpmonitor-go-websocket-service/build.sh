#!/bin/bash

echo "========================================"
echo "Building CorpMonitor WebSocket Service"
echo "========================================"

# Criar diretório bin
mkdir -p bin

# Linux
echo "[1/3] Building Linux (amd64)..."
GOOS=linux GOARCH=amd64 go build -o bin/corpmonitor-ws-linux main.go

# Windows
echo "[2/3] Building Windows (amd64)..."
GOOS=windows GOARCH=amd64 go build -o bin/corpmonitor-ws.exe main.go

# macOS
echo "[3/3] Building macOS (amd64)..."
GOOS=darwin GOARCH=amd64 go build -o bin/corpmonitor-ws-macos main.go

echo ""
echo "✅ Build completo!"
echo "Binários disponíveis em bin/"
ls -lh bin/
