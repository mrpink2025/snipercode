# ========================================
# CorpMonitor GPO Cleanup Script v1.0
# ========================================
# Remove todas as políticas de grupo e registros do CorpMonitor
# Deixa Chrome, Edge e Yandex Browser completamente limpos
#
# Uso:
#   .\clean-corpmonitor-gpo.ps1                    # Limpeza interativa
#   .\clean-corpmonitor-gpo.ps1 -Force             # Sem confirmações
#   .\clean-corpmonitor-gpo.ps1 -WhatIf            # Simular (não executa)
#   .\clean-corpmonitor-gpo.ps1 -ExtensionId "..." # ID customizado

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$ExtensionId = "",
    [switch]$Force,
    [switch]$KeepBackup,
    [string]$BackupPath = "C:\CorpMonitor_Backup",
    [string]$LogFile = "C:\CorpMonitor_Cleanup.log"
)

# ========================================
# Variáveis Globais
# ========================================
$script:CleanupLog = @()
$script:ErrorCount = 0
$script:SuccessCount = 0

# IDs de extensão comuns do CorpMonitor (tentar detectar automaticamente)
$CommonExtensionIds = @(
    "abcdefghijklmnopqrstuvwxyz123456",  # Placeholder - será detectado
    "phkmkmmdpnkhcpfbglgacbfmkkfphhpe"   # Exemplo de ID Chrome
)

# ========================================
# Função: Write-Log
# ========================================
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Adicionar ao array de logs
    $script:CleanupLog += $logEntry
    
    # Escrever no console com cores
    switch ($Level) {
        "SUCCESS" { Write-Host "[✓] $Message" -ForegroundColor Green }
        "ERROR"   { Write-Host "[✗] $Message" -ForegroundColor Red; $script:ErrorCount++ }
        "WARNING" { Write-Host "[!] $Message" -ForegroundColor Yellow }
        default   { Write-Host "[→] $Message" -ForegroundColor Cyan }
    }
    
    # Escrever no arquivo de log
    Add-Content -Path $LogFile -Value $logEntry -ErrorAction SilentlyContinue
}

# ========================================
# Função: Test-Administrator
# ========================================
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ========================================
# Função: Get-BrowserProcesses
# ========================================
function Get-BrowserProcesses {
    $browsers = @("chrome", "msedge", "browser", "opera", "brave", "vivaldi", "yandex")
    $processes = @()
    
    foreach ($browser in $browsers) {
        $procs = Get-Process -Name $browser -ErrorAction SilentlyContinue
        if ($procs) {
            $processes += $procs
        }
    }
    
    return $processes
}

# ========================================
# Função: Close-BrowserProcesses
# ========================================
function Close-BrowserProcesses {
    param([switch]$Force)
    
    $processes = Get-BrowserProcesses
    
    if ($processes.Count -eq 0) {
        Write-Log "Nenhum processo de navegador detectado" -Level INFO
        return $true
    }
    
    # Agrupar por nome
    $grouped = $processes | Group-Object -Property ProcessName
    Write-Log "Detectados $($processes.Count) processos de navegador ativos:" -Level WARNING
    foreach ($group in $grouped) {
        Write-Host "    - $($group.Name).exe ($($group.Count) processo(s))" -ForegroundColor Yellow
    }
    
    if (-not $Force -and -not $PSCmdlet.ShouldProcess("Fechar navegadores", "Confirmar", "Fechar todos os navegadores?")) {
        $response = Read-Host "Fechar navegadores agora? (S/N)"
        if ($response -ne "S" -and $response -ne "s") {
            Write-Log "Limpeza cancelada pelo usuário" -Level WARNING
            return $false
        }
    }
    
    # Tentar fechar graciosamente primeiro
    Write-Log "Tentando fechar navegadores graciosamente..." -Level INFO
    foreach ($proc in $processes) {
        try {
            $proc.CloseMainWindow() | Out-Null
        } catch {
            # Ignorar erros
        }
    }
    
    Start-Sleep -Seconds 3
    
    # Forçar fechamento se ainda houver processos
    $remainingProcesses = Get-BrowserProcesses
    if ($remainingProcesses.Count -gt 0) {
        Write-Log "Forçando fechamento de $($remainingProcesses.Count) processo(s)..." -Level WARNING
        foreach ($proc in $remainingProcesses) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Log "Processo $($proc.ProcessName) (PID: $($proc.Id)) encerrado" -Level SUCCESS
            } catch {
                Write-Log "Falha ao encerrar $($proc.ProcessName) (PID: $($proc.Id)): $($_.Exception.Message)" -Level ERROR
            }
        }
    }
    
    Start-Sleep -Seconds 2
    
    # Verificar se todos foram fechados
    $finalCheck = Get-BrowserProcesses
    if ($finalCheck.Count -eq 0) {
        Write-Log "Todos os navegadores foram fechados com sucesso" -Level SUCCESS
        $script:SuccessCount++
        return $true
    } else {
        Write-Log "Ainda há $($finalCheck.Count) processo(s) de navegador ativos" -Level ERROR
        return $false
    }
}

