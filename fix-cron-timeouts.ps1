$files = @(
    "d:\projects\Betverset\app\api\cron\bootstrap\route.ts",
    "d:\projects\Betverset\app\api\cron\sync\route.ts",
    "d:\projects\Betverset\app\api\cron\settle\route.ts",
    "d:\projects\Betverset\app\api\cron\purge\route.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -notmatch "export const maxDuration") {
            $content += "`nexport const maxDuration = 300;`n"
            Set-Content $file $content -NoNewline
            Write-Host "Added maxDuration to $file"
        }
    }
}
