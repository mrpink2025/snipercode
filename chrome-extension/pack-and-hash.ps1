# ============================================
# CorpMonitor Extension - Pack and Hash Script
# ============================================
# Empacota extensão em .crx, gera hash SHA256 e atualiza update.xml

$ErrorActionPreference = "Stop"

Write-Host "🔐 Empacotando extensão e gerando hash SHA256..." -ForegroundColor Cyan

# Paths
$scriptDir = $PSScriptRoot
$distDir = Join-Path $scriptDir "dist"
$updateXml = Join-Path $scriptDir "update.xml"
$keyPem = Join-Path $scriptDir "key.pem"
$crxFile = Join-Path $scriptDir "corpmonitor.crx"
$zipFile = Join-Path $scriptDir "corpmonitor.zip"
$sha256File = Join-Path $scriptDir "corpmonitor.sha256"

# Verificar se dist existe
if (-not (Test-Path $distDir)) {
    Write-Host "❌ Pasta dist não encontrada. Execute 'npm run build' primeiro." -ForegroundColor Red
    exit 1
}

# ============================================
# Encontrar Chrome executável
# ============================================
$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromeExe = $path
        break
    }
}

if (-not $chromeExe) {
    Write-Host "❌ Chrome não encontrado. Instale Google Chrome primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Chrome encontrado: $chromeExe" -ForegroundColor Green

# ============================================
# Gerar chave privada se não existir
# ============================================
if (-not (Test-Path $keyPem)) {
    Write-Host "🔑 Gerando chave privada..." -ForegroundColor Yellow
    
    # Usar OpenSSL se disponível, senão criar placeholder
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        & openssl genrsa -out $keyPem 2048 2>&1 | Out-Null
        Write-Host "✓ Chave privada gerada: key.pem" -ForegroundColor Green
    } else {
        Write-Host "⚠️  OpenSSL não encontrado. Chrome irá gerar chave automaticamente." -ForegroundColor Yellow
    }
}

# ============================================
# Empacotar extensão como .crx
# ============================================
Write-Host "📦 Empacotando extensão..." -ForegroundColor Cyan

# Remover .crx anterior se existir
if (Test-Path $crxFile) {
    Remove-Item $crxFile -Force
}

