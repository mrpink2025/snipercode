#Requires -Version 5.1

<#
.SYNOPSIS
    Detecta e atualiza automaticamente o caminho do SignTool no sign.bat

.DESCRIPTION
    Este script busca a versão mais recente do SignTool instalada via Windows SDK,
    valida sua funcionalidade e atualiza o arquivo sign.bat com o caminho correto.

.EXAMPLE
    .\update-signtool-path.ps1
#>

param(
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"

# ========================================
# HEADER
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " SignTool Auto-Detector & Updater" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# [1/4] BUSCAR SIGNTOOL
# ========================================
Write-Host "[1/4] Buscando SignTool no Windows SDK..." -ForegroundColor Yellow

$sdkBasePath = "C:\Program Files (x86)\Windows Kits\10\bin\"

if (-not (Test-Path $sdkBasePath)) {
    Write-Host ""
    Write-Host "[ERRO] Windows SDK nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "O Windows SDK deve estar instalado em:" -ForegroundColor White
    Write-Host "  $sdkBasePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Baixe o Windows SDK de:" -ForegroundColor White
    Write-Host "  https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Durante a instalacao, selecione:" -ForegroundColor White
    Write-Host "  [x] Windows SDK Signing Tools for Desktop Apps" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Buscar todos os signtool.exe em pastas x64
$signToolPaths = Get-ChildItem -Path $sdkBasePath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
    Sort-Object -Property @{Expression = { 
        try {
            [version]($_.Directory.Parent.Name)
        } catch {
            [version]"0.0.0.0"
        }
    }; Descending = $true }

if ($signToolPaths.Count -eq 0) {
    Write-Host ""
    Write-Host "[ERRO] Nenhum SignTool x64 encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Reinstale o Windows SDK e certifique-se de selecionar:" -ForegroundColor White
    Write-Host "  [x] Windows SDK Signing Tools for Desktop Apps" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "  Encontradas $($signToolPaths.Count) versoes:" -ForegroundColor Green
foreach ($st in $signToolPaths) {
    $ver = $st.Directory.Parent.Name
    Write-Host "    - $ver" -ForegroundColor Gray
}

# ========================================
# [2/4] VALIDAR SIGNTOOL
# ========================================
Write-Host ""
Write-Host "[2/4] Testando SignTool mais recente..." -ForegroundColor Yellow

$validSignTool = $null
$sdkVersion = $null

foreach ($signTool in $signToolPaths) {
    $testPath = $signTool.FullName
    $testVersion = $signTool.Directory.Parent.Name
    
    Write-Host "  Testando: $testVersion..." -ForegroundColor Gray -NoNewline
    
    try {
        $testResult = & $testPath /? 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
            $validSignTool = $testPath
            $sdkVersion = $testVersion
            Write-Host " OK" -ForegroundColor Green
            break
        } else {
            Write-Host " FALHOU" -ForegroundColor Red
        }
    } catch {
        Write-Host " ERRO" -ForegroundColor Red
    }
}

if (-not $validSignTool) {
    Write-Host ""
    Write-Host "[ERRO] Nenhum SignTool funcional encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Todas as versoes encontradas falharam no teste." -ForegroundColor White
    Write-Host "Reinstale o Windows SDK." -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "  Selecionado: $sdkVersion" -ForegroundColor Green
Write-Host "  Caminho: $validSignTool" -ForegroundColor White

# ========================================
# [3/4] ATUALIZAR SIGN.BAT
# ========================================
Write-Host ""
Write-Host "[3/4] Atualizando sign.bat..." -ForegroundColor Yellow

$signBatPath = Join-Path $PSScriptRoot "sign.bat"

if (-not (Test-Path $signBatPath)) {
    Write-Host ""
    Write-Host "[ERRO] sign.bat nao encontrado em:" -ForegroundColor Red
    Write-Host "  $signBatPath" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Criar backup
if (-not $SkipBackup) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupPath = "$signBatPath.backup-$timestamp"
    Copy-Item $signBatPath $backupPath -Force
    Write-Host "  Backup criado: sign.bat.backup-$timestamp" -ForegroundColor Yellow
}

# Ler conteúdo do sign.bat
$content = Get-Content $signBatPath -Raw -Encoding Default

# Substituir a linha do SIGNTOOL
$pattern = 'set SIGNTOOL="[^"]*"'
$replacement = "set SIGNTOOL=`"$validSignTool`""

if ($content -notmatch $pattern) {
    Write-Host ""
    Write-Host "[ERRO] Linha SIGNTOOL nao encontrada em sign.bat!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Certifique-se que sign.bat contem:" -ForegroundColor White
    Write-Host '  set SIGNTOOL="..."' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

$newContent = $content -replace $pattern, $replacement

# Salvar (manter encoding original)
Set-Content $signBatPath $newContent -NoNewline -Encoding Default

Write-Host "  sign.bat atualizado (linha 9)" -ForegroundColor Green

# ========================================
# [4/4] RELATORIO FINAL
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " CONFIGURACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "SignTool Path:" -ForegroundColor White
Write-Host "  $validSignTool" -ForegroundColor Cyan
Write-Host ""
Write-Host "SDK Version:" -ForegroundColor White
Write-Host "  $sdkVersion" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipBackup) {
    Write-Host "Backup:" -ForegroundColor White
    Write-Host "  $backupPath" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor White
Write-Host " PROXIMOS PASSOS" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host ""
Write-Host "1. Obter Certificate Thumbprint:" -ForegroundColor Yellow
Write-Host "   certutil -store -user My" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Editar sign.bat (linha 10):" -ForegroundColor Yellow
Write-Host "   set CERT_THUMBPRINT=SEU_THUMBPRINT_AQUI" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Conectar token USB com certificado EV" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Executar assinatura:" -ForegroundColor Yellow
Write-Host "   scripts\sign.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host ""
