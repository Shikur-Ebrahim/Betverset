const fs = require('fs');
const path = require('path');
function walk(dir) {
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    f = path.join(dir, f);
    if (fs.statSync(f).isDirectory()) res = res.concat(walk(f));
    else if (f.endsWith('route.ts') || f.endsWith('route.tsx')) res.push(f);
  });
  return res;
}
walk('d:/projects/Betvers/frontend/app/api').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('export const dynamic')) {
    const lines = c.split('\n');
    const importEndIndex = lines.findLastIndex(l => l.startsWith('import '));
    if (importEndIndex !== -1) {
      lines.splice(importEndIndex + 1, 0, '\nexport const dynamic = \'force-dynamic\';');
      fs.writeFileSync(f, lines.join('\n'));
      console.log('Added force-dynamic to', f);
    } else {
      fs.writeFileSync(f, 'export const dynamic = \'force-dynamic\';\n' + c);
      console.log('Added force-dynamic to', f);
    }
  }
});
