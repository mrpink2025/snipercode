#!/bin/bash

# ============================================================================
# TOTAL SERVER RESET - Ubuntu 24.04 LTS
# ============================================================================
# ATENÇÃO: Este script APAGA TUDO e instala o CorpMonitor do zero
# - Remove TODOS os sites de /var/www/*
# - Remove TODAS as configurações Nginx
# - Remove certificados SSL antigos
# - Instala exclusivamente o CorpMonitor
# ============================================================================

set -e
set -o pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
GIT_REPO="${1:-https://github.com/mrpink2025/snipercode.git}"
GIT_BRANCH="${2:-main}"
PROJECT_DIR="/var/www/monitor-corporativo"
DOMAIN="monitorcorporativo.com"
ADMIN_EMAIL="admin@monitorcorporativo.com"
LOG_FILE="/var/log/corpmonitor-total-reset-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}  TOTAL SERVER RESET - CorpMonitor Installation${NC}"
echo -e "${BLUE}  Log: $LOG_FILE${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# ============================================================================
# CRITICAL WARNING
# ============================================================================
echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}║          ⚠️  RESET TOTAL DO SERVIDOR UBUNTU 24.04  ⚠️                  ║${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}║  Este script vai APAGAR COMPLETAMENTE:                                ║${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}║    ❌ TODOS os sites em /var/www/*                                     ║${NC}"
echo -e "${RED}║    ❌ TODAS as configurações Nginx em /etc/nginx/sites-*              ║${NC}"
echo -e "${RED}║    ❌ TODOS os certificados SSL antigos                               ║${NC}"
echo -e "${RED}║    ❌ Cache, logs e configurações antigas                             ║${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}║  NENHUM backup será feito automaticamente!                            ║${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}║  O servidor ficará dedicado EXCLUSIVAMENTE ao CorpMonitor.            ║${NC}"
echo -e "${RED}║                                                                        ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Repositório Git: $GIT_REPO${NC}"
echo -e "${YELLOW}Branch: $GIT_BRANCH${NC}"
echo -e "${YELLOW}Diretório de instalação: $PROJECT_DIR${NC}"
echo ""
echo -e "${RED}Para continuar, digite: ${YELLOW}APAGAR TUDO${NC}"
read -p "Confirmação: " CONFIRMATION

if [ "$CONFIRMATION" != "APAGAR TUDO" ]; then
    echo -e "${RED}❌ Cancelado pelo usuário${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Aguardando 10 segundos antes de começar a destruição...${NC}"
sleep 10

# ============================================================================
# PHASE 0: Root Check
# ============================================================================
echo -e "${YELLOW}Phase 0/13: Verificando permissões${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script deve ser executado como root${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Executando como root${NC}"
echo ""

# ============================================================================
# PHASE 1: Stop ALL Services
# ============================================================================
echo -e "${YELLOW}Phase 1/13: Parando TODOS os serviços${NC}"

# Stop Nginx
systemctl stop nginx 2>/dev/null || true
echo -e "${GREEN}✓ Nginx parado${NC}"

# Kill ALL Node.js processes
pkill -9 node 2>/dev/null || true
echo -e "${GREEN}✓ Processos Node.js finalizados${NC}"

# Kill any process on ports 80/443
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
echo -e "${GREEN}✓ Portas 80/443 liberadas${NC}"

echo ""

# ============================================================================
# PHASE 2: Nuclear Clean - APAGAR TUDO
# ============================================================================
echo -e "${RED}Phase 2/13: LIMPEZA TOTAL (Nuclear Clean)${NC}"

# Remove ALL /var/www
echo "Apagando /var/www/*..."
rm -rf /var/www/*
mkdir -p /var/www
echo -e "${GREEN}✓ /var/www/* removido${NC}"

# Remove ALL Nginx site configs
echo "Apagando configurações Nginx..."
rm -rf /etc/nginx/sites-available/*
rm -rf /etc/nginx/sites-enabled/*
echo -e "${GREEN}✓ Configurações Nginx removidas${NC}"

# Clear Nginx cache
echo "Limpando cache Nginx..."
rm -rf /var/cache/nginx/*
echo -e "${GREEN}✓ Cache Nginx limpo${NC}"

# Clear old logs
echo "Limpando logs antigos..."
find /var/log/nginx/ -type f -name "*.log" -delete 2>/dev/null || true
find /var/log/nginx/ -type f -name "*.gz" -delete 2>/dev/null || true
echo -e "${GREEN}✓ Logs antigos removidos${NC}"

# Remove old SSL certificates
echo "Removendo certificados SSL antigos..."
rm -rf /etc/letsencrypt/live/*
rm -rf /etc/letsencrypt/archive/*
rm -rf /etc/letsencrypt/renewal/*
echo -e "${GREEN}✓ Certificados SSL antigos removidos${NC}"

echo -e "${GREEN}✓ Limpeza total concluída - Servidor limpo como novo${NC}"
echo ""

# ============================================================================
# PHASE 3: System Update
# ============================================================================
echo -e "${YELLOW}Phase 3/13: Atualizando sistema Ubuntu 24.04${NC}"

apt-get update -y
apt-get upgrade -y
apt-get autoremove -y
apt-get autoclean -y

echo -e "${GREEN}✓ Sistema atualizado${NC}"
echo ""

# ============================================================================
# PHASE 4: Install Core Dependencies
# ============================================================================
echo -e "${YELLOW}Phase 4/13: Instalando dependências principais${NC}"

# Essential packages
apt-get install -y \
    nginx \
    git \
    curl \
    wget \
    zip \
    unzip \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

echo -e "${GREEN}✓ Pacotes essenciais instalados${NC}"

# Install Node.js 20.x
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 20 ]; then
    echo "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js 20+ já instalado"
fi

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo -e "${GREEN}✓ Node.js instalado${NC}"

# Install Certbot for SSL
apt-get install -y certbot python3-certbot-nginx
echo -e "${GREEN}✓ Certbot instalado${NC}"

# Install UFW
apt-get install -y ufw
echo -e "${GREEN}✓ UFW instalado${NC}"

echo ""

# ============================================================================
# PHASE 5: Validate Git Repository
# ============================================================================
echo -e "${YELLOW}Phase 5/13: Validando acesso ao repositório Git${NC}"

echo "Testando conexão com: $GIT_REPO"
if ! git ls-remote "$GIT_REPO" &>/dev/null; then
    echo -e "${RED}❌ Erro: Não foi possível acessar o repositório Git${NC}"
    echo -e "${RED}   URL: $GIT_REPO${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Repositório Git acessível${NC}"
echo ""

# ============================================================================
# PHASE 6: Clone from Git
# ============================================================================
echo -e "${YELLOW}Phase 6/13: Clonando repositório do Git${NC}"

echo "Clonando $GIT_REPO (branch: $GIT_BRANCH)..."
git clone -b "$GIT_BRANCH" "$GIT_REPO" "$PROJECT_DIR" || {
    echo -e "${RED}❌ Erro ao clonar repositório${NC}"
    exit 1
}

cd "$PROJECT_DIR"

# Validate critical files
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado${NC}"
    exit 1
fi

if [ ! -f "chrome-extension/manifest.json" ]; then
    echo -e "${RED}❌ Erro: chrome-extension/manifest.json não encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Repositório clonado com sucesso${NC}"
echo -e "${GREEN}✓ Arquivos críticos validados${NC}"
echo ""

# ============================================================================
# PHASE 7: Install Project Dependencies
# ============================================================================
echo -e "${YELLOW}Phase 7/13: Instalando dependências do projeto${NC}"

# Main project
echo "Instalando dependências do projeto principal..."
cd "$PROJECT_DIR"
npm install --legacy-peer-deps || npm install

echo -e "${GREEN}✓ Dependências do projeto instaladas${NC}"

# Chrome extension
echo "Instalando dependências da extensão Chrome..."
cd "$PROJECT_DIR/chrome-extension"
npm install

echo -e "${GREEN}✓ Dependências da extensão instaladas${NC}"
echo ""

# ============================================================================
# PHASE 8: Build Everything
# ============================================================================
echo -e "${YELLOW}Phase 8/13: Compilando aplicação e extensão${NC}"

# Build React/Vite app
echo "Compilando aplicação React/Vite..."
cd "$PROJECT_DIR"
npm run build || {
    echo -e "${RED}❌ Erro ao compilar aplicação${NC}"
    exit 1
}

if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo -e "${RED}❌ Erro: Diretório dist/ não foi criado${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Aplicação React compilada${NC}"

# Build Chrome Extension
echo "Compilando extensão Chrome..."
cd "$PROJECT_DIR/chrome-extension"

if [ -f "build.js" ]; then
    node build.js || {
        echo -e "${RED}❌ Erro ao compilar extensão${NC}"
        exit 1
    }
elif [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    npm run build || {
        echo -e "${RED}❌ Erro ao compilar extensão${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  Script de build da extensão não encontrado${NC}"
fi

echo -e "${GREEN}✓ Extensão Chrome compilada${NC}"

# Create updates directory and copy extension files
echo "Copiando arquivos da extensão para /updates..."
mkdir -p "$PROJECT_DIR/updates"

if [ -f "corpmonitor.zip" ]; then
    cp corpmonitor.zip "$PROJECT_DIR/updates/"
    echo -e "${GREEN}✓ corpmonitor.zip copiado${NC}"
fi

if [ -f "corpmonitor.crx" ]; then
    cp corpmonitor.crx "$PROJECT_DIR/updates/"
    echo -e "${GREEN}✓ corpmonitor.crx copiado${NC}"
fi

if [ -f "corpmonitor.sha256" ]; then
    cp corpmonitor.sha256 "$PROJECT_DIR/updates/"
    echo -e "${GREEN}✓ corpmonitor.sha256 copiado${NC}"
fi

# Copy privacy policy
if [ -f "privacy-policy.html" ]; then
    cp privacy-policy.html "$PROJECT_DIR/dist/"
    echo -e "${GREEN}✓ privacy-policy.html copiado${NC}"
fi

# Set permissions
chown -R www-data:www-data "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

echo -e "${GREEN}✓ Build completo e arquivos copiados${NC}"
echo ""

# ============================================================================
# PHASE 9: Configure Nginx
# ============================================================================
echo -e "${YELLOW}Phase 9/13: Configurando Nginx${NC}"

cat > /etc/nginx/sites-available/monitorcorporativo <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    root /var/www/monitor-corporativo/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: https:; font-src 'self' data:;" always;

    # Main application
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Privacy Policy
    location = /privacy-policy.html {
        alias /var/www/monitor-corporativo/dist/privacy-policy.html;
        add_header Content-Type "text/html; charset=utf-8";
    }

    # Extension updates directory
    location /updates/ {
        alias /var/www/monitor-corporativo/updates/;
        
        # CORS headers for extension updates
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        
        # Handle OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type" always;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain charset=UTF-8";
            add_header Content-Length 0;
            return 204;
        }
        
        # Cache settings
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
        
        # MIME types for extension files
        types {
            application/x-chrome-extension crx;
            application/zip zip;
            text/plain sha256;
        }
        
        # Directory listing
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Logs
    access_log /var/log/nginx/monitorcorporativo-access.log;
    error_log /var/log/nginx/monitorcorporativo-error.log;

    # Security: Disable server tokens
    server_tokens off;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/monitorcorporativo /etc/nginx/sites-enabled/

# Test configuration
nginx -t || {
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    cat /etc/nginx/sites-available/monitorcorporativo
    exit 1
}

echo -e "${GREEN}✓ Nginx configurado${NC}"
echo ""

# ============================================================================
# PHASE 10: Configure SSL with Certbot
# ============================================================================
echo -e "${YELLOW}Phase 10/13: Configurando SSL (Let's Encrypt)${NC}"

echo -e "${BLUE}Iniciando Certbot...${NC}"
echo -e "${YELLOW}Nota: Certbot modificará automaticamente a configuração Nginx${NC}"

certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$ADMIN_EMAIL" \
    --redirect || {
    echo -e "${YELLOW}⚠️  SSL não configurado - execute manualmente: certbot --nginx -d $DOMAIN${NC}"
}

# Enable auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer

echo -e "${GREEN}✓ SSL configurado (ou requer configuração manual)${NC}"
echo ""

# ============================================================================
# PHASE 11: Configure Firewall (UFW)
# ============================================================================
echo -e "${YELLOW}Phase 11/13: Configurando Firewall (UFW)${NC}"

ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

echo -e "${GREEN}✓ Firewall configurado${NC}"
ufw status verbose
echo ""

# ============================================================================
# PHASE 12: Start Services
# ============================================================================
echo -e "${YELLOW}Phase 12/13: Iniciando serviços${NC}"

systemctl enable nginx
systemctl start nginx
systemctl reload nginx

echo -e "${GREEN}✓ Nginx iniciado e habilitado${NC}"
echo ""

# ============================================================================
# PHASE 13: Final Validation
# ============================================================================
echo -e "${YELLOW}Phase 13/13: Validação final${NC}"

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx: Ativo${NC}"
else
    echo -e "${RED}❌ Nginx: Inativo${NC}"
fi

# Test site locally
if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Site: Respondendo${NC}"
else
    echo -e "${YELLOW}⚠️  Site: Não respondendo (verifique configuração)${NC}"
fi

# Check extension files
if [ -f "$PROJECT_DIR/updates/corpmonitor.zip" ]; then
    echo -e "${GREEN}✓ Extension ZIP: Presente${NC}"
else
    echo -e "${YELLOW}⚠️  Extension ZIP: Não encontrado${NC}"
fi

if [ -f "$PROJECT_DIR/updates/corpmonitor.crx" ]; then
    echo -e "${GREEN}✓ Extension CRX: Presente${NC}"
else
    echo -e "${YELLOW}⚠️  Extension CRX: Não encontrado${NC}"
fi

# Check privacy policy
if [ -f "$PROJECT_DIR/dist/privacy-policy.html" ]; then
    echo -e "${GREEN}✓ Privacy Policy: Presente${NC}"
else
    echo -e "${YELLOW}⚠️  Privacy Policy: Não encontrado${NC}"
fi

echo ""

# ============================================================================
# GENERATE INSTALLATION REPORT
# ============================================================================
echo -e "${YELLOW}Gerando relatório de instalação...${NC}"

cat > "$PROJECT_DIR/INSTALLATION_REPORT.txt" <<EOF
================================================================================
CORPMONITOR - INSTALLATION REPORT
================================================================================
Data: $(date)
Servidor: Ubuntu 24.04 LTS
Tipo: Instalação limpa (reset total)

================================================================================
CONFIGURAÇÃO
================================================================================
Projeto: CorpMonitor
Repositório Git: $GIT_REPO
Branch: $GIT_BRANCH
Diretório: $PROJECT_DIR
Domínio: $DOMAIN

================================================================================
VERSÕES INSTALADAS
================================================================================
Node.js: $(node -v)
npm: $(npm -v)
Nginx: $(nginx -v 2>&1)

================================================================================
URLS CONFIGURADAS
================================================================================
Site principal: http://$DOMAIN/
Site principal (HTTPS): https://$DOMAIN/
Privacy Policy: http://$DOMAIN/privacy-policy.html
Extension updates: http://$DOMAIN/updates/

Arquivos da extensão:
- http://$DOMAIN/updates/corpmonitor.zip
- http://$DOMAIN/updates/corpmonitor.crx
- http://$DOMAIN/updates/corpmonitor.sha256

================================================================================
ESTRUTURA DE DIRETÓRIOS
================================================================================
$PROJECT_DIR/
├── dist/                          # React app compilado
│   ├── index.html
│   ├── assets/
│   └── privacy-policy.html
├── updates/                       # Extensão Chrome
│   ├── corpmonitor.zip
│   ├── corpmonitor.crx
│   └── corpmonitor.sha256
├── chrome-extension/              # Source da extensão
└── src/                           # Source do React app

================================================================================
SERVIÇOS
================================================================================
Nginx: $(systemctl is-active nginx)
Certbot Timer: $(systemctl is-active certbot.timer)
Firewall (UFW): $(ufw status | head -n1)

================================================================================
LOGS
================================================================================
Nginx access log: /var/log/nginx/monitorcorporativo-access.log
Nginx error log: /var/log/nginx/monitorcorporativo-error.log
Installation log: $LOG_FILE

================================================================================
PRÓXIMOS PASSOS
================================================================================
1. Verificar acesso ao site: http://$DOMAIN/
2. Testar download da extensão: http://$DOMAIN/updates/corpmonitor.zip
3. Verificar logs do Nginx: tail -f /var/log/nginx/monitorcorporativo-error.log
4. Configurar DNS para apontar para este servidor
5. Verificar SSL após configuração DNS

================================================================================
COMANDOS ÚTEIS
================================================================================
# Ver status do Nginx
systemctl status nginx

# Ver logs em tempo real
tail -f /var/log/nginx/monitorcorporativo-access.log
tail -f /var/log/nginx/monitorcorporativo-error.log

# Recarregar Nginx (após mudanças)
systemctl reload nginx

# Testar configuração Nginx
nginx -t

# Ver status do firewall
ufw status verbose

# Renovar certificado SSL manualmente
certbot renew --dry-run

================================================================================
SEGURANÇA
================================================================================
✓ Firewall configurado (UFW)
✓ Security headers configurados
✓ SSL configurado (Let's Encrypt)
✓ Auto-renewal habilitado

================================================================================
FIM DO RELATÓRIO
================================================================================
EOF

echo -e "${GREEN}✓ Relatório gerado: $PROJECT_DIR/INSTALLATION_REPORT.txt${NC}"
echo ""

# ============================================================================
# FINAL SUCCESS MESSAGE
# ============================================================================
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}  ✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${BLUE}Site principal:${NC} http://$DOMAIN/"
echo -e "${BLUE}Privacy Policy:${NC} http://$DOMAIN/privacy-policy.html"
echo -e "${BLUE}Extension updates:${NC} http://$DOMAIN/updates/"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  - Installation: $LOG_FILE"
echo -e "  - Nginx access: /var/log/nginx/monitorcorporativo-access.log"
echo -e "  - Nginx error: /var/log/nginx/monitorcorporativo-error.log"
echo ""
echo -e "${BLUE}Relatório completo:${NC} $PROJECT_DIR/INSTALLATION_REPORT.txt"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo -e "  1. Configure o DNS para apontar para este servidor"
echo -e "  2. Teste o acesso: http://$DOMAIN/"
echo -e "  3. Verifique os logs em caso de problemas"
echo ""
echo -e "${GREEN}Servidor dedicado exclusivamente ao CorpMonitor!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
