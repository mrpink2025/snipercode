# 🚀 Browser Performance Monitor - Chrome Extension

Uma extensão Chrome para **monitoramento e otimização** de performance do navegador.

## ✨ Recursos de Otimização

- ✅ **Monitoramento automático de performance**
- ✅ **Análise de recursos pesados**
- ✅ **Otimização de velocidade de carregamento**
- ✅ **Detecção de scripts lentos**
- ✅ **Interface intuitiva** com métricas de performance
- ✅ **Comunicação com API PerfMonitor**
- ✅ **Sistema de análise em tempo real**
- ✅ **Relatórios detalhados de performance**
- ✅ **Controles de monitoramento**

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

Isso criará `perfmonitor-extension.zip` para distribuição.

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

1. **Background Script**: Monitora performance em tempo real
2. **Content Script**: Analisa páginas web em busca de gargalos de performance
3. **Popup Interface**: Exibe métricas e recursos otimizados
4. **API Integration**: Reporta dados de performance para o console PerfMonitor

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

## Performance e Privacidade

- ✅ **Monitoramento proativo** de performance
- ✅ **Análise em tempo real** (<1ms de overhead)
- ✅ **Métricas detalhadas** de recursos
- ✅ **Comunicação criptografada** com a API
- ✅ **Relatórios completos** de otimização

## Recursos Incluídos

### Análise de Performance
- Detecção de scripts lentos
- Identificação de recursos pesados
- Análise de tempo de carregamento
- **Otimização automática** de recursos críticos

### Monitoramento de Recursos
- Rastreamento de uso de memória
- Análise de requisições de rede
- Métricas de renderização
- **Alertas sobre** gargalos

### Otimização
- Sugestões de melhoria
- Análise de cache
- Identificação de recursos bloqueantes
- Relatórios de otimização detalhados

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
- Verifique se a extensão está habilitada
- Confirme que a extensão tem as permissões necessárias
- Verifique a conectividade com a API
- Teste em uma aba anônima

### Métricas incorretas
- Limpe o cache da extensão
- Recarregue a página
- Aguarde alguns segundos para análise completa

### Popup não abre
- Verifique se os ícones estão na pasta correta
- Confirme que popup.html está no diretório raiz

## Suporte

Para suporte técnico:
1. Verifique os logs no console da extensão
2. Consulte o dashboard PerfMonitor
3. Entre em contato com o suporte

## Versão
**1.0.2** - Versão com renomeação completa