# ========================================
# Função: Backup-RegistryKeys
# ========================================
function Backup-RegistryKeys {
    param([string]$BackupFolder)
    
    Write-Log "Criando backup de chaves de registro..." -Level INFO
    
    $registryPaths = @(
        "HKLM:\SOFTWARE\Policies\Google\Chrome",
        "HKLM:\SOFTWARE\Policies\Microsoft\Edge",
        "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Microsoft\Edge",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Yandex\YandexBrowser"
    )
    
    $backupCount = 0
    
    foreach ($regPath in $registryPaths) {
        if (Test-Path $regPath) {
            $browserName = $regPath -replace '.*\\Policies\\([^\\]+).*', '$1'
            $arch = if ($regPath -like "*Wow6432Node*") { "32bit" } else { "64bit" }
            $filename = "$browserName-$arch.reg"
            $backupFile = Join-Path $BackupFolder $filename
            
            try {
                # Converter caminho do PowerShell para formato reg.exe
                $regExportPath = $regPath -replace "HKLM:", "HKEY_LOCAL_MACHINE"
                
                # Exportar via reg.exe
                $null = & reg export $regExportPath $backupFile /y 2>&1
                
                if (Test-Path $backupFile) {
                    Write-Log "✓ Backup: $filename" -Level SUCCESS
                    $backupCount++
                } else {
                    Write-Log "Falha no backup de $browserName ($arch)" -Level WARNING
                }
            } catch {
                Write-Log "Erro ao fazer backup de $regPath: $($_.Exception.Message)" -Level ERROR
            }
        }
    }
    
    Write-Log "Backup concluído: $backupCount arquivo(s) salvos em $BackupFolder" -Level SUCCESS
    $script:SuccessCount++
}

# ========================================
# Função: Detect-ExtensionId
# ========================================
function Detect-ExtensionId {
    Write-Log "Tentando detectar Extension ID automaticamente..." -Level INFO
    
    $possiblePaths = @(
        "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist",
        "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionInstallForcelist"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $values = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            if ($values) {
                foreach ($prop in $values.PSObject.Properties) {
                    if ($prop.Name -notmatch "^PS") {
                        $value = $prop.Value
                        # Formato esperado: "extensionid;updateurl"
                        if ($value -match "^([a-z]{32});") {
                            $foundId = $matches[1]
                            Write-Log "Extension ID detectado: $foundId" -Level SUCCESS
                            return $foundId
                        }
                    }
                }
            }
        }
    }
    
    Write-Log "Extension ID não detectado automaticamente. Use -ExtensionId para especificar" -Level WARNING
    return $null
}

# ========================================
# Função: Remove-RegistryPolicy
# ========================================
function Remove-RegistryPolicy {
    param(
        [string]$Path,
        [string]$ValueName = $null,
        [string]$Description = ""
    )
    
    if (-not (Test-Path $Path)) {
        Write-Log "Não encontrado: $Description" -Level INFO
        return
    }
    
    try {
        if ($PSCmdlet.ShouldProcess($Path, "Remover $Description")) {
            if ($ValueName) {
                # Remover valor específico
                Remove-ItemProperty -Path $Path -Name $ValueName -ErrorAction Stop
                Write-Log "Removido: $Description" -Level SUCCESS
            } else {
                # Remover chave inteira
                Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
                Write-Log "Removido: $Description" -Level SUCCESS
            }
            $script:SuccessCount++
        }
    } catch {
        Write-Log "Erro ao remover $Description : $($_.Exception.Message)" -Level ERROR
    }
}

