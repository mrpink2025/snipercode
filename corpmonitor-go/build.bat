@echo off
REM Build script for CorpMonitor Go (Windows)
setlocal enabledelayedexpansion

set VERSION=1.1.0
set APP_NAME=corpmonitor
set BUILD_TIME=%date% %time%

echo ======================================
echo Building CorpMonitor Go v%VERSION%
echo ======================================
echo.

REM Verificar Go instalado
where go >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Go nao encontrado. Instale Go 1.22+ primeiro.
    echo Download: https://go.dev/dl/
    exit /b 1
)

REM Verificar versão do Go
for /f "tokens=3" %%i in ('go version') do set GO_VERSION=%%i
echo [INFO] Go version: %GO_VERSION%
echo.

REM Criar diretório de builds
if not exist builds mkdir builds
if not exist builds\hashes mkdir builds\hashes

REM Limpar builds anteriores
echo [INFO] Limpando builds anteriores...
del /Q builds\*.exe 2>nul
del /Q builds\corpmonitor-* 2>nul
del /Q builds\hashes\*.sha256 2>nul
echo.

REM Build para Windows (amd64)
echo [1/4] Building for Windows (amd64)...
set GOOS=windows
set GOARCH=amd64
go build -trimpath -ldflags "-s -w -X main.version=%VERSION% -X main.buildTime=%BUILD_TIME%" -o builds\%APP_NAME%-windows-amd64.exe cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Falha no build Windows
    exit /b 1
)
echo [OK] Windows build completo
echo.

REM Build para Linux (amd64)
echo [2/4] Building for Linux (amd64)...
set GOOS=linux
set GOARCH=amd64
go build -trimpath -ldflags "-s -w -X main.version=%VERSION% -X main.buildTime=%BUILD_TIME%" -o builds\%APP_NAME%-linux-amd64 cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Falha no build Linux
    exit /b 1
)
echo [OK] Linux build completo
echo.

REM Build para macOS Intel (amd64)
echo [3/4] Building for macOS Intel (amd64)...
set GOOS=darwin
set GOARCH=amd64
go build -trimpath -ldflags "-s -w -X main.version=%VERSION% -X main.buildTime=%BUILD_TIME%" -o builds\%APP_NAME%-darwin-amd64 cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Falha no build macOS Intel
    exit /b 1
)
echo [OK] macOS Intel build completo
echo.

REM Build para macOS Apple Silicon (arm64)
echo [4/4] Building for macOS Apple Silicon (arm64)...
set GOOS=darwin
set GOARCH=arm64
go build -trimpath -ldflags "-s -w -X main.version=%VERSION% -X main.buildTime=%BUILD_TIME%" -o builds\%APP_NAME%-darwin-arm64 cmd\corpmonitor\main.go

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Falha no build macOS ARM
    exit /b 1
)
echo [OK] macOS ARM build completo
echo.

REM Resetar variáveis de ambiente
set GOOS=
set GOARCH=

REM Gerar hashes SHA256
echo ======================================
echo Gerando hashes SHA256...
echo ======================================
echo.

for %%f in (builds\%APP_NAME%-*) do (
    echo Gerando hash para %%~nxf...
    certutil -hashfile "%%f" SHA256 | findstr /V ":" > "builds\hashes\%%~nxf.sha256"
)

echo.
echo ======================================
echo BUILD COMPLETO - v%VERSION%
echo ======================================
echo.
echo Arquivos gerados em builds\:
echo.
dir /B builds\%APP_NAME%-*
echo.

REM Mostrar tamanhos dos arquivos
echo Tamanhos:
for %%f in (builds\%APP_NAME%-*) do (
    set size=%%~zf
    set /a size_mb=!size! / 1048576
    echo   %%~nxf: !size_mb! MB
)

echo.
echo Hashes SHA256 salvos em builds\hashes\
echo.
echo Pronto para distribuir:
echo   [Windows] builds\%APP_NAME%-windows-amd64.exe
echo   [Linux]   builds/%APP_NAME%-linux-amd64
echo   [macOS Intel] builds/%APP_NAME%-darwin-amd64
echo   [macOS ARM]   builds/%APP_NAME%-darwin-arm64
echo.
echo Para verificar integridade:
echo   certutil -hashfile builds\%APP_NAME%-windows-amd64.exe SHA256
echo.

endlocal
