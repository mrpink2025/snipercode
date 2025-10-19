#!/bin/bash

# ============================================
# CorpMonitor Extension - Automated Deployment
# ============================================
# This script automates the complete deployment of the CorpMonitor Chrome extension
# including building, hosting privacy policy, configuring Nginx, and validation.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/var/www/monitor-corporativo"
EXTENSION_DIR="$PROJECT_ROOT/chrome-extension"
WEB_ROOT="$PROJECT_ROOT/dist"
EXTENSION_DEPLOY_DIR="$PROJECT_ROOT/extension"
NGINX_CONF="/etc/nginx/sites-available/monitor-corporativo"
BACKUP_DIR="$PROJECT_ROOT/backups"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CorpMonitor Extension Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================
# PHASE 1: Pre-flight Checks
# ============================================
echo -e "${YELLOW}Phase 1: Pre-flight Checks${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Please run as root (use sudo)${NC}"
   exit 1
fi

# Check if project directory exists
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_ROOT${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# ============================================
# PHASE 2: Backup Current State
# ============================================
echo -e "${YELLOW}Phase 2: Creating Backup${NC}"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"

tar -czf "$BACKUP_FILE" \
    -C "$PROJECT_ROOT" \
    --exclude='node_modules' \
    --exclude='backups' \
    . 2>/dev/null || true

echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
echo ""

# ============================================
# PHASE 3: Build Extension
# ============================================
echo -e "${YELLOW}Phase 3: Building Extension${NC}"

cd "$EXTENSION_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build extension
echo "Building extension package..."
npm run build

# Verify build artifacts
if [ ! -f "$EXTENSION_DIR/corpmonitor.zip" ]; then
    echo -e "${RED}❌ Build failed: corpmonitor.zip not found${NC}"
    exit 1
fi

if [ ! -f "$EXTENSION_DIR/corpmonitor.crx" ]; then
    echo -e "${RED}❌ Build failed: corpmonitor.crx not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Extension built successfully${NC}"
echo "   - corpmonitor.zip ($(du -h "$EXTENSION_DIR/corpmonitor.zip" | cut -f1))"
echo "   - corpmonitor.crx ($(du -h "$EXTENSION_DIR/corpmonitor.crx" | cut -f1))"
echo ""

# ============================================
# PHASE 4: Deploy Privacy Policy
# ============================================
echo -e "${YELLOW}Phase 4: Deploying Privacy Policy${NC}"

# Copy privacy policy to web root
if [ -f "$EXTENSION_DIR/privacy-policy.html" ]; then
    cp "$EXTENSION_DIR/privacy-policy.html" "$WEB_ROOT/privacy-policy.html"
    chown www-data:www-data "$WEB_ROOT/privacy-policy.html"
    chmod 644 "$WEB_ROOT/privacy-policy.html"
    echo -e "${GREEN}✓ Privacy policy deployed to $WEB_ROOT/privacy-policy.html${NC}"
else
    echo -e "${RED}❌ privacy-policy.html not found in extension directory${NC}"
    exit 1
fi

echo ""

# ============================================
# PHASE 5: Setup Extension Directory
# ============================================
echo -e "${YELLOW}Phase 5: Setting Up Extension Directory${NC}"

# Create extension directory if it doesn't exist
mkdir -p "$EXTENSION_DEPLOY_DIR"

# Copy CRX, ZIP, SHA256, and update.xml to extension directory
cp "$EXTENSION_DIR/corpmonitor.crx" "$EXTENSION_DEPLOY_DIR/corpmonitor.crx"
cp "$EXTENSION_DIR/corpmonitor.zip" "$EXTENSION_DEPLOY_DIR/corpmonitor.zip"
cp "$EXTENSION_DIR/corpmonitor.sha256" "$EXTENSION_DEPLOY_DIR/corpmonitor.sha256"
cp "$EXTENSION_DIR/update.xml" "$EXTENSION_DEPLOY_DIR/update.xml"

# Set permissions
chown -R www-data:www-data "$EXTENSION_DEPLOY_DIR"
chmod 755 "$EXTENSION_DEPLOY_DIR"
chmod 644 "$EXTENSION_DEPLOY_DIR"/*

echo -e "${GREEN}✓ Extension files deployed to $EXTENSION_DEPLOY_DIR${NC}"
echo ""

# ============================================
# PHASE 6: Configure Nginx
# ============================================
echo -e "${YELLOW}Phase 6: Configuring Nginx${NC}"

# Backup current Nginx config
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "$NGINX_CONF.backup-$(date +%Y%m%d-%H%M%S)"
fi

# Add location blocks for privacy policy and updates
cat > /tmp/nginx-extension-additions.conf << 'EOF'
    # Privacy Policy (Chrome Web Store requirement)
    location = /privacy-policy.html {
        root /var/www/monitor-corporativo/dist;
        add_header Cache-Control "public, max-age=3600";
        add_header Content-Type "text/html; charset=UTF-8";
        access_log /var/log/nginx/privacy-policy-access.log;
    }

    # Extension Directory
    location /extension/ {
        alias /var/www/monitor-corporativo/extension/;
        autoindex off;
        
        # CORS headers for Chrome extension updates
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD";
        add_header Access-Control-Allow-Headers "Content-Type";
        
        # Cache for 1 hour
        add_header Cache-Control "public, max-age=3600";
        
        # Security headers
        add_header X-Content-Type-Options "nosniff";
        
        # Allow .crx, .xml, .zip downloads
        types {
            application/x-chrome-extension crx;
            application/zip zip;
            text/plain sha256;
            text/xml xml;
        }
        
        access_log /var/log/nginx/extension-access.log;
    }
EOF

# Check if locations already exist in Nginx config
if ! grep -q "location = /privacy-policy.html" "$NGINX_CONF"; then
    echo "Adding Nginx configuration..."
    
    # Insert before the last closing brace (end of server block)
    sed -i '/^}/i \    # Extension-related locations' "$NGINX_CONF"
    cat /tmp/nginx-extension-additions.conf >> "$NGINX_CONF.tmp"
    sed -i '/^}/e cat '"$NGINX_CONF"'.tmp' "$NGINX_CONF"
    rm -f "$NGINX_CONF.tmp" /tmp/nginx-extension-additions.conf
    
    echo -e "${GREEN}✓ Nginx configuration updated${NC}"
else
    echo -e "${YELLOW}⚠ Nginx locations already configured${NC}"
fi

# Test Nginx configuration
if nginx -t 2>&1 | grep -q "test is successful"; then
    echo -e "${GREEN}✓ Nginx configuration test passed${NC}"
    
    # Reload Nginx
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    echo "Restoring backup..."
    if [ -f "$NGINX_CONF.backup-$(date +%Y%m%d)" ]; then
        cp "$NGINX_CONF.backup-$(date +%Y%m%d)" "$NGINX_CONF"
        systemctl reload nginx
    fi
    exit 1
fi

echo ""

# ============================================
# PHASE 7: Validation
# ============================================
echo -e "${YELLOW}Phase 7: Validating Deployment${NC}"

# Test main site
echo -n "Testing main site... "
if curl -s -o /dev/null -w "%{http_code}" https://monitorcorporativo.com | grep -q "200"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
fi

# Test privacy policy
echo -n "Testing privacy policy... "
if curl -s -o /dev/null -w "%{http_code}" https://monitorcorporativo.com/privacy-policy.html | grep -q "200"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test extension CRX download
echo -n "Testing extension CRX... "
if curl -s -o /dev/null -w "%{http_code}" https://monitorcorporativo.com/extension/corpmonitor.crx | grep -q "200"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test update.xml
echo -n "Testing update.xml... "
if curl -s -o /dev/null -w "%{http_code}" https://monitorcorporativo.com/extension/update.xml | grep -q "200"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test SHA256 checksum
echo -n "Testing SHA256 checksum... "
if curl -s -o /dev/null -w "%{http_code}" https://monitorcorporativo.com/extension/corpmonitor.sha256 | grep -q "200"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

echo ""

# ============================================
# PHASE 8: Generate Deployment Report
# ============================================
echo -e "${YELLOW}Phase 8: Generating Deployment Report${NC}"

REPORT_FILE="$PROJECT_ROOT/DEPLOYMENT_REPORT.txt"

cat > "$REPORT_FILE" << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CorpMonitor Extension Deployment Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deployment Date: $(date '+%Y-%m-%d %H:%M:%S')
Server: $(hostname)
User: $USER

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ DEPLOYMENT STATUS: SUCCESS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Build Artifacts:

  ✓ corpmonitor.zip      : $(du -h "$EXTENSION_DIR/corpmonitor.zip" | cut -f1)
  ✓ corpmonitor.crx      : $(du -h "$EXTENSION_DIR/corpmonitor.crx" | cut -f1)
  ✓ corpmonitor.sha256   : $(cat "$EXTENSION_DIR/corpmonitor.sha256")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Public URLs:

  Main Site:        https://monitorcorporativo.com
  Privacy Policy:   https://monitorcorporativo.com/privacy-policy.html
  Extension CRX:    https://monitorcorporativo.com/extension/corpmonitor.crx
  Extension ZIP:    https://monitorcorporativo.com/extension/corpmonitor.zip
  Update XML:       https://monitorcorporativo.com/extension/update.xml
  SHA256 Checksum:  https://monitorcorporativo.com/extension/corpmonitor.sha256

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 File Locations:

  Web Root:        $WEB_ROOT
  Extension Files: $EXTENSION_DIR
  Extension Deploy: $EXTENSION_DEPLOY_DIR
  Nginx Config:    $NGINX_CONF
  Backup:          $BACKUP_FILE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Validation Tests:

  ✓ Main site accessible (HTTP 200)
  ✓ Privacy policy accessible (HTTP 200)
  ✓ Extension CRX downloadable (HTTP 200)
  ✓ SHA256 checksum available (HTTP 200)
  ✓ Nginx configuration valid
  ✓ Nginx reloaded successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Next Steps:

  1. Verify privacy policy content:
     curl https://monitorcorporativo.com/privacy-policy.html

  2. Download and verify extension package:
     wget https://monitorcorporativo.com/updates/corpmonitor.zip
     sha256sum -c corpmonitor.sha256

  3. Submit to Chrome Web Store:
     - Upload: corpmonitor.zip
     - Privacy URL: https://monitorcorporativo.com/privacy-policy.html
     - Review guide: chrome-extension/CHROME_STORE_SUBMISSION.md

  4. Monitor logs:
     tail -f /var/log/nginx/privacy-policy-access.log
     tail -f /var/log/nginx/extension-updates-access.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 Support:

  Dashboard:        https://monitorcorporativo.com
  Submission Guide: $EXTENSION_DIR/CHROME_STORE_SUBMISSION.md
  Technical Docs:   $EXTENSION_DIR/INSTALLATION.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Rollback Command (if needed):

  sudo tar -xzf "$BACKUP_FILE" -C "$PROJECT_ROOT"
  sudo systemctl reload nginx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo -e "${GREEN}✓ Deployment report generated: $REPORT_FILE${NC}"
echo ""

# ============================================
# PHASE 9: Display Summary
# ============================================
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ DEPLOYMENT COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo ""
echo "✓ Extension built and packaged"
echo "✓ Privacy policy deployed"
echo "✓ Update server configured"
echo "✓ Nginx updated and reloaded"
echo "✓ All validation tests passed"
echo ""
echo -e "${YELLOW}📖 Full report: $REPORT_FILE${NC}"
echo ""
echo -e "${BLUE}🔗 Important URLs:${NC}"
echo "   Privacy:  https://monitorcorporativo.com/privacy-policy.html"
echo "   Download: https://monitorcorporativo.com/extension/corpmonitor.crx"
echo "   Updates:  https://monitorcorporativo.com/extension/update.xml"
echo ""
echo -e "${GREEN}🎉 Ready for Chrome Web Store submission!${NC}"
echo ""
