#!/bin/bash

################################################################################
# Script de Instalação Automática - Monitor Corporativo
# Ubuntu 24.04 LTS
# Domínio: monitorcorporativo.com
################################################################################

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis de configuração
DOMAIN="monitorcorporativo.com"
GITHUB_REPO="https://github.com/mrpink2025/snipercode"
PROJECT_DIR="/var/www/monitor-corporativo"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
EXTENSION_BUILD_DIR="$PROJECT_DIR/chrome-extension"
SITE_BUILD_DIR="$PROJECT_DIR/dist"

# Função para log colorido
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script deve ser executado como root (use sudo)"
   exit 1
fi

log_info "Iniciando instalação do Monitor Corporativo..."
log_info "Domínio: $DOMAIN"
log_info "GitHub: $GITHUB_REPO"

################################################################################
# 1. ATUALIZAR SISTEMA
################################################################################
log_info "Atualizando sistema..."
apt-get update -y
apt-get upgrade -y

################################################################################
# 2. INSTALAR DEPENDÊNCIAS BASE
################################################################################
log_info "Instalando dependências base..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    zip \
    unzip

################################################################################
# 3. INSTALAR NODE.JS 20.x
################################################################################
log_info "Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verificar instalação
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log_success "Node.js $NODE_VERSION instalado"
log_success "npm $NPM_VERSION instalado"

################################################################################
# 4. INSTALAR NGINX
################################################################################
log_info "Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
log_success "Nginx instalado e iniciado"

################################################################################
# 5. INSTALAR CERTBOT (Let's Encrypt)
################################################################################
log_info "Instalando Certbot para SSL..."
apt-get install -y certbot python3-certbot-nginx
log_success "Certbot instalado"

################################################################################
# 6. CLONAR REPOSITÓRIO
################################################################################
log_info "Clonando repositório do GitHub..."
if [ -d "$PROJECT_DIR" ]; then
    log_warning "Diretório já existe. Removendo..."
    rm -rf "$PROJECT_DIR"
fi

mkdir -p /var/www
cd /var/www
git clone "$GITHUB_REPO" monitor-corporativo
cd "$PROJECT_DIR"
log_success "Repositório clonado com sucesso"

################################################################################
# 7. INSTALAR DEPENDÊNCIAS DO PROJETO
################################################################################
log_info "Instalando dependências do projeto..."
npm install
log_success "Dependências instaladas"

################################################################################
# 8. COMPILAR O SITE (BUILD VITE)
################################################################################
log_info "Compilando o site..."
npm run build
if [ -d "$SITE_BUILD_DIR" ]; then
    log_success "Site compilado com sucesso: $SITE_BUILD_DIR"
else
    log_error "Erro ao compilar o site. Diretório dist não encontrado."
    exit 1
fi

################################################################################
# 9. COMPILAR A EXTENSÃO CHROME
################################################################################
log_info "Compilando extensão Chrome..."
cd "$EXTENSION_BUILD_DIR"

# Verificar se existe package.json
if [ -f "package.json" ]; then
    npm install
fi

# Executar build da extensão se existir script
if [ -f "build.js" ]; then
    node build.js
    log_success "Extensão compilada usando build.js"
elif [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    npm run build
    log_success "Extensão compilada usando npm run build"
else
    log_warning "Nenhum script de build encontrado para extensão"
fi

# Criar ZIP da extensão
EXTENSION_ZIP="$PROJECT_DIR/monitor-corporativo-extension.zip"
cd "$EXTENSION_BUILD_DIR"
zip -r "$EXTENSION_ZIP" . -x "*.git*" -x "node_modules/*" -x "*.log"
log_success "Extensão empacotada: $EXTENSION_ZIP"

################################################################################
# 10. CONFIGURAR NGINX
################################################################################
log_info "Configurando Nginx..."

# Criar arquivo de configuração
cat > "$NGINX_SITES_AVAILABLE/monitorcorporativo" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    root $SITE_BUILD_DIR;
    index index.html;

    # Logs
    access_log /var/log/nginx/monitorcorporativo-access.log;
    error_log /var/log/nginx/monitorcorporativo-error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Main location
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Disable logging for favicon
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }

    # Disable logging for robots.txt
    location = /robots.txt {
        log_not_found off;
        access_log off;
    }
}
EOF

# Criar symlink
ln -sf "$NGINX_SITES_AVAILABLE/monitorcorporativo" "$NGINX_SITES_ENABLED/"

# Remover default se existir
if [ -f "$NGINX_SITES_ENABLED/default" ]; then
    rm "$NGINX_SITES_ENABLED/default"
fi

# Testar configuração
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    log_success "Nginx configurado e recarregado"
else
    log_error "Erro na configuração do Nginx"
    exit 1
fi

################################################################################
# 11. CONFIGURAR SSL (Let's Encrypt)
################################################################################
log_info "Configurando SSL com Let's Encrypt..."
log_warning "IMPORTANTE: Certifique-se que os DNS do domínio $DOMAIN apontam para este servidor!"
log_warning "Aguardando 10 segundos antes de continuar..."
sleep 10

