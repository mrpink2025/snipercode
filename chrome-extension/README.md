# 🛡️ CorpMonitor Web Protection - Chrome Extension

Uma extensão Chrome corporativa para **proteção ativa** contra phishing, malware e vazamento de dados.

## ✨ Recursos de Proteção

- ✅ **Bloqueio automático de phishing** (homograph attacks, typosquatting)
- ✅ **Detecção de malware** via Google Safe Browsing
- ✅ **Proteção contra roubo de credenciais** (cookies, tokens)
- ✅ **Data Loss Prevention (DLP)** em tempo real
- ✅ **Interface intuitiva** com status de proteção
- ✅ **Comunicação com API CorpMonitor**
- ✅ **Sistema de níveis de risco** (50-69: aviso | 70-89: banner | ≥90: bloqueio total)
- ✅ **Whitelist dinâmica** para sites confiáveis
- ✅ **Controles de ativação/desativação** (somente admin)

## Instalação Rápida

### Para Desenvolvimento
```bash
cd chrome-extension
npm run dev
```

Depois:
1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. Clique "Carregar sem compactação"
4. Selecione a pasta `dist/`

### Para Produção
```bash
npm run pack
```

Isso criará `corpmonitor-extension.zip` para distribuição.

## Estrutura dos Arquivos

```
chrome-extension/
├── manifest.json         # Configuração da extensão
├── background.js         # Service worker principal
├── content.js           # Script de conteúdo
├── popup.html           # Interface do popup
├── popup.js             # Lógica do popup
├── icons/               # Ícones da extensão
├── build.js             # Script de build
└── package.json         # Configurações NPM
```

## Como Funciona

1. **Background Script**: Detecta e bloqueia ameaças em tempo real
2. **Content Script**: Analisa páginas web em busca de indicadores de phishing
3. **Popup Interface**: Exibe status de proteção e ameaças bloqueadas
4. **API Integration**: Reporta ameaças bloqueadas para o console CorpMonitor

## Configuração Corporativa

### Instalação Forçada via GPO
```reg
[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="[ID_DA_EXTENSAO];https://clients2.google.com/service/update2/crx"
```

### Política de Permissões
A extensão requer as seguintes permissões:
- `activeTab`: Para acessar dados da aba ativa
- `storage`: Para armazenar configurações
- `cookies`: Para monitorar cookies
- `tabs`: Para detectar mudanças de página
- `background`: Para executar em segundo plano

## Segurança e Privacidade

- ✅ **Bloqueio proativo** de sites maliciosos e phishing
- ✅ **Proteção em tempo real** (<1 segundo de resposta)
- ✅ **Análise de ameaças** com múltiplos indicadores
- ✅ **Comunicação criptografada** com a API
- ✅ **Auditoria completa** de todas as ações de bloqueio

## Proteção Incluída

### Detecção de Phishing
- Homograph attacks (caracteres unicode suspeitos)
- Typosquatting (imitação de sites legítimos)
- TLDs suspeitos (.tk, .ml, .ga, etc.)
- **Bloqueio automático** de sites com risco crítico (≥90/100)

### Proteção de Credenciais
- Detecção de tentativas de roubo de cookies
- Monitoramento de tokens de autenticação
- Alertas sobre sessões suspeitas
- **Bloqueio preventivo** de exfiltração

### Análise de Ameaças
- Integração com Google Safe Browsing
- Detecção de malware em tempo real
- Análise de reputação de domínios
- Sistema de níveis de risco (baixo, médio, alto, crítico)

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev          # Build e instruções de instalação
npm run build        # Apenas build
npm run pack         # Criar pacote ZIP

# Informações
npm run install-guide # Ver guia de instalação
```

## Troubleshooting

### Extensão não carrega
- Verifique se o modo desenvolvedor está ativo
- Confirme que todos os arquivos estão na pasta dist/

### Proteção não funciona
- Verifique se a extensão está habilitada
- Confirme que a extensão tem as permissões necessárias
- Verifique a conectividade com a API
- Teste em uma aba anônima

### Sites legítimos sendo bloqueados
- Adicione o site à whitelist no console CorpMonitor
- Reporte o falso positivo ao administrador
- Aguarde análise da equipe de segurança

### Popup não abre
- Verifique se os ícones estão na pasta correta
- Confirme que popup.html está no diretório raiz

## Suporte

Para suporte técnico:
1. Verifique os logs no console da extensão
2. Consulte o dashboard CorpMonitor
3. Entre em contato com o administrador IT

## Versão
**1.0.0** - Versão inicial com funcionalidades completas