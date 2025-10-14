# 📦 CorpMonitor MSI Installer

Instalador MSI para distribuição em massa da extensão CorpMonitor para Chrome/Edge.

---

## 🚀 Início Rápido

### **1. Instalar Ferramentas**

```powershell
# WiX Toolset v3.11+
# Download: https://wixtoolset.org/releases/

# Windows SDK (para SignTool)
# Download: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
```

### **2. Gerar GUIDs e Preencher Placeholders**

```powershell
cd scripts
.\generate-guids.ps1
```

Siga as instruções em: **`docs/PREENCHER_PLACEHOLDERS.md`**

### **3. Compilar MSI**

```batch
cd scripts
build.bat
```

### **4. Assinar MSI (quando tiver certificado EV)**

```batch
cd scripts
sign.bat
```

### **5. Testar Instalação**

```batch
cd scripts
test-install.bat
```

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
- WiX Toolset v3.11+
- Windows SDK (para SignTool)
- PowerShell 5.1+

### **Para Assinatura (opcional, mas recomendado):**
- Certificado EV Code Signing ($400-500/ano)
- Token USB físico (obrigatório para EV desde 2023)

### **Para Deploy em Massa:**
- Active Directory configurado
- Acesso a Group Policy Management Console
- Share de rede acessível por todas as máquinas

---

## 📝 Placeholders Obrigatórios

Antes de compilar, preencha:

| Placeholder | Localização | Como Obter |
|------------|-------------|------------|
| `[PREENCHER_EXTENSION_ID]` | `Product.wxs`, `Registry.wxs` | `chrome://extensions/` (32 chars) |
| `[PREENCHER_NOME_EMPRESA]` | `Product.wxs` | Nome da sua empresa |
| `[PREENCHER_GUID_UPGRADE]` | `Product.wxs` | `[guid]::NewGuid()` (PowerShell) |
| `[PREENCHER_GUID_1..24]` | `Files.wxs`, `Registry.wxs` | `generate-guids.ps1` |
| `[PREENCHER_CERTIFICATE_THUMBPRINT]` | `sign.bat` | `certutil -store -user My` |

**Leia:** `docs/PREENCHER_PLACEHOLDERS.md` para detalhes.

---

## 🏗️ Processo de Build

### **Passo 1: Preparar Ambiente**

```batch
:: Instalar WiX Toolset
winget install WiXToolset

:: Verificar instalação
"C:\Program Files (x86)\WiX Toolset v3.11\bin\candle.exe" -?
```

### **Passo 2: Obter Extension ID**

```plaintext
1. Abra Chrome
2. Chrome → Extensões → Modo desenvolvedor
3. "Carregar sem compactação" → Selecionar chrome-extension/
4. Copiar ID da extensão (32 caracteres)
```

### **Passo 3: Gerar GUIDs**

```powershell
cd corpmonitor-installer\scripts
.\generate-guids.ps1
```

Copie os GUIDs gerados para os arquivos WiX.

### **Passo 4: Editar Arquivos WiX**

```xml
<!-- Product.wxs -->
<?define Manufacturer = "Minha Empresa Ltda" ?>
<?define ExtensionId = "abcdefghijklmnopqrstuvwxyz123456" ?>
<?define UpgradeCode = "{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}" ?>
```

### **Passo 5: Compilar**

```batch
cd corpmonitor-installer\scripts
build.bat
```

Resultado: `build\CorpMonitor.msi`

### **Passo 6: Assinar (quando tiver certificado)**

```batch
:: 1. Conectar token USB com certificado EV
:: 2. Obter thumbprint
certutil -store -user My

:: 3. Editar scripts\sign.bat com o thumbprint
:: 4. Assinar
cd scripts
sign.bat
```

### **Passo 7: Testar Localmente**

```batch
cd scripts
test-install.bat
```

Verifique no Chrome: `chrome://extensions/`

---

## 🚀 Distribuição em Massa (GPO)

### **Opção 1: Group Policy (Recomendado)**

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

### **Opção 2: Microsoft Intune**

```plaintext
1. Portal Intune → Apps → Windows → Add
2. App type: Line-of-business app
3. Upload: CorpMonitor.msi
4. Assign to: All Devices
5. Install behavior: System
```

### **Opção 3: SCCM (System Center Configuration Manager)**

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

- [Preencher Placeholders](docs/PREENCHER_PLACEHOLDERS.md)
- [WiX Toolset Docs](https://wixtoolset.org/docs/)
- [Chrome Enterprise Policies](https://chromeenterprise.google/policies/)
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

**Última atualização:** 2025-10-13  
**Versão do Instalador:** 1.0.1
