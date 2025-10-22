# ========================================
# CorpMonitor Restore Script v1.0
# ========================================
# Restaura políticas de GPO a partir de backup
#
# Uso:
#   .\restore-from-backup.ps1 -BackupFolder "C:\CorpMonitor_Backup\2025-10-22_15-30-45"

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFolder,
    
    [switch]$Force
)

# ========================================
# Funções Auxiliares
# ========================================

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    switch ($Level) {
        "SUCCESS" { Write-Host "[✓] $Message" -ForegroundColor Green }
        "ERROR"   { Write-Host "[✗] $Message" -ForegroundColor Red }
        "WARNING" { Write-Host "[!] $Message" -ForegroundColor Yellow }
        default   { Write-Host "[→] $Message" -ForegroundColor Cyan }
    }
}

# ========================================
# MAIN EXECUTION
# ========================================

Clear-Host

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " CorpMonitor Restore Script v1.0" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar privilégios administrativos
if (-not (Test-Administrator)) {
    Write-Host "[✗] ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Log "Verificando privilégios administrativos..." -Level SUCCESS
Write-Host ""

# Verificar se a pasta de backup existe
if (-not (Test-Path $BackupFolder)) {
    Write-Log "ERRO: Pasta de backup não encontrada: $BackupFolder" -Level ERROR
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Log "Pasta de backup encontrada: $BackupFolder" -Level SUCCESS
Write-Host ""

# Listar arquivos .reg no backup
$regFiles = Get-ChildItem -Path $BackupFolder -Filter "*.reg" -ErrorAction SilentlyContinue

if ($regFiles.Count -eq 0) {
    Write-Log "ERRO: Nenhum arquivo .reg encontrado no backup!" -Level ERROR
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Log "Arquivos de backup encontrados:" -Level INFO
foreach ($file in $regFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor White
}
Write-Host ""

# Confirmar restauração
if (-not $Force) {
    Write-Host "⚠️  ATENÇÃO: Esta operação irá RESTAURAR as políticas de GPO!" -ForegroundColor Yellow
    Write-Host "   As extensões serão forçadas novamente nos navegadores." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Deseja continuar? (S/N)"
    
    if ($confirm -ne "S" -and $confirm -ne "s") {
        Write-Log "Restauração cancelada pelo usuário" -Level WARNING
        exit 0
    }
}

Write-Host ""
Write-Log "Iniciando restauração..." -Level INFO
Write-Host ""

# Restaurar cada arquivo .reg
$successCount = 0
$errorCount = 0

foreach ($regFile in $regFiles) {
    $filePath = $regFile.FullName
    $fileName = $regFile.Name
    
    try {
        Write-Host "  [→] Importando $fileName..." -ForegroundColor Cyan -NoNewline
        
        if ($PSCmdlet.ShouldProcess($filePath, "Importar registro")) {
            # Usar reg.exe para importar
            $output = & reg import $filePath 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host " ✓" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host " ✗" -ForegroundColor Red
                Write-Log "Erro ao importar $fileName : $output" -Level ERROR
                $errorCount++
            }
        }
    } catch {
        Write-Host " ✗" -ForegroundColor Red
        Write-Log "Exceção ao importar $fileName : $($_.Exception.Message)" -Level ERROR
        $errorCount++
    }
}

Write-Host ""

# Atualizar Group Policy
Write-Log "Atualizando políticas de grupo..." -Level INFO

try {
    if ($PSCmdlet.ShouldProcess("Group Policy", "Atualizar")) {
        $null = & gpupdate /force 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Políticas de grupo atualizadas com sucesso" -Level SUCCESS
        } else {
            Write-Log "gpupdate retornou código $LASTEXITCODE" -Level WARNING
        }
    }
} catch {
    Write-Log "Erro ao atualizar políticas de grupo: $($_.Exception.Message)" -Level ERROR
}

Write-Host ""

# Resumo final
Write-Host "=========================================" -ForegroundColor Cyan
if ($errorCount -eq 0) {
    Write-Host "✓ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
} else {
    Write-Host "⚠ RESTAURAÇÃO CONCLUÍDA COM AVISOS" -ForegroundColor Yellow
}
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Estatísticas:" -ForegroundColor Cyan
Write-Host "  - Arquivos importados: $successCount" -ForegroundColor Green
Write-Host "  - Erros encontrados: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Reinicie os navegadores" -ForegroundColor White
Write-Host "  2. Verifique chrome://policy/ (políticas devem aparecer)" -ForegroundColor White
Write-Host "  3. Verifique chrome://extensions/ (CorpMonitor deve estar instalado)" -ForegroundColor White
Write-Host ""

Read-Host "Pressione Enter para sair"
