#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔐 Building CRX manually with openssl + zip..."

# FASE 1: Validar dist/
if [ ! -d "dist" ]; then
  echo "❌ dist/ não encontrado! Execute: npm run build"
  exit 1
fi

if [ ! -f "dist/manifest.json" ]; then
  echo "❌ manifest.json não encontrado em dist/"
  exit 1
fi

echo "✅ dist/ validated"

# FASE 2: Gerar key.pem se não existir
if [ ! -f "key.pem" ]; then
  echo "🔑 Generating private key..."
  openssl genrsa 2048 > key.pem 2>/dev/null
  echo "✅ key.pem generated"
else
  echo "✅ Using existing key.pem"
fi

# FASE 3: Extrair chave pública e gerar Extension ID
echo "📋 Extracting public key..."
openssl rsa -in key.pem -pubout -outform DER > public-key.der 2>/dev/null

echo "🔑 Generating Extension ID..."
EXTENSION_ID=$(openssl dgst -sha256 -binary public-key.der | \
  xxd -p -c 256 | \
  head -c 32 | \
  tr '0-9a-f' 'a-p')

echo "✅ Extension ID: $EXTENSION_ID"
echo "$EXTENSION_ID" > extension-id.txt

# FASE 4: Criar ZIP do dist/
echo "📦 Creating ZIP archive..."
cd dist
zip -qr ../extension.zip .
cd ..
echo "✅ extension.zip created"

# FASE 5: Gerar assinatura
echo "🔐 Signing extension..."
openssl dgst -sha256 -binary extension.zip > signature.bin
openssl rsautl -sign -inkey key.pem -in signature.bin > signature.sig

# FASE 6: Construir CRX (formato CRX3)
echo "🧩 Building CRX file..."

PUBLIC_KEY_LEN=$(stat -c%s public-key.der 2>/dev/null || stat -f%z public-key.der)
SIGNATURE_LEN=$(stat -c%s signature.sig 2>/dev/null || stat -f%z signature.sig)

# Criar header binário
printf 'Cr24' > corpmonitor.crx
printf '\x03\x00\x00\x00' >> corpmonitor.crx

# Converter tamanhos para little-endian
printf '%08x' $PUBLIC_KEY_LEN | sed 's/\(..\)\(..\)\(..\)\(..\)/\\x\4\\x\3\\x\2\\x\1/' | xargs printf >> corpmonitor.crx
printf '%08x' $SIGNATURE_LEN | sed 's/\(..\)\(..\)\(..\)\(..\)/\\x\4\\x\3\\x\2\\x\1/' | xargs printf >> corpmonitor.crx

# Adicionar public key, signature e ZIP
cat public-key.der >> corpmonitor.crx
cat signature.sig >> corpmonitor.crx
cat extension.zip >> corpmonitor.crx

echo "✅ corpmonitor.crx created"

# FASE 7: Calcular SHA256 do CRX
echo "🔐 Calculating SHA256..."
SHA256=$(sha256sum corpmonitor.crx 2>/dev/null | cut -d' ' -f1 || shasum -a 256 corpmonitor.crx | cut -d' ' -f1)
echo "$SHA256" > corpmonitor.sha256
echo "✅ SHA256: $SHA256"

# FASE 8: Ler versão do manifest
VERSION=$(grep -oP '"version":\s*"\K[^"]+' dist/manifest.json)
echo "📋 Version: $VERSION"

# FASE 9: Gerar update.xml
echo "📝 Generating update.xml..."
cat > update.xml << EOF
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$EXTENSION_ID'>
    <updatecheck 
      codebase='https://chamanasortebet.net/extension/corpmonitor.crx' 
      version='$VERSION' 
      hash_sha256='$SHA256' />
  </app>
</gupdate>
EOF

echo "✅ update.xml generated"

# FASE 10: Limpar arquivos temporários
rm -f public-key.der signature.bin signature.sig extension.zip

# FASE 11: Resumo
echo ""
echo "✅ Build complete!"
echo "   Files generated:"
CRX_SIZE=$(stat -c%s corpmonitor.crx 2>/dev/null | awk '{print int($1/1024)}' || stat -f%z corpmonitor.crx | awk '{print int($1/1024)}')
echo "   - corpmonitor.crx ($CRX_SIZE KB)"
echo "   - corpmonitor.sha256"
echo "   - extension-id.txt (ID: $EXTENSION_ID)"
echo "   - update.xml"
echo "   - key.pem (KEEP SECURE!)"
echo ""
echo "🚀 Next steps:"
echo "   1. sudo bash update-all.sh"
echo "   2. Test: https://chamanasortebet.net/extension/update.xml"
