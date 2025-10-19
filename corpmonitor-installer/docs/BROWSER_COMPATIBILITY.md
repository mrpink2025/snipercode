# Compatibilidade de Navegadores

## ✅ Navegadores Suportados (100% Automatizado)

O instalador MSI instala a extensão CorpMonitor automaticamente em:

| Navegador | Versão | Políticas Usadas | Status |
|-----------|--------|------------------|--------|
| **Google Chrome** | Todas | `Google\Chrome` | ✅ Nativo |
| **Microsoft Edge** | 2020+ (Chromium) | `Microsoft\Edge` | ✅ Nativo |
| **Opera** | 60+ (Chromium) | `Google\Chrome` | ✅ Herdado |
| **Brave** | Todas | `Google\Chrome` | ✅ Herdado |
| **Vivaldi** | Todas | `Google\Chrome` | ✅ Herdado |
| **Yandex Browser** | Todas | `Yandex\YandexBrowser` | ✅ Nativo |

## 📊 Detecção Automática

Durante a instalação, o MSI:

1. **Fecha automaticamente** todos os navegadores Chromium detectados:
   - `chrome.exe` (Google Chrome)
   - `msedge.exe` (Microsoft Edge)
   - `brave.exe` (Brave)
   - `opera.exe` (Opera)
   - `vivaldi.exe` (Vivaldi)
   - `browser.exe` (Yandex)

2. **Instala chaves de registro** para cada navegador:
   - `ExtensionInstallForcelist` (força instalação)
   - `ExtensionSettings` (configurações + pin toolbar)

3. **Reabre Chrome** (ou primeiro navegador encontrado) automaticamente

## 🔍 Verificação Pós-Instalação

### Google Chrome / Opera / Brave / Vivaldi
```powershell
# Verificar políticas
chrome://policy/

# Verificar registry
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
```

### Microsoft Edge
```powershell
# Verificar políticas
edge://policy/

# Verificar registry
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist"
```

### Yandex Browser
```powershell
# Verificar políticas
browser://policy/

# Verificar registry
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser\ExtensionInstallForcelist"
```

## ⚠️ Navegadores NÃO Suportados

| Navegador | Motivo | Alternativa |
|-----------|--------|-------------|
| **Firefox** | Não é Chromium | Instalação manual via XPI |
| **Safari** | Não é Chromium, Mac-only | N/A (Windows-only) |
| **Internet Explorer** | Descontinuado, não suporta extensions | Migrar para Edge |
| **Chrome Canary/Dev** | Usa mesmas políticas do Chrome estável | ✅ Funciona automaticamente |

## 🧪 Teste de Compatibilidade

Para testar se a extensão foi instalada em todos os navegadores:

```powershell
# Script de teste
$browsers = @(
    @{Name="Chrome"; Path="C:\Program Files\Google\Chrome\Application\chrome.exe"; Flag="--profile-directory=Default"},
    @{Name="Edge"; Path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"; Flag="--profile-directory=Default"},
    @{Name="Opera"; Path="C:\Program Files\Opera\launcher.exe"; Flag=""},
    @{Name="Brave"; Path="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"; Flag=""},
    @{Name="Vivaldi"; Path="C:\Program Files\Vivaldi\Application\vivaldi.exe"; Flag=""},
    @{Name="Yandex"; Path="C:\Users\$env:USERNAME\AppData\Local\Yandex\YandexBrowser\Application\browser.exe"; Flag=""}
)

foreach ($browser in $browsers) {
    if (Test-Path $browser.Path) {
        Write-Host "✅ $($browser.Name) instalado" -ForegroundColor Green
        Start-Process $browser.Path -ArgumentList "$($browser.Flag) chrome://extensions/"
        Start-Sleep 2
    } else {
        Write-Host "⚠️  $($browser.Name) não instalado" -ForegroundColor Yellow
    }
}
```

## 📝 Notas Importantes

1. **Opera GX**: Usa as mesmas políticas do Opera padrão (compatível)
2. **Edge Dev/Beta/Canary**: Usam as mesmas políticas do Edge estável (compatível)
3. **Navegadores portáteis**: Podem não respeitar políticas HKLM (limitação do Windows)
4. **Perfis múltiplos**: A extensão é instalada em **todos os perfis** de cada navegador

## 🔒 Segurança

- Script executado com privilégios SYSTEM (MSI)
- Não coleta dados do usuário
- Logs armazenados localmente apenas
- Não envia dados para servidor externo

## 🐛 Troubleshooting

### Extensão não aparece no Yandex

1. Verificar políticas:
```powershell
browser://policy/
```

2. Verificar registry manual:
```powershell
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser\ExtensionInstallForcelist"
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Yandex\YandexBrowser\ExtensionSettings\kmcpcjjddbhdgkaonaohpikkdgfejkgm"
```

3. Reiniciar completamente o Yandex Browser

### Opera/Brave/Vivaldi não carregam a extensão

Esses navegadores herdam políticas do Chrome. Se a extensão não aparece:

1. Verificar se políticas Chrome foram aplicadas:
```powershell
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
```

2. Executar `gpupdate /force` em máquinas com GPO

3. Reiniciar o navegador completamente (fechar todos os processos)

## 📊 Matriz de Compatibilidade

| Feature | Chrome | Edge | Opera | Brave | Vivaldi | Yandex |
|---------|--------|------|-------|-------|---------|--------|
| Force Install | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toolbar Pin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-update | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User removal | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
