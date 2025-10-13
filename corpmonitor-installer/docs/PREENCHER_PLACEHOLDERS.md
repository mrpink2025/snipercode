# 📋 Guia de Preenchimento de Placeholders

Este documento lista todos os placeholders que você precisa preencher antes de compilar o MSI.

---

## 🎯 Placeholders Obrigatórios

### 1. **Extension ID** (Chrome)

**Onde preencher:**
- `Product.wxs`: `<?define ExtensionId = "[PREENCHER_EXTENSION_ID]" ?>`
- `Registry.wxs`: Todas as ocorrências de `[PREENCHER_EXTENSION_ID]`

**Como obter:**

```bash
# 1. Instale a extensão manualmente no Chrome (modo desenvolvedor)
# 2. Abra chrome://extensions/
# 3. Ative "Modo do desenvolvedor" (canto superior direito)
# 4. Copie o ID da extensão (algo como: abcdefghijklmnopqrstuvwxyz123456)
```

**Formato esperado:** 32 caracteres alfanuméricos (ex: `abcdefghijklmnopqrstuvwxyz123456`)

---

### 2. **Nome da Empresa/Fabricante**

**Onde preencher:**
- `Product.wxs`: `<?define Manufacturer = "[PREENCHER_NOME_EMPRESA]" ?>`

**Exemplos:**
- `"CorpMonitor Inc."`
- `"Acme Corporation"`
- `"MinhaSoftwareHouse Ltda"`

**Formato esperado:** String (use aspas duplas)

---

### 3. **UpgradeCode (GUID)**

**Onde preencher:**
- `Product.wxs`: `<?define UpgradeCode = "[PREENCHER_GUID_UPGRADE]" ?>`

**Como gerar:**

```powershell
# PowerShell
[guid]::NewGuid().ToString().ToUpper()
```

**IMPORTANTE:**
- Gere este GUID **UMA VEZ** e **NUNCA MUDE** entre versões
- Este GUID permite que versões futuras atualizem a instalação existente

**Formato esperado:** `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}` (com chaves)

---

### 4. **GUIDs dos Componentes** (24 GUIDs no total)

**Onde preencher:**
- `Files.wxs`: `[PREENCHER_GUID_1]` até `[PREENCHER_GUID_16]`
- `Registry.wxs`: `[PREENCHER_GUID_17]` até `[PREENCHER_GUID_24]`

**Como gerar:**

```powershell
# Execute o script gerador (recomendado)
.\scripts\generate-guids.ps1

# OU gere manualmente:
[guid]::NewGuid().ToString().ToUpper()  # Repita 24 vezes
```

**Formato esperado:** `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}` (com chaves)

**IMPORTANTE:**
- Cada GUID deve ser **ÚNICO** (não reutilize entre componentes)
- Os GUIDs podem mudar entre versões, mas manter os mesmos facilita atualizações

---

### 5. **Certificate Thumbprint** (para assinatura)

**Onde preencher:**
- `scripts/sign.bat`: `set CERT_THUMBPRINT=[PREENCHER_CERTIFICATE_THUMBPRINT]`

**Como obter:**

```batch
:: Windows Command Prompt
certutil -store -user My

:: OU PowerShell
Get-ChildItem -Path Cert:\CurrentUser\My | Format-List *
```

**Formato esperado:** 40 caracteres hexadecimais (ex: `ABC123DEF456...`)

**IMPORTANTE:**
- Você só precisa preencher isso **depois que o certificado EV chegar**
- O certificado deve estar no token USB conectado

---

## 🛠️ Processo de Preenchimento Passo a Passo

### **Passo 1: Gerar GUIDs**

```powershell
cd corpmonitor-installer\scripts
.\generate-guids.ps1
```

Isso irá gerar todos os GUIDs necessários e salvá-los em `build/guids.txt`.

### **Passo 2: Obter Extension ID**

1. Abra o Chrome
2. Navegue até o diretório `chrome-extension/`
3. Chrome → ⋮ → Mais ferramentas → Extensões
4. Ative "Modo do desenvolvedor"
5. Clique em "Carregar sem compactação"
6. Selecione o diretório `chrome-extension/`
7. Copie o **ID** da extensão (32 caracteres)

