const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('d:/projects/Betvers/frontend/app/api');
const libFiles = walk('d:/projects/Betvers/frontend/lib');
const allFiles = [...files, ...libFiles];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  if (content.includes('async (transaction) =>')) {
    content = content.replace(/async \(transaction\) =>/g, 'async (transaction: any) =>');
    modified = true;
  }
  if (content.includes('async (tx) =>')) {
    content = content.replace(/async \(tx\) =>/g, 'async (tx: any) =>');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log('Fixed implicit any transaction in', file);
  }
}
