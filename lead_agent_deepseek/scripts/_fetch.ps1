param([string]$url)
$r = Invoke-WebRequest -Uri $url -TimeoutSec 25 -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
$max = [Math]::Min(20000, $r.Content.Length)
Write-Output $r.Content.Substring(0, $max)
# Also extract all img src
$r.Images | ForEach-Object { Write-Output "IMG: $($_.src)" }
