const fs = require('fs');
const path = require('path');
function walk(dir) {
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    f = path.join(dir, f);
    if (fs.statSync(f).isDirectory()) res = res.concat(walk(f));
    else if (f.endsWith('.ts')) res.push(f);
  });
  return res;
}
walk('d:/projects/Betvers/frontend/app/api').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;
  
  c = c.replace(/\b([a-zA-Z0-9_]+) =>/g, '($1: any) =>');
  
  if (c !== orig) {
    fs.writeFileSync(f, c);
    console.log('Fixed arrow funcs in', f);
  }
});
