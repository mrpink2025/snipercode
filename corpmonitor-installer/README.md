# 📦 CorpMonitor MSI Installer

Instalador MSI para distribuição em massa da extensão CorpMonitor para Chrome/Edge com suporte a **CBCM (Chrome Browser Cloud Management)**.

---

## 🚀 Início Rápido (NOVO - Script Automatizado)

### **Método 1: Script Automatizado (Recomendado)**

```powershell
# No diretório raiz do projeto (onde está setup-and-build-msi.ps1)
.\setup-and-build-msi.ps1
```

Este script faz **TUDO automaticamente**:
1. ✅ Valida pré-requisitos (WiX, arquivos, etc.)
2. ✅ Coleta Extension ID e Manufacturer (modo interativo)
3. ✅ Gera 34 GUIDs únicos
4. ✅ Preenche todos os 49 placeholders
5. ✅ Copia arquivos da extensão
6. ✅ Compila MSI com WiX
7. ✅ Gera hash SHA256
8. ✅ Mostra relatório final

**Com suporte CBCM (opcional):**
```powershell
.\setup-and-build-msi.ps1 -CBCMToken "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
```

**Modo silencioso (CI/CD):**
```powershell
.\setup-and-build-msi.ps1 `
    -ExtensionId "kmcpcjjddbhdgkaonaohpikkdgfejkgm" `
    -Manufacturer "CorpMonitor Ltda" `
    -CBCMToken "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" `
    -Silent
```

**📖 CBCM Setup completo:** Veja [CBCM_SETUP.md](CBCM_SETUP.md)

---

### **Método 2: Scripts Individuais (Legado)**

<details>
<summary>Clique para expandir</summary>

### **1. Instalar Ferramentas**

```powershell
# WiX Toolset v3.11+
# Download: https://wixtoolset.org/releases/

# Windows SDK (para SignTool)
# Download: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
```

### **2. Gerar GUIDs e Preencher Placeholders**

```powershell
cd corpmonitor-installer/scripts
.\generate-guids.ps1
```

Siga as instruções em: **`docs/PREENCHER_PLACEHOLDERS.md`**

### **3. Compilar MSI**

```batch
cd corpmonitor-installer/scripts
build.bat
```

### **4. Assinar MSI (quando tiver certificado EV)**

```batch
cd corpmonitor-installer/scripts
sign.bat
```

### **5. Testar Instalação**

```batch
cd corpmonitor-installer/scripts
test-install.bat
```

</details>

---

## 📁 Estrutura do Projeto

```
corpmonitor-installer/
├── source/
│   ├── extension/          # Arquivos da extensão (copiados automaticamente)
│   └── wix/                # Arquivos WiX (XML)
│       ├── Product.wxs     # Definição do produto
│       ├── Files.wxs       # Estrutura de arquivos
│       └── Registry.wxs    # Chaves de registro (força instalação)
│
├── build/                  # Output do build
│   ├── CorpMonitor.msi     # MSI final
│   └── *.wixobj            # Objetos intermediários
│
├── scripts/                # Scripts de automação
│   ├── build.bat           # Compilar MSI
│   ├── sign.bat            # Assinar com certificado EV
│   ├── test-install.bat    # Testar instalação local
│   └── generate-guids.ps1  # Gerar GUIDs únicos
│
└── docs/                   # Documentação
    └── PREENCHER_PLACEHOLDERS.md
```

---

## 🔧 Pré-requisitos

### **Software:**
- Windows 10/11 ou Windows Server 2016+
- WiX Toolset v3.14+ (testado com v3.14)
- Windows SDK (para SignTool, opcional)
- PowerShell 5.1+

### **Para CBCM (Chrome Browser Cloud Management):**
- Google Workspace ou Cloud Identity (gratuito para device management)
- Token de enrollment obtido no Google Admin Console
- Veja: [CBCM_SETUP.md](CBCM_SETUP.md) para detalhes completos

### **Para Assinatura (opcional, mas recomendado):**
- Certificado EV Code Signing ($400-500/ano)
- Token USB físico (obrigatório para EV desde 2023)

### **Para Deploy em Massa:**
- Active Directory + GPO **OU** CBCM (não precisa de ambos)
- Share de rede acessível por todas as máquinas (se usar GPO)

---

## 📝 Placeholders (Preenchidos Automaticamente)

O script `setup-and-build-msi.ps1` preenche **automaticamente** todos os placeholders:

| Placeholder | Total | Localização | Preenchimento |
|------------|-------|-------------|---------------|
| `[PREENCHER_EXTENSION_ID]` | ~12x | `Product.wxs`, `Registry.wxs` | Coleta interativa ou `-ExtensionId` |
| `[PREENCHER_NOME_EMPRESA]` | 1x | `Product.wxs` | Coleta interativa ou `-Manufacturer` |
| `[PREENCHER_GUID_UPGRADE]` | 1x | `Product.wxs` | Gerado automaticamente |
| `[PREENCHER_GUID_1..34]` | 34x | `Files.wxs`, `Registry.wxs` | Gerados automaticamente (34 GUIDs) |
| **Total** | **49** | - | **100% automatizado** |

