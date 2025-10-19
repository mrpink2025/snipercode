#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CorpMonitor Update Script - Ubuntu 24.04
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$PROJECT_ROOT/chrome-extension"
DEPLOY_DIR="$PROJECT_ROOT/extension"
WEB_ROOT="/var/www/monitor-corporativo/extension"

# Arquivos
CRX_FILE="corpmonitor.crx"
ZIP_FILE="corpmonitor.zip"
SHA256_FILE="corpmonitor.sha256"
UPDATE_XML="update.xml"
KEY_FILE="key.pem"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CorpMonitor Update Script - Ubuntu 24.04${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 1: Validação de Ambiente
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[1/8]${NC} ✅ Validação de ambiente"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}   ✗ Node.js não encontrado!${NC}"
    echo -e "${YELLOW}   Instale com: sudo apt install nodejs npm${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Node.js $(node --version) instalado${NC}"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}   ✗ npm não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ npm $(npm --version) disponível${NC}"

# Verificar Chrome/Chromium
CHROME_BIN=""
if command -v google-chrome &> /dev/null; then
    CHROME_BIN="google-chrome"
elif command -v chromium-browser &> /dev/null; then
    CHROME_BIN="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROME_BIN="chromium"
else
    echo -e "${RED}   ✗ Chrome/Chromium não encontrado!${NC}"
    echo -e "${YELLOW}   Instale com: sudo apt install chromium-browser${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ $CHROME_BIN instalado${NC}"

# Verificar estrutura de pastas
if [ ! -d "$EXTENSION_DIR" ]; then
    echo -e "${RED}   ✗ Pasta chrome-extension/ não encontrada!${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Estrutura de pastas OK${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 2: Build da Extensão
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[2/8]${NC} 🔨 Build da extensão"

cd "$EXTENSION_DIR"

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}   → Instalando dependências...${NC}"
    npm install --silent
fi
echo -e "${GREEN}   ✓ Dependências OK${NC}"

# Build
echo -e "${BLUE}   → Executando npm run build...${NC}"
npm run build > /dev/null 2>&1
echo -e "${GREEN}   ✓ Build concluído${NC}"

# Verificar arquivos gerados
if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}   ✗ corpmonitor.zip não foi gerado!${NC}"
    exit 1
fi
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo -e "${GREEN}   ✓ $ZIP_FILE criado ($ZIP_SIZE)${NC}"

if [ ! -d "dist" ]; then
    echo -e "${RED}   ✗ Pasta dist/ não foi criada!${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ dist/ criado${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 3: Empacota .CRX e Gera Hash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[3/8]${NC} 📦 Empacotando .crx"

# Gerar chave privada se não existir
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${BLUE}   → Gerando key.pem...${NC}"
    openssl genrsa 2048 > "$KEY_FILE" 2>/dev/null
    echo -e "${GREEN}   ✓ key.pem gerado${NC}"
else
    echo -e "${GREEN}   ✓ key.pem existente (reutilizando)${NC}"
fi

# Usar build-crx.js (tem fallbacks: crx3 API → crx3 CLI → Chrome CLI)
echo -e "${BLUE}   → Executando build-crx.js (com fallbacks)...${NC}"
node build-crx.js

# Verificar se .crx foi gerado
if [ ! -f "$CRX_FILE" ]; then
    echo -e "${RED}   ✗ build-crx.js falhou ao criar .crx${NC}"
    echo -e "${YELLOW}   Verifique se 'npm install' foi executado em chrome-extension/${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ $CRX_FILE criado${NC}"

# SHA256 já foi calculado por build-crx.js
if [ -f "$SHA256_FILE" ]; then
    SHA256_HASH=$(cat "$SHA256_FILE" | tr -d '\n')
    echo -e "${GREEN}   ✓ SHA256: ${SHA256_HASH:0:16}...${NC}"
else
    echo -e "${YELLOW}   ⚠ Calculando SHA256 manualmente...${NC}"
    SHA256_HASH=$(sha256sum "$CRX_FILE" | cut -d' ' -f1)
    echo "$SHA256_HASH" > "$SHA256_FILE"
    echo -e "${GREEN}   ✓ SHA256: ${SHA256_HASH:0:16}...${NC}"
fi

# Extension ID já foi gerado por build-crx.js
if [ -f "extension-id.txt" ]; then
    EXTENSION_ID=$(cat extension-id.txt | tr -d '\n')
    echo -e "${GREEN}   ✓ Extension ID: $EXTENSION_ID${NC}"
