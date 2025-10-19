# ============================================
# CorpMonitor MSI - Setup Completo e Build
# ============================================
# Script único que faz TUDO:
# 1. Coleta configurações (interativo ou silent)
# 2. Gera GUIDs únicos
# 3. Preenche todos os placeholders
# 4. Copia arquivos da extensão
# 5. Compila MSI com WiX
# 6. Gera hash SHA256
# 7. Mostra relatório completo
#
# Uso:
#   .\setup-and-build-msi.ps1               (modo interativo)
#   .\setup-and-build-msi.ps1 -Silent       (usa valores padrão)
#   .\setup-and-build-msi.ps1 -Test         (testa instalação após build)
#   .\setup-and-build-msi.ps1 -Clean        (limpa build anterior)
#   .\setup-and-build-msi.ps1 -ExtensionId "abc..." -Manufacturer "Empresa"
# ============================================

param(
    [string]$ExtensionId = "",
    [string]$Manufacturer = "",
    [string]$CBCMToken = "",
    [switch]$Silent,
    [switch]$Test,
    [switch]$Clean
)

# ===== CONFIGURAÇÕES =====
$PROJECT_ROOT = $PSScriptRoot
$INSTALLER_DIR = Join-Path $PROJECT_ROOT "corpmonitor-installer"
$SOURCE_DIR = Join-Path $INSTALLER_DIR "source"
$WIX_DIR = Join-Path $SOURCE_DIR "wix"
$BUILD_DIR = Join-Path $INSTALLER_DIR "build"
$EXTENSION_SOURCE = Join-Path $PROJECT_ROOT "chrome-extension"

$WIX_PATH = "C:\Program Files (x86)\WiX Toolset v3.14\bin"

# Valores padrão
$DEFAULT_EXTENSION_ID = "kmcpcjjddbhdgkaonaohpikkdgfejkgm"
$DEFAULT_MANUFACTURER = "CorpMonitor Ltda"

# ===== CORES =====
$C = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Warning = "Yellow"
    White   = "White"
    Gray    = "DarkGray"
}

# ===== FUNÇÕES AUXILIARES =====
function Write-Step {
    param([string]$Message, [string]$Color = $C.Info)
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Show-Banner {
    $banner = @"

========================================
   CorpMonitor MSI - Setup & Build
========================================
  Setup Completo + Compilação + Hash
========================================

"@
    Write-Host $banner -ForegroundColor $C.Info
}

function Show-Progress {
    param([int]$Current, [int]$Total, [string]$Activity)
    $percent = [math]::Round(($Current / $Total) * 100)
    $barLength = 30
    $filled = [math]::Round(($percent / 100) * $barLength)
    $bar = ("#" * $filled).PadRight($barLength, "-")
    
    Write-Host "`r[$bar] $percent% - $Activity" -NoNewline -ForegroundColor $C.Info
    if ($Current -eq $Total) {
        Write-Host "" # Nova linha ao completar
    }
}

function Read-UserInput {
    param(
        [string]$Prompt,
        [string]$Default,
        [string]$ValidationPattern = "",
        [string]$ValidationMessage = ""
    )
    
    Write-Host "`n$Prompt" -ForegroundColor $C.Info
    if ($Default) {
        Write-Host "  (padrao: $Default)" -ForegroundColor $C.Gray
    }
    Write-Host "  > " -NoNewline -ForegroundColor $C.White
    
    $input = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($input)) {
        $input = $Default
    }
    
    # Validação
    if ($ValidationPattern -and $input -notmatch $ValidationPattern) {
        Write-Host "  [ERRO] $ValidationMessage" -ForegroundColor $C.Error
        return Read-UserInput -Prompt $Prompt -Default $Default -ValidationPattern $ValidationPattern -ValidationMessage $ValidationMessage
    }
    
    return $input
}

