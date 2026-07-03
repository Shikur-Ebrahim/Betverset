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
  if (c.includes("export const dynamic = 'force-dynamic';")) {
    // Remove all existing ones completely
    c = c.replace(/\n?export const dynamic = 'force-dynamic';\n?/g, '\n');
    // Add safely at the very end
    c += "\nexport const dynamic = 'force-dynamic';\n";
    fs.writeFileSync(f, c);
    console.log('Fixed force-dynamic in', f);
  }
});
