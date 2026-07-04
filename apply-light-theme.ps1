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

    # Primary colors
    $content = $content.Replace('#7CFF00', '#10B981')
    $content = $content.Replace('#5BE000', '#059669')

    # Backgrounds
    $content = $content.Replace('bg-[#09090B]', 'bg-[#F8FAFC]')
    $content = $content.Replace('bg-[#18181B]', 'bg-[#FFFFFF]')
    $content = $content.Replace('bg-[#202024]', 'bg-[#F1F5F9]')
    $content = $content.Replace('bg-[#111111]', 'bg-[#FFFFFF]')
    $content = $content.Replace('bg-[#27272A]', 'bg-[#F3F4F6]')
    
    # Background hovers
    $content = $content.Replace('hover:bg-[#202024]', 'hover:bg-[#F1F5F9]')
    $content = $content.Replace('hover:bg-[#27272A]', 'hover:bg-[#E5E7EB]')

    # Text Colors
    $content = $content.Replace('text-white', 'text-[#111827]')
    $content = $content.Replace('text-[#FFFFFF]', 'text-[#111827]')
    $content = $content.Replace('text-[#71717A]', 'text-[#6B7280]')
    $content = $content.Replace('text-[#A1A1AA]', 'text-[#4B5563]')
    $content = $content.Replace('text-[#52525B]', 'text-[#6B7280]')
    $content = $content.Replace('text-black', 'text-white') # Buttons that had black text now need white text on green
    $content = $content.Replace('text-[#000]', 'text-white')

    # Text hovers
    $content = $content.Replace('hover:text-white', 'hover:text-[#111827]')

    # Borders & Shadows
    $content = $content.Replace('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)')
    $content = $content.Replace('rgba(255, 255, 255, 0.08)', 'rgba(0,0,0,0.08)')
    $content = $content.Replace('rgba(255,255,255,0.10)', 'rgba(0,0,0,0.12)')
    $content = $content.Replace('rgba(255,255,255,0.1)', 'rgba(0,0,0,0.1)')
    $content = $content.Replace('rgba(255,255,255,0.06)', 'rgba(0,0,0,0.06)')
    $content = $content.Replace('rgba(255,255,255,0.04)', 'rgba(0,0,0,0.04)')

    # Primary opacity
    $content = $content.Replace('rgba(124,255,0,0.10)', 'rgba(16,185,129,0.10)')
    $content = $content.Replace('rgba(124, 255, 0, 0.10)', 'rgba(16,185,129,0.10)')
    $content = $content.Replace('rgba(124,255,0,0.12)', 'rgba(16,185,129,0.12)')
    $content = $content.Replace('rgba(124,255,0,0.2)', 'rgba(16,185,129,0.2)')
    $content = $content.Replace('rgba(124,255,0,0.3)', 'rgba(16,185,129,0.3)')

    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $file"
  }
}
Write-Host 'Done!'
