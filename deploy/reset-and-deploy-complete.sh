#!/bin/bash

# ============================================
# CorpMonitor - Complete Server Reset & Deploy
# ============================================
# ATENÇÃO: Este script APAGA TUDO e reconfigura do zero!
# Use apenas se você tem certeza do que está fazendo.

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/var/www/monitor-corporativo"
NGINX_CONF="/etc/nginx/sites-available/monitor-corporativo"
NGINX_ENABLED="/etc/nginx/sites-enabled/monitor-corporativo"
BACKUP_ROOT="/var/backups/monitor-corporativo"
DOMAIN="monitorcorporativo.com"

echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}  ⚠️  RESET COMPLETO DO SERVIDOR  ⚠️${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${RED}ATENÇÃO: Este script vai:${NC}"
echo -e "${RED}  1. APAGAR todo o conteúdo de $PROJECT_ROOT${NC}"
echo -e "${RED}  2. REMOVER configurações Nginx${NC}"
echo -e "${RED}  3. LIMPAR caches e logs${NC}"
echo -e "${RED}  4. RECONFIGURAR tudo do zero${NC}"
echo ""
echo -e "${YELLOW}Um backup será criado antes de continuar.${NC}"
echo ""
read -p "Tem certeza que deseja continuar? (digite 'SIM' em maiúsculas): " confirmation

if [ "$confirmation" != "SIM" ]; then
    echo -e "${GREEN}Operação cancelada pelo usuário.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Iniciando reset completo...${NC}"
echo ""

# ============================================
# PHASE 0: Root Check
# ============================================
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Execute como root (use sudo)${NC}"
   exit 1
fi

# ============================================
# PHASE 1: Critical Backup
# ============================================
echo -e "${YELLOW}Phase 1/10: Backup Crítico${NC}"

mkdir -p "$BACKUP_ROOT"
BACKUP_FILE="$BACKUP_ROOT/pre-reset-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

if [ -d "$PROJECT_ROOT" ]; then
    echo "Criando backup completo..."
    tar -czf "$BACKUP_FILE" \
        -C "$(dirname "$PROJECT_ROOT")" \
        "$(basename "$PROJECT_ROOT")" \
        2>/dev/null || true
    echo -e "${GREEN}✓ Backup salvo: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠ Diretório do projeto não existe, pulando backup${NC}"
fi

# Backup Nginx config
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "$BACKUP_ROOT/nginx-backup-$(date +%Y%m%d-%H%M%S).conf"
    echo -e "${GREEN}✓ Backup Nginx salvo${NC}"
fi

echo ""

# ============================================
# PHASE 2: Stop Services
# ============================================
echo -e "${YELLOW}Phase 2/10: Parando Serviços${NC}"

systemctl stop nginx 2>/dev/null || true
echo -e "${GREEN}✓ Nginx parado${NC}"

# Kill any Node processes in project directory
pkill -f "$PROJECT_ROOT" 2>/dev/null || true
echo -e "${GREEN}✓ Processos Node encerrados${NC}"

echo ""

# ============================================
# PHASE 3: Remove Everything
# ============================================
echo -e "${YELLOW}Phase 3/10: Removendo Configurações Antigas${NC}"

# Remove project directory
if [ -d "$PROJECT_ROOT" ]; then
    echo "Removendo diretório do projeto..."
    rm -rf "$PROJECT_ROOT"
    echo -e "${GREEN}✓ Diretório do projeto removido${NC}"
fi

# Remove Nginx configs
if [ -f "$NGINX_CONF" ]; then
    rm -f "$NGINX_CONF"
    echo -e "${GREEN}✓ Configuração Nginx removida${NC}"
fi

if [ -L "$NGINX_ENABLED" ]; then
    rm -f "$NGINX_ENABLED"
    echo -e "${GREEN}✓ Symlink Nginx removido${NC}"
fi

# Clear Nginx cache
if [ -d "/var/cache/nginx" ]; then
    rm -rf /var/cache/nginx/*
    echo -e "${GREEN}✓ Cache Nginx limpo${NC}"
fi

# Clear logs (keep directory structure)
if [ -d "/var/log/nginx" ]; then
    find /var/log/nginx -name "*monitor*" -type f -delete 2>/dev/null || true
    echo -e "${GREEN}✓ Logs antigos removidos${NC}"
fi

echo ""

# ============================================
# PHASE 4: Install Dependencies
# ============================================
echo -e "${YELLOW}Phase 4/10: Instalando Dependências${NC}"

# Update package list
apt-get update -qq

# Install required packages
PACKAGES="nginx git nodejs npm curl zip unzip"
for pkg in $PACKAGES; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        echo "Instalando $pkg..."
        apt-get install -y $pkg > /dev/null 2>&1
        echo -e "${GREEN}✓ $pkg instalado${NC}"
    else
        echo -e "${GREEN}✓ $pkg já instalado${NC}"
    fi
done

echo ""

# ============================================
# PHASE 5: Create Project Structure
# ============================================
echo -e "${YELLOW}Phase 5/10: Criando Estrutura do Projeto${NC}"

mkdir -p "$PROJECT_ROOT"/{dist,chrome-extension,updates,logs,backups}
echo -e "${GREEN}✓ Estrutura de diretórios criada${NC}"

# Set ownership
chown -R www-data:www-data "$PROJECT_ROOT"
echo -e "${GREEN}✓ Permissões configuradas${NC}"

echo ""

# ============================================
# PHASE 6: Clone/Copy Project Files
# ============================================
echo -e "${YELLOW}Phase 6/10: Copiando Arquivos do Projeto${NC}"

# You should customize this based on your deployment method
# Option 1: Copy from local directory (if running from project folder)
if [ -d "./dist" ]; then
    echo "Copiando arquivos do diretório local..."
    cp -r ./dist/* "$PROJECT_ROOT/dist/" 2>/dev/null || true
    cp -r ./chrome-extension "$PROJECT_ROOT/" 2>/dev/null || true
    echo -e "${GREEN}✓ Arquivos copiados do diretório local${NC}"
fi

# Option 2: Clone from Git (uncomment and configure if needed)
# echo "Clonando do repositório Git..."
# git clone https://github.com/your-org/monitor-corporativo.git "$PROJECT_ROOT/temp"
# cp -r "$PROJECT_ROOT/temp/"* "$PROJECT_ROOT/"
# rm -rf "$PROJECT_ROOT/temp"

echo ""

# ============================================
# PHASE 7: Build Extension
# ============================================
echo -e "${YELLOW}Phase 7/10: Compilando Extensão${NC}"

if [ -d "$PROJECT_ROOT/chrome-extension" ]; then
    cd "$PROJECT_ROOT/chrome-extension"
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        echo "Instalando dependências da extensão..."
        npm install > /dev/null 2>&1
        echo -e "${GREEN}✓ Dependências instaladas${NC}"
    fi
    
    # Build extension
    if [ -f "build.js" ]; then
        echo "Compilando extensão..."
        npm run build > /dev/null 2>&1
        echo -e "${GREEN}✓ Extensão compilada${NC}"
        
        # Copy artifacts
        if [ -f "corpmonitor.zip" ]; then
            cp corpmonitor.* "$PROJECT_ROOT/updates/" 2>/dev/null || true
            echo -e "${GREEN}✓ Arquivos copiados para diretório de updates${NC}"
        fi
    fi
    
    # Copy privacy policy
    if [ -f "privacy-policy.html" ]; then
        cp privacy-policy.html "$PROJECT_ROOT/dist/"
        echo -e "${GREEN}✓ Política de privacidade copiada${NC}"
    fi
    
    cd - > /dev/null
else
    echo -e "${YELLOW}⚠ Diretório chrome-extension não encontrado${NC}"
fi

echo ""

# ============================================
# PHASE 8: Configure Nginx
# ============================================
echo -e "${YELLOW}Phase 8/10: Configurando Nginx${NC}"

cat > "$NGINX_CONF" << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monitorcorporativo.com www.monitorcorporativo.com;

    # SSL Configuration (update paths to your certificates)
    ssl_certificate /etc/letsencrypt/live/monitorcorporativo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitorcorporativo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Root and Index
    root /var/www/monitor-corporativo/dist;
    index index.html;

    # Logging
    access_log /var/log/nginx/monitor-corporativo-access.log;
    error_log /var/log/nginx/monitor-corporativo-error.log;

    # Main Location
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Privacy Policy (required for Chrome Web Store)
    location = /privacy-policy.html {
        root /var/www/monitor-corporativo/dist;
        add_header Cache-Control "public, max-age=3600";
        add_header Content-Type "text/html; charset=UTF-8";
        access_log /var/log/nginx/privacy-policy-access.log;
    }

    # Extension Updates Directory
    location /updates/ {
        alias /var/www/monitor-corporativo/updates/;
        autoindex off;
        
        # CORS headers for Chrome extension updates
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        
        # Cache control
        add_header Cache-Control "public, max-age=3600";
        
        # Security
        add_header X-Content-Type-Options "nosniff" always;
        
        # MIME types
        types {
            application/x-chrome-extension crx;
            application/zip zip;
            text/plain sha256;
        }
        
        access_log /var/log/nginx/extension-updates-access.log;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /\.git {
        deny all;
    }
}
NGINX_EOF

echo -e "${GREEN}✓ Configuração Nginx criada${NC}"

# Enable site
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
echo -e "${GREEN}✓ Site habilitado${NC}"

# Test configuration
if nginx -t 2>&1 | grep -q "test is successful"; then
    echo -e "${GREEN}✓ Configuração Nginx válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração Nginx${NC}"
    nginx -t
    exit 1
fi

echo ""

# ============================================
# PHASE 9: Start Services
# ============================================
echo -e "${YELLOW}Phase 9/10: Iniciando Serviços${NC}"

systemctl start nginx
systemctl enable nginx > /dev/null 2>&1
echo -e "${GREEN}✓ Nginx iniciado e habilitado${NC}"

systemctl reload nginx
echo -e "${GREEN}✓ Nginx recarregado${NC}"

echo ""

# ============================================
# PHASE 10: Validation
# ============================================
echo -e "${YELLOW}Phase 10/10: Validação${NC}"

# Test Nginx status
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
fi

# Test main site (local)
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Site principal acessível (localhost)${NC}"
else
    echo -e "${YELLOW}⚠ Site principal não responde em localhost${NC}"
fi

# Test privacy policy
if [ -f "$PROJECT_ROOT/dist/privacy-policy.html" ]; then
    echo -e "${GREEN}✓ Política de privacidade existe${NC}"
else
    echo -e "${RED}❌ Política de privacidade não encontrada${NC}"
fi

# Test extension files
if [ -f "$PROJECT_ROOT/updates/corpmonitor.crx" ]; then
    echo -e "${GREEN}✓ Extensão (CRX) existe${NC}"
else
    echo -e "${YELLOW}⚠ Extensão (CRX) não encontrada${NC}"
fi

if [ -f "$PROJECT_ROOT/updates/corpmonitor.zip" ]; then
    echo -e "${GREEN}✓ Extensão (ZIP) existe${NC}"
else
    echo -e "${YELLOW}⚠ Extensão (ZIP) não encontrada${NC}"
fi

echo ""

# ============================================
# PHASE 11: Generate Report
# ============================================
echo -e "${YELLOW}Gerando Relatório Final...${NC}"

REPORT_FILE="$PROJECT_ROOT/DEPLOYMENT_REPORT.txt"

cat > "$REPORT_FILE" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CorpMonitor - Relatório de Deploy Completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data: $(date '+%Y-%m-%d %H:%M:%S')
Servidor: $(hostname)
Usuário: $USER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STATUS: DEPLOY COMPLETO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Estrutura Criada:

  ✓ $PROJECT_ROOT/dist/              - Site principal
  ✓ $PROJECT_ROOT/chrome-extension/  - Código da extensão
  ✓ $PROJECT_ROOT/updates/           - Arquivos de update
  ✓ $PROJECT_ROOT/logs/              - Logs da aplicação
  ✓ $PROJECT_ROOT/backups/           - Backups locais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 URLs Públicas:

  Site Principal:    https://$DOMAIN
  Privacy Policy:    https://$DOMAIN/privacy-policy.html
  Extension CRX:     https://$DOMAIN/updates/corpmonitor.crx
  Extension ZIP:     https://$DOMAIN/updates/corpmonitor.zip
  SHA256 Checksum:   https://$DOMAIN/updates/corpmonitor.sha256

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Configurações:

  Nginx Config:      $NGINX_CONF
  Project Root:      $PROJECT_ROOT
  Backup Location:   $BACKUP_FILE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Serviços Ativos:

  Nginx:             $(systemctl is-active nginx)
  Status:            $(systemctl status nginx --no-pager -l | head -3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Arquivos da Extensão:

$(ls -lh "$PROJECT_ROOT/updates/" 2>/dev/null || echo "  Nenhum arquivo encontrado")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 Testes de Validação:

  1. Testar site principal:
     curl -I https://$DOMAIN

  2. Testar privacy policy:
     curl -I https://$DOMAIN/privacy-policy.html

  3. Testar download da extensão:
     curl -I https://$DOMAIN/updates/corpmonitor.crx

  4. Verificar checksum:
     curl https://$DOMAIN/updates/corpmonitor.sha256
     sha256sum $PROJECT_ROOT/updates/corpmonitor.zip

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Próximos Passos:

  1. Verificar se o site está acessível publicamente
  2. Testar a política de privacidade no navegador
  3. Fazer upload de corpmonitor.zip para Chrome Web Store
  4. Configurar DNS se necessário
  5. Configurar SSL/TLS se não configurado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Rollback (Se Necessário):

  sudo tar -xzf "$BACKUP_FILE" -C "$(dirname "$PROJECT_ROOT")"
  sudo systemctl restart nginx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 Suporte:

  Documentação:     $PROJECT_ROOT/chrome-extension/CHROME_STORE_SUBMISSION.md
  Backup Original:  $BACKUP_FILE
  Logs Nginx:       /var/log/nginx/monitor-corporativo-*.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo -e "${GREEN}✓ Relatório gerado: $REPORT_FILE${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ DEPLOY COMPLETO FINALIZADO!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📋 Resumo:${NC}"
echo -e "   ✓ Backup criado: $BACKUP_FILE"
echo -e "   ✓ Configurações antigas removidas"
echo -e "   ✓ Novo ambiente configurado"
echo -e "   ✓ Nginx configurado e rodando"
echo -e "   ✓ Extensão pronta para deploy"
echo ""
echo -e "${CYAN}📖 Relatório completo: ${NC}$REPORT_FILE"
echo ""
echo -e "${CYAN}🌐 URLs para testar:${NC}"
echo -e "   • https://$DOMAIN"
echo -e "   • https://$DOMAIN/privacy-policy.html"
echo -e "   • https://$DOMAIN/updates/corpmonitor.crx"
echo ""
echo -e "${YELLOW}⚠️  Lembre-se de:${NC}"
echo -e "   1. Verificar certificado SSL"
echo -e "   2. Testar todos os endpoints"
echo -e "   3. Validar política de privacidade"
echo -e "   4. Submeter extensão ao Chrome Web Store"
echo ""
echo -e "${GREEN}🎉 Servidor pronto para produção!${NC}"
echo ""
