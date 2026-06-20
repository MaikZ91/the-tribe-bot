try {
    $r = Invoke-WebRequest -Uri 'http://www.karsten-stolle.de/' -TimeoutSec 20 -UseBasicParsing
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length)"
    if ($r.Content -match '<title>([^<]+)</title>') { Write-Host "Title: $($Matches[1])" }
    $imgs = [regex]::Matches($r.Content, '<img[^>]+src=["'']([^"''\s]+)["'']') | ForEach-Object { $_.Groups[1].Value } | Select-Object -First 8
    Write-Host "Images: $($imgs -join ' | ')"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