function Test-Prerequisites {
    Write-Step "[1/9] Validando pre-requisitos..." $C.Info
    
    $errors = @()
    
    # WiX Toolset
    if (!(Test-Path "$WIX_PATH\candle.exe")) {
        $errors += "WiX Toolset v3.14 nao encontrado em: $WIX_PATH"
        $errors += "  Baixe de: https://github.com/wixtoolset/wix3/releases/tag/wix3141rtm"
    } else {
        Write-Host "  [OK] WiX Toolset encontrado" -ForegroundColor $C.Success
    }
    
    # Estrutura de arquivos WiX
    $requiredFiles = @(
        (Join-Path $WIX_DIR "Product.wxs"),
        (Join-Path $WIX_DIR "Files.wxs"),
        (Join-Path $WIX_DIR "Registry.wxs")
    )
    
    foreach ($file in $requiredFiles) {
        if (!(Test-Path $file)) {
            $errors += "Arquivo WiX nao encontrado: $file"
        }
    }
    
    if ($requiredFiles.Count -eq ($requiredFiles | Where-Object { Test-Path $_ }).Count) {
        Write-Host "  [OK] Arquivos WiX validados" -ForegroundColor $C.Success
    }
    
    # Pasta chrome-extension
    if (!(Test-Path $EXTENSION_SOURCE)) {
        $errors += "Pasta chrome-extension nao encontrada: $EXTENSION_SOURCE"
    } else {
        Write-Host "  [OK] Pasta chrome-extension encontrada" -ForegroundColor $C.Success
    }
    
    # ChromeManager.ps1
    $chromeManager = Join-Path $INSTALLER_DIR "scripts\ChromeManager.ps1"
    if (!(Test-Path $chromeManager)) {
        $errors += "ChromeManager.ps1 nao encontrado: $chromeManager"
    } else {
        Write-Host "  [OK] ChromeManager.ps1 encontrado" -ForegroundColor $C.Success
    }
    
    if ($errors.Count -gt 0) {
        Write-Host "`n[ERRO] Pre-requisitos falharam:" -ForegroundColor $C.Error
        foreach ($err in $errors) {
            Write-Host "  - $err" -ForegroundColor $C.Error
        }
        exit 1
    }
    
    Write-Host "`n  [OK] Todos os pre-requisitos atendidos!" -ForegroundColor $C.Success
}

function Get-Configuration {
    if ($Silent) {
        Write-Step "[2/9] Modo silencioso - usando valores padrao..." $C.Info
        $script:ExtensionId = if ($script:ExtensionId) { $script:ExtensionId } else { $DEFAULT_EXTENSION_ID }
        $script:Manufacturer = if ($script:Manufacturer) { $script:Manufacturer } else { $DEFAULT_MANUFACTURER }
        Write-Host "  Extension ID: $($script:ExtensionId)" -ForegroundColor $C.Gray
        Write-Host "  Manufacturer: $($script:Manufacturer)" -ForegroundColor $C.Gray
        Write-Host "  CBCM Token: $(if ($script:CBCMToken) { '***fornecido***' } else { 'nao fornecido' })" -ForegroundColor $C.Gray
        return
    }
    
    Write-Step "[2/9] Coletando configuracoes..." $C.Info
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $C.Info
    Write-Host "  CONFIGURACAO DO INSTALADOR MSI" -ForegroundColor $C.Info
    Write-Host "========================================" -ForegroundColor $C.Info
    
    # Extension ID
    if (-not $script:ExtensionId) {
        $script:ExtensionId = Read-UserInput `
            -Prompt "Extension ID do Chrome:" `
            -Default $DEFAULT_EXTENSION_ID `
            -ValidationPattern "^[a-z]{32}$" `
            -ValidationMessage "Extension ID deve ter 32 caracteres minusculos (a-z)"
    }
    
    # Manufacturer
    if (-not $script:Manufacturer) {
        $script:Manufacturer = Read-UserInput `
            -Prompt "`nNome do Fabricante (Manufacturer):" `
            -Default $DEFAULT_MANUFACTURER
    }
    
    # CBCM Token (OBRIGATORIO)
    if (-not $script:CBCMToken) {
        Write-Host "`n========================================" -ForegroundColor $C.Warning
        Write-Host "  CBCM TOKEN OBRIGATORIO" -ForegroundColor $C.Warning
        Write-Host "========================================" -ForegroundColor $C.Warning
        Write-Host "  Token CBCM e OBRIGATORIO para instalar extensao off-store" -ForegroundColor $C.Error
        Write-Host "  Obtenha em: https://admin.google.com > Dispositivos > Chrome > Gerenciamento do navegador" -ForegroundColor $C.Gray
        Write-Host ""

        # Requisitar ate ser valido (>=5 chars)
        do {
            $script:CBCMToken = Read-UserInput `
                -Prompt "Token CBCM (OBRIGATORIO):" `
                -Default "" `
                -ValidationPattern ".{5,}" `
                -ValidationMessage "Token CBCM deve ter pelo menos 5 caracteres"
        } while ([string]::IsNullOrWhiteSpace($script:CBCMToken))
    }
    
    # Confirmar
    Write-Host "`n========================================" -ForegroundColor $C.Info
    Write-Host "  CONFIRMAR CONFIGURACAO" -ForegroundColor $C.Info
    Write-Host "========================================" -ForegroundColor $C.Info
    Write-Host "  Extension ID: $($script:ExtensionId)" -ForegroundColor $C.White
    Write-Host "  Manufacturer: $($script:Manufacturer)" -ForegroundColor $C.White
    Write-Host "  CBCM Token: $(if ($script:CBCMToken) { '***fornecido***' } else { '[ERRO: NAO FORNECIDO]' })" -ForegroundColor $(if ($script:CBCMToken) { $C.White } else { $C.Error })
    Write-Host ""
    Write-Host "Confirma estas configuracoes? (S/n): " -NoNewline -ForegroundColor $C.Warning
    
    $confirm = Read-Host
    if ($confirm -match "^[nN]") {
        Write-Host "`n[CANCELADO] Usuario cancelou a operacao" -ForegroundColor $C.Warning
        exit 0
    }
    
    Write-Host "`n[OK] Configuracao confirmada!" -ForegroundColor $C.Success
}

