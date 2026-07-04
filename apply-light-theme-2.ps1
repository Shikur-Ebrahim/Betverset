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

    # Edge case background colors
    $content = $content.Replace('#27272A', '#F3F4F6')
    $content = $content.Replace('#1a1a1d', '#F8FAFC')
    $content = $content.Replace('#111114', '#F1F5F9')

    # Edge case text colors
    $content = $content.Replace('#52525B', '#9CA3AF')
    $content = $content.Replace('color:''#000''', 'color:''#FFFFFF''')
    $content = $content.Replace('color: ''#000''', 'color: ''#FFFFFF''')

    # Lime green edge cases (converting to Emerald #10B981)
    $content = $content.Replace('rgba(124,255,0,0.1)', 'rgba(16,185,129,0.1)')
    $content = $content.Replace('rgba(124,255,0,0.15)', 'rgba(16,185,129,0.15)')
    $content = $content.Replace('rgba(124,255,0,0.3)', 'rgba(16,185,129,0.3)')
    $content = $content.Replace('rgba(124,255,0,0.35)', 'rgba(16,185,129,0.35)')
    $content = $content.Replace('rgba(124,255,0,0.06)', 'rgba(16,185,129,0.06)')
    $content = $content.Replace('rgba(124,255,0,0.08)', 'rgba(16,185,129,0.08)')
    $content = $content.Replace('rgba(124, 255, 0, 0.15)', 'rgba(16,185,129,0.15)')
    $content = $content.Replace('rgba(124, 255, 0, 0.3)', 'rgba(16,185,129,0.3)')
    
    # Fix dark glassmorphism borders and backgrounds
    $content = $content.Replace('rgba(255,255,255,0.04)', 'rgba(0,0,0,0.04)')
    $content = $content.Replace('rgba(255,255,255,0.05)', 'rgba(0,0,0,0.05)')
    $content = $content.Replace('rgba(255,255,255,0.02)', 'rgba(0,0,0,0.02)')
    
    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $file"
  }
}
Write-Host 'Done!'
