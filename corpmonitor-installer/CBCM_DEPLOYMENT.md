# 🚀 CorpMonitor - Deploy via CBCM (Chrome Browser Cloud Management)

## ✅ Por que CBCM em vez de GPO?

### **Vantagens do CBCM:**

| Aspecto | GPO Local | CBCM (Recomendado) |
|---------|-----------|-------------------|
| **Plataforma** | Apenas Windows | Windows, Mac, Linux, ChromeOS |
| **Infraestrutura** | Requer Active Directory | Apenas conexão com internet |
| **Gerenciamento** | Local (cada domínio) | Centralizado (Google Admin Console) |
| **Conflitos** | Possíveis entre GPO e CBCM | Nenhum (fonte única) |
| **Auditoria** | Logs locais | Logs centralizados no Google |
| **Atualizações** | Propagação por GPUpdate | Sincronização automática cloud |
| **Multi-organização** | Complexo (múltiplos domínios) | Simples (1 console) |
| **Custo** | Infraestrutura AD | Gratuito (Cloud Identity) |

### **Quando usar CBCM:**
- ✅ Ambiente corporativo moderno (cloud-first)
- ✅ Máquinas remotas ou home office
- ✅ Múltiplas plataformas (Windows + Mac)
- ✅ Precisa de auditoria centralizada
- ✅ Quer simplificar gerenciamento

### **Quando GPO ainda faz sentido:**
- ⚠️ Ambiente 100% Windows on-premise
- ⚠️ Restrições de conectividade cloud
- ⚠️ Já tem infraestrutura GPO complexa

---

## 📦 Passos de Instalação

### **1. Obter CBCM Enrollment Token**

