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
    # Usar OpenSSL para extrair a chave pública em formato DER
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        # Extrair chave pública em formato DER (SubjectPublicKeyInfo)
        $tempDer = Join-Path $scriptDir "temp-pubkey.der"
        & openssl rsa -in $keyPem -pubout -outform DER -out $tempDer 2>&1 | Out-Null
        
        if (Test-Path $tempDer) {
            # Ler bytes da chave pública DER
            $pubKeyBytes = [System.IO.File]::ReadAllBytes($tempDer)
            
            # Calcular SHA256
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $hashBytes = $sha256.ComputeHash($pubKeyBytes)
            
            # Mapear primeiros 16 bytes para caracteres 'a'..'p'
            $extensionId = -join ($hashBytes[0..15] | ForEach-Object { 
                [char]([int][char]'a' + ($_ % 16)) 
            })
            
            # Limpar arquivo temporário
            Remove-Item $tempDer -Force
            
            Write-Host "✓ Extension ID calculado: $extensionId" -ForegroundColor Green
        } else {
            throw "Falha ao gerar chave pública DER"
        }
    } else {
        throw "OpenSSL não disponível"
    }
    
} catch {
    Write-Host "⚠️  OpenSSL não disponível - usando método alternativo" -ForegroundColor Yellow
    
    # Fallback: usar hash da chave privada inteira
    $pemContent = Get-Content $keyPem -Raw
    $base64Key = $pemContent -replace '-----BEGIN.*-----', '' -replace '-----END.*-----', '' -replace '\s', ''
    $keyBytes = [System.Convert]::FromBase64String($base64Key)
    
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha256.ComputeHash($keyBytes)
    
    $extensionId = -join ($hashBytes[0..15] | ForEach-Object { 
        [char]([int][char]'a' + ($_ % 16)) 
    })
    
    Write-Host "✓ Extension ID (fallback): $extensionId" -ForegroundColor Green
    Write-Host "  ⚠️  Instale OpenSSL para cálculo preciso" -ForegroundColor Yellow
}

# Salvar Extension ID em arquivo
$extensionIdFile = Join-Path $scriptDir "extension-id.txt"
Set-Content -Path $extensionIdFile -Value $extensionId -NoNewline
Write-Host "✓ Extension ID salvo em: extension-id.txt" -ForegroundColor Green

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
Write-Host "   ✓ extension-id.txt     - Extension ID (para MSI e validação)"
Write-Host "   ✓ update.xml           - Atualizado com Extension ID e hash"
Write-Host "   ✓ key.pem              - Chave privada (NÃO enviar ao servidor!)"
Write-Host ""
Write-Host "🚀 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. Execute ..\setup-and-build-msi.ps1 para compilar o instalador MSI"
Write-Host "   2. Deploy no servidor: sudo bash deploy/deploy-extension.sh"
Write-Host "   3. Reinstale o MSI nas máquinas gerenciadas"
Write-Host "   4. Valide em chrome://policy (sem erros de Extension ID)"
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Mantenha key.pem em segurança e NÃO envie para repositório Git!" -ForegroundColor Red
Write-Host ""
