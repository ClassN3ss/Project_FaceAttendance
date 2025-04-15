const fs = require('fs');
const path = require('path');

const dir = 'node_modules/face-api.js/build/es6';

function removeSourceMapComments(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const updated = content.replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  fs.writeFileSync(filePath, updated, 'utf-8');
}

function walk(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js')) {
      removeSourceMapComments(fullPath);
      console.log('✅ cleaned:', fullPath);
    }
  }
}

walk(dir);
