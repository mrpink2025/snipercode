# 🧹 CorpMonitor GPO Cleanup Script

## Visão Geral

Este script PowerShell remove **completamente** todas as políticas de grupo (GPO) e entradas de registro criadas pelo instalador do CorpMonitor, deixando o Chrome, Edge e Yandex Browser totalmente limpos.

## ⚠️ Antes de Executar

### Requisitos

- ✅ Windows 10/11 ou Windows Server 2016+
- ✅ PowerShell 5.1 ou superior
- ✅ Privilégios de **Administrador**
- ⚠️ **CUIDADO:** Este script remove políticas permanentemente

### O Que Será Removido

#### **Registro do Windows:**
- ✅ `ExtensionInstallForcelist` (Chrome, Edge, Yandex)
- ✅ `ExtensionSettings` (Chrome, Edge, Yandex)
- ✅ **TODAS as políticas do CBCM (Chrome Browser Cloud Management):**
  - `CloudManagementEnrollmentToken`
  - `CloudManagementEnrollmentMandatory`
  - `CloudPolicyOverridesPlatformPolicy`
  - `CloudReportingEnabled`
  - `CloudPolicySettingEnabled`
  - `CloudManagementServiceUrl`
  - `MachineLevelUserCloudPolicyEnrollmentToken`
  - `BrowserSignin`
  - `SyncDisabled`
  - `ForceEphemeralProfiles`
  - `BrowserSwitcherEnabled`
  - Subchaves: `CloudManagement`, `Reporting`, `DeviceManagement`
- ✅ **Remove completamente a chave de políticas do Chrome se estiver vazia**
- ✅ Chaves de registro 64-bit e 32-bit (Wow6432Node)

#### **Dados de Usuário:**
- ✅ Extensão instalada em todos os perfis de usuário
- ✅ Arquivos em `%LOCALAPPDATA%\...\Extensions\[EXTENSION_ID]`

#### **Processos:**
- ⚠️ Todos os navegadores (Chrome, Edge, Yandex, etc.) serão fechados

---

## 🚀 Como Usar

### Método 1: Limpeza Interativa (Recomendado)

```powershell
# 1. Abrir PowerShell como Administrador
# 2. Navegar até a pasta do script
cd C:\path\to\corpmonitor-installer\scripts

# 3. Executar o script
.\clean-corpmonitor-gpo.ps1
```

**O que acontece:**
- ✅ Cria backup automático antes de remover
- ✅ Pede confirmação antes de fechar navegadores
- ✅ Mostra progresso detalhado de cada operação
- ✅ Gera relatório completo ao final

---

### Método 2: Limpeza Forçada (Sem Confirmações)

```powershell
.\clean-corpmonitor-gpo.ps1 -Force
```

**Use quando:**
- Você tem certeza absoluta do que está fazendo
- Precisa automatizar a limpeza (ex: script de implantação)
- Já fez backup manual

---

### Método 3: Simulação (Dry-Run)

```powershell
.\clean-corpmonitor-gpo.ps1 -WhatIf
```

**O que faz:**
- ✅ Mostra **o que seria feito** sem executar
- ✅ Útil para testar antes de executar de verdade
- ✅ Não faz nenhuma modificação no sistema

---

### Método 4: Extension ID Customizado

```powershell
.\clean-corpmonitor-gpo.ps1 -ExtensionId "abcdefghijklmnopqrstuvwxyz123456"
```

**Use quando:**
- O script não detectar automaticamente o Extension ID
- Você usou um Extension ID personalizado no instalador

---

### Método 5: Backup Customizado

```powershell
# Salvar backup em local específico
.\clean-corpmonitor-gpo.ps1 -BackupPath "D:\Backups\CorpMonitor"

# Manter backup após limpeza (útil para auditoria)
.\clean-corpmonitor-gpo.ps1 -KeepBackup
```

---

## 📊 Output Esperado