# Obter certificado SSL
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN --redirect

if [ $? -eq 0 ]; then
    log_success "SSL configurado com sucesso!"
else
    log_warning "Erro ao configurar SSL. Você pode executar manualmente: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

# Configurar renovação automática
systemctl enable certbot.timer
systemctl start certbot.timer
log_success "Renovação automática de SSL configurada"

################################################################################
# 12. CONFIGURAR FIREWALL (UFW)
################################################################################
log_info "Configurando firewall..."
apt-get install -y ufw
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw status
log_success "Firewall configurado"

################################################################################
# 13. CRIAR ARQUIVO DE INFORMAÇÕES
################################################################################
INFO_FILE="$PROJECT_DIR/INSTALLATION_INFO.txt"
cat > "$INFO_FILE" <<EOF
================================================================================
MONITOR CORPORATIVO - INFORMAÇÕES DE INSTALAÇÃO
================================================================================

Data de Instalação: $(date)
Sistema Operacional: Ubuntu 24.04 LTS

================================================================================
CAMINHOS E LOCALIZAÇÃO DOS ARQUIVOS
================================================================================

Diretório do Projeto:
  $PROJECT_DIR

Site Compilado (Frontend):
  $SITE_BUILD_DIR
  
Extensão Chrome (Código Fonte):
  $EXTENSION_BUILD_DIR
  
Extensão Chrome (ZIP para Instalação):
  $EXTENSION_ZIP

Configuração Nginx:
  $NGINX_SITES_AVAILABLE/monitorcorporativo

Logs Nginx:
  Access: /var/log/nginx/monitorcorporativo-access.log
  Error: /var/log/nginx/monitorcorporativo-error.log

================================================================================
URLS E ACESSO
================================================================================

Site Principal:
  https://$DOMAIN
  https://www.$DOMAIN

Protocolo: HTTPS (SSL Let's Encrypt)

================================================================================
EXTENSÃO CHROME - INSTRUÇÕES DE INSTALAÇÃO
================================================================================

1. Abra o Chrome e vá para: chrome://extensions/
2. Ative o "Modo do desenvolvedor" (canto superior direito)
3. Clique em "Carregar sem compactação"
4. Selecione a pasta: $EXTENSION_BUILD_DIR

OU

1. Faça download do arquivo: $EXTENSION_ZIP
2. Descompacte em uma pasta local
3. Siga os passos acima

================================================================================
COMANDOS ÚTEIS
================================================================================

Ver logs do Nginx em tempo real:
  tail -f /var/log/nginx/monitorcorporativo-error.log

Recarregar Nginx:
  sudo systemctl reload nginx

Verificar status do Nginx:
  sudo systemctl status nginx

Renovar SSL manualmente:
  sudo certbot renew

Atualizar site (após mudanças):
  cd $PROJECT_DIR
  git pull
  npm install
  npm run build
  sudo systemctl reload nginx

Recompilar extensão:
  cd $EXTENSION_BUILD_DIR
  node build.js
  zip -r $EXTENSION_ZIP . -x "*.git*" -x "node_modules/*"

================================================================================
VERSÕES INSTALADAS
================================================================================

Node.js: $(node --version)
npm: $(npm --version)
Nginx: $(nginx -v 2>&1)

================================================================================
PRÓXIMOS PASSOS
================================================================================

1. ✅ Verifique se o site está acessível em https://$DOMAIN
2. ✅ Instale a extensão Chrome seguindo as instruções acima
3. ✅ Configure as variáveis de ambiente se necessário
4. ✅ Configure o Supabase e atualize as credenciais
5. ✅ Teste todas as funcionalidades do sistema

================================================================================
SUPORTE
================================================================================

Para problemas ou dúvidas:
- Verifique os logs do Nginx
- Verifique os logs do sistema: journalctl -xe
- Repositório: $GITHUB_REPO

================================================================================
EOF

log_success "Arquivo de informações criado: $INFO_FILE"

################################################################################
# 14. RESUMO FINAL
################################################################################
echo ""
echo "================================================================================"
log_success "INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "================================================================================"
echo ""
log_info "📁 CAMINHOS IMPORTANTES:"
echo "   Site: $SITE_BUILD_DIR"
echo "   Extensão: $EXTENSION_BUILD_DIR"
echo "   Extensão ZIP: $EXTENSION_ZIP"
echo ""
log_info "🌐 URLS:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
log_info "📋 ARQUIVO DE INFORMAÇÕES:"
echo "   $INFO_FILE"
echo ""
log_info "🔧 PRÓXIMOS PASSOS:"
echo "   1. Acesse https://$DOMAIN para verificar o site"
echo "   2. Instale a extensão Chrome de: $EXTENSION_BUILD_DIR"
echo "   3. Configure as credenciais do Supabase no arquivo .env"
echo "   4. Leia o arquivo: cat $INFO_FILE"
echo ""
echo "================================================================================"

# Exibir conteúdo do arquivo de info
cat "$INFO_FILE"