function Generate-AllGuids {
    Write-Step "[3/9] Gerando 34 GUIDs unicos..." $C.Info
    
    $guids = @{}
    $guids["UpgradeCode"] = [guid]::NewGuid().ToString().ToUpper()
    
    for ($i = 1; $i -le 34; $i++) {
        Show-Progress -Current $i -Total 34 -Activity "Gerando GUIDs"
        $guids["GUID_$i"] = [guid]::NewGuid().ToString().ToUpper()
        Start-Sleep -Milliseconds 10 # Pequena pausa para mostrar progresso
    }
    
    Write-Host "`n  [OK] 34 GUIDs gerados (UpgradeCode + 34 componentes)" -ForegroundColor $C.Success
    Write-Host "  Preview:" -ForegroundColor $C.Gray
    Write-Host "    UpgradeCode: {$($guids['UpgradeCode'])}" -ForegroundColor $C.Gray
    Write-Host "    GUID_1: {$($guids['GUID_1'])}" -ForegroundColor $C.Gray
    Write-Host "    GUID_34 (CBCM): {$($guids['GUID_34'])}" -ForegroundColor $C.Gray
    Write-Host "    ..." -ForegroundColor $C.Gray
    
    return $guids
}

function Fill-Placeholders {
    param([hashtable]$Guids)
    
    $totalPlaceholders = 0
    
    # Product.wxs (4 placeholders: Manufacturer, ExtensionId, UpgradeCode, CBCMToken)
    Write-Step "[4/9] Preenchendo Product.wxs..." $C.Info
    $productFile = Join-Path $WIX_DIR "Product.wxs"
    $content = Get-Content $productFile -Raw -Encoding UTF8
    
    $content = $content -replace '\[PREENCHER_NOME_EMPRESA\]', $script:Manufacturer
    $content = $content -replace '\[PREENCHER_EXTENSION_ID\]', $script:ExtensionId
    $content = $content -replace '\[PREENCHER_GUID_UPGRADE\]', $Guids["UpgradeCode"]
    $content = $content -replace '\[PREENCHER_CBCM_TOKEN\]', [regex]::Escape($script:CBCMToken)
    
    Set-Content $productFile $content -Encoding UTF8 -NoNewline
    $totalPlaceholders += 4
    Write-Host "  [OK] Product.wxs atualizado (4 placeholders) - Total: $totalPlaceholders/50" -ForegroundColor $C.Success
    
    # Files.wxs (18 GUIDs)
    Write-Step "[5/9] Preenchendo Files.wxs..." $C.Info
    $filesFile = Join-Path $WIX_DIR "Files.wxs"
    $content = Get-Content $filesFile -Raw -Encoding UTF8
    
    for ($i = 1; $i -le 18; $i++) {
        $content = $content -replace "\[PREENCHER_GUID_$i\]", $Guids["GUID_$i"]
    }
    
    Set-Content $filesFile $content -Encoding UTF8 -NoNewline
    $totalPlaceholders += 18
    Write-Host "  [OK] Files.wxs atualizado (18 GUIDs) - Total: $totalPlaceholders/50" -ForegroundColor $C.Success
    
    # Registry.wxs (12 Extension IDs + 16 GUIDs = 28 placeholders)
    Write-Step "[6/9] Preenchendo Registry.wxs..." $C.Info
    $registryFile = Join-Path $WIX_DIR "Registry.wxs"
    $content = Get-Content $registryFile -Raw -Encoding UTF8
    
    # Extension IDs
    $content = $content -replace '\[PREENCHER_EXTENSION_ID\]', $script:ExtensionId
    
    # GUIDs 19-34 (19-30 para navegadores + 31-34 para CBCM)
    for ($i = 19; $i -le 34; $i++) {
        $content = $content -replace "\[PREENCHER_GUID_$i\]", $Guids["GUID_$i"]
    }
    
    Set-Content $registryFile $content -Encoding UTF8 -NoNewline
    
    $extIdCount = ([regex]::Matches($content, $script:ExtensionId)).Count
    $totalPlaceholders += 28
    Write-Host "  [OK] Registry.wxs atualizado ($extIdCount Extension IDs + 16 GUIDs, incluindo CBCM) - Total: $totalPlaceholders/50" -ForegroundColor $C.Success
    
    # Validar
    $allContent = (Get-Content $productFile -Raw) + (Get-Content $filesFile -Raw) + (Get-Content $registryFile -Raw)
    $remaining = ([regex]::Matches($allContent, '\[PREENCHER_[^\]]+\]')).Count
    
    if ($remaining -gt 0) {
        Write-Host "`n[ERRO] Ainda existem $remaining placeholders nao preenchidos!" -ForegroundColor $C.Error
        $matches = [regex]::Matches($allContent, '\[PREENCHER_[^\]]+\]')
        Write-Host "  Placeholders restantes:" -ForegroundColor $C.Error
        foreach ($match in ($matches | Select-Object -Unique)) {
            Write-Host "    - $($match.Value)" -ForegroundColor $C.Error
        }
        exit 1
    }
    
    Write-Host "`n  [OK] Todos os 50 placeholders preenchidos com sucesso!" -ForegroundColor $C.Success
}

