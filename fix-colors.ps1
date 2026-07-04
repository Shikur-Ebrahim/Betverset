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
  'components\WithdrawalDepositRuleBanner.tsx'
)

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    $content = $content.Replace('#FF8C00', '#7CFF00')
    $content = $content.Replace('#E67E00', '#5BE000')
    $content = $content.Replace('rgba(255, 140, 0, 0.12)', 'rgba(124, 255, 0, 0.10)')
    $content = $content.Replace('rgba(255, 140, 0, 0.15)', 'rgba(124, 255, 0, 0.12)')
    $content = $content.Replace('rgba(255, 140, 0, 0.3)', 'rgba(124, 255, 0, 0.3)')
    $content = $content.Replace('rgba(255,140,0,0.12)', 'rgba(124,255,0,0.10)')
    $content = $content.Replace('rgba(255,140,0,0.15)', 'rgba(124,255,0,0.12)')
    $content = $content.Replace('rgba(255,140,0,0.2)', 'rgba(124,255,0,0.2)')
    $content = $content.Replace('rgba(255,140,0,0.3)', 'rgba(124,255,0,0.3)')
    $content = $content.Replace('rgba(255,140,0,0.4)', 'rgba(124,255,0,0.4)')
    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $file"
  } else {
    Write-Host "Not found: $file"
  }
}
Write-Host 'Done!'
