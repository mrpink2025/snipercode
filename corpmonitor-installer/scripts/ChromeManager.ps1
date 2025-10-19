param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('Close','Reopen')]
    [string]$Action,
    
    [string]$LogFile = "$env:TEMP\CorpMonitor-Install.log"
)

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

function Get-BrowserProcesses {
    # Chromium-based browsers (browser.exe = Yandex)
    return Get-Process -Name chrome, msedge, brave, opera, vivaldi, browser -ErrorAction SilentlyContinue
}

function Close-Browsers {
    Write-Log "=== Iniciando fechamento de navegadores ==="
    
    $processes = Get-BrowserProcesses
    if ($processes.Count -eq 0) {
        Write-Log "Nenhum navegador Chromium encontrado em execução"
        return 0
    }
    
    Write-Log "Encontrados $($processes.Count) processos: $($processes.Name -join ', ')"
    
    # Tentar fechar gracefully (SIGTERM)
    foreach ($proc in $processes) {
        try {
            Write-Log "Fechando $($proc.Name) (PID: $($proc.Id))"
            $proc.CloseMainWindow() | Out-Null
        } catch {
            Write-Log "Aviso: Erro ao fechar $($proc.Name): $_"
        }
    }
    
    # Aguardar 3 segundos
    Write-Log "Aguardando 3 segundos para fechamento graceful..."
    Start-Sleep -Seconds 3
    
    # Verificar processos restantes
    $remaining = Get-BrowserProcesses
    if ($remaining) {
        Write-Log "Forçando fechamento de $($remaining.Count) processos restantes"
        Stop-Process -Name chrome, msedge, brave, opera, vivaldi, browser -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Verificação final
    $final = Get-BrowserProcesses
    if ($final) {
        Write-Log "AVISO: $($final.Count) processos ainda ativos: $($final.Name -join ', ')"
        return 1
    }
    
    Write-Log "✅ Todos os navegadores fechados com sucesso"
    return 0
}

function Reopen-Chrome {
    Write-Log "=== Tentando reabrir Chrome ==="
    
    # Caminhos possíveis do Chrome
    $chromePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    
    $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($chromePath) {
        Write-Log "Chrome encontrado: $chromePath"
        try {
            # Iniciar Chrome sem janelas específicas (carrega perfil padrão)
            Start-Process $chromePath -WindowStyle Normal
            Write-Log "✅ Chrome reaberto com sucesso"
            return 0
        } catch {
            Write-Log "Erro ao reabrir Chrome: $_"
            return 1
        }
    }
    
    # Tentar Edge como fallback
    $edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $edgePath) {
        Write-Log "Chrome não encontrado, usando Edge: $edgePath"
        try {
            Start-Process $edgePath -WindowStyle Normal
            Write-Log "✅ Edge reaberto com sucesso"
            return 0
        } catch {
            Write-Log "Erro ao reabrir Edge: $_"
            return 1
        }
    }
    
    Write-Log "❌ Nenhum navegador Chromium encontrado para reabrir"
    return 1
}

# ===== EXECUÇÃO PRINCIPAL =====
try {
    Write-Log ""
    Write-Log "========================================="
    Write-Log "ChromeManager - Action: $Action"
    Write-Log "========================================="
    
    $exitCode = 0
    
    switch ($Action) {
        'Close' {
            $exitCode = Close-Browsers
        }
        'Reopen' {
            $exitCode = Reopen-Chrome
        }
    }
    
    Write-Log "Operação '$Action' concluída com código: $exitCode"
    Write-Log "========================================="
    exit $exitCode
    
} catch {
    Write-Log "ERRO FATAL: $_"
    Write-Log "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}
