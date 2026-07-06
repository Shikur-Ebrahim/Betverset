const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-[#E8EDF5]': 'bg-[#1E293B]',
  'bg-[#DDE4EE]': 'bg-[#273549]',
  'bg-[#F5F9FF]': 'bg-[#0F172A]',
  'bg-[#E6EEFF]': 'bg-[#111827]',
  'bg-[#E2E8F0]': 'bg-[#334155]',
  'bg-[#D3DBE8]': 'bg-[#334155]',
  'text-[#6B7280]': 'text-[#94A3B8]',
  'text-[#8B949E]': 'text-[#94A3B8]',
  'text-[#30363D]': 'text-[#CBD5E1]',
  'text-[#4B5563]': 'text-[#CBD5E1]',
  'border-[rgba(0,0,0,0.08)]': 'border-[#334155]',
  'border-[rgba(0,0,0,0.12)]': 'border-[#334155]',
  'border-[rgba(0,0,0,0.12)]/40': 'border-[#334155]',
  'bg-[rgba(37,99,235,0.08)]': 'bg-[#273549]',
  'text-black': 'text-[#FFFFFF]',
  'text-[#111827]': 'text-[#FFFFFF]',
  'text-[#1A202C]': 'text-[#FFFFFF]',
  'bg-[var(--site-surface-soft)]': 'bg-[#1E293B]',
  'bg-[var(--site-surface)]': 'bg-[#1E293B]',
  'bg-[var(--site-bg)]': 'bg-[#0F172A]'
};

const filePaths = [
  path.join(__dirname, 'components/home-page-client.tsx'),
  path.join(__dirname, 'components/match-detail-view.tsx'),
  path.join(__dirname, 'components/match-odds-client.tsx'),
  path.join(__dirname, 'components/BetSlipDrawer.tsx'),
  path.join(__dirname, 'components/BottomNavigation.tsx')
];

filePaths.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