> **Nota:** GUIDs 29-32 são para componentes CBCM (novos!)

**Método manual legado:** `docs/PREENCHER_PLACEHOLDERS.md`

---

## 🏗️ Processo de Build (Automatizado)

### **Método Simples (Recomendado)**

```powershell
# No diretório raiz do projeto
.\setup-and-build-msi.ps1
```

**O que acontece:**
1. ✅ Valida WiX Toolset instalado
2. ✅ Pergunta Extension ID e Manufacturer (ou usa defaults)
3. ✅ Pergunta token CBCM (opcional, pode deixar vazio)
4. ✅ Gera 34 GUIDs únicos
5. ✅ Preenche todos os 49 placeholders
6. ✅ Copia arquivos da extensão
7. ✅ Compila MSI
8. ✅ Gera SHA256 hash
9. ✅ Salva log JSON com todos os GUIDs usados

**Resultado:** `corpmonitor-installer/build/CorpMonitor.msi`

---

### **Opções Avançadas**

```powershell
# Build + Teste de instalação
.\setup-and-build-msi.ps1 -Test

# Limpar build anterior
.\setup-and-build-msi.ps1 -Clean

# Modo silencioso (CI/CD)
.\setup-and-build-msi.ps1 `
    -ExtensionId "kmcpcjjddbhdgkaonaohpikkdgfejkgm" `
    -Manufacturer "CorpMonitor Ltda" `
    -CBCMToken "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" `
    -Silent -Test

# Build sem CBCM
.\setup-and-build-msi.ps1 -Silent
```

---

### **Assinatura (Opcional)**

```batch
cd corpmonitor-installer\scripts
sign.bat
```

Requer certificado EV Code Signing.

---

## 🚀 Distribuição em Massa

### **🔐 Opção 1: CBCM (Chrome Browser Cloud Management) - NOVO**

**Vantagens:**
- ✅ Não precisa de Active Directory/GPO
- ✅ Chrome mostra "Browser is managed"
- ✅ Gerenciamento via Google Admin Console
- ✅ Funciona em Windows, Mac, Linux
- ✅ Deploy remoto sem infraestrutura local

**Setup:**
1. Obtenha token CBCM no Google Admin Console
2. Build MSI com token: `.\setup-and-build-msi.ps1 -CBCMToken "XXXXX..."`
3. Distribua MSI (GPO, Intune, SCCM, manual)
4. Máquinas se registram automaticamente no Chrome Management

**📖 Guia completo:** [CBCM_SETUP.md](CBCM_SETUP.md)

---

### **Opção 2: Group Policy (Tradicional)**

```powershell
# 1. Copiar MSI para share de rede
Copy-Item build\CorpMonitor.msi \\dc-server\sysvol\domain\software\

# 2. Abrir Group Policy Management Console (gpmc.msc)

# 3. Criar nova GPO:
#    Computer Configuration → Policies → Software Settings → Software Installation
#    Right-click → New → Package
#    Selecionar: \\dc-server\sysvol\domain\software\CorpMonitor.msi

# 4. Linkar GPO à OU desejada

# 5. Forçar atualização nas máquinas:
Invoke-Command -ComputerName PC001 -ScriptBlock { gpupdate /force }
```

### **Opção 3: Microsoft Intune**

```plaintext
1. Portal Intune → Apps → Windows → Add
2. App type: Line-of-business app
3. Upload: CorpMonitor.msi
4. Assign to: All Devices
5. Install behavior: System
```

### **Opção 4: SCCM (System Center Configuration Manager)**

```plaintext
1. Software Library → Applications → Create Application
2. Type: Windows Installer (*.msi)
3. Content location: \\server\share\CorpMonitor.msi
4. Deploy to: All Workstations
5. Purpose: Required
```

---

## 🧪 Testes

### **Teste Local (Antes do Deploy)**

```batch
:: Instalar
msiexec /i build\CorpMonitor.msi /qn /l*v install.log

:: Verificar arquivos
dir "C:\Program Files\CorpMonitor\Extension\"

:: Verificar registry
reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

:: Verificar no Chrome
chrome://extensions/

:: Desinstalar
msiexec /x build\CorpMonitor.msi /qn
```

### **Teste em Máquina Virtual**

```powershell
# Criar snapshot antes de testar
Checkpoint-VM -Name "TestVM" -SnapshotName "Pre-CorpMonitor"

# Copiar MSI e instalar
Copy-Item build\CorpMonitor.msi \\TestVM\C$\Temp\
Invoke-Command -ComputerName TestVM -ScriptBlock {
    Start-Process msiexec -ArgumentList "/i C:\Temp\CorpMonitor.msi /qn" -Wait
}

# Validar
Invoke-Command -ComputerName TestVM -ScriptBlock {
    Test-Path "C:\Program Files\CorpMonitor\Extension\manifest.json"
    Get-ItemProperty "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
}

# Rollback se necessário
Restore-VMSnapshot -Name "Pre-CorpMonitor" -Confirm:$false
```