function Copy-ExtensionFiles {
    Write-Step "[7/9] Copiando arquivos da extensao Chrome..." $C.Info
    
    $extDest = Join-Path $SOURCE_DIR "extension"
    $iconsDest = Join-Path $extDest "icons"
    $scriptsDest = Join-Path $SOURCE_DIR "scripts"
    
    # Criar diretórios
    @($extDest, $iconsDest, $scriptsDest) | ForEach-Object {
        if (!(Test-Path $_)) { 
            New-Item -ItemType Directory -Path $_ | Out-Null 
        }
    }
    
    # Arquivos principais
    $mainFiles = @(
        "manifest.json", "background.js", "content.js", 
        "popup.html", "popup.js", "options.html", "options.js",
        "config.js", "debug-console.js", "service-worker-utils.js",
        "privacy-policy.html", "offscreen.html", "offscreen.js"
    )
    
    foreach ($file in $mainFiles) {
        Copy-Item (Join-Path $EXTENSION_SOURCE $file) $extDest -Force -ErrorAction SilentlyContinue
    }
    
    # Ícones
    Copy-Item (Join-Path $EXTENSION_SOURCE "icons\*") $iconsDest -Force
    
    # ChromeManager.ps1
    $chromeManager = Join-Path $INSTALLER_DIR "scripts\ChromeManager.ps1"
    Copy-Item $chromeManager $scriptsDest -Force
    
    Write-Host "  [OK] Arquivos copiados para source/" -ForegroundColor $C.Success
}

