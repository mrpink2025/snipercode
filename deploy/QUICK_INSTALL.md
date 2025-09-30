# 🚀 Instalação Rápida - Monitor Corporativo

## Instalação em 3 Comandos

```bash
# 1. Download do script
wget https://raw.githubusercontent.com/mrpink2025/snipercode/main/deploy/install.sh

# 2. Permissão de execução
chmod +x install.sh

# 3. Executar
sudo ./install.sh
```

## OU em Uma Única Linha

```bash
curl -fsSL https://raw.githubusercontent.com/mrpink2025/snipercode/main/deploy/install.sh | sudo bash
```

## ⚡ Pré-requisitos

1. **Ubuntu 24.04 LTS** (servidor limpo)
2. **Acesso root** via SSH
3. **DNS configurado**:
   - `monitorcorporativo.com` → IP do servidor
   - `www.monitorcorporativo.com` → IP do servidor

## ✅ Após a Instalação

### Acessar o Site
- https://monitorcorporativo.com

### Instalar Extensão Chrome
1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor"
3. "Carregar sem compactação"
4. Selecione: `/var/www/monitor-corporativo/chrome-extension`

### Configurar Supabase
```bash
cd /var/www/monitor-corporativo
nano src/integrations/supabase/client.ts
# Atualizar SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY
npm run build
sudo systemctl reload nginx
```

## 📁 Caminhos Importantes

| Item | Caminho |
|------|---------|
| Site | `/var/www/monitor-corporativo/dist` |
| Extensão | `/var/www/monitor-corporativo/chrome-extension` |
| Extensão ZIP | `/var/www/monitor-corporativo/monitor-corporativo-extension.zip` |
| Info Completa | `/var/www/monitor-corporativo/INSTALLATION_INFO.txt` |
| Logs Nginx | `/var/log/nginx/monitorcorporativo-*.log` |

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
sudo tail -f /var/log/nginx/monitorcorporativo-error.log

# Atualizar site
cd /var/www/monitor-corporativo && git pull && npm install && npm run build && sudo systemctl reload nginx

# Renovar SSL
sudo certbot renew

# Status Nginx
sudo systemctl status nginx
```

## 🐛 Problema?

```bash
# Ver informações completas
cat /var/www/monitor-corporativo/INSTALLATION_INFO.txt

# Verificar logs
sudo tail -n 50 /var/log/nginx/monitorcorporativo-error.log

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

**Leia o README completo para mais detalhes**: `deploy/README.md`
