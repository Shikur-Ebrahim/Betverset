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
    } else if (file.endsWith('route.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('d:/projects/Betvers/frontend/app/api');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.match(/\{ params \}: \{ params:/)) {
    const regex = /(export async function [A-Z]+\([^,]+,\s*)(\{ params \}: \{ params: (\{[^}]+\}) \})(\)\s*\{)/g;
    let modified = false;
    content = content.replace(regex, (match, p1, p2, p3, p4) => {
      modified = true;
      return `${p1}props: { params: Promise<${p3}> }${p4}\n  const params = await props.params;`;
    });
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log('Modified', file);
    }
  }
}
