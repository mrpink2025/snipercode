# ============================================
# CorpMonitor MSI Builder - Automático
# ============================================
# Uso: .\build-msi.ps1
# Flags: -Test (testar instalação após build)
#        -Clean (limpar build anterior)
# ============================================

param(
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
$EXTENSION_ID = "pmdpfbglebnjlabbflpkjmnkejhjkmbo"
$COMPANY_NAME = "Alves Junior Maquinas e Equipamentos Ltda"

# ===== CORES =====
$SUCCESS = "Green"
$ERROR = "Red"
$INFO = "Cyan"
$WARN = "Yellow"

# ===== FUNÇÕES =====
function Write-Step {
    param([string]$Message, [string]$Color = $INFO)
    Write-Host "`n[$([DateTime]::Now.ToString('HH:mm:ss'))] $Message" -ForegroundColor $Color
}

function Test-WixInstalled {
    if (!(Test-Path "$WIX_PATH\candle.exe")) {
        Write-Host "`n[ERRO] WiX Toolset v3.14 não encontrado!" -ForegroundColor $ERROR
        Write-Host "Caminho esperado: $WIX_PATH" -ForegroundColor $ERROR
        Write-Host "`nBaixe de: https://github.com/wixtoolset/wix3/releases/tag/wix3141rtm" -ForegroundColor $WARN
        exit 1
    }
}

function Generate-Guids {
    Write-Step "Gerando 25 GUIDs únicos..." $INFO
    
    $guids = @{}
    $guids["UpgradeCode"] = [guid]::NewGuid().ToString().ToUpper()
    
    for ($i = 1; $i -le 24; $i++) {
        $guids["GUID_$i"] = [guid]::NewGuid().ToString().ToUpper()
    }
    
    Write-Host "✅ GUIDs gerados com sucesso" -ForegroundColor $SUCCESS
    return $guids
}

function Replace-Placeholders {
    param(
        [string]$FilePath,
        [hashtable]$Guids
    )
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    
    # Substituir dados fixos
    $content = $content -replace '\[PREENCHER_NOME_EMPRESA\]', $COMPANY_NAME
    $content = $content -replace '\[PREENCHER_EXTENSION_ID\]', $EXTENSION_ID
    $content = $content -replace '\[PREENCHER_GUID_UPGRADE\]', $Guids["UpgradeCode"]
    
    # Substituir GUIDs numerados
    for ($i = 1; $i -le 24; $i++) {
        $content = $content -replace "\[PREENCHER_GUID_$i\]", $Guids["GUID_$i"]
    }
    
    Set-Content $FilePath $content -Encoding UTF8 -NoNewline
}

function Copy-ExtensionFiles {
    Write-Step "Copiando arquivos da extensão..." $INFO
    
    $extDest = Join-Path $SOURCE_DIR "extension"
    $iconsDest = Join-Path $extDest "icons"
    
    if (!(Test-Path $extDest)) { New-Item -ItemType Directory -Path $extDest | Out-Null }
    if (!(Test-Path $iconsDest)) { New-Item -ItemType Directory -Path $iconsDest | Out-Null }
    
    # Arquivos principais
    Copy-Item "$EXTENSION_SOURCE\manifest.json" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\background.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\content.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\popup.html" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\popup.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\options.html" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\options.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\config.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\debug-console.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\service-worker-utils.js" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\privacy-policy.html" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\offscreen.html" $extDest -Force
    Copy-Item "$EXTENSION_SOURCE\offscreen.js" $extDest -Force
    
    # Ícones
    Copy-Item "$EXTENSION_SOURCE\icons\*" $iconsDest -Force
    
    Write-Host "✅ Arquivos copiados" -ForegroundColor $SUCCESS
}

function Build-Msi {
    param([hashtable]$Guids)
    
    Write-Step "Substituindo placeholders nos arquivos WiX..." $INFO
    
    Replace-Placeholders "$WIX_DIR\Product.wxs" $Guids
    Replace-Placeholders "$WIX_DIR\Files.wxs" $Guids
    Replace-Placeholders "$WIX_DIR\Registry.wxs" $Guids
    
    Write-Host "✅ Placeholders substituídos" -ForegroundColor $SUCCESS
    
    # Salvar diretório atual
    $originalDir = Get-Location
    
    try {
        # Mudar para diretório do instalador (onde os caminhos relativos funcionam)
        Set-Location $INSTALLER_DIR
        
        # Compilar
        Write-Step "Compilando Product.wxs..." $INFO
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Product.wixobj" "source\wix\Product.wxs"
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Product.wxs" }
        
        Write-Step "Compilando Files.wxs..." $INFO
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Files.wixobj" "source\wix\Files.wxs"
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Files.wxs" }
        
        Write-Step "Compilando Registry.wxs..." $INFO
        & "$WIX_PATH\candle.exe" -arch x64 -out "build\Registry.wixobj" "source\wix\Registry.wxs"
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Registry.wxs" }
        
        Write-Step "Linkando objetos WiX..." $INFO
        & "$WIX_PATH\light.exe" `
            -out "build\CorpMonitor.msi" `
            -ext WixUIExtension `
            -cultures:en-US `
            -spdb `
            "build\Product.wixobj" `
            "build\Files.wixobj" `
            "build\Registry.wixobj"
        
        if ($LASTEXITCODE -ne 0) { throw "Falha ao linkar MSI" }
        
        Write-Host "✅ MSI compilado com sucesso" -ForegroundColor $SUCCESS
        
    } finally {
        # Restaurar diretório original
        Set-Location $originalDir
    }
}

function Generate-Hash {
    Write-Step "Gerando hash SHA256..." $INFO
    
    $msiPath = Join-Path $BUILD_DIR "CorpMonitor.msi"
    $hash = (Get-FileHash $msiPath -Algorithm SHA256).Hash
    
    Set-Content "$msiPath.sha256" "SHA256: $hash"
    Write-Host "✅ Hash: $hash" -ForegroundColor $SUCCESS
}

function Test-Installation {
    Write-Step "Testando instalação silenciosa..." $WARN
    
    $msiPath = Join-Path $BUILD_DIR "CorpMonitor.msi"
    
    Write-Host "Instalando MSI..." -ForegroundColor $INFO
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /l*v `"$BUILD_DIR\install.log`"" -Wait -NoNewWindow
    
    # Verificar arquivos
    $installPath = "C:\Program Files\CorpMonitor\Extension"
    if (Test-Path $installPath) {
        Write-Host "✅ Arquivos instalados em: $installPath" -ForegroundColor $SUCCESS
        
        # Verificar Registry
        $regKey = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
        if (Test-Path $regKey) {
            Write-Host "✅ Registry Chrome configurado" -ForegroundColor $SUCCESS
        } else {
            Write-Host "⚠️ Registry Chrome NÃO encontrado" -ForegroundColor $WARN
        }
    } else {
        Write-Host "❌ Instalação falhou!" -ForegroundColor $ERROR
    }
    
    Write-Host "`nPara desinstalar: msiexec /x `"$msiPath`" /qn" -ForegroundColor $INFO
}

# ===== EXECUÇÃO PRINCIPAL =====
try {
    Write-Host "`n========================================" -ForegroundColor $INFO
    Write-Host " CorpMonitor MSI Builder v2.0 (Auto)" -ForegroundColor $INFO
    Write-Host "========================================" -ForegroundColor $INFO
    
    # Validações
    Test-WixInstalled
    
    if (!(Test-Path $EXTENSION_SOURCE)) {
        Write-Host "`n[ERRO] Pasta chrome-extension não encontrada!" -ForegroundColor $ERROR
        Write-Host "Caminho esperado: $EXTENSION_SOURCE" -ForegroundColor $ERROR
        exit 1
    }
    
    # Limpar build anterior
    if ($Clean -and (Test-Path $BUILD_DIR)) {
        Write-Step "Limpando build anterior..." $WARN
        Remove-Item $BUILD_DIR -Recurse -Force
    }
    
    if (!(Test-Path $BUILD_DIR)) {
        New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
    }
    
    # Gerar GUIDs
    $guids = Generate-Guids
    
    # Salvar GUIDs em arquivo (para referência)
    $guidsFile = Join-Path $BUILD_DIR "guids-used.json"
    $guids | ConvertTo-Json | Set-Content $guidsFile -Encoding UTF8
    
    # Copiar arquivos
    Copy-ExtensionFiles
    
    # Compilar MSI
    Build-Msi -Guids $guids
    
    # Gerar hash
    Generate-Hash
    
    # Testar (opcional)
    if ($Test) {
        Test-Installation
    }
    
    # Sucesso
    Write-Host "`n========================================" -ForegroundColor $SUCCESS
    Write-Host " BUILD CONCLUÍDO COM SUCESSO!" -ForegroundColor $SUCCESS
    Write-Host "========================================" -ForegroundColor $SUCCESS
    Write-Host "`nArquivos gerados:" -ForegroundColor $INFO
    Write-Host "  MSI: $BUILD_DIR\CorpMonitor.msi" -ForegroundColor $SUCCESS
    Write-Host "  SHA256: $BUILD_DIR\CorpMonitor.msi.sha256" -ForegroundColor $SUCCESS
    Write-Host "  GUIDs: $BUILD_DIR\guids-used.json" -ForegroundColor $SUCCESS
    Write-Host "`nPróximos passos:" -ForegroundColor $INFO
    Write-Host "  1. Testar: .\build-msi.ps1 -Test" -ForegroundColor $WARN
    Write-Host "  2. Assinar: corpmonitor-installer\scripts\sign.bat" -ForegroundColor $WARN
    Write-Host "  3. Deploy GPO: Deploy via GPO no domínio" -ForegroundColor $WARN
    
} catch {
    Write-Host "`n========================================" -ForegroundColor $ERROR
    Write-Host " ERRO NA COMPILAÇÃO!" -ForegroundColor $ERROR
    Write-Host "========================================" -ForegroundColor $ERROR
    Write-Host "`n$_" -ForegroundColor $ERROR
    Write-Host "`nLogs em: $BUILD_DIR" -ForegroundColor $WARN
    exit 1
}
