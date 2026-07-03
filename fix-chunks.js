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
  
  // Replace `const chunks = [];` with `const chunks: string[][] = [];`
  c = c.replace(/const chunks = \[\];/g, 'const chunks: string[][] = [];');
  
  if (c !== orig) {
    fs.writeFileSync(f, c);
    console.log('Fixed chunks array in', f);
  }
});