function Build-MsiPackage {
    Write-Step "[8/9] Compilando MSI com WiX Toolset..." $C.Info
    
    $originalDir = Get-Location
    
    try {
        Set-Location $INSTALLER_DIR
        
        # Compilar cada .wxs
        Write-Host "  - Compilando Product.wxs..." -ForegroundColor $C.Gray
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Product.wixobj" "source\wix\Product.wxs" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Product.wxs" }
        
        Write-Host "  - Compilando Files.wxs..." -ForegroundColor $C.Gray
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Files.wixobj" "source\wix\Files.wxs" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Files.wxs" }
        
        Write-Host "  - Compilando Registry.wxs..." -ForegroundColor $C.Gray
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Registry.wixobj" "source\wix\Registry.wxs" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Registry.wxs" }
        
        # Linkar
        Write-Host "  - Linkando MSI..." -ForegroundColor $C.Gray
        & "$WIX_PATH\light.exe" `
            -out "build\CorpMonitor.msi" `
            -ext WixUIExtension `
            -cultures:en-US `
            -spdb `
            "build\Product.wixobj" `
            "build\Files.wixobj" `
            "build\Registry.wixobj" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) { throw "Falha ao linkar MSI" }
        
        Write-Host "`n  [OK] MSI compilado com sucesso!" -ForegroundColor $C.Success
        
    } finally {
        Set-Location $originalDir
    }
}

function Generate-Hash {
    Write-Step "[9/9] Gerando hash SHA256..." $C.Info
    
    $msiPath = Join-Path $BUILD_DIR "CorpMonitor.msi"
    $hash = (Get-FileHash $msiPath -Algorithm SHA256).Hash
    
    Set-Content "$msiPath.sha256" "SHA256: $hash"
    Write-Host "  [OK] Hash: $hash" -ForegroundColor $C.Success
    
    return $hash
}

function Save-BuildLog {
    param([hashtable]$Guids, [string]$Hash)
    
    $logFile = Join-Path $BUILD_DIR "guids-used.json"
    
    $logData = @{
        BuildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Configuration = @{
            ExtensionId = $script:ExtensionId
            Manufacturer = $script:Manufacturer
            UpgradeCode = $Guids["UpgradeCode"]
            CBCMEnabled = if ($script:CBCMToken) { $true } else { $false }
            CBCMTokenEmbedded = $true
        }
        GUIDs = $Guids
        PlaceholdersFilled = 50
        MSIPath = "build/CorpMonitor.msi"
        SHA256 = $Hash
    }
    
    $logData | ConvertTo-Json -Depth 10 | Set-Content $logFile -Encoding UTF8
    Write-Host "`n  [INFO] Log salvo em: $logFile" -ForegroundColor $C.Info
}

