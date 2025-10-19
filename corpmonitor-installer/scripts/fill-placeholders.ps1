# ========================================
# Script Automatizado de Preenchimento de Placeholders
# CorpMonitor MSI Installer
# ========================================

param(
    [string]$ExtensionId = "kmcpcjjddbhdgkaonaohpikkdgfejkgm",
    [string]$Manufacturer = "CorpMonitor Ltda"
)

$ErrorActionPreference = "Stop"

# Cores para output
$Colors = @{
    Success = "Green"
    Error = "Red"
    Info = "Cyan"
    Warning = "Yellow"
}

function Write-Step {
    param([string]$Message, [string]$Color = "White")
    Write-Host "$(Get-Date -Format 'HH:mm:ss') $Message" -ForegroundColor $Color
}

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerRoot = Split-Path -Parent $ScriptDir
$WixSourceDir = Join-Path $InstallerRoot "source\wix"
$BuildDir = Join-Path $InstallerRoot "build"

Write-Step "========================================" $Colors.Info
Write-Step " Preenchimento Automatizado de Placeholders" $Colors.Info
Write-Step "========================================" $Colors.Info
Write-Step ""

# Validar estrutura
Write-Step "[1/6] Validando estrutura de pastas..." $Colors.Info
if (!(Test-Path $WixSourceDir)) {
    Write-Step "❌ Pasta WiX não encontrada: $WixSourceDir" $Colors.Error
    exit 1
}

$ProductWxs = Join-Path $WixSourceDir "Product.wxs"
$FilesWxs = Join-Path $WixSourceDir "Files.wxs"
$RegistryWxs = Join-Path $WixSourceDir "Registry.wxs"

foreach ($file in @($ProductWxs, $FilesWxs, $RegistryWxs)) {
    if (!(Test-Path $file)) {
        Write-Step "❌ Arquivo não encontrado: $file" $Colors.Error
        exit 1
    }
}
Write-Step "✅ Estrutura validada" $Colors.Success

# Gerar GUIDs
Write-Step ""
Write-Step "[2/6] Gerando 30 GUIDs únicos..." $Colors.Info
$UpgradeCode = [guid]::NewGuid().ToString().ToUpper()
$Guids = @()
for ($i = 1; $i -le 29; $i++) {
    $Guids += [guid]::NewGuid().ToString().ToUpper()
}
Write-Step "✅ 30 GUIDs gerados" $Colors.Success