### **Passo 3: Editar Product.wxs**

```xml
<?define ProductName = "CorpMonitor Extension" ?>
<?define ProductVersion = "1.0.1" ?>
<?define Manufacturer = "SUA_EMPRESA_AQUI" ?>  <!-- MUDAR -->
<?define ExtensionId = "SEU_EXTENSION_ID_AQUI" ?>  <!-- MUDAR -->
<?define UpgradeCode = "{GUID_DO_GENERATE_GUIDS_AQUI}" ?>  <!-- MUDAR -->
```

### **Passo 4: Editar Files.wxs**

Substituir todos os `[PREENCHER_GUID_X]` pelos GUIDs gerados.

**Exemplo:**
```xml
<!-- ANTES -->
<Component Id="ManifestJson" Guid="[PREENCHER_GUID_1]">

<!-- DEPOIS -->
<Component Id="ManifestJson" Guid="{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}">
```

### **Passo 5: Editar Registry.wxs**

1. Substituir `[PREENCHER_EXTENSION_ID]` pelo Extension ID (em 8 lugares)
2. Substituir `[PREENCHER_GUID_17]` até `[PREENCHER_GUID_24]` pelos GUIDs gerados

### **Passo 6: Editar sign.bat (quando tiver certificado)**

```batch
set CERT_THUMBPRINT=ABC123DEF456...  <!-- MUDAR para thumbprint real -->
```

---

## ✅ Checklist de Validação

Antes de executar `build.bat`, verifique:

- [ ] `Product.wxs`: Manufacturer preenchido
- [ ] `Product.wxs`: ExtensionId preenchido (32 caracteres)
- [ ] `Product.wxs`: UpgradeCode preenchido (formato `{GUID}`)
- [ ] `Files.wxs`: Todos os 16 GUIDs preenchidos (GUID_1 até GUID_16)
- [ ] `Registry.wxs`: ExtensionId preenchido em 8 lugares
- [ ] `Registry.wxs`: Todos os 8 GUIDs preenchidos (GUID_17 até GUID_24)
- [ ] `sign.bat`: Certificate Thumbprint preenchido (se já tem certificado)

---

## 🔍 Buscar e Substituir em Massa

Você pode usar **Find & Replace** (Ctrl+H) no seu editor:

### **Substituir Extension ID:**

**Buscar:** `[PREENCHER_EXTENSION_ID]`  
**Substituir por:** `abcdefghijklmnopqrstuvwxyz123456` (seu ID real)

### **Substituir Manufacturer:**

**Buscar:** `[PREENCHER_NOME_EMPRESA]`  
**Substituir por:** `"Minha Empresa Ltda"`

### **Substituir GUIDs:**

**Não use Find & Replace para GUIDs!** Cada um deve ser único.

---

## ❌ Erros Comuns

### **Erro: "The Component/@Guid attribute's value, '[PREENCHER_GUID_1]', is not a valid guid."**

**Causa:** GUID não preenchido ou formato incorreto

**Solução:** 
- Certifique-se de usar o formato `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`
- Use `generate-guids.ps1` para gerar GUIDs válidos

---

### **Erro: "The Component/@Id attribute's value, 'ManifestJson', is duplicated."**

**Causa:** Dois componentes com o mesmo GUID

**Solução:** 
- Cada componente deve ter um GUID único
- Regere os GUIDs usando `generate-guids.ps1`

---

### **Extensão não aparece no Chrome após instalação**

**Causa:** Extension ID incorreto ou malformado

**Solução:**
1. Verifique se o Extension ID tem exatamente 32 caracteres
2. Verifique se está tudo em minúsculas
3. Instale a extensão manualmente e copie o ID correto

---

## 📞 Suporte

Se tiver dúvidas:

1. Revise este documento
2. Execute `generate-guids.ps1` para gerar GUIDs corretos
3. Verifique se o Extension ID foi obtido corretamente do Chrome
4. Consulte a documentação do WiX: https://wixtoolset.org/docs/

---

**Última atualização:** 2025-10-13
