# CorpMonitor Chrome Extension

Uma extensão Chrome corporativa para monitoramento de dados e conformidade de privacidade.

## Funcionalidades

- ✅ Monitoramento automático de cookies
- ✅ Coleta de metadados de navegação
- ✅ Interface de usuário intuitiva
- ✅ Comunicação com API CorpMonitor
- ✅ Sistema de consentimento do usuário
- ✅ Relatórios em tempo real
- ✅ Controles de ativação/desativação

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

1. **Background Script**: Monitora abas ativas e coleta dados de cookies
2. **Content Script**: Coleta metadados da página e elementos de tracking
3. **Popup Interface**: Permite controle do usuário e visualização de status
4. **API Integration**: Envia dados coletados para o sistema CorpMonitor

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

- ❌ **Não coleta dados sensíveis** (senhas, números de cartão, etc.)
- ✅ **Coleta apenas metadados** necessários para conformidade
- ✅ **Requer consentimento explícito** do usuário
- ✅ **Comunicação criptografada** com a API
- ✅ **Auditoria completa** de todas as ações

## Monitoramento Incluído

### Cookies
- Nome e domínio dos cookies
- Configurações de segurança (Secure, HttpOnly, SameSite)
- Datas de expiração
- **Hash dos valores** (não os valores reais)

### Metadados
- URLs visitadas
- Elementos de tracking detectados
- Submissões de formulário (apenas estrutura)
- LocalStorage/SessionStorage (apenas chaves)

### Atividade
- Cliques em elementos rastreados
- Mudanças dinâmicas no DOM
- Scripts de analytics carregados

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

### Monitoramento não funciona
- Verifique se o usuário deu consentimento
- Confirme que a extensão tem as permissões necessárias
- Verifique a conectividade com a API

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