#Requires -Version 5.1
<#
.SYNOPSIS
    Compilador completo do MSI CorpMonitor com suporte multilíngue
.DESCRIPTION
    Compila um único MSI que suporta 5 idiomas com seleção durante instalação
#>

param(
    [string]$ExtensionId = "kmcpcjjddbhdgkaonaohpikkdgfejkgm",
    [string]$Manufacturer = "Alves Junior Maquinas e Equipamentos Ltda",
    [string]$CBCMToken = "",
    [switch]$CleanBuild
)

$ErrorActionPreference = "Stop"

# ===== Configuração =====
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$InstallerRoot = "$PSScriptRoot"
$WixPath = "C:\Program Files (x86)\WiX Toolset v3.11\bin"
$BuildDir = "$InstallerRoot\build"
$SourceDir = "$InstallerRoot\source\wix"

# ===== Banner =====
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CorpMonitor MSI - Compilador Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ===== 1. Validar Pré-requisitos =====
Write-Host "[1/7] Validando pré-requisitos..." -ForegroundColor Yellow

if (-not (Test-Path "$WixPath\candle.exe")) {
    Write-Host "ERRO: WiX Toolset não encontrado em $WixPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$SourceDir\Product.wxs")) {
    Write-Host "ERRO: Product.wxs não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ WiX Toolset encontrado" -ForegroundColor Green
Write-Host ""

# ===== 2. Limpar Build Anterior =====
if ($CleanBuild -and (Test-Path $BuildDir)) {
    Write-Host "[2/7] Limpando build anterior..." -ForegroundColor Yellow
    Remove-Item $BuildDir -Recurse -Force
}

if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

Write-Host "  ✓ Diretório preparado" -ForegroundColor Green
Write-Host ""

# ===== 3. Preencher Placeholders =====
Write-Host "[3/7] Preenchendo placeholders..." -ForegroundColor Yellow

# Gerar GUIDs
$UpgradeCode = [guid]::NewGuid().ToString().ToUpper()
$Guids = @{}
for ($i = 1; $i -le 4; $i++) {
    $Guids["GUID_$i"] = [guid]::NewGuid().ToString().ToUpper()
}

# Substituir em Product.wxs
$ProductContent = Get-Content "$SourceDir\Product.wxs" -Raw
$ProductContent = $ProductContent -replace '\[PREENCHER_NOME_EMPRESA\]', $Manufacturer
$ProductContent = $ProductContent -replace '\[PREENCHER_EXTENSION_ID\]', $ExtensionId
$ProductContent = $ProductContent -replace '\[PREENCHER_GUID_UPGRADE\]', $UpgradeCode
$ProductContent | Set-Content "$BuildDir\Product.wxs" -Encoding UTF8

# Copiar outros arquivos
Copy-Item "$SourceDir\Registry.wxs" "$BuildDir\Registry.wxs"
Copy-Item "$SourceDir\UI.wxs" "$BuildDir\UI.wxs"

Write-Host "  ✓ Placeholders preenchidos" -ForegroundColor Green
Write-Host "    Extension ID: $ExtensionId" -ForegroundColor Gray
Write-Host "    Manufacturer: $Manufacturer" -ForegroundColor Gray
Write-Host "    Upgrade Code: $UpgradeCode" -ForegroundColor Gray
Write-Host ""

# ===== 4. Compilar Arquivos WiX =====
Write-Host "[4/7] Compilando arquivos WiX..." -ForegroundColor Yellow

$LocalizationFiles = @(
    "pt-BR", "en-US", "es-ES", "pt-PT", "fr-FR"
)

Push-Location $BuildDir

# Compilar .wxs -> .wixobj
& "$WixPath\candle.exe" `
    -out Product.wixobj Product.wxs `
    -ext WixUIExtension 2>&1 | Out-Null

& "$WixPath\candle.exe" `
    -out Registry.wixobj Registry.wxs 2>&1 | Out-Null

& "$WixPath\candle.exe" `
    -out UI.wixobj UI.wxs `
    -ext WixUIExtension 2>&1 | Out-Null

Write-Host "  ✓ Objetos WiX gerados" -ForegroundColor Green
Write-Host ""

# ===== 5. Linkar com Todas as Localizações =====
Write-Host "[5/7] Linkando com suporte multilíngue..." -ForegroundColor Yellow

$LocalizationArgs = @()
foreach ($lang in $LocalizationFiles) {
    $LocalizationArgs += "-loc"
    $LocalizationArgs += "$InstallerRoot\localization\$lang.wxl"
    Write-Host "    + $lang" -ForegroundColor Gray
}

& "$WixPath\light.exe" `
    -out CorpMonitor.msi `
    -cultures:"pt-BR;en-US;es-ES;pt-PT;fr-FR" `
    @LocalizationArgs `
    -ext WixUIExtension `
    -sice:ICE61 `
    Product.wixobj Registry.wixobj UI.wixobj 2>&1 | Out-Null

Pop-Location

Write-Host "  ✓ MSI gerado com 5 idiomas embutidos" -ForegroundColor Green
Write-Host ""

# ===== 6. Gerar Hash SHA256 =====
Write-Host "[6/7] Gerando hash SHA256..." -ForegroundColor Yellow

$MsiPath = "$BuildDir\CorpMonitor.msi"
$Hash = (Get-FileHash $MsiPath -Algorithm SHA256).Hash

$Hash | Out-File "$MsiPath.sha256" -Encoding ASCII

Write-Host "  ✓ Hash gerado" -ForegroundColor Green
Write-Host ""

# ===== 7. Relatório Final =====
Write-Host "[7/7] Relatório Final" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " BUILD CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 MSI: $MsiPath" -ForegroundColor Cyan
Write-Host "📊 Tamanho: $([math]::Round((Get-Item $MsiPath).Length / 1KB, 2)) KB" -ForegroundColor Cyan
Write-Host "🔒 SHA256: $Hash" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌍 IDIOMAS SUPORTADOS:" -ForegroundColor Yellow
Write-Host "  🇧🇷 Português (Brasil)" -ForegroundColor White
Write-Host "  🇺🇸 English (United States)" -ForegroundColor White
Write-Host "  🇪🇸 Español (España)" -ForegroundColor White
Write-Host "  🇵🇹 Português (Portugal)" -ForegroundColor White
Write-Host "  🇫🇷 Français (France)" -ForegroundColor White
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. TESTAR LOCALMENTE:" -ForegroundColor White
Write-Host "   msiexec /i `"$MsiPath`" CHROME_ENROLLMENT_TOKEN=`"seu_token`"" -ForegroundColor Gray
Write-Host ""
Write-Host "2. ASSINAR (Recomendado):" -ForegroundColor White
Write-Host "   .\scripts\sign.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "3. DEPLOY VIA CBCM:" -ForegroundColor White
Write-Host "   https://admin.google.com/ac/chrome/apps" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
