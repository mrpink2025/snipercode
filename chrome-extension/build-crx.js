#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ChromeExtension = require('crx3');

console.log('🔐 Building signed CRX package...');

const distDir = path.join(__dirname, 'dist');
const crxPath = path.join(__dirname, 'corpmonitor.crx');
const pemPath = path.join(__dirname, 'key.pem');

// Função para gerar chave privada
function generatePrivateKey() {
  console.log('🔑 Generating private key...');
  const { generateKeyPairSync } = require('crypto');
  
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  fs.writeFileSync(pemPath, privateKey);
  console.log('✅ Private key generated: key.pem');
  console.log('⚠️  IMPORTANTE: Guarde este arquivo em local seguro!');
  return privateKey;
}

// Verificar se dist/ existe
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ not found. Run "npm run build" first!');
  process.exit(1);
}

async function buildCrx() {
  try {
    // Carregar ou gerar chave privada
    let privateKey;
    if (fs.existsSync(pemPath)) {
      console.log('🔑 Using existing private key: key.pem');
      privateKey = fs.readFileSync(pemPath);
    } else {
      privateKey = generatePrivateKey();
    }
    
    // Empacotar extensão com crx3
    console.log('📦 Packing extension with crx3...');
    
    const crx = new ChromeExtension({
      privateKey: privateKey
    });
    
    const crxBuffer = await crx.load(distDir).pack();
    fs.writeFileSync(crxPath, crxBuffer);
    console.log(`✅ CRX created: ${crxPath}`);
  
    // Calcular SHA256
    const fileBuffer = fs.readFileSync(crxPath);
    const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    console.log(`🔐 SHA256: ${hashSum}`);
    fs.writeFileSync(path.join(__dirname, 'corpmonitor.sha256'), hashSum);
    
    // Extrair Extension ID usando crx3
    console.log('\n📋 Extracting Extension ID...');
    
    const extensionId = crx.generateAppId();
    console.log(`✅ Extension ID: ${extensionId}`);
    console.log('\n⚠️  IMPORTANTE: Adicione este ID em:');
    console.log('   1. update.xml: <app appid="' + extensionId + '">');
    console.log('   2. Registry.wxs: [PREENCHER_EXTENSION_ID]');
    console.log('   3. Product.wxs: <?define ExtensionId = "' + extensionId + '" ?>');
    
    // Salvar Extension ID
    fs.writeFileSync(path.join(__dirname, 'extension-id.txt'), extensionId);
    
    console.log('\n✅ Build complete!');
    console.log('   Files generated:');
    console.log('   - corpmonitor.crx');
    console.log('   - corpmonitor.sha256');
    console.log('   - extension-id.txt');
    console.log('   - key.pem (KEEP SECURE!)');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar build
buildCrx();
