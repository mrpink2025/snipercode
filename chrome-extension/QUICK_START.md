# CorpMonitor Extension - Quick Start

## Instalação Imediata

### 1. Preparar Ícones
Abra `create-icons.html` no seu navegador e clique "Generate Icons" para criar os ícones necessários.

### 2. Build da Extensão
```bash
cd chrome-extension
node build.js
```

### 3. Instalar no Chrome
1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor" (canto superior direito)
3. Clique "Carregar sem compactação"
4. Selecione a pasta `dist/` criada pelo build

### 4. Verificar Instalação
- Deve aparecer o ícone 🛡️ na barra do Chrome
- Clique no ícone para ver o popup
- Aceite o termo de consentimento
- Ative o monitoramento

## Como Funciona

1. **Coleta Automática**: A extensão monitora cookies e metadados automaticamente
2. **Envio de Dados**: Dados são enviados para a API CorpMonitor em tempo real
3. **Dashboard**: Visualize os dados coletados no dashboard web
4. **Controle do Usuário**: Usuários podem ativar/desativar o monitoramento

## Dados Coletados

### ✅ Coletados (Seguros)
- Hash de cookies (não os valores)
- Domínios visitados
- Metadados de tracking
- Estrutura de formulários (não dados preenchidos)

### ❌ NÃO Coletados (Privados)
- Senhas ou dados pessoais
- Conteúdo de formulários
- Valores reais de cookies
- Informações bancárias

## Suporte

- **Dashboard**: Acesse o painel CorpMonitor para ver dados coletados
- **Console**: Verifique `chrome://extensions/` > CorpMonitor > "Inspecionar visualizações: worker de serviço"
- **Logs**: Verifique o console do navegador para debug

## Status da Implementação ✅

- [x] Manifest V3 configurado
- [x] Background service worker
- [x] Content script para coleta
- [x] Popup interface completa
- [x] Integração com API CorpMonitor
- [x] Sistema de consentimento
- [x] Controles de ativação/desativação
- [x] Coleta de cookies e metadados
- [x] Build system automatizado

**A extensão está 100% funcional e pronta para uso!**