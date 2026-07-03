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

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  // Replace `(doc) =>`
  if (content.match(/\(doc\) =>/)) {
    content = content.replace(/\(doc\) =>/g, '(doc: any) =>');
    modified = true;
  }
  // Replace `doc =>`
  if (content.match(/ doc =>/)) {
    content = content.replace(/ doc =>/g, ' (doc: any) =>');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log('Fixed implicit any doc in', file);
  }
}