#### **Opção A: Google Workspace (Pago)**
1. Acesse: https://admin.google.com
2. Navegue: **Dispositivos** → **Chrome** → **Inscrições**
3. Clique em **Gerar novo token**
4. Copie o token gerado (formato: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`)
5. ⚠️ **Importante:** Token é único por organização

#### **Opção B: Cloud Identity Free (Gratuito)**
1. Crie conta gratuita: https://cloud.google.com/identity
2. Acesse Admin Console: https://admin.google.com
3. Navegue: **Dispositivos** → **Chrome** → **Gerenciamento**
4. Ative: **Gerenciamento de navegador Chrome**
5. Gere token de inscrição

---

### **2. Instalar MSI com Token CBCM**

#### **Instalação Silenciosa (Recomendado)**

```batch
msiexec /i CorpMonitor.msi ^
  CHROME_ENROLLMENT_TOKEN="SEU_TOKEN_AQUI" ^
  /qn /l*v C:\Temp\corpmonitor-install.log
```

#### **Instalação com Interface**

```batch
msiexec /i CorpMonitor.msi ^
  CHROME_ENROLLMENT_TOKEN="SEU_TOKEN_AQUI"
```

#### **Deploy em Rede (GPO/Script)**

```powershell
# Script PowerShell para deploy em massa
$token = "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
$msiPath = "\\servidor\share\CorpMonitor.msi"

$computers = Get-ADComputer -Filter * | Select-Object -ExpandProperty Name

foreach ($pc in $computers) {
    Invoke-Command -ComputerName $pc -ScriptBlock {
        param($msi, $tk)
        Start-Process msiexec -ArgumentList "/i `"$msi`" CHROME_ENROLLMENT_TOKEN=`"$tk`" /qn" -Wait
    } -ArgumentList $msiPath, $token
}
```

---

### **3. Configurar Extensão no Admin Console**

#### **3.1. Acessar Configuração de Extensões**

1. Abra: https://admin.google.com/ac/chrome/apps/user
2. Navegue: **Dispositivos** → **Chrome** → **Aplicativos e extensões**
3. Selecione: **Usuários e navegadores**

#### **3.2. Adicionar Extensão Forçada**

1. Clique em **Adicionar aplicativo ou extensão do Chrome**
2. Insira o **Extension ID**: `[SEU_EXTENSION_ID]`
3. Clique em **Salvar**

#### **3.3. Configurar Política de Instalação**

Configure as seguintes políticas:

| Política | Valor | Descrição |
|----------|-------|-----------|
| **Modo de instalação** | `Instalação forçada` | Usuário não pode remover |
| **Fixar na barra de ferramentas** | `Forçar fixação` | Ícone sempre visível |
| **URL de atualização** | `https://monitorcorporativo.com/extension/update.xml` | Servidor de updates |
| **Aplicar a** | `Toda a organização` ou OUs específicas | Escopo |

#### **3.4. Políticas Avançadas (Opcional)**

```json
{
  "ExtensionSettings": {
    "[SEU_EXTENSION_ID]": {
      "installation_mode": "force_installed",
      "toolbar_pin": "force_pinned",
      "update_url": "https://monitorcorporativo.com/extension/update.xml",
      "minimum_version_required": "1.0.0"
    }
  }
}
```

---

### **4. Verificar Enrollment**

#### **4.1. No Chrome do Usuário**

1. Abra: `chrome://policy`
2. Clique em **Recarregar políticas**
3. Verifique se aparece:
   ```
   CloudManagementEnrollmentToken: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
   Fonte: Plataforma
   Status: OK
   ```

#### **4.2. Verificar Extensão Instalada**

1. Abra: `chrome://extensions/`
2. A extensão **CorpMonitor** deve aparecer com:
   - ✅ Status: **Gerenciado pela organização**
   - ✅ Botão "Remover" desabilitado
   - ✅ Ícone fixado na toolbar

#### **4.3. No Admin Console**

1. Acesse: https://admin.google.com/ac/chrome/reports/browsers
2. Navegue: **Dispositivos** → **Chrome** → **Navegadores**
3. Verifique se máquinas aparecem na lista
4. Clique em uma máquina → **Extensões instaladas**
5. Confirme que **CorpMonitor** está listada

---

## 🔧 Troubleshooting

### **❌ Problema: Extensão não instala automaticamente**

**Sintomas:**
- Chrome não mostra "Gerenciado pela organização"
- Extensão não aparece em `chrome://extensions/`

**Soluções:**

```batch
:: 1. Verificar se token está no registro
reg query "HKLM\SOFTWARE\Policies\Google\Chrome" /v CloudManagementEnrollmentToken

:: 2. Forçar enrollment manualmente
"C:\Program Files\Google\Chrome\Application\chrome.exe" --enable-cloud-management

:: 3. Reiniciar Chrome completamente
taskkill /F /IM chrome.exe
timeout /t 5
start chrome

:: 4. Verificar políticas aplicadas
chrome://policy/
```

**Aguardar sincronização:**
- Políticas CBCM podem levar até **24 horas** para propagar
- Para forçar: `chrome://policy` → **Recarregar políticas**

---

### **❌ Problema: Token inválido ou expirado**

**Erro:**
```
Failed to enroll browser: ENROLLMENT_TOKEN_INVALID
```

**Solução:**

1. Gerar novo token no Admin Console
2. Desinstalar MSI:
   ```batch
   msiexec /x {PRODUCT_CODE} /qn
   ```
3. Reinstalar com novo token:
   ```batch
   msiexec /i CorpMonitor.msi CHROME_ENROLLMENT_TOKEN="NOVO_TOKEN" /qn
   ```

---

### **❌ Problema: Máquina não aparece no Admin Console**

**Causas comuns:**
- Firewall bloqueando `*.googleapis.com`
- Proxy corporativo sem bypass para Google
- Token não foi aplicado corretamente

**Verificação:**

```batch
:: 1. Testar conectividade
ping -n 4 clients2.google.com

:: 2. Verificar logs do Chrome
"%LOCALAPPDATA%\Google\Chrome\User Data\chrome_debug.log"

:: 3. Forçar enrollment
chrome --enable-logging --v=1
```

**Portas necessárias:**
- TCP 443 (HTTPS) para `*.googleapis.com`
- TCP 443 para `*.google.com`

---

### **❌ Problema: Conflito entre GPO local e CBCM**

**Sintomas:**
- Políticas conflitantes em `chrome://policy`
- Extensão instalada 2x (local + cloud)

**Solução (CBCM prevalece):**

```batch
:: 1. Remover chaves GPO locais
reg delete "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /f
reg delete "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionSettings" /f

:: 2. Manter apenas CBCM
reg query "HKLM\SOFTWARE\Policies\Google\Chrome\CloudManagementEnrollmentToken"

:: 3. Forçar atualização de políticas
gpupdate /force
```

**⚠️ Nota:** Com este MSI refatorado, as chaves GPO **não são mais criadas**, evitando conflitos.

---

## 📊 Monitoramento e Auditoria

### **Dashboard do Admin Console**

1. **Navegadores ativos:** https://admin.google.com/ac/chrome/reports/browsers
2. **Extensões instaladas:** Ver por máquina ou agregado
3. **Políticas aplicadas:** Status de conformidade
4. **Alertas:** Configurar notificações para máquinas não-conformes

### **Exportar Relatórios**

```plaintext
Admin Console → Relatórios → Chrome → Navegadores
- Filtrar por extensão: CorpMonitor
- Exportar CSV com todas as máquinas
- Agendar relatórios semanais
```

---

## 🔐 Segurança e Compliance

### **Boas Práticas:**

1. **Rotação de Token:**
   - Gerar novo token a cada 6-12 meses
   - Desabilitar tokens antigos no Admin Console

2. **Escopo de Políticas:**
   - Aplicar apenas para OUs necessárias
   - Não forçar em contas de admin (flexibilidade)

3. **Auditoria:**
   - Revisar logs mensalmente
   - Alertar sobre máquinas não-enrolled após 48h

4. **Backup:**
   - Documentar Extension ID e token
   - Manter cópia do MSI versionado

---

## 💡 Dicas Avançadas

### **Deploy Híbrido (CBCM + SCCM/Intune)**

```powershell
# Script de instalação para Intune/SCCM
$token = Get-Content "\\secure-share\cbcm-token.txt"
Start-Process msiexec -ArgumentList "/i CorpMonitor.msi CHROME_ENROLLMENT_TOKEN=`"$token`" /qn" -Wait

# Verificar sucesso
if (Test-Path "HKLM:\SOFTWARE\Policies\Google\Chrome") {
    $enrollToken = Get-ItemProperty "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name CloudManagementEnrollmentToken
    if ($enrollToken.CloudManagementEnrollmentToken -eq $token) {
        Write-Output "SUCCESS: CBCM enrolled"
        exit 0
    }
}
Write-Output "FAIL: Enrollment failed"
exit 1
```

### **Rollback de Emergência**

```batch
:: Desinstalação forçada
msiexec /x {PRODUCT_CODE} /qn REBOOT=ReallySuppress

:: Limpar registros CBCM (se necessário)
reg delete "HKLM\SOFTWARE\Policies\Google\Chrome\CloudManagementEnrollmentToken" /f

:: Remover máquina do Admin Console
:: (Fazer manualmente no console ou via API)
```

---

## 📚 Recursos Adicionais

### **Documentação Oficial:**
- [Chrome Browser Cloud Management](https://support.google.com/chrome/a/answer/9116814)
- [Cloud Identity Free](https://cloud.google.com/identity/docs/setup)
- [Chrome Enterprise Policies](https://chromeenterprise.google/policies/)
- [Enrollment Tokens](https://support.google.com/chrome/a/answer/9301891)

### **APIs para Automação:**
- [Chrome Policy API](https://developers.google.com/chrome/policy)
- [Chrome Browser Management API](https://developers.google.com/chrome/management)

---

## 🎯 Checklist de Deploy

- [ ] Token CBCM obtido no Google Admin Console
- [ ] MSI compilado com token correto
- [ ] Testado em 1-2 máquinas piloto
- [ ] Extensão configurada no Admin Console (instalação forçada)
- [ ] Políticas aplicadas à OU correta
- [ ] Máquinas piloto aparecem no relatório (aguardar 24h)
- [ ] Extensão visível e funcional nas máquinas
- [ ] Deploy em massa via GPO/Intune/SCCM
- [ ] Monitoramento configurado no Admin Console
- [ ] Documentação de token arquivada (cofre seguro)

---

**Última atualização:** 2025-10-22  
**Versão:** 1.0 (CBCM-only)