```
=========================================
 CorpMonitor GPO Cleanup Script v1.0
=========================================

[✓] Verificando privilégios administrativos...
[✓] Pasta de backup criada: C:\CorpMonitor_Backup\2025-10-22_15-30-45
[→] Tentando detectar Extension ID automaticamente...
[✓] Extension ID detectado: phkmkmmdpnkhcpfbglgacbfmkkfphhpe

[→] Criando backup de chaves de registro...
    [✓] Backup: Google-Chrome-64bit.reg
    [✓] Backup: Google-Chrome-32bit.reg
    [✓] Backup: Microsoft-Edge-64bit.reg
[✓] Backup concluído: 3 arquivo(s) salvos

[!] Detectados 2 processos de navegador ativos:
    - chrome.exe (2 processo(s))
Fechar navegadores agora? (S/N): S
[✓] Todos os navegadores foram fechados com sucesso

[→] Removendo políticas de registro...
  [Chrome 64-bit]
    [✓] Removido: Chrome ExtensionInstallForcelist (64-bit)
    [✓] Removido: Chrome ExtensionSettings/phk... (64-bit)
  [Chrome 32-bit]
    [✓] Removido: Chrome ExtensionInstallForcelist (32-bit)
  [Edge 64-bit]
    [→] Não encontrado: Edge ExtensionInstallForcelist (64-bit)

[→] Removendo TODAS as políticas do CBCM...
  [CBCM - Chrome Browser Cloud Management]
    [✓] Removido: CBCM CloudManagementEnrollmentToken (64-bit)
    [✓] Removido: CBCM CloudManagementEnrollmentMandatory (64-bit)
    [✓] Removido: CBCM CloudPolicyOverridesPlatformPolicy (64-bit)
    [✓] Removido: CBCM CloudReportingEnabled (64-bit)
    [→] Chave de políticas do Chrome (64-bit) está vazia, removendo completamente...
    [✓] Removido: Políticas Chrome vazias (64-bit)

[→] Removendo dados de extensão dos perfis de usuário...
    [✓] Removido: Chrome\Default\Extensions\phk...
    [✓] Removido: Chrome\Profile 1\Extensions\phk...
[✓] Removidos dados de extensão de 2 perfil(is)

[→] Atualizando políticas de grupo...
[✓] Políticas de grupo atualizadas com sucesso

[→] Validando limpeza...
[✓] Todas as verificações passaram! Limpeza completa

=========================================
✓ LIMPEZA CONCLUÍDA COM SUCESSO!
=========================================

Estatísticas:
  - Operações bem-sucedidas: 12
  - Erros encontrados: 0

Próximos passos:
  1. Reinicie os navegadores para confirmar mudanças
  2. Verifique chrome://policy/ (deve estar vazio)
  3. Verifique edge://policy/ (deve estar vazio)

Arquivos gerados:
  - Backup: C:\CorpMonitor_Backup\2025-10-22_15-30-45
  - Log: C:\CorpMonitor_Cleanup.log

Pressione Enter para sair
```

---

## 🌐 Sobre a Remoção do CBCM

### O que é CBCM?

**CBCM (Chrome Browser Cloud Management)** é um serviço do Google que permite gerenciar navegadores Chrome de forma centralizada na nuvem, sem necessidade de Active Directory.

### O que o script remove do CBCM?

Este script remove **TODAS** as políticas do CBCM instaladas localmente, incluindo:

1. **Tokens de Inscrição:**
   - Remove o token que conecta o navegador ao console de gerenciamento
   - O navegador deixará de reportar ao CBCM após reinicialização

2. **Políticas de Gerenciamento:**
   - `CloudManagementEnrollmentMandatory` - Inscrição obrigatória
   - `CloudPolicyOverridesPlatformPolicy` - Sobrescrever políticas locais
   - `CloudReportingEnabled` - Relatórios ao servidor

3. **Subchaves Completas:**
   - `HKLM:\SOFTWARE\Policies\Google\Chrome\CloudManagement`
   - `HKLM:\SOFTWARE\Policies\Google\Chrome\Reporting`
   - `HKLM:\SOFTWARE\Policies\Google\Chrome\DeviceManagement`

4. **Limpeza Total:**
   - Se após remover todas as políticas a chave `Policies\Google\Chrome` estiver vazia, ela é **completamente removida**
   - Isso garante que não sobrem rastros de configurações antigas

### ⚠️ O que acontece após remover o CBCM?

- ✅ O navegador **não estará mais gerenciado** pelo console CBCM
- ✅ Políticas aplicadas via CBCM **deixam de funcionar**
- ✅ Extensões forçadas via CBCM **podem ser desinstaladas** pelo usuário
- ✅ O Chrome volta ao estado "não gerenciado" (pode ver em `chrome://policy/`)
- ⚠️ Para reativar o CBCM, será necessário **reinstalar** o token de inscrição

### Como verificar se o CBCM foi removido?

```
1. Abrir Chrome
2. Ir para: chrome://policy/
3. Na seção "Chrome Policies", deve aparecer:
   Status: "No machine policies set"
4. Em "Policy precedence", NÃO deve aparecer "Cloud" como fonte
```

