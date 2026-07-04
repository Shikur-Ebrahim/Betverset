$files = @(
  'components\home-page-client.tsx',
  'components\BetSlipDrawer.tsx',
  'components\DepositModal.tsx',
  'components\WithdrawalModal.tsx',
  'components\BetHistory.tsx',
  'components\TransactionHistory.tsx',
  'components\AccountSettings.tsx',
  'components\match-detail-view.tsx',
  'components\match-detail-page-client.tsx',
  'components\WithdrawalDailyLimitBanner.tsx',
  'components\WithdrawalDepositRuleBanner.tsx',
  'components\check-ticket-client.tsx'
)

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8

    # Fix lime green buttons - text should be black not white
    $content = $content.Replace('bg-[#7CFF00] text-black', 'bg-[#7CFF00]')
    $content = $content.Replace('bg-[#7CFF00] font-bold text-white', 'bg-[#7CFF00] font-bold text-black')
    $content = $content.Replace('bg-[#7CFF00] hover', 'bg-[#7CFF00] text-black hover')
    $content = $content.Replace('text-white shadow-md transition-colors hover:bg-[#5BE000]', 'text-black shadow-md transition-colors hover:bg-[#5BE000]')
    $content = $content.Replace('font-bold text-white shadow-md transition-colors hover:bg-[#5BE000]', 'font-bold text-black shadow-md transition-colors hover:bg-[#5BE000]')

    # Background replacements (dark theme)
    $content = $content.Replace('bg-white', 'bg-[#18181B]')
    $content = $content.Replace('bg-[#0D1117]', 'bg-[#09090B]')
    $content = $content.Replace('bg-[#161B22]', 'bg-[#111111]')
    $content = $content.Replace('bg-[#21262D]', 'bg-[#202024]')
    $content = $content.Replace('bg-[#30363D]', 'bg-[#27272A]')
    $content = $content.Replace('bg-[#F1F5F9]', 'bg-[#27272A]')
    $content = $content.Replace('bg-[#FFF7ED]', 'bg-[rgba(124,255,0,0.08)]')
    $content = $content.Replace('bg-[#FEE2E2]', 'bg-[rgba(239,68,68,0.10)]')

    # Border replacements
    $content = $content.Replace('border-[#30363D]', 'border-[rgba(255,255,255,0.08)]')
    $content = $content.Replace('border-[#E2E8F0]', 'border-[rgba(255,255,255,0.08)]')
    $content = $content.Replace('border-[#CBD5E1]', 'border-[rgba(255,255,255,0.10)]')
    $content = $content.Replace('border-white', 'border-[rgba(255,255,255,0.10)]')

    # Text color replacements
    $content = $content.Replace('text-[#1A202C]', 'text-white')
    $content = $content.Replace('text-[#4A5568]', 'text-[#A1A1AA]')
    $content = $content.Replace('text-[#8B949E]', 'text-[#71717A]')
    $content = $content.Replace('text-[#C9D1D9]', 'text-[#A1A1AA]')
    $content = $content.Replace('text-[#A0AEC0]', 'text-[#71717A]')
    $content = $content.Replace('text-[#94A3B8]', 'text-[#71717A]')

    # Hover backgrounds
    $content = $content.Replace('hover:bg-[#F1F5F9]', 'hover:bg-[#202024]')
    $content = $content.Replace('hover:bg-[#21262D]', 'hover:bg-[#202024]')
    $content = $content.Replace('hover:bg-[#30363D]', 'hover:bg-[#27272A]')
    $content = $content.Replace('hover:bg-[#484F58]', 'hover:bg-[#27272A]')
    $content = $content.Replace('hover:bg-[#FFF7ED]', 'hover:bg-[rgba(124,255,0,0.08)]')
    $content = $content.Replace('hover:bg-[#FEE2E2]', 'hover:bg-[rgba(239,68,68,0.10)]')
    $content = $content.Replace('hover:text-[#1A202C]', 'hover:text-white')

    # Placeholder colors
    $content = $content.Replace('placeholder-[#94A3B8]', 'placeholder-[#52525B]')
    $content = $content.Replace('placeholder-[#A0AEC0]', 'placeholder-[#52525B]')

    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $file"
  }
}
Write-Host 'Done!'