else
    echo -e "${RED}   ✗ extension-id.txt não foi gerado!${NC}"
    echo -e "${YELLOW}   build-crx.js deveria ter criado este arquivo${NC}"
    exit 1
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 4: Atualiza update.xml
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[4/8]${NC} 📝 Atualizando $UPDATE_XML"

if [ ! -f "$UPDATE_XML" ]; then
    echo -e "${RED}   ✗ $UPDATE_XML não encontrado!${NC}"
    exit 1
fi

# Substituir placeholders
echo -e "${BLUE}   → Substituindo Extension ID...${NC}"
sed -i "s/\[EXTENSION_ID_AQUI\]/$EXTENSION_ID/g" "$UPDATE_XML"
echo -e "${GREEN}   ✓ Extension ID preenchido${NC}"

echo -e "${BLUE}   → Substituindo SHA256 hash...${NC}"
sed -i "s/\[HASH_SHA256_AQUI\]/$SHA256_HASH/g" "$UPDATE_XML"
echo -e "${GREEN}   ✓ SHA256 hash preenchido${NC}"

# Validar que não sobraram placeholders
if grep -q "\[.*_AQUI\]" "$UPDATE_XML"; then
    echo -e "${RED}   ✗ Ainda existem placeholders em $UPDATE_XML!${NC}"
    grep "\[.*_AQUI\]" "$UPDATE_XML"
    exit 1
fi
echo -e "${GREEN}   ✓ Validação OK (sem placeholders)${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 5: Prepara Arquivos para Deploy
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[5/8]${NC} 📂 Preparando arquivos"

# Criar diretório de deploy
mkdir -p "$DEPLOY_DIR"
echo -e "${GREEN}   ✓ Diretório $DEPLOY_DIR criado${NC}"

# Copiar arquivos
cp "$CRX_FILE" "$DEPLOY_DIR/"
cp "$ZIP_FILE" "$DEPLOY_DIR/"
cp "$SHA256_FILE" "$DEPLOY_DIR/"
cp "$UPDATE_XML" "$DEPLOY_DIR/"
echo -e "${GREEN}   ✓ Arquivos copiados${NC}"

