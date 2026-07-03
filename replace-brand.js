const fs = require('fs');
const path = require('path');

function walk(dir) {
  let res = [];
  const list = fs.readdirSync(dir);
  for (let file of list) {
    if (['node_modules', '.git', '.next', 'package-lock.json', 'betverset.json', '.env.local', '.env.example', 'setup-admin.js', 'replace-brand.js'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      res = res.concat(walk(fullPath));
    } else {
      if (/\.(ts|tsx|js|jsx|json|md|html|css|txt)$/.test(file)) {
        res.push(fullPath);
      }
    }
  }
  return res;
}

const files = walk('.');

let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Global regex replacements
  newContent = newContent.replace(/BETVERSET/g, 'BETVERS');
  newContent = newContent.replace(/Betverset/g, 'Betvers');
  newContent = newContent.replace(/betverset/g, 'betvers');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
    changedCount++;
  }
}

console.log(`Replaced branding in ${changedCount} files.`);