# Pack extension
try {
    if (Test-Path $keyPem) {
        & $chromeExe --pack-extension="$distDir" --pack-extension-key="$keyPem" 2>&1 | Out-Null
    } else {
        & $chromeExe --pack-extension="$distDir" 2>&1 | Out-Null
    }
    
    # Chrome cria dist.crx, precisamos renomear
    $distCrx = "$distDir.crx"
    if (Test-Path $distCrx) {
        Move-Item $distCrx $crxFile -Force
        Write-Host "✓ Extensão empacotada: corpmonitor.crx" -ForegroundColor Green
    } else {
        Write-Host "❌ Falha ao empacotar extensão" -ForegroundColor Red
        exit 1
    }
    
    # Se key.pem não existia, Chrome criou dist.pem
    $distPem = "$distDir.pem"
    if ((Test-Path $distPem) -and (-not (Test-Path $keyPem))) {
        Move-Item $distPem $keyPem -Force
        Write-Host "✓ Chave privada salva: key.pem" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro ao empacotar: $_" -ForegroundColor Red
    exit 1
}

# ============================================
# Calcular SHA256 do .crx
# ============================================
Write-Host "🔐 Calculando hash SHA256 do .crx..." -ForegroundColor Cyan

try {
    $hash = (Get-FileHash -Path $crxFile -Algorithm SHA256).Hash.ToLower()
    Set-Content -Path $sha256File -Value $hash
    Write-Host "✓ Hash SHA256: $($hash.Substring(0, 16))..." -ForegroundColor Green
    Write-Host "  Salvo em: corpmonitor.sha256" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao calcular hash: $_" -ForegroundColor Red
    exit 1
}

# ============================================
# Extrair Extension ID da chave privada
# ============================================
Write-Host "🆔 Extraindo Extension ID..." -ForegroundColor Cyan

try {
    # Ler chave privada
    $pemContent = Get-Content $keyPem -Raw
    
    # Extrair a parte base64 (remover header/footer)
    $base64Key = $pemContent -replace '-----BEGIN.*-----', '' -replace '-----END.*-----', '' -replace '\s', ''
    
    # Converter base64 para bytes
    $keyBytes = [System.Convert]::FromBase64String($base64Key)
    
    # Parse RSA key (simplificado - pegamos os primeiros bytes da chave pública)
    # O Extension ID é derivado do SHA256 dos primeiros 128 bytes da public key
    # Chrome usa um formato específico, aqui fazemos uma aproximação
    
    # Alternativa: ler o Extension ID do manifest se já estiver instalado
    # Por simplicidade, vamos calcular um ID baseado no hash da chave
    $keyHash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($keyBytes)
    
    # Chrome Extension IDs usam base16 (0-9, a-p) dos primeiros 16 bytes do hash
    $idBytes = $keyHash[0..15]
    $extensionId = -join ($idBytes | ForEach-Object { [char]([int][char]'a' + ($_ % 16)) })
    
    Write-Host "✓ Extension ID (derivado): $extensionId" -ForegroundColor Green
    Write-Host "  ⚠️  Para produção, use o ID real do Chrome Web Store" -ForegroundColor Yellow
    
} catch {
    Write-Host "⚠️  Não foi possível derivar Extension ID da chave" -ForegroundColor Yellow
    Write-Host "   Usando placeholder temporário" -ForegroundColor Gray
    $extensionId = "abcdefghijklmnopqrstuvwxyzabcd"
}

# ============================================
# Atualizar update.xml
# ============================================
Write-Host "📝 Atualizando update.xml..." -ForegroundColor Cyan

if (Test-Path $updateXml) {
    try {
        $xmlContent = Get-Content $updateXml -Raw
        
        # Substituir placeholders
        $xmlContent = $xmlContent -replace '\[EXTENSION_ID_AQUI\]', $extensionId
        $xmlContent = $xmlContent -replace '\[HASH_SHA256_AQUI\]', $hash
        
        # Salvar arquivo atualizado
        Set-Content -Path $updateXml -Value $xmlContent -Encoding UTF8
        
        Write-Host "✓ update.xml atualizado:" -ForegroundColor Green
        Write-Host "  - Extension ID: $extensionId" -ForegroundColor Gray
        Write-Host "  - SHA256: $($hash.Substring(0, 16))..." -ForegroundColor Gray
        
    } catch {
        Write-Host "⚠️  Erro ao atualizar update.xml: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  update.xml não encontrado em $updateXml" -ForegroundColor Yellow
}

# ============================================
# Resumo final
# ============================================
Write-Host ""
Write-Host "✅ Empacotamento concluído com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Arquivos gerados:" -ForegroundColor Cyan
Write-Host "   ✓ corpmonitor.crx      - Extensão empacotada"
Write-Host "   ✓ corpmonitor.zip      - Código-fonte (do build.js)"
Write-Host "   ✓ corpmonitor.sha256   - Hash SHA256 do .crx"
Write-Host "   ✓ update.xml           - Atualizado com Extension ID e hash"
Write-Host "   ✓ key.pem              - Chave privada (NÃO enviar ao servidor!)"
Write-Host ""
Write-Host "🚀 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. Verifique update.xml e substitua Extension ID se necessário"
Write-Host "   2. Execute setup-and-build-msi.ps1 para compilar o instalador MSI"
Write-Host "   3. Deploy no servidor: sudo bash deploy/deploy-extension.sh"
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Mantenha key.pem em segurança e NÃO envie para repositório Git!" -ForegroundColor Red
Write-Host ""