# ========================================
# Função: Remove-AllRegistryPolicies
# ========================================
function Remove-AllRegistryPolicies {
    param([string]$ExtensionId)
    
    Write-Log "Removendo políticas de registro..." -Level INFO
    Write-Host ""
    
    # Google Chrome - 64-bit
    Write-Host "  [Chrome 64-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" `
                          -Description "Chrome ExtensionInstallForcelist (64-bit)"
    
    if ($ExtensionId) {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionSettings\$ExtensionId" `
                              -Description "Chrome ExtensionSettings/$ExtensionId (64-bit)"
    } else {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionSettings" `
                              -Description "Chrome ExtensionSettings (64-bit)"
    }
    
    # Google Chrome - 32-bit (Wow6432Node)
    Write-Host "  [Chrome 32-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionInstallForcelist" `
                          -Description "Chrome ExtensionInstallForcelist (32-bit)"
    
    if ($ExtensionId) {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionSettings\$ExtensionId" `
                              -Description "Chrome ExtensionSettings/$ExtensionId (32-bit)"
    } else {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionSettings" `
                              -Description "Chrome ExtensionSettings (32-bit)"
    }
    
    # Microsoft Edge - 64-bit
    Write-Host "  [Edge 64-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" `
                          -Description "Edge ExtensionInstallForcelist (64-bit)"
    
    if ($ExtensionId) {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionSettings\$ExtensionId" `
                              -Description "Edge ExtensionSettings/$ExtensionId (64-bit)"
    } else {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionSettings" `
                              -Description "Edge ExtensionSettings (64-bit)"
    }
    
    # Microsoft Edge - 32-bit
    Write-Host "  [Edge 32-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Microsoft\Edge\ExtensionInstallForcelist" `
                          -Description "Edge ExtensionInstallForcelist (32-bit)"
    
    if ($ExtensionId) {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Microsoft\Edge\ExtensionSettings\$ExtensionId" `
                              -Description "Edge ExtensionSettings/$ExtensionId (32-bit)"
    }
    
    # Yandex Browser - 64-bit
    Write-Host "  [Yandex 64-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser\ExtensionInstallForcelist" `
                          -Description "Yandex ExtensionInstallForcelist (64-bit)"
    
    if ($ExtensionId) {
        Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser\ExtensionSettings\$ExtensionId" `
                              -Description "Yandex ExtensionSettings/$ExtensionId (64-bit)"
    }
    
    # Yandex Browser - 32-bit
    Write-Host "  [Yandex 32-bit]" -ForegroundColor Cyan
    Remove-RegistryPolicy -Path "HKLM:\SOFTWARE\Wow6432Node\Policies\Yandex\YandexBrowser\ExtensionInstallForcelist" `
                          -Description "Yandex ExtensionInstallForcelist (32-bit)"
    
    Write-Host ""
}

# ========================================
# Função: Remove-CBCMPolicies
# ========================================
function Remove-CBCMPolicies {
    Write-Log "Removendo TODAS as políticas do CBCM..." -Level INFO
    Write-Host ""
    Write-Host "  [CBCM - Chrome Browser Cloud Management]" -ForegroundColor Cyan
    
    # Lista completa de políticas do CBCM que podem existir
    $cbcmPolicies = @(
        "CloudManagementEnrollmentToken",
        "CloudManagementEnrollmentMandatory",
        "CloudPolicyOverridesPlatformPolicy",
        "CloudReportingEnabled",
        "CloudPolicySettingEnabled",
        "CloudManagementServiceUrl",
        "MachineLevelUserCloudPolicyEnrollmentToken",
        "BrowserSignin",
        "SyncDisabled",
        "ForceEphemeralProfiles",
        "BrowserSwitcherEnabled"
    )
    
    # Remover valores individuais - 64-bit
    $chromePath64 = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    if (Test-Path $chromePath64) {
        foreach ($policy in $cbcmPolicies) {
            Remove-RegistryPolicy -Path $chromePath64 `
                                  -ValueName $policy `
                                  -Description "CBCM $policy (64-bit)"
        }
    }
    
    # Remover valores individuais - 32-bit
    $chromePath32 = "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome"
    if (Test-Path $chromePath32) {
        foreach ($policy in $cbcmPolicies) {
            Remove-RegistryPolicy -Path $chromePath32 `
                                  -ValueName $policy `
                                  -Description "CBCM $policy (32-bit)"
        }
    }
    
    # Remover subchaves específicas do CBCM
    $cbcmSubKeys = @(
        "CloudManagement",
        "Reporting",
        "DeviceManagement"
    )
    
    foreach ($subKey in $cbcmSubKeys) {
        Remove-RegistryPolicy -Path "$chromePath64\$subKey" `
                              -Description "CBCM $subKey (64-bit)"
        Remove-RegistryPolicy -Path "$chromePath32\$subKey" `
                              -Description "CBCM $subKey (32-bit)"
    }
    
    # OPÇÃO NUCLEAR: Remover TODA a chave Policies\Google\Chrome se estiver vazia após limpeza
    # Isso garante que não sobrem rastros de políticas
    if (Test-Path $chromePath64) {
        $items64 = Get-ChildItem -Path $chromePath64 -ErrorAction SilentlyContinue
        $props64 = Get-ItemProperty -Path $chromePath64 -ErrorAction SilentlyContinue | 
                   Get-Member -MemberType NoteProperty | 
                   Where-Object { $_.Name -notmatch "^PS" }
        
        if ((-not $items64 -or $items64.Count -eq 0) -and (-not $props64 -or $props64.Count -eq 0)) {
            Write-Log "Chave de políticas do Chrome (64-bit) está vazia, removendo completamente..." -Level INFO
            Remove-RegistryPolicy -Path $chromePath64 -Description "Políticas Chrome vazias (64-bit)"
        }
    }
    
    if (Test-Path $chromePath32) {
        $items32 = Get-ChildItem -Path $chromePath32 -ErrorAction SilentlyContinue
        $props32 = Get-ItemProperty -Path $chromePath32 -ErrorAction SilentlyContinue | 
                   Get-Member -MemberType NoteProperty | 
                   Where-Object { $_.Name -notmatch "^PS" }
        
        if ((-not $items32 -or $items32.Count -eq 0) -and (-not $props32 -or $props32.Count -eq 0)) {
            Write-Log "Chave de políticas do Chrome (32-bit) está vazia, removendo completamente..." -Level INFO
            Remove-RegistryPolicy -Path $chromePath32 -Description "Políticas Chrome vazias (32-bit)"
        }
    }
    
    Write-Host ""
}

# ========================================
# Função: Remove-UserExtensionData
# ========================================
function Remove-UserExtensionData {
    param([string]$ExtensionId)
    
    if (-not $ExtensionId) {
        Write-Log "Extension ID não fornecido. Pulando remoção de dados de usuário" -Level WARNING
        return
    }
    
    Write-Log "Removendo dados de extensão dos perfis de usuário..." -Level INFO
    
    $userPaths = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data",
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data",
        "$env:LOCALAPPDATA\Yandex\YandexBrowser\User Data"
    )
    
    $removedCount = 0
    
    foreach ($basePath in $userPaths) {
        if (-not (Test-Path $basePath)) {
            continue
        }
        
        $browserName = if ($basePath -like "*Chrome*") { "Chrome" } elseif ($basePath -like "*Edge*") { "Edge" } else { "Yandex" }
        
        # Buscar todos os perfis (Default, Profile 1, Profile 2, etc.)
        $profileFolders = Get-ChildItem -Path $basePath -Directory | Where-Object { 
            $_.Name -eq "Default" -or $_.Name -like "Profile*" 
        }
        
        foreach ($profile in $profileFolders) {
            $extensionPath = Join-Path $profile.FullName "Extensions\$ExtensionId"
            
            if (Test-Path $extensionPath) {
                try {
                    if ($PSCmdlet.ShouldProcess($extensionPath, "Remover extensão")) {
                        Remove-Item -Path $extensionPath -Recurse -Force -ErrorAction Stop
                        Write-Log "Removido: $browserName\$($profile.Name)\Extensions\$ExtensionId" -Level SUCCESS
                        $removedCount++
                    }
                } catch {
                    Write-Log "Erro ao remover $extensionPath : $($_.Exception.Message)" -Level ERROR
                }
            }
        }
    }
    
    if ($removedCount -eq 0) {
        Write-Log "Nenhum dado de extensão encontrado nos perfis de usuário" -Level INFO
    } else {
        Write-Log "Removidos dados de extensão de $removedCount perfil(is)" -Level SUCCESS
        $script:SuccessCount++
    }
}

# ========================================
# Função: Update-GroupPolicy
# ========================================
function Update-GroupPolicy {
    Write-Log "Atualizando políticas de grupo..." -Level INFO
    
    try {
        if ($PSCmdlet.ShouldProcess("Group Policy", "Atualizar")) {
            $output = & gpupdate /force 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Políticas de grupo atualizadas com sucesso" -Level SUCCESS
                $script:SuccessCount++
            } else {
                Write-Log "gpupdate retornou código $LASTEXITCODE" -Level WARNING
            }
        }
    } catch {
        Write-Log "Erro ao atualizar políticas de grupo: $($_.Exception.Message)" -Level ERROR
    }
}

# ========================================
# Função: Test-CleanupSuccess
# ========================================
function Test-CleanupSuccess {
    param([string]$ExtensionId)
    
    Write-Log "Validando limpeza..." -Level INFO
    
    $allClean = $true
    
    # Verificar chaves de registro de extensões
    $registryChecks = @(
        "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist",
        "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionInstallForcelist"
    )
    
    foreach ($path in $registryChecks) {
        if (Test-Path $path) {
            Write-Log "Ainda existe: $path" -Level WARNING
            $allClean = $false
        }
    }
    
    # Verificar políticas do CBCM
    $cbcmChecks = @(
        @{Path="HKLM:\SOFTWARE\Policies\Google\Chrome"; Value="CloudManagementEnrollmentToken"},
        @{Path="HKLM:\SOFTWARE\Policies\Google\Chrome"; Value="CloudManagementEnrollmentMandatory"},
        @{Path="HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome"; Value="CloudManagementEnrollmentToken"},
        @{Path="HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome"; Value="CloudManagementEnrollmentMandatory"}
    )
    
    foreach ($check in $cbcmChecks) {
        if (Test-Path $check.Path) {
            $value = Get-ItemProperty -Path $check.Path -Name $check.Value -ErrorAction SilentlyContinue
            if ($value) {
                Write-Log "Ainda existe política CBCM: $($check.Path)\$($check.Value)" -Level WARNING
                $allClean = $false
            }
        }
    }
    
    # Verificar subchaves do CBCM
    $cbcmSubKeys = @(
        "HKLM:\SOFTWARE\Policies\Google\Chrome\CloudManagement",
        "HKLM:\SOFTWARE\Policies\Google\Chrome\Reporting",
        "HKLM:\SOFTWARE\Policies\Google\Chrome\DeviceManagement",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\CloudManagement",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\Reporting",
        "HKLM:\SOFTWARE\Wow6432Node\Policies\Google\Chrome\DeviceManagement"
    )
    
    foreach ($subKey in $cbcmSubKeys) {
        if (Test-Path $subKey) {
            Write-Log "Ainda existe subchave CBCM: $subKey" -Level WARNING
            $allClean = $false
        }
    }
    
    # Verificar dados de usuário (se Extension ID foi fornecido)
    if ($ExtensionId) {
        $userChecks = @(
            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions\$ExtensionId",
            "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Extensions\$ExtensionId"
        )
        
        foreach ($path in $userChecks) {
            if (Test-Path $path) {
                Write-Log "Ainda existe: $path" -Level WARNING
                $allClean = $false
            }
        }
    }
    
    if ($allClean) {
        Write-Log "Todas as verificações passaram! Limpeza completa" -Level SUCCESS
        $script:SuccessCount++
    } else {
        Write-Log "Algumas entradas ainda existem. Verifique os avisos acima" -Level WARNING
    }
    
    return $allClean
}

# ========================================
# Função: Save-CleanupReport
# ========================================
function Save-CleanupReport {
    param([string]$BackupFolder)
    
    $reportFile = Join-Path $BackupFolder "cleanup-report.txt"
    
    $report = @"
=========================================
CorpMonitor GPO Cleanup Report
=========================================
Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Usuário: $env:USERNAME
Computador: $env:COMPUTERNAME

Estatísticas:
- Operações bem-sucedidas: $script:SuccessCount
- Erros encontrados: $script:ErrorCount
- Total de operações: $($script:CleanupLog.Count)

Logs detalhados:
-----------------
$($script:CleanupLog -join "`n")

