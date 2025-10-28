#!/bin/bash
# Build script for CorpMonitor Go

set -e

VERSION="1.0.0"
APP_NAME="corpmonitor"

echo "🚀 Building CorpMonitor Go v${VERSION}"
echo "======================================"

# Verificar Go instalado
if ! command -v go &> /dev/null; then
    echo "❌ Go não encontrado. Instale Go 1.22+ primeiro."
    exit 1
fi

# Criar diretório de builds
mkdir -p builds

# Build para Linux
echo "📦 Building for Linux..."
GOOS=linux GOARCH=amd64 go build -o builds/${APP_NAME}-linux-amd64 \
  -ldflags "-X main.version=${VERSION}" \
  cmd/corpmonitor/main.go

# Build para Windows
echo "📦 Building for Windows..."
GOOS=windows GOARCH=amd64 go build -o builds/${APP_NAME}-windows-amd64.exe \
  -ldflags "-X main.version=${VERSION}" \
  cmd/corpmonitor/main.go

# Build para macOS (Intel)
echo "📦 Building for macOS (Intel)..."
GOOS=darwin GOARCH=amd64 go build -o builds/${APP_NAME}-darwin-amd64 \
  -ldflags "-X main.version=${VERSION}" \
  cmd/corpmonitor/main.go

# Build para macOS (Apple Silicon)
echo "📦 Building for macOS (ARM64)..."
GOOS=darwin GOARCH=arm64 go build -o builds/${APP_NAME}-darwin-arm64 \
  -ldflags "-X main.version=${VERSION}" \
  cmd/corpmonitor/main.go

# Calcular hashes
echo ""
echo "📋 Calculando hashes SHA256..."
cd builds
for file in ${APP_NAME}*; do
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" > "$file.sha256"
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" > "$file.sha256"
    fi
done
cd ..

echo ""
echo "✅ Build completo!"
echo ""
echo "Arquivos gerados em builds/:"
ls -lh builds/

echo ""
echo "📦 Pronto para distribuir:"
echo "  Linux:   ./builds/${APP_NAME}-linux-amd64"
echo "  Windows: builds\\${APP_NAME}-windows-amd64.exe"
echo "  macOS:   ./builds/${APP_NAME}-darwin-amd64 (Intel)"
echo "           ./builds/${APP_NAME}-darwin-arm64 (Apple Silicon)"
echo ""
echo "🔐 Hashes SHA256 gerados para verificação"