function Test-Installation {
    Write-Step "`n[TESTE] Instalando MSI silenciosamente..." $C.Warning
    
    $msiPath = Join-Path $BUILD_DIR "CorpMonitor.msi"
    
    # Token CBCM ja esta embutido no MSI, nao precisa passar como parametro
    $msiParams = "/i `"$msiPath`" /qn /l*v `"$BUILD_DIR\install-test.log`""
    
    Write-Host "  [INFO] Token CBCM ja embutido no MSI..." -ForegroundColor $C.Info
    Write-Host "  Executando msiexec..." -ForegroundColor $C.Gray
    Start-Process msiexec.exe -ArgumentList $msiParams -Wait -NoNewWindow
    
    Start-Sleep -Seconds 2
    
    # Verificar arquivos
    $installPath = "C:\Program Files\CorpMonitor\Extension"
    if (Test-Path $installPath) {
        Write-Host "  [OK] Arquivos instalados em: $installPath" -ForegroundColor $C.Success
        
        # Verificar Registry - ExtensionInstallForcelist
        $regKey = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
        if (Test-Path $regKey) {
            Write-Host "  [OK] Registry Chrome ExtensionInstallForcelist configurado" -ForegroundColor $C.Success
        } else {
            Write-Host "  [AVISO] Registry Chrome ExtensionInstallForcelist NAO encontrado" -ForegroundColor $C.Warning
        }
        
        # Verificar Registry - CBCM Token
        if ($script:CBCMToken) {
            $cbcmKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
            $tokenValue = Get-ItemProperty -Path $cbcmKey -Name "CloudManagementEnrollmentToken" -ErrorAction SilentlyContinue
            if ($tokenValue) {
                Write-Host "  [OK] Token CBCM instalado no Registry" -ForegroundColor $C.Success
            } else {
                Write-Host "  [AVISO] Token CBCM NAO encontrado no Registry" -ForegroundColor $C.Warning
            }
        }
    } else {
        Write-Host "  [ERRO] Instalacao falhou!" -ForegroundColor $C.Error
        Write-Host "  Veja o log: $BUILD_DIR\install-test.log" -ForegroundColor $C.Gray
    }
    
    Write-Host "`n  Para desinstalar: msiexec /x `"$msiPath`" /qn" -ForegroundColor $C.Info
}

function Show-FinalReport {
    param([string]$Hash, [hashtable]$Guids)
    
    $msiPath = Join-Path $BUILD_DIR "CorpMonitor.msi"
    $msiSize = (Get-Item $msiPath).Length / 1MB
    
    Write-Host "`n========================================" -ForegroundColor $C.Success
    Write-Host " BUILD CONCLUIDO COM SUCESSO!" -ForegroundColor $C.Success
    Write-Host "========================================" -ForegroundColor $C.Success
    Write-Host ""
    Write-Host "Arquivos gerados:" -ForegroundColor $C.Info
    Write-Host "  [MSI] build\CorpMonitor.msi ($([math]::Round($msiSize, 2)) MB)" -ForegroundColor $C.White
    Write-Host "  [HASH] build\CorpMonitor.msi.sha256" -ForegroundColor $C.White
    Write-Host "  [LOG] build\guids-used.json" -ForegroundColor $C.White
    Write-Host ""
    Write-Host "Configuracao aplicada:" -ForegroundColor $C.Info
    Write-Host "  Extension ID: $($script:ExtensionId)" -ForegroundColor $C.White
    Write-Host "  Manufacturer: $($script:Manufacturer)" -ForegroundColor $C.White
    Write-Host "  UpgradeCode: {$($Guids['UpgradeCode'])}" -ForegroundColor $C.White
    Write-Host ""
    Write-Host "SHA256:" -ForegroundColor $C.Info
    Write-Host "  $Hash" -ForegroundColor $C.Gray
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor $C.Info
    Write-Host "  1. Testar instalacao:" -ForegroundColor $C.White
    Write-Host "     .\setup-and-build-msi.ps1 -Test" -ForegroundColor $C.Gray
    Write-Host ""
    Write-Host "  2. Assinar MSI (certificado):" -ForegroundColor $C.White
    Write-Host "     corpmonitor-installer\scripts\sign.bat" -ForegroundColor $C.Gray
    Write-Host ""
    Write-Host "  3. Deploy via GPO:" -ForegroundColor $C.White
    Write-Host "     Distribuir CorpMonitor.msi via Group Policy" -ForegroundColor $C.Gray
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $C.Success
}

# ===== EXECUÇÃO PRINCIPAL =====
try {
    $startTime = Get-Date
    
    # Banner
    if (!$Silent) {
        Show-Banner
    }
    
    # Limpar build anterior
    if ($Clean -and (Test-Path $BUILD_DIR)) {
        Write-Step "Limpando build anterior..." $C.Warning
        Remove-Item $BUILD_DIR -Recurse -Force
    }
    
    if (!(Test-Path $BUILD_DIR)) {
        New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
    }
    
    # Executar pipeline
    Test-Prerequisites
    Get-Configuration

    # Validar token CBCM obrigatorio
    if ([string]::IsNullOrWhiteSpace($script:CBCMToken)) {
        Write-Host "`n[ERRO] Token CBCM e obrigatorio! Forneca via parametro -CBCMToken ou no prompt interativo." -ForegroundColor $C.Error
        exit 1
    }

    $guids = Generate-AllGuids
    Fill-Placeholders -Guids $guids
    Copy-ExtensionFiles
    Build-MsiPackage
    $hash = Generate-Hash
    Save-BuildLog -Guids $guids -Hash $hash
    
    # Teste opcional
    if ($Test) {
        Test-Installation
    }
    
    # Relatório final
    $elapsed = (Get-Date) - $startTime
    Show-FinalReport -Hash $hash -Guids $guids
    Write-Host "Tempo total: $([math]::Round($elapsed.TotalSeconds)) segundos" -ForegroundColor $C.Gray
    Write-Host ""
    
} catch {
    Write-Host "`n========================================" -ForegroundColor $C.Error
    Write-Host " ERRO NO BUILD!" -ForegroundColor $C.Error
    Write-Host "========================================" -ForegroundColor $C.Error
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor $C.Error
    Write-Host ""
    Write-Host "Stack trace:" -ForegroundColor $C.Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor $C.Gray
    Write-Host ""
    Write-Host "Logs em: $BUILD_DIR" -ForegroundColor $C.Warning
    exit 1
}
