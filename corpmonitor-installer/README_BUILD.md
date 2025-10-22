# 🌍 MSI Multilíngue CorpMonitor

## ✅ Implementado

Este MSI foi **completamente refatorado** para ser:

- ✅ **Único arquivo MSI** (~50-80 KB) com todos os idiomas
- ✅ **Seleção de idioma** na primeira tela do instalador
- ✅ **5 idiomas suportados**: pt-BR, en-US, es-ES, pt-PT, fr-FR
- ✅ **Propaganda de segurança** durante a instalação
- ✅ **Apenas registra CBCM** (não copia arquivos da extensão)
- ✅ **UI customizada** com recursos de segurança destacados

---

## 🚀 Como Compilar

### 1. Executar o script de build:

```powershell
.\build-msi-complete.ps1 -CleanBuild
```

### 2. Parâmetros opcionais:

```powershell
# Customizar Extension ID e Manufacturer
.\build-msi-complete.ps1 `
    -ExtensionId "seu_extension_id" `
    -Manufacturer "Nome da Sua Empresa" `
    -CleanBuild
```

---

## 📋 Pré-requisitos

1. **WiX Toolset v3.11** instalado em:
   ```
   C:\Program Files (x86)\WiX Toolset v3.11\bin
   ```

2. **PowerShell 5.1+** (já vem no Windows 10/11)

3. **Permissões de administrador** (para teste de instalação)

---

## 🎯 O que o Script Faz

1. ✅ Valida pré-requisitos (WiX Toolset, arquivos fonte)
2. ✅ Gera GUIDs únicos para o MSI
3. ✅ Preenche placeholders em Product.wxs
4. ✅ Compila arquivos WiX (.wxs → .wixobj)
5. ✅ Linka com **todos os 5 idiomas** em um único MSI
6. ✅ Gera hash SHA256 para validação
7. ✅ Exibe relatório detalhado

---

## 📦 Resultado

Após a compilação, você terá:

```
build/
├── CorpMonitor.msi        ← MSI multilíngue (~50-80 KB)
├── CorpMonitor.msi.sha256 ← Hash para validação
└── [arquivos temporários .wixobj]
```

---

## 🌍 Fluxo de Instalação

```
1. [Tela 1] Seleção de Idioma
   🇧🇷 Português (Brasil)
   🇺🇸 English (United States)
   🇪🇸 Español (España)
   🇵🇹 Português (Portugal)
   🇫🇷 Français (France)

2. [Tela 2] Boas-vindas
   "Bem-vindo à Proteção Web CorpMonitor"

3. [Tela 3] Recursos de Segurança ⭐
   🛡️ Bloqueio de Phishing em Tempo Real
   🦠 Prevenção de Malware
   🔒 Proteção contra Vazamento de Dados
   📊 Monitoramento Centralizado
   ⚡ Resposta Automatizada a Incidentes
   ✅ Zero Impacto na Produtividade

4. [Tela 4] Instalação
   Progress bar: "Instalando Proteção..."

5. [Tela 5] Conclusão ✅
   "Proteção Web CorpMonitor instalada com sucesso"
```

---

## 🧪 Como Testar

### Instalação silenciosa:

```cmd
msiexec /i build\CorpMonitor.msi ^
  CHROME_ENROLLMENT_TOKEN="seu_token_cbcm" ^
  /qn /l*v install.log
```

### Instalação com interface:

```cmd
msiexec /i build\CorpMonitor.msi ^
  CHROME_ENROLLMENT_TOKEN="seu_token_cbcm"
```

### Desinstalar:

```cmd
msiexec /x build\CorpMonitor.msi /qn
```

---

## 🔐 Deploy via CBCM

1. Acesse: https://admin.google.com/ac/chrome/apps
2. Faça upload do `CorpMonitor.msi`
3. Configure força de instalação: **"Forçar instalação"**
4. Aplique a política para OUs desejadas

---

## 📝 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `source/wix/Product.wxs` | Definição do produto MSI |
| `source/wix/Registry.wxs` | Chaves de registro CBCM |
| `source/wix/UI.wxs` | Interface customizada |
| `localization/*.wxl` | Traduções (5 idiomas) |
| `build-msi-complete.ps1` | Script de compilação |

---

## 🎨 Bitmaps Personalizados (Opcional)

Para adicionar imagens personalizadas ao instalador:

1. Crie `assets/banner.bmp` (493 x 58 pixels)
2. Crie `assets/dialog.bmp` (493 x 312 pixels)
3. Veja especificações em `assets/banner-spec.txt` e `assets/dialog-spec.txt`

---

## ✅ Validação SHA256

Para validar o MSI após download:

```powershell
$hash = Get-FileHash .\CorpMonitor.msi -Algorithm SHA256
$expected = Get-Content .\CorpMonitor.msi.sha256
if ($hash.Hash -eq $expected) {
    Write-Host "✅ MSI válido" -ForegroundColor Green
} else {
    Write-Host "❌ MSI corrompido!" -ForegroundColor Red
}
```

---

## 🆘 Troubleshooting

### Erro: "WiX Toolset não encontrado"

**Solução**: Instale WiX Toolset v3.11 de:
https://wixtoolset.org/releases/

### Erro: "Product.wxs não encontrado"

**Solução**: Execute o script da pasta `corpmonitor-installer`

### MSI muito grande (>500 KB)

**Solução**: Verifique se `Files.wxs` foi deletado corretamente

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| Tamanho do MSI | ~1-2 MB | ~50-80 KB |
| Idiomas | Fixo (1033) | Selecionável (5) |
| Copia arquivos? | ✅ Sim (desnecessário) | ❌ Não |
| UI customizada? | ❌ Não | ✅ Sim |
| Propaganda? | ❌ Não | ✅ Sim |
| Método deploy | Registry + Files | Registry only |

---

## 🎉 Sucesso!

Se você vir esta mensagem ao final do build:

```
========================================
 BUILD CONCLUÍDO COM SUCESSO!
========================================

📦 MSI: build\CorpMonitor.msi
📊 Tamanho: 52.34 KB
🔒 SHA256: [hash]

🌍 IDIOMAS SUPORTADOS:
  🇧🇷 Português (Brasil)
  🇺🇸 English (United States)
  🇪🇸 Español (España)
  🇵🇹 Português (Portugal)
  🇫🇷 Français (France)
```

Significa que o MSI está pronto para deploy! 🚀