# Definir permissões
chmod 644 "$DEPLOY_DIR"/*
chmod 755 "$DEPLOY_DIR"
echo -e "${GREEN}   ✓ Permissões definidas (644/755)${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 6: Deploy HTTPS no Servidor
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[6/8]${NC} 🚀 Deploy HTTPS"

# Verificar se Nginx está instalado
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}   ✗ Nginx não encontrado!${NC}"
    echo -e "${YELLOW}   Instale com: sudo apt install nginx${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Nginx instalado${NC}"

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    echo -e "${YELLOW}   ⚠ Nginx não está rodando, iniciando...${NC}"
    sudo systemctl start nginx
fi
echo -e "${GREEN}   ✓ Nginx rodando${NC}"

# Criar diretório no servidor
sudo mkdir -p "$WEB_ROOT"
echo -e "${GREEN}   ✓ Diretório $WEB_ROOT criado${NC}"

# Copiar arquivos
echo -e "${BLUE}   → Copiando arquivos para $WEB_ROOT...${NC}"
sudo cp "$DEPLOY_DIR/$CRX_FILE" "$WEB_ROOT/"
sudo cp "$DEPLOY_DIR/$ZIP_FILE" "$WEB_ROOT/"
sudo cp "$DEPLOY_DIR/$SHA256_FILE" "$WEB_ROOT/"
sudo cp "$DEPLOY_DIR/$UPDATE_XML" "$WEB_ROOT/"
echo -e "${GREEN}   ✓ Arquivos copiados${NC}"

# Definir permissões e ownership
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo chmod -R 755 "$WEB_ROOT"
echo -e "${GREEN}   ✓ Permissões e ownership definidos${NC}"

# Recarregar Nginx
echo -e "${BLUE}   → Recarregando Nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}   ✓ Nginx recarregado${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 7: Validação Final
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${YELLOW}[7/8]${NC} ✅ Validação final"

# URLs
BASE_URL="https://monitorcorporativo.com/extension"
UPDATE_XML_URL="$BASE_URL/update.xml"
CRX_URL="$BASE_URL/corpmonitor.crx"
SHA256_URL="$BASE_URL/corpmonitor.sha256"

# Testar update.xml
echo -e "${BLUE}   → Testando $UPDATE_XML_URL...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$UPDATE_XML_URL")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✓ update.xml acessível (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}   ✗ update.xml inacessível (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}   Verifique se Certbot está configurado para HTTPS${NC}"
fi

# Testar CRX
echo -e "${BLUE}   → Testando $CRX_URL...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CRX_URL")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✓ corpmonitor.crx acessível (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}   ⚠ corpmonitor.crx retornou HTTP $HTTP_CODE${NC}"
fi

# Validar SHA256
echo -e "${BLUE}   → Validando integridade SHA256...${NC}"
REMOTE_SHA256=$(curl -s "$SHA256_URL" 2>/dev/null | tr -d '\n')
if [ "$REMOTE_SHA256" = "$SHA256_HASH" ]; then
    echo -e "${GREEN}   ✓ SHA256 válido${NC}"
else
    echo -e "${YELLOW}   ⚠ SHA256 remoto não corresponde ao local${NC}"
fi

# Validar update.xml não tem placeholders
echo -e "${BLUE}   → Validando update.xml remoto...${NC}"
REMOTE_XML=$(curl -s "$UPDATE_XML_URL")
if echo "$REMOTE_XML" | grep -q "\[.*_AQUI\]"; then
    echo -e "${RED}   ✗ update.xml ainda contém placeholders!${NC}"
else
    echo -e "${GREEN}   ✓ update.xml sem placeholders${NC}"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASSO 8: Resumo
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ UPDATE COMPLETO COM SUCESSO!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📦 Arquivos prontos:${NC}"
echo -e "   ✓ chrome-extension/$CRX_FILE"
echo -e "   ✓ chrome-extension/$UPDATE_XML (ID e hash preenchidos)"
echo -e "   ✓ chrome-extension/$ZIP_FILE (para Web Store)"
echo -e "   ✓ $WEB_ROOT/$CRX_FILE"
echo ""

echo -e "${YELLOW}🌐 URLs HTTPS ativos:${NC}"
echo -e "   ✓ $CRX_URL"
echo -e "   ✓ $UPDATE_XML_URL"
echo -e "   ✓ $SHA256_URL"
echo ""

echo -e "${YELLOW}🚀 Próximos passos:${NC}"
echo -e "   1. Testar instalação GPO no Windows"
echo -e "   2. Verificar update.xml no navegador: $UPDATE_XML_URL"
echo -e "   3. Monitorar logs: tail -f /var/log/nginx/access.log"
echo ""

echo -e "${YELLOW}📋 Extension ID para GPO:${NC}"
echo -e "   $EXTENSION_ID"
echo ""

echo -e "${YELLOW}🔧 Rollback (se necessário):${NC}"
echo -e "   sudo rm -rf $WEB_ROOT/*"
echo ""

echo -e "${GREEN}🎉 Sistema pronto para produção!${NC}"
echo ""

# Gerar relatório
REPORT_FILE="$PROJECT_ROOT/DEPLOYMENT_REPORT.txt"
cat > "$REPORT_FILE" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CorpMonitor Deployment Report
  $(date '+%Y-%m-%d %H:%M:%S')
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Build Information:
   Extension ID: $EXTENSION_ID
   SHA256 Hash: $SHA256_HASH
   CRX Size: $(du -h "$EXTENSION_DIR/$CRX_FILE" | cut -f1)
   ZIP Size: $ZIP_SIZE

🌐 Public URLs:
   CRX: $CRX_URL
   Update XML: $UPDATE_XML_URL
   SHA256: $SHA256_URL

📂 File Locations:
   Local: $EXTENSION_DIR/
   Staging: $DEPLOY_DIR/
   Production: $WEB_ROOT/

✅ Validation Results:
   update.xml: HTTP $HTTP_CODE
   SHA256: $([ "$REMOTE_SHA256" = "$SHA256_HASH" ] && echo "Valid" || echo "Mismatch")
   Placeholders: $(grep -q "\[.*_AQUI\]" "$UPDATE_XML" && echo "Found" || echo "None")

🔧 Chrome Extension Policy (GPO):
   ExtensionInstallForcelist:
     1: {
       "id": "$EXTENSION_ID",
       "update_url": "$UPDATE_XML_URL"
     }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo -e "${GREEN}✓ Relatório salvo em: $REPORT_FILE${NC}"
echo ""