---

## 🐛 Troubleshooting

### **Extensão não aparece no Chrome**

```batch
:: 1. Verificar se políticas foram aplicadas
chrome://policy/

:: 2. Verificar registry
reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

:: 3. Forçar reload de políticas
gpupdate /force

:: 4. Reiniciar Chrome completamente
taskkill /F /IM chrome.exe
start chrome
```

### **Erro na compilação WiX**

```plaintext
Erro: "The Component/@Guid attribute's value is not a valid guid"
Solução: Verifique se todos os [PREENCHER_GUID_X] foram substituídos

Erro: "Unable to find source file"
Solução: Execute build.bat (copia arquivos da extensão automaticamente)

Erro: "Light.exe failed with exit code 1"
Solução: Verifique logs acima para detalhes específicos
```

### **MSI falha ao instalar**

```batch
:: Ver log detalhado
msiexec /i CorpMonitor.msi /l*vx install.log
notepad install.log

:: Erros comuns:
:: Error 1603 - Falha genérica (ver log)
:: Error 1722 - Problema com CustomActions
:: Error 2503/2502 - Executar como Admin
```

### **Token USB não reconhecido (assinatura)**

```batch
:: 1. Instalar driver do token (ex: SafeNet Authentication Client)

:: 2. Verificar se certificado está visível
certutil -csp "eToken Base Cryptographic Provider" -key

:: 3. Rebootar (às vezes necessário)
shutdown /r /t 0
```

---

## 📊 Monitoramento de Deploy

### **Script PowerShell de Validação**

```powershell
# validate-deployment.ps1
function Test-CorpMonitorInstalled {
    param([string]$ComputerName)
    
    $result = Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        $installed = Test-Path "C:\Program Files\CorpMonitor\Extension\manifest.json"
        $registry = Test-Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
        
        [PSCustomObject]@{
            Computer = $env:COMPUTERNAME
            Installed = $installed
            RegistryOK = $registry
            Status = if ($installed -and $registry) { "OK" } else { "ERRO" }
        }
    }
    
    return $result
}

# Validar múltiplas máquinas
$computers = Get-ADComputer -Filter * | Select-Object -ExpandProperty Name
$results = $computers | ForEach-Object { Test-CorpMonitorInstalled -ComputerName $_ }
$results | Export-Csv deployment-status.csv -NoTypeInformation
```

---

## 💰 Custos

| Item | Custo | Frequência |
|------|-------|------------|
| WiX Toolset | Gratuito | - |
| Windows SDK | Gratuito | - |
| Certificado EV Code Signing | $400-500 | Anual |
| GPO (Active Directory) | Gratuito | Nativo Windows |
| **Total Ano 1** | ~$400-500 | - |

---

## 📚 Documentação Adicional

### **CorpMonitor Docs:**
- 🆕 **[CBCM Setup Guide](CBCM_SETUP.md)** - Chrome Browser Cloud Management
- [Preencher Placeholders (método manual)](docs/PREENCHER_PLACEHOLDERS.md)
- [Browser Compatibility](docs/BROWSER_COMPATIBILITY.md)

### **Referências Externas:**
- [WiX Toolset Docs](https://wixtoolset.org/docs/)
- [Chrome Enterprise Policies](https://chromeenterprise.google/policies/)
- [Chrome Browser Cloud Management](https://support.google.com/chrome/a/answer/9116814)
- [Code Signing Best Practices](https://docs.microsoft.com/en-us/windows-hardware/drivers/install/code-signing-best-practices)

---

## 📞 Suporte

Problemas? Verifique:

1. ✅ Todos os placeholders preenchidos (`docs/PREENCHER_PLACEHOLDERS.md`)
2. ✅ WiX Toolset instalado corretamente
3. ✅ Extension ID obtido do Chrome
4. ✅ GUIDs únicos gerados (`generate-guids.ps1`)
5. ✅ Logs de erro em `build\install.log`

---

---

## 🎯 Novidades da Versão 1.1.0

- ✅ **Script automatizado** `setup-and-build-msi.ps1` (faz tudo em 1 comando)
- ✅ **Suporte CBCM** (Chrome Browser Cloud Management)
- ✅ **34 GUIDs** (antes 30) - 4 novos para CBCM
- ✅ **49 placeholders** preenchidos automaticamente
- ✅ **Documentação CBCM** completa ([CBCM_SETUP.md](CBCM_SETUP.md))
- ✅ **Modo silencioso** para CI/CD (`-Silent`)
- ✅ **Teste automatizado** (`-Test`)

---

**Última atualização:** 2025-10-19  
**Versão do Instalador:** 1.1.0 (CBCM Support)
