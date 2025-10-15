#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🔐 Building signed CRX package...');

const distDir = path.join(__dirname, 'dist');
const crxPath = path.join(__dirname, 'corpmonitor.crx');
const pemPath = path.join(__dirname, 'key.pem');

// Verificar se dist/ existe
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ not found. Run "npm run build" first!');
  process.exit(1);
}

try {
  // Gerar chave privada (se não existir)
  if (!fs.existsSync(pemPath)) {
    console.log('🔑 Generating private key...');
    execSync(`openssl genrsa 2048 > "${pemPath}"`);
    console.log('✅ Private key generated: key.pem');
    console.log('⚠️  IMPORTANTE: Guarde este arquivo em local seguro!');
  } else {
    console.log('🔑 Using existing private key: key.pem');
  }
  
  // Empacotar extensão com Chrome
  console.log('📦 Packing extension with Chrome...');
  
  const chromePath = process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome';
  
  execSync(`"${chromePath}" --pack-extension="${distDir}" --pack-extension-key="${pemPath}"`, 
    { stdio: 'inherit' });
  
  // Mover .crx para nome correto
  const generatedCrx = path.join(__dirname, 'dist.crx');
  if (fs.existsSync(generatedCrx)) {
    fs.renameSync(generatedCrx, crxPath);
    console.log(`✅ CRX created: ${crxPath}`);
  }
  
  // Calcular SHA256
  const fileBuffer = fs.readFileSync(crxPath);
  const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  console.log(`🔐 SHA256: ${hashSum}`);
  fs.writeFileSync(path.join(__dirname, 'corpmonitor.sha256'), hashSum);
  
  // Extrair Extension ID do .crx (CRX3 format)
  console.log('\n📋 Extracting Extension ID...');
  
  // CRX3 header: "Cr24" + version (4 bytes) + header length (4 bytes)
  const header = fileBuffer.slice(0, 16);
  const magic = header.slice(0, 4).toString('ascii');
  
  if (magic === 'Cr24') {
    // Read public key from CRX3 header
    const headerLength = header.readUInt32LE(8);
    const publicKeyLength = fileBuffer.readUInt32LE(16);
    const publicKey = fileBuffer.slice(20, 20 + publicKeyLength);
    
    // Extension ID = first 128 bits of SHA256(public_key), base32 encoded with 'a'-'p'
    const publicKeyHash = crypto.createHash('sha256').update(publicKey).digest();
    const extensionId = Array.from(publicKeyHash.slice(0, 16))
      .map(byte => String.fromCharCode(97 + (byte & 0x0f)))
      .join('');
    
    console.log(`✅ Extension ID: ${extensionId}`);
    console.log('\n⚠️  IMPORTANTE: Adicione este ID em:');
    console.log('   1. update.xml: <app appid="' + extensionId + '">');
    console.log('   2. Registry.wxs: [PREENCHER_EXTENSION_ID]');
    console.log('   3. Product.wxs: <?define ExtensionId = "' + extensionId + '" ?>');
    
    // Salvar Extension ID
    fs.writeFileSync(path.join(__dirname, 'extension-id.txt'), extensionId);
    
  } else {
    console.warn('⚠️  Could not extract Extension ID (invalid CRX format)');
    console.log('    Use: https://robwu.nl/crxviewer/ to extract manually');
  }
  
  console.log('\n✅ Build complete!');
  console.log('   Files generated:');
  console.log('   - corpmonitor.crx');
  console.log('   - corpmonitor.sha256');
  console.log('   - extension-id.txt');
  console.log('   - key.pem (KEEP SECURE!)');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