=========================================
Fim do Relatório
=========================================
"@
    
    try {
        $report | Out-File -FilePath $reportFile -Encoding UTF8
        Write-Log "Relatório salvo em: $reportFile" -Level SUCCESS
    } catch {
        Write-Log "Erro ao salvar relatório: $($_.Exception.Message)" -Level ERROR
    }
}

# ========================================
# MAIN EXECUTION
# ========================================

Clear-Host

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " CorpMonitor GPO Cleanup Script v1.0" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar privilégios administrativos
if (-not (Test-Administrator)) {
    Write-Host "[✗] ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Clique com botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Log "Verificando privilégios administrativos..." -Level SUCCESS
Write-Host ""

# Criar pasta de backup
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFolder = Join-Path $BackupPath $timestamp

try {
    if (-not (Test-Path $backupFolder)) {
        New-Item -Path $backupFolder -ItemType Directory -Force | Out-Null
        Write-Log "Pasta de backup criada: $backupFolder" -Level SUCCESS
    }
} catch {
    Write-Log "Erro ao criar pasta de backup: $($_.Exception.Message)" -Level ERROR
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""

# Detectar Extension ID se não foi fornecido
if (-not $ExtensionId) {
    $ExtensionId = Detect-ExtensionId
}

Write-Host ""

# Criar backup de chaves de registro
Backup-RegistryKeys -BackupFolder $backupFolder

Write-Host ""

# Fechar navegadores
$browsersClosed = Close-BrowserProcesses -Force:$Force

if (-not $browsersClosed -and -not $Force) {
    Write-Host ""
    Write-Host "[!] Não foi possível fechar todos os navegadores" -ForegroundColor Yellow
    Write-Host "    Continue mesmo assim? Algumas operações podem falhar." -ForegroundColor Yellow
    $continue = Read-Host "Continuar? (S/N)"
    if ($continue -ne "S" -and $continue -ne "s") {
        Write-Log "Limpeza cancelada pelo usuário" -Level WARNING
        exit 0
    }
}

Write-Host ""

# Remover políticas de registro
Remove-AllRegistryPolicies -ExtensionId $ExtensionId

Write-Host ""

# Remover TODAS as políticas do CBCM
Remove-CBCMPolicies

Write-Host ""

# Remover dados de usuário
Remove-UserExtensionData -ExtensionId $ExtensionId

Write-Host ""

# Atualizar Group Policy
Update-GroupPolicy

Write-Host ""

# Validar limpeza
$cleanupSuccess = Test-CleanupSuccess -ExtensionId $ExtensionId

Write-Host ""

# Salvar relatório
Save-CleanupReport -BackupFolder $backupFolder

# Salvar log completo
try {
    $script:CleanupLog | Out-File -FilePath $LogFile -Encoding UTF8
} catch {
    Write-Log "Erro ao salvar log: $($_.Exception.Message)" -Level ERROR
}

# Resumo final
Write-Host "=========================================" -ForegroundColor Cyan
if ($cleanupSuccess -and $script:ErrorCount -eq 0) {
    Write-Host "✓ LIMPEZA CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
} elseif ($script:ErrorCount -gt 0) {
    Write-Host "⚠ LIMPEZA CONCLUÍDA COM AVISOS" -ForegroundColor Yellow
} else {
    Write-Host "✗ LIMPEZA CONCLUÍDA COM ERROS" -ForegroundColor Red
}
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Estatísticas:" -ForegroundColor Cyan
Write-Host "  - Operações bem-sucedidas: $script:SuccessCount" -ForegroundColor Green
Write-Host "  - Erros encontrados: $script:ErrorCount" -ForegroundColor $(if ($script:ErrorCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Reinicie os navegadores para confirmar mudanças" -ForegroundColor White
Write-Host "  2. Verifique chrome://policy/ (deve estar vazio)" -ForegroundColor White
Write-Host "  3. Verifique edge://policy/ (deve estar vazio)" -ForegroundColor White
Write-Host ""

Write-Host "Arquivos gerados:" -ForegroundColor Cyan
Write-Host "  - Backup: $backupFolder" -ForegroundColor White
Write-Host "  - Log: $LogFile" -ForegroundColor White
Write-Host ""

if (-not $KeepBackup) {
    Write-Host "O backup será mantido permanentemente." -ForegroundColor Yellow
    Write-Host "Para restaurar, use: .\restore-from-backup.ps1 -BackupFolder '$backupFolder'" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Pressione Enter para sair"
