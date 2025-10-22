# ✅ MSI CorpMonitor - Build Corrigido

## 🎯 O que foi corrigido

O MSI anterior **SOMENTE instalava chaves CBCM**, mas **NÃO instalava a extensão Chrome**.

### ✅ Correções implementadas:

1. **`Files.wxs`** (CRIADO): Define todos os 18 arquivos da extensão Chrome
2. **`ExtensionRegistry.wxs`** (CRIADO): Força instalação em 6 navegadores (Chrome, Edge, Brave, Opera, Vivaldi, Yandex)
3. **`Registry.wxs`** (CORRIGIDO): CBCM agora é condicional e aceita token via CLI
4. **`Product.wxs`** (CORRIGIDO): Inclui todos os ComponentGroups necessários
5. **`setup-and-build-msi.ps1`** (CORRIGIDO): Compila os 4 arquivos WiX

---

## 📦 Como compilar o MSI

### **Método 1: Modo Interativo (Recomendado para primeira vez)**

```powershell
cd corpmonitor-installer
.\setup-and-build-msi.ps1
```

O script irá perguntar:
- **Extension ID**: Detecta automaticamente de `chrome-extension/extension-id.txt`
- **Manufacturer**: Nome da sua empresa
- **CBCM Token**: Token obrigatório (obtenha em [Google Admin Console](https://admin.google.com))

### **Método 2: Modo Silencioso (Automação)**

```powershell
.\setup-and-build-msi.ps1 `
  -Silent `
  -ExtensionId "kmcpcjjddbhdgkaonaohpikkdgfejkgm" `
  -Manufacturer "CorpMonitor Ltda" `
  -CBCMToken "2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

### **Método 3: Build Limpo (Clean Build)**

```powershell
.\setup-and-build-msi.ps1 -Clean -Silent `
  -CBCMToken "2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

---

## 🔍 Verificação pós-build

Após a compilação, verifique:

### **1. Arquivos gerados**

```
corpmonitor-installer/build/
├── CorpMonitor.msi          ✅ Instalador final (±5-10MB)
├── CorpMonitor.msi.sha256   ✅ Hash de verificação
├── guids-used.json          ✅ Log de GUIDs gerados
└── *.wixobj                 ✅ Objetos compilados
```

### **2. Conteúdo do MSI**

Liste o conteúdo:

```powershell
cd corpmonitor-installer\build
msiexec /qn /a CorpMonitor.msi TARGETDIR=C:\temp\msi-extract
dir C:\temp\msi-extract /s
```

Deve conter:
- `C:\Program Files\CorpMonitor\extension\manifest.json`
- `C:\Program Files\CorpMonitor\extension\background.js`
- `C:\Program Files\CorpMonitor\extension\icons\*.png`
- **(18 arquivos totais)**

### **3. Chaves de registro**

Execute o MSI e verifique:

```powershell
# Instalar
msiexec /i CorpMonitor.msi /qn CHROME_ENROLLMENT_TOKEN="2e0be2c0-4252-4c4d-a072-1f774f1b2edc"

# Verificar CBCM
reg query "HKLM\SOFTWARE\Policies\Google\Chrome" /v CloudManagementEnrollmentToken

# Verificar ExtensionInstallForcelist
reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

# Verificar Edge
reg query "HKLM\SOFTWARE\Policies\Microsoft\Edge\Extensions\kmcpcjjddbhdgkaonaohpikkdgfejkgm"
```

### **4. Chrome gerenciado**

Abra o Chrome e verifique:

1. `chrome://management` → Deve mostrar "O navegador é gerenciado pela sua organização"
2. `chrome://extensions` → Extensão "CorpMonitor" deve estar ativa com badge "Instalada pela política"
3. `chrome://policy` → Deve listar:
   - `CloudManagementEnrollmentToken`
   - `ExtensionInstallForcelist`

---

## 🚀 Instalação em máquinas corporativas

### **Instalação silenciosa com GPO**

1. Copie `CorpMonitor.msi` para um compartilhamento de rede:
   ```
   \\servidor\deploy\CorpMonitor.msi
   ```

2. Crie uma GPO de instalação:
   - **Computer Configuration** → **Policies** → **Software Settings** → **Software Installation**
   - Adicione `CorpMonitor.msi`
   - Modo: **Assigned**

3. Configure parâmetros:
   ```
   msiexec /i CorpMonitor.msi /qn CHROME_ENROLLMENT_TOKEN="SEU_TOKEN_AQUI"
   ```

### **Instalação via SCCM/Intune**

```powershell
msiexec /i "C:\deploy\CorpMonitor.msi" /qn /norestart ^
  CHROME_ENROLLMENT_TOKEN="2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

### **Instalação manual (teste)**

```powershell
# Com interface
msiexec /i CorpMonitor.msi CHROME_ENROLLMENT_TOKEN="2e0be2c0-4252-4c4d-a072-1f774f1b2edc"

# Silenciosa
msiexec /i CorpMonitor.msi /qn CHROME_ENROLLMENT_TOKEN="2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

---

## 🔧 Troubleshooting

### **Problema 1: Chrome não abre após instalação**

**Causa**: Conflito de processo do Chrome.

**Solução**: O MSI fecha/reabre o Chrome automaticamente (via `ChromeManager.ps1`). Se falhar:

```powershell
# Fechar Chrome manualmente
Get-Process chrome,msedge,brave,opera,vivaldi | Stop-Process -Force

# Reabrir
Start-Process chrome
```

---

### **Problema 2: Extensão não aparece**

**Verificações**:

1. **Arquivos instalados?**
   ```powershell
   dir "C:\Program Files\CorpMonitor\extension\manifest.json"
   ```

2. **Registro aplicado?**
   ```powershell
   reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
   ```

3. **Chrome gerenciado?**
   - Abra `chrome://policy` e procure por `ExtensionInstallForcelist`
   - Se não aparece, rode `gpupdate /force` ou reinicie

4. **Extension ID correto?**
   - Verifique em `chrome-extension/extension-id.txt`
   - Deve corresponder ao ID no registro

---

### **Problema 3: Erro ao compilar MSI**

**Erro**: `WiX Toolset not found`

**Solução**:
```powershell
# Baixe WiX 3.14 de:
# https://github.com/wixtoolset/wix3/releases/tag/wix3141rtm
# Instale em: C:\Program Files (x86)\WiX Toolset v3.14\
```

**Erro**: `Arquivo WiX não encontrado`

**Solução**: Certifique-se que os arquivos existem:
```powershell
dir corpmonitor-installer\source\wix\
# Deve listar: Product.wxs, Files.wxs, Registry.wxs, ExtensionRegistry.wxs
```

---

### **Problema 4: CBCM token não aceito**

**Erro**: `CBCM Enrollment Token is required`

**Solução**: Sempre forneça o token via CLI:

```powershell
msiexec /i CorpMonitor.msi CHROME_ENROLLMENT_TOKEN="SEU_TOKEN_AQUI"
```

Ou embuta no MSI durante build:
```powershell
.\setup-and-build-msi.ps1 -CBCMToken "SEU_TOKEN_AQUI"
```

---

## 📋 Checklist de Deployment

### **Antes do Build**

- [ ] WiX Toolset 3.14 instalado
- [ ] Extension ID gerado (`npm run build` em `chrome-extension/`)
- [ ] CBCM Token obtido no Google Admin Console
- [ ] Manufacturer definido

### **Durante o Build**

- [ ] Executar `.\setup-and-build-msi.ps1`
- [ ] Verificar 50 placeholders preenchidos
- [ ] Compilação sem erros
- [ ] MSI gerado em `build/CorpMonitor.msi`
- [ ] SHA256 hash criado

### **Após o Build**

- [ ] Extrair MSI e verificar 18 arquivos da extensão
- [ ] Instalar em máquina de teste
- [ ] Verificar chaves de registro (CBCM + ExtensionInstallForcelist)
- [ ] Abrir Chrome e confirmar extensão ativa
- [ ] Verificar `chrome://management` (gerenciado)
- [ ] Testar desinstalação

### **Deployment**

- [ ] Copiar MSI para rede corporativa
- [ ] Configurar GPO ou SCCM/Intune
- [ ] Documentar comando com token CBCM
- [ ] Pilotar em grupo de teste (5-10 usuários)
- [ ] Rollout geral

---

## 🆘 Suporte

### **Logs do Build**

```powershell
dir corpmonitor-installer\build\*.log
# candle-product.log     → Compilação de Product.wxs
# candle-files.log       → Compilação de Files.wxs
# candle-registry.log    → Compilação de Registry.wxs
# candle-extregistry.log → Compilação de ExtensionRegistry.wxs
# light.log              → Linkagem final do MSI
```

### **Logs do MSI no Windows**

```powershell
# Instalação com log verboso
msiexec /i CorpMonitor.msi /l*v C:\install.log CHROME_ENROLLMENT_TOKEN="..."

# Analisar
notepad C:\install.log
```

### **Desinstalação**

```powershell
# Silenciosa
msiexec /x CorpMonitor.msi /qn

# Ou pelo Painel de Controle
# Programas e Recursos → CorpMonitor Web Protection → Desinstalar
```

---

## 📊 Diferença: Antes vs Depois

| Aspecto | ❌ MSI Antigo | ✅ MSI Corrigido |
|---------|--------------|-----------------|
| **Arquivos instalados** | 0 (só registro) | 18 (extensão completa) |
| **Chaves de registro** | 4 (CBCM only) | 20 (CBCM + 6 navegadores × 2 arch + ExtensionInstallForcelist) |
| **Navegadores suportados** | Chrome (gerenciamento) | Chrome, Edge, Brave, Opera, Vivaldi, Yandex |
| **Extensão visível?** | ❌ Não | ✅ Sim (forçada por política) |
| **Chrome gerenciado?** | ✅ Sim | ✅ Sim |
| **Token CBCM** | Hardcoded no build | Aceita via CLI (`/i ... CHROME_ENROLLMENT_TOKEN=...`) |
| **Tamanho do MSI** | ~500KB | ~5-10MB |

---

## 🎉 Pronto para uso!

Execute:

```powershell
cd corpmonitor-installer
.\setup-and-build-msi.ps1 -CBCMToken "2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

E instale em uma máquina de teste:

```powershell
msiexec /i CorpMonitor.msi /qn CHROME_ENROLLMENT_TOKEN="2e0be2c0-4252-4c4d-a072-1f774f1b2edc"
```

🎯 **Resultado esperado**: Chrome reabre com extensão CorpMonitor ativa e gerenciada!
