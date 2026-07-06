const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, 'components'),
  path.join(__dirname, 'app')
];

const replacements = {
  'bg-[#FFFFFF]': 'bg-[var(--site-surface)]',
  'bg-white': 'bg-[var(--site-surface)]',
  'bg-[#F8FAFC]': 'bg-[var(--site-bg)]',
  'bg-[#EEF4FF]': 'bg-[var(--site-surface-soft)]',
  'bg-[#F1F5F9]': 'bg-[var(--site-surface-soft)]',
  'text-[#111827]': 'text-white',
  'text-[#1A202C]': 'text-white',
  'text-gray-900': 'text-white',
  'text-gray-800': 'text-gray-200',
  'text-gray-700': 'text-gray-300',
  'text-gray-600': 'text-gray-400',
  'text-slate-900': 'text-white',
  'text-slate-800': 'text-gray-200',
  'border-gray-100': 'border-[var(--site-border)]',
  'border-gray-200': 'border-[var(--site-border)]',
  'border-slate-100': 'border-[var(--site-border)]',
  'border-slate-200': 'border-[var(--site-border)]',
  'border-[#E2E8F0]': 'border-[var(--site-border)]',
  'border-[#F1F5F9]': 'border-[var(--site-border)]',
  'border-[#CBD5E1]': 'border-[var(--site-border-strong)]',
  'bg-slate-50': 'bg-[var(--site-bg)]',
  'bg-gray-50': 'bg-[var(--site-bg)]',
  'text-black': 'text-white'
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

let files = [];
directories.forEach(d => {
  if (fs.existsSync(d)) {
    files = files.concat(walkDir(d));
  }
});

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    // Simple split-join to replace all occurrences literally
    content = content.split(key).join(value);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated correctly:', file);
  }
});