Se ainda aparecer políticas ou "Managed by your organization":
- Reiniciar o navegador completamente
- Executar `gpupdate /force` 
- Verificar se há políticas de domínio (AD) sobrepondo

---

## 🔍 Verificando a Limpeza

### 1. Verificar Políticas do Chrome

```
1. Abrir Google Chrome
2. Digitar na barra de endereço: chrome://policy/
3. Verificar que NÃO há políticas listadas
4. Se houver, clicar em "Reload Policies"
```

### 2. Verificar Políticas do Edge

```
1. Abrir Microsoft Edge
2. Digitar na barra de endereço: edge://policy/
3. Verificar que NÃO há políticas listadas
```

### 3. Verificar Extensões Instaladas

```
1. Chrome: chrome://extensions/
2. Edge: edge://extensions/
3. Verificar que CorpMonitor NÃO aparece na lista
```

### 4. Verificar Registro (Avançado)

```powershell
# PowerShell como Administrador
Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -ErrorAction SilentlyContinue

# Deve retornar: nada (ou erro dizendo que não existe)
```

---

## 🛠️ Troubleshooting

### Problema: "Este script precisa ser executado como Administrador"

**Solução:**
```
1. Fechar PowerShell
2. Clicar com botão direito no ícone do PowerShell
3. Selecionar "Executar como Administrador"
4. Executar o script novamente
```

---

### Problema: "Ainda há X processo(s) de navegador ativos"

**Solução:**
```powershell
# Opção 1: Fechar manualmente todos os navegadores via Task Manager
# Opção 2: Forçar fechamento
.\clean-corpmonitor-gpo.ps1 -Force

# Opção 3: Verificar processos travados
Get-Process | Where-Object { $_.Name -like "*chrome*" -or $_.Name -like "*edge*" }
```

---

### Problema: Políticas ainda aparecem em chrome://policy/

**Possíveis causas:**
1. **Cache do navegador:** Fechar completamente o navegador e reabrir
2. **GPO de domínio:** Verificar se há políticas de domínio (AD) sobrepondo
3. **CBCM ainda ativo:** Token de inscrição não foi removido corretamente
4. **Outro instalador:** Verificar se há outro software gerenciando políticas

**Soluções:**
```powershell
# Verificar se políticas do CBCM ainda existem
Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "CloudManagementEnrollmentToken" -ErrorAction SilentlyContinue

# Se retornar algo, remover manualmente
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "CloudManagementEnrollmentToken" -Force
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "CloudManagementEnrollmentMandatory" -Force

# Forçar atualização de GPO
gpupdate /force

# Reiniciar computador (garantia de limpeza completa)
Restart-Computer -Force

# Verificar se há outras políticas (domain-wide)
gpresult /h gpreport.html
```

**Verificar especificamente o CBCM:**
```powershell
# Ver todas as propriedades da chave de políticas do Chrome
Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -ErrorAction SilentlyContinue | Format-List

# Verificar subchaves do CBCM
Test-Path "HKLM:\SOFTWARE\Policies\Google\Chrome\CloudManagement"
Test-Path "HKLM:\SOFTWARE\Policies\Google\Chrome\Reporting"

# Se existirem, remover manualmente
Remove-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\CloudManagement" -Recurse -Force
Remove-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\Reporting" -Recurse -Force
```

---

### Problema: Extension ID não detectado automaticamente

**Solução:**
```powershell
# Opção 1: Encontrar Extension ID manualmente
# Chrome: chrome://extensions/ → Ativar "Modo de desenvolvedor" → Ver ID

# Opção 2: Buscar no registro
Get-ChildItem -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" | Get-ItemProperty

# Opção 3: Especificar manualmente
.\clean-corpmonitor-gpo.ps1 -ExtensionId "SEU_EXTENSION_ID_AQUI"
```

---

### Problema: "Erro ao fazer backup de..."

**Solução:**
```powershell
# Verificar se pasta de backup está acessível
Test-Path "C:\CorpMonitor_Backup"

# Usar caminho alternativo
.\clean-corpmonitor-gpo.ps1 -BackupPath "D:\Temp\Backup"

# Continuar sem backup (NÃO RECOMENDADO)
.\clean-corpmonitor-gpo.ps1 -Force
```

---

## 🔄 Restaurando o Backup

Se você precisar **reverter a limpeza** (restaurar as políticas), use:

```powershell
.\restore-from-backup.ps1 -BackupFolder "C:\CorpMonitor_Backup\2025-10-22_15-30-45"
```