# Salvar GUIDs para referência
if (!(Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

$guidLog = @"
========================================
GUIDs Gerados em $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================

UpgradeCode: {$UpgradeCode}

Files.wxs Components:
"@

for ($i = 0; $i -lt 18; $i++) {
    $guidLog += "`nGUID_$($i+1): {$($Guids[$i])}"
}

$guidLog += "`n`nRegistry.wxs Components:"
for ($i = 18; $i -lt 29; $i++) {
    $guidLog += "`nGUID_$($i+1): {$($Guids[$i])}"
}

$guidLog | Out-File -FilePath (Join-Path $BuildDir "guids-used.txt") -Encoding UTF8

# Preencher Product.wxs
Write-Step ""
Write-Step "[3/6] Preenchendo Product.wxs..." $Colors.Info
$productContent = Get-Content $ProductWxs -Raw

$productContent = $productContent -replace '\[PREENCHER_MANUFACTURER\]', $Manufacturer
$productContent = $productContent -replace '\[PREENCHER_EXTENSION_ID\]', $ExtensionId
$productContent = $productContent -replace '\[PREENCHER_UPGRADE_CODE\]', $UpgradeCode

$productContent | Out-File -FilePath $ProductWxs -Encoding UTF8 -NoNewline
Write-Step "✅ Product.wxs atualizado (3 placeholders)" $Colors.Success

# Preencher Files.wxs
Write-Step ""
Write-Step "[4/6] Preenchendo Files.wxs..." $Colors.Info
$filesContent = Get-Content $FilesWxs -Raw

for ($i = 1; $i -le 18; $i++) {
    $placeholder = "[PREENCHER_GUID_$i]"
    $guid = "{$($Guids[$i-1])}"
    $filesContent = $filesContent -replace [regex]::Escape($placeholder), $guid
}

$filesContent | Out-File -FilePath $FilesWxs -Encoding UTF8 -NoNewline
Write-Step "✅ Files.wxs atualizado (18 GUIDs)" $Colors.Success

# Preencher Registry.wxs
Write-Step ""
Write-Step "[5/6] Preenchendo Registry.wxs..." $Colors.Info
$registryContent = Get-Content $RegistryWxs -Raw

# Substituir Extension ID (todas as ocorrências)
$registryContent = $registryContent -replace '\[PREENCHER_EXTENSION_ID\]', $ExtensionId

# Substituir GUIDs (19-30)
for ($i = 19; $i -le 30; $i++) {
    $placeholder = "[PREENCHER_GUID_$i]"
    $guid = "{$($Guids[$i-1])}"
    $registryContent = $registryContent -replace [regex]::Escape($placeholder), $guid
}

$registryContent | Out-File -FilePath $RegistryWxs -Encoding UTF8 -NoNewline

# Contar substituições
$extIdCount = ([regex]::Matches($registryContent, $ExtensionId)).Count
Write-Step "✅ Registry.wxs atualizado ($extIdCount Extension IDs + 12 GUIDs)" $Colors.Success

# Validar se ainda existem placeholders
Write-Step ""
Write-Step "[6/6] Validando preenchimento..." $Colors.Info
$allContent = (Get-Content $ProductWxs -Raw) + (Get-Content $FilesWxs -Raw) + (Get-Content $RegistryWxs -Raw)
$remainingPlaceholders = ([regex]::Matches($allContent, '\[PREENCHER_[^\]]+\]')).Count

if ($remainingPlaceholders -gt 0) {
    Write-Step "⚠️  Ainda existem $remainingPlaceholders placeholders não preenchidos!" $Colors.Warning
    
    # Mostrar quais são
    $matches = [regex]::Matches($allContent, '\[PREENCHER_[^\]]+\]')
    $uniquePlaceholders = $matches | Select-Object -ExpandProperty Value -Unique
    Write-Step "Placeholders restantes:" $Colors.Warning
    foreach ($ph in $uniquePlaceholders) {
        Write-Step "  - $ph" $Colors.Warning
    }
    exit 1
} else {
    Write-Step "✅ Todos os placeholders foram preenchidos!" $Colors.Success
}

# Resumo final
Write-Step ""
Write-Step "========================================" $Colors.Info
Write-Step " ✅ PREENCHIMENTO CONCLUÍDO" $Colors.Success
Write-Step "========================================" $Colors.Info
Write-Step ""
Write-Step "Configuração aplicada:" $Colors.Info
Write-Step "  Manufacturer: $Manufacturer" -ForegroundColor White
Write-Step "  Extension ID: $ExtensionId" -ForegroundColor White
Write-Step "  UpgradeCode: {$UpgradeCode}" -ForegroundColor White
Write-Step ""
Write-Step "Arquivos atualizados:" $Colors.Info
Write-Step "  ✓ Product.wxs (3 valores)" -ForegroundColor White
Write-Step "  ✓ Files.wxs (18 GUIDs)" -ForegroundColor White
Write-Step "  ✓ Registry.wxs ($extIdCount Extension IDs + 12 GUIDs)" -ForegroundColor White
Write-Step ""
Write-Step "📝 Log de GUIDs salvo em: build/guids-used.txt" $Colors.Info
Write-Step ""
Write-Step "Próximos passos:" $Colors.Info
Write-Step "  1. Compilar o MSI:" -ForegroundColor White
Write-Step "     .\build-msi.ps1" -ForegroundColor Gray
Write-Step ""
Write-Step "  2. Assinar o MSI (após receber certificado):" -ForegroundColor White
Write-Step "     .\sign.bat" -ForegroundColor Gray
Write-Step ""
Write-Step "  3. Testar instalação:" -ForegroundColor White
Write-Step "     .\test-install.bat" -ForegroundColor Gray
Write-Step ""
