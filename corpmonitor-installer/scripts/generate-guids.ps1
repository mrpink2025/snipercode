# ========================================
# Gerador de GUIDs para WiX
# ========================================
# Execute este script para gerar todos os GUIDs necessarios
# PowerShell: .\generate-guids.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Gerador de GUIDs para CorpMonitor MSI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Copie e cole estes valores nos arquivos WiX:" -ForegroundColor Yellow
Write-Host ""

# UpgradeCode (Product.wxs)
Write-Host "[Product.wxs - UpgradeCode]" -ForegroundColor Green
$upgradeGuid = [guid]::NewGuid().ToString().ToUpper()
Write-Host "<?define UpgradeCode = `"{$upgradeGuid}`" ?>" -ForegroundColor White
Write-Host ""

# Files.wxs - Arquivos principais (11 componentes)
Write-Host "[Files.wxs - Componentes de Arquivos]" -ForegroundColor Green
$fileComponents = @(
    "ManifestJson",
    "BackgroundJs", 
    "ContentJs",
    "PopupHtml",
    "PopupJs",
    "OptionsHtml",
    "OptionsJs",
    "ConfigJs",
    "DebugConsoleJs",
    "ServiceWorkerUtilsJs",
    "PrivacyPolicyHtml"
)

$guidIndex = 1
foreach ($component in $fileComponents) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    Write-Host "[PREENCHER_GUID_$guidIndex] $component = {$guid}" -ForegroundColor White
    $guidIndex++
}
Write-Host ""

# Files.wxs - Ícones (5 componentes)
Write-Host "[Files.wxs - Componentes de Ícones]" -ForegroundColor Green
$iconComponents = @(
    "Icon16",
    "Icon32",
    "Icon48",
    "Icon128",
    "BaseIcon"
)

foreach ($component in $iconComponents) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    Write-Host "[PREENCHER_GUID_$guidIndex] $component = {$guid}" -ForegroundColor White
    $guidIndex++
}
Write-Host ""

# Registry.wxs - 64-bit (4 componentes)
Write-Host "[Registry.wxs - Registry 64-bit]" -ForegroundColor Green
$registry64Components = @(
    "ChromeForcelist_x64",
    "ChromeSettings_x64",
    "EdgeForcelist_x64",
    "EdgeSettings_x64"
)

foreach ($component in $registry64Components) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    Write-Host "[PREENCHER_GUID_$guidIndex] $component = {$guid}" -ForegroundColor White
    $guidIndex++
}
Write-Host ""

# Registry.wxs - 32-bit (4 componentes)
Write-Host "[Registry.wxs - Registry 32-bit]" -ForegroundColor Green
$registry32Components = @(
    "ChromeForcelist_x86",
    "ChromeSettings_x86",
    "EdgeForcelist_x86",
    "EdgeSettings_x86"
)

foreach ($component in $registry32Components) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    Write-Host "[PREENCHER_GUID_$guidIndex] $component = {$guid}" -ForegroundColor White
    $guidIndex++
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Total de GUIDs gerados: $($guidIndex - 1)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "- Substitua TODOS os [PREENCHER_GUID_X] nos arquivos WiX" -ForegroundColor Yellow
Write-Host "- NUNCA reutilize GUIDs entre componentes diferentes" -ForegroundColor Yellow
Write-Host "- Guarde o UpgradeCode (nunca mude entre versoes)" -ForegroundColor Yellow
Write-Host ""

# Salvar em arquivo
$outputFile = "$PSScriptRoot\..\build\guids.txt"
if (!(Test-Path "$PSScriptRoot\..\build")) {
    New-Item -ItemType Directory -Path "$PSScriptRoot\..\build" | Out-Null
}

$output = @"
========================================
GUIDs Gerados em $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================

[Product.wxs - UpgradeCode]
<?define UpgradeCode = "{$upgradeGuid}" ?>

[Files.wxs - Componentes de Arquivos]
"@

$guidIndex = 1
foreach ($component in $fileComponents) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    $output += "`n[PREENCHER_GUID_$guidIndex] $component = {$guid}"
    $guidIndex++
}

$output += "`n`n[Files.wxs - Componentes de Ícones]"
foreach ($component in $iconComponents) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    $output += "`n[PREENCHER_GUID_$guidIndex] $component = {$guid}"
    $guidIndex++
}

$output += "`n`n[Registry.wxs - Registry 64-bit]"
foreach ($component in $registry64Components) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    $output += "`n[PREENCHER_GUID_$guidIndex] $component = {$guid}"
    $guidIndex++
}

$output += "`n`n[Registry.wxs - Registry 32-bit]"
foreach ($component in $registry32Components) {
    $guid = [guid]::NewGuid().ToString().ToUpper()
    $output += "`n[PREENCHER_GUID_$guidIndex] $component = {$guid}"
    $guidIndex++
}

$output | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "GUIDs salvos em: $outputFile" -ForegroundColor Green
Write-Host ""
