@echo off
REM Build script for CorpMonitor Go (Windows)

set VERSION=1.0.0
set APP_NAME=corpmonitor

echo Building CorpMonitor Go v%VERSION%
echo ======================================

REM Verificar Go instalado
where go >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Go nao encontrado. Instale Go 1.22+ primeiro.
    exit /b 1
)

REM Criar diretório de builds
if not exist builds mkdir builds

REM Build para Windows
echo Building for Windows...
go build -o builds\%APP_NAME%-windows-amd64.exe ^
  -ldflags "-X main.version=%VERSION%" ^
  cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo Erro no build Windows
    exit /b 1
)

REM Build para Linux
echo Building for Linux...
set GOOS=linux
set GOARCH=amd64
go build -o builds\%APP_NAME%-linux-amd64 ^
  -ldflags "-X main.version=%VERSION%" ^
  cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo Erro no build Linux
    exit /b 1
)

echo.
echo Build completo!
echo.
echo Arquivos gerados em builds\:
dir /B builds

echo.
echo Pronto para distribuir:
echo   Windows: builds\%APP_NAME%-windows-amd64.exe
echo   Linux:   ./builds/%APP_NAME%-linux-amd64
echo.
echo Para gerar hashes SHA256:
echo   certutil -hashfile builds\%APP_NAME%-windows-amd64.exe SHA256
