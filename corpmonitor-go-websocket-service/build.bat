@echo off
echo ========================================
echo Building CorpMonitor WebSocket Service
echo ========================================

REM Criar diretório bin
if not exist bin mkdir bin

echo [1/3] Building Windows (amd64)...
set GOOS=windows
set GOARCH=amd64
go build -o bin/corpmonitor-ws.exe main.go
if errorlevel 1 (
    echo [ERROR] Falha no build Windows
    exit /b 1
)

echo [2/3] Building Linux (amd64)...
set GOOS=linux
set GOARCH=amd64
go build -o bin/corpmonitor-ws-linux main.go
if errorlevel 1 (
    echo [ERROR] Falha no build Linux
    exit /b 1
)

echo [3/3] Building macOS (amd64)...
set GOOS=darwin
set GOARCH=amd64
go build -o bin/corpmonitor-ws-macos main.go
if errorlevel 1 (
    echo [ERROR] Falha no build macOS
    exit /b 1
)

echo.
echo ========================================
echo BUILD COMPLETO
echo ========================================
echo Binarios disponiveis em bin/
dir bin\
