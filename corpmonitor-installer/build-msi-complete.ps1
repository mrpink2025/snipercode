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
    [string]$CBCMToken = "2e0be2c0-4252-4c4d-a072-1f774f1b2edc",
    [string]$WixPath = "C:\Users\User\Downloads\wix311-binaries",
    [switch]$CleanBuild
)

$ErrorActionPreference = "Stop"

# ===== Configuração =====
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$InstallerRoot = "$PSScriptRoot"
$BuildDir = "$InstallerRoot\build"
$SourceDir = "$InstallerRoot\source\wix"

# ===== Detectar WiX Toolset =====
if ([string]::IsNullOrEmpty($WixPath)) {
    Write-Host "Detectando WiX Toolset..." -ForegroundColor Gray
    
    $PossiblePaths = @(
        "C:\Program Files (x86)\WiX Toolset v3.11\bin",
        "C:\Program Files\WiX Toolset v3.11\bin",
        "${env:ProgramFiles(x86)}\WiX Toolset v3.11\bin",
        "$env:ProgramFiles\WiX Toolset v3.11\bin",
        "C:\Users\$env:USERNAME\Downloads\wix311-binaries",
        "$env:USERPROFILE\Downloads\wix311-binaries",
        "C:\Tools\wix311\bin",
        "C:\wix311\bin"
    )

    foreach ($path in $PossiblePaths) {
        if (Test-Path "$path\candle.exe") {
            $WixPath = $path
            Write-Host "  WiX Toolset detectado em: $path" -ForegroundColor Green
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($WixPath)) {
        Write-Host ""
        Write-Host "ERRO: WiX Toolset nao encontrado automaticamente." -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUCOES:" -ForegroundColor Yellow
        Write-Host "  1. Especifique o caminho manualmente:" -ForegroundColor White
        Write-Host "     .\build-msi-complete.ps1 -WixPath 'C:\caminho\para\wix\bin'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  2. Baixe WiX Toolset v3.11:" -ForegroundColor White
        Write-Host "     https://github.com/wixtoolset/wix3/releases/tag/wix3112rtm" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
}

# ===== Banner =====
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CorpMonitor MSI - Compilador Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ===== 1. Validar Pré-requisitos =====
Write-Host "[1/7] Validando pré-requisitos..." -ForegroundColor Yellow

if (-not (Test-Path "$WixPath\candle.exe")) {
    Write-Host "ERRO: WiX Toolset nao encontrado em $WixPath" -ForegroundColor Red
    Write-Host "Verifique se o caminho esta correto." -ForegroundColor Yellow
    Write-Host "Arquivos esperados: candle.exe, light.exe" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$SourceDir\Product.wxs")) {
    Write-Host "ERRO: Product.wxs não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "  OK WiX Toolset encontrado" -ForegroundColor Green
Write-Host ""

# ===== 2. Limpar Build Anterior =====
if ($CleanBuild -and (Test-Path $BuildDir)) {
    Write-Host "[2/7] Limpando build anterior..." -ForegroundColor Yellow
    Remove-Item $BuildDir -Recurse -Force
}

if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

Write-Host "  OK Diretorio preparado" -ForegroundColor Green
Write-Host ""

# ===== 3. Preencher Placeholders =====
Write-Host "[3/7] Preenchendo placeholders..." -ForegroundColor Yellow

# Gerar GUIDs
$UpgradeCode = [guid]::NewGuid().ToString().ToUpper()
$Guids = @{}
for ($i = 1; $i -le 34; $i++) {
    $Guids["GUID_$i"] = [guid]::NewGuid().ToString().ToUpper()
}

# Substituir em Product.wxs
$ProductContent = Get-Content "$SourceDir\Product.wxs" -Raw
$ProductContent = $ProductContent -replace '\[PREENCHER_NOME_EMPRESA\]', $Manufacturer
$ProductContent = $ProductContent -replace '\[PREENCHER_EXTENSION_ID\]', $ExtensionId
$ProductContent = $ProductContent -replace '\[PREENCHER_GUID_UPGRADE\]', $UpgradeCode
$ProductContent | Set-Content "$BuildDir\Product.wxs" -Encoding UTF8

# Substituir em Registry.wxs
$RegistryContent = Get-Content "$SourceDir\Registry.wxs" -Raw
$RegistryContent = $RegistryContent -replace '\[PREENCHER_GUID_31\]', $Guids["GUID_31"]
$RegistryContent = $RegistryContent -replace '\[PREENCHER_GUID_32\]', $Guids["GUID_32"]
$RegistryContent = $RegistryContent -replace '\[PREENCHER_GUID_33\]', $Guids["GUID_33"]
$RegistryContent = $RegistryContent -replace '\[PREENCHER_GUID_34\]', $Guids["GUID_34"]
$RegistryContent | Set-Content "$BuildDir\Registry.wxs" -Encoding UTF8

Write-Host "  OK Placeholders preenchidos" -ForegroundColor Green
Write-Host "    Extension ID: $ExtensionId" -ForegroundColor Gray
Write-Host "    Manufacturer: $Manufacturer" -ForegroundColor Gray
Write-Host "    Upgrade Code: $UpgradeCode" -ForegroundColor Gray
Write-Host "    Registry GUIDs: GUID_31 a GUID_34 gerados" -ForegroundColor Gray
Write-Host ""

# ===== 4. Compilar Arquivos WiX =====
Write-Host "[4/7] Compilando arquivos WiX..." -ForegroundColor Yellow

$LocalizationFiles = @(
    "pt-BR", "en-US", "es-ES", "pt-PT", "fr-FR"
)

Push-Location $BuildDir

# Compilar .wxs -> .wixobj
$candleProduct = & "$WixPath\candle.exe" `
    -out Product.wixobj Product.wxs `
    -ext WixUIExtension 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao compilar Product.wxs:" -ForegroundColor Red
    Write-Host $candleProduct -ForegroundColor Yellow
    Pop-Location
    exit 1
}

$candleRegistry = & "$WixPath\candle.exe" `
    -out Registry.wixobj Registry.wxs 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao compilar Registry.wxs:" -ForegroundColor Red
    Write-Host $candleRegistry -ForegroundColor Yellow
    Pop-Location
    exit 1
}

Write-Host "  OK Objetos WiX gerados" -ForegroundColor Green
Write-Host ""

# ===== 5. Compilar MSI (sem UI) =====
Write-Host "[5/6] Compilando MSI..." -ForegroundColor Yellow

$lightBase = & "$WixPath\light.exe" `
    -out CorpMonitor.msi `
    -sice:ICE61 `
    Product.wixobj Registry.wixobj 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao compilar MSI:" -ForegroundColor Red
    Write-Host $lightBase -ForegroundColor Yellow
    Pop-Location
    exit 1
}

if (-not (Test-Path "$BuildDir\CorpMonitor.msi")) {
    Write-Host "ERRO: MSI nao foi gerado!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "  OK MSI gerado (CBCM keys only)" -ForegroundColor Green

Pop-Location

Write-Host ""

# ===== 6. Gerar Hash SHA256 =====
Write-Host "[6/6] Gerando hash SHA256..." -ForegroundColor Yellow

$MsiPath = "$BuildDir\CorpMonitor.msi"
$Hash = (Get-FileHash $MsiPath -Algorithm SHA256).Hash

$Hash | Out-File "$MsiPath.sha256" -Encoding ASCII

Write-Host "  OK Hash gerado" -ForegroundColor Green
Write-Host ""

# ===== 7. Relatório Final =====
Write-Host "[7/7] Relatório Final" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " BUILD CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "MSI: $MsiPath" -ForegroundColor Cyan
Write-Host "Tamanho: $([math]::Round((Get-Item $MsiPath).Length / 1KB, 2)) KB" -ForegroundColor Cyan
Write-Host "SHA256: $Hash" -ForegroundColor Cyan
Write-Host ""
Write-Host "CONTEUDO:" -ForegroundColor Yellow
Write-Host "  - CBCM Registry Keys (x64 + x86)" -ForegroundColor White
Write-Host "  - CloudManagementEnrollmentToken" -ForegroundColor Gray
Write-Host "  - CloudManagementEnrollmentMandatory" -ForegroundColor Gray
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. TESTAR LOCALMENTE (silencioso):" -ForegroundColor White
Write-Host "   msiexec /i `"$MsiPath`" CHROME_ENROLLMENT_TOKEN=`"seu_token`" /qn" -ForegroundColor Gray
Write-Host ""
Write-Host "2. ASSINAR (Recomendado):" -ForegroundColor White
Write-Host "   .\scripts\sign.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "3. DEPLOY VIA CBCM:" -ForegroundColor White
Write-Host "   Upload em: https://admin.google.com/ac/chrome/apps" -ForegroundColor Gray
Write-Host "   A extensao sera instalada automaticamente via CBCM" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