**⚠️ CUIDADO:** Isso restaura as políticas de GPO removidas!

---

## 📁 Arquivos Gerados

### 1. Backup de Registro (`.reg`)

**Localização:** `C:\CorpMonitor_Backup\[timestamp]\`

**Arquivos:**
- `Google-Chrome-64bit.reg`
- `Google-Chrome-32bit.reg`
- `Microsoft-Edge-64bit.reg`
- `Microsoft-Edge-32bit.reg`
- `Yandex-YandexBrowser-64bit.reg`

**Para restaurar manualmente:**
```cmd
reg import "C:\CorpMonitor_Backup\...\Google-Chrome-64bit.reg"
```

---

### 2. Log Detalhado (`CorpMonitor_Cleanup.log`)

**Localização:** `C:\CorpMonitor_Cleanup.log`

**Contém:**
- Timestamp de cada operação
- Nível de log (INFO, SUCCESS, WARNING, ERROR)
- Detalhes de cada chave removida
- Erros encontrados (se houver)

**Exemplo:**
```
[2025-10-22 15:30:45] [SUCCESS] Verificando privilégios administrativos...
[2025-10-22 15:30:46] [INFO] Criando backup de chaves de registro...
[2025-10-22 15:30:47] [SUCCESS] ✓ Backup: Google-Chrome-64bit.reg
```

---

### 3. Relatório de Limpeza (`cleanup-report.txt`)

**Localização:** `C:\CorpMonitor_Backup\[timestamp]\cleanup-report.txt`

**Contém:**
- Estatísticas de operações (sucesso/erro)
- Log completo da sessão
- Data, usuário e computador onde foi executado

---

## 🔒 Considerações de Segurança

### ✅ Seguro:
- Backup automático antes de qualquer mudança
- Confirmações interativas (modo padrão)
- Logs auditáveis de todas as operações
- Reversível via backup

### ⚠️ Atenção:
- Requer privilégios de Administrador (pode modificar sistema)
- Fecha todos os navegadores abertos (perda de dados não salvos)
- Remove políticas permanentemente (a menos que restaure backup)

### 🚫 Não Faz:
- ❌ Remove arquivos de instalação do CorpMonitor (apenas políticas)
- ❌ Remove contas de usuário ou dados do sistema
- ❌ Modifica configurações de rede ou segurança
- ❌ Desinstala navegadores

---

## 🔗 Links Úteis

- **Documentação Chrome Enterprise:** https://support.google.com/chrome/a/answer/9037717
- **Políticas do Edge:** https://docs.microsoft.com/en-us/deployedge/microsoft-edge-policies
- **Group Policy Management:** https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/dn265969(v=ws.11)

---

## 💡 Dicas

### Automatizar Limpeza em Múltiplas Máquinas

```powershell
# Script para limpar em rede (executar via GPO ou SCCM)
$computers = Get-ADComputer -Filter * -SearchBase "OU=Workstations,DC=empresa,DC=com"

foreach ($computer in $computers) {
    Invoke-Command -ComputerName $computer.Name -FilePath ".\clean-corpmonitor-gpo.ps1" -ArgumentList "-Force"
}
```

### Agendar Limpeza Periódica

```powershell
# Criar tarefa agendada
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\clean-corpmonitor-gpo.ps1 -Force"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 3am
Register-ScheduledTask -TaskName "CorpMonitor Cleanup" -Action $action -Trigger $trigger -RunLevel Highest
```

### Verificar Políticas Ativas

```powershell
# Listar TODAS as políticas ativas de Chrome
Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -ErrorAction SilentlyContinue | Format-List

# Verificar se há políticas de domínio (GPO)
gpresult /r
```

---

## 📞 Suporte

Para problemas ou dúvidas, entre em contato com:
- **Email:** suporte@corpmonitor.com
- **Documentação:** https://docs.corpmonitor.com/cleanup

---

## 📝 Changelog

### v1.0 (2025-10-22)
- ✅ Lançamento inicial
- ✅ Suporte para Chrome, Edge e Yandex
- ✅ **Remoção COMPLETA de todas as políticas do CBCM (Chrome Browser Cloud Management)**
- ✅ Backup automático de registro
- ✅ Detecção automática de Extension ID
- ✅ Limpeza de dados de usuário
- ✅ Validação pós-limpeza
- ✅ Modo dry-run (-WhatIf)
- ✅ **Remoção da chave de políticas completa do Chrome quando vazia**
