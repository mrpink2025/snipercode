#!/usr/bin/env node

// Build script for CorpMonitor Chrome Extension
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building CorpMonitor Chrome Extension...');

// Create build directory
const buildDir = path.join(__dirname, 'dist');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Copy extension files
const filesToCopy = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'content.js'
];

console.log('📁 Copying extension files...');
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(buildDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   ✓ ${file}`);
  } else {
    console.warn(`   ⚠️  ${file} not found`);
  }
});

// Create icons directory and copy icons
const iconsDir = path.join(buildDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate simple icons (you can replace with actual icons)
console.log('🎨 Generating icons...');
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  // For now, create placeholder files - replace with actual PNG generation
  fs.writeFileSync(iconPath, `Icon ${size}x${size} placeholder`);
  console.log(`   ✓ icon${size}.png`);
});

// Create .crx package (requires Chrome browser)
console.log('📦 Creating .crx package...');
try {
  // Note: This requires Chrome to be installed and in PATH
  const crxPath = path.join(__dirname, 'corpmonitor-extension.crx');
  
  // Create zip for manual installation
  const zipPath = path.join(__dirname, 'corpmonitor-extension.zip');
  
  if (process.platform === 'win32') {
    // Windows
    execSync(`powershell Compress-Archive -Path "${buildDir}\\*" -DestinationPath "${zipPath}" -Force`);
  } else {
    // Unix-like systems
    execSync(`cd "${buildDir}" && zip -r "${zipPath}" .`);
  }
  
  console.log(`   ✓ Extension package created: ${zipPath}`);
} catch (error) {
  console.warn('   ⚠️  Could not create .crx package. Manual packaging required.');
  console.log('   💡 Upload the dist/ folder to Chrome Web Store or load as unpacked extension.');
}

// Generate installation instructions
const instructionsPath = path.join(__dirname, 'INSTALLATION.md');
const instructions = `# CorpMonitor Extension Installation

## Development Installation (Unpacked)

1. Open Chrome and navigate to \`chrome://extensions/\`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" button
4. Select the \`dist/\` folder from this directory
5. The extension should now appear in your extensions list

## Production Installation (.zip)

1. Use the generated \`corpmonitor-extension.zip\` file
2. Upload to Chrome Web Store for distribution
3. Or install locally by extracting and loading as unpacked

## Enterprise Deployment

For corporate deployment, use Group Policy with the following settings:

### Registry Keys (Windows)
\`\`\`
[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
"1"="[EXTENSION_ID];https://clients2.google.com/service/update2/crx"
\`\`\`

### Chrome ADMX Template
Include the extension ID in your Chrome ADMX policy template.

## Verification

After installation, you should see:
- 🛡️ CorpMonitor icon in the Chrome toolbar
- Extension popup when clicking the icon
- Monitoring capabilities active (with user consent)

## Troubleshooting

- **Extension not loading**: Check Chrome developer mode is enabled
- **No icon showing**: Verify manifest.json and icon files are correct
- **Monitoring not working**: Check extension permissions and user consent

## Support

For technical support, contact your IT administrator or refer to the CorpMonitor dashboard at your corporate portal.
`;

fs.writeFileSync(instructionsPath, instructions);
console.log(`📖 Installation instructions created: ${instructionsPath}`);

console.log('');
console.log('✅ Build completed successfully!');
console.log('');
console.log('Next steps:');
console.log('1. Review the dist/ folder contents');
console.log('2. Test the extension by loading it unpacked in Chrome');
console.log('3. Read INSTALLATION.md for deployment instructions');
console.log('4. Package for distribution when ready');
console.log('');
console.log('🎉 CorpMonitor Chrome Extension is ready!');