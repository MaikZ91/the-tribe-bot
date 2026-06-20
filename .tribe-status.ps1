# Quick-Reader für PostHog Live Monitor
# Zeigt: letzte Events, neue Besucher, Gesamt-Statistiken seit Kampagnenstart
param([switch]$Deep)

$logFile = Join-Path $PSScriptRoot '.tribe-live-monitor.json'
$phx = 'phx_XGyeW69v6n3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'
$base = 'https://eu.posthog.com/api/projects/175210'
$hb = @{Authorization="Bearer $phx"; "Content-Type"="application/json"}

function PQ($q) {
    try { $body = @{query=@{kind='HogQLQuery'; query=$q}} | ConvertTo-Json; return Invoke-RestMethod -Uri "$base/query/" -Method POST -Headers $hb -Body $body } catch { return $null }
}

Write-Host "========================================"
Write-Host "  THE TRIBE - LIVE ANALYTICS"
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "========================================"

# LIVE: Gesamt seit Kampagnenstart
Write-Host "`n--- HEUTE GESAMT ---"
$r = PQ "SELECT count() as pageviews, uniq(person_id) as visitors FROM events WHERE event = '`$pageview' AND toDate(timestamp) = today()"
if ($r -and $r.results) { Write-Host "Pageviews heute: $($r.results[0]) | Besucher: $($r.results[1])" }

$r = PQ "SELECT count() as clicks FROM events WHERE event = 'whatsapp_cta_click' AND toDate(timestamp) = today()"
if ($r -and $r.results) { Write-Host "CTA-Klicks heute: $($r.results[0])" }

$r = PQ "SELECT count() as dwell FROM events WHERE event = 'tribe_dwell' AND toDate(timestamp) = today()"
if ($r -and $r.results) { Write-Host "Dwell-Events heute: $($r.results[0])" }

# Quelle heute
Write-Host "`n--- QUELLE HEUTE ---"
$r = PQ "SELECT properties.`$referrer as ref, count() as cnt FROM events WHERE event = '`$pageview' AND toDate(timestamp) = today() GROUP BY ref ORDER BY cnt DESC"
if ($r -and $r.results) { $r.results | ForEach-Object { Write-Host "  $($_.value[0]): $($_.value[1])" } }

# Letzte Sessions
Write-Host "`n--- LETZTE 5 SESSIONS ---"
try {
    $sr = Invoke-RestMethod -Uri "$base/session_recordings/?limit=5" -Headers @{Authorization="Bearer $phx"}
    if ($sr -and $sr.results) {
        foreach ($s in $sr.results | Sort-Object start_time -Descending) {
            $src = if ($s.start_url -match 'utm_source=ig') { 'IG' } elseif ($s.start_url -match 'utm_source=fb' -or $s.start_url -match 'fbclid=') { 'FB' } else { 'DIR' }
            $dur = [math]::Round($s.recording_duration, 0)
            $act = [math]::Round($s.active_seconds, 0)
            $time = [DateTime]::Parse($s.start_time).ToString('HH:mm')
            $flag = if ($dur -le 10) { "BOUNCE" } elseif ($s.click_count -gt 0) { "CLICK!" } elseif ($dur -gt 60) { "LONG" } else { "" }
            Write-Host "  $time | $src | ${dur}s act=${act}s | $flag"
        }
    }
} catch {}

# Monitor-Log
if (Test-Path $logFile) {
    $log = Get-Content $logFile -Raw | ConvertFrom-Json
    Write-Host "`n--- MONITOR LOG ($(($log.events).Count) updates) ---"
    Write-Host "Letztes Update: $($log.last_update)"
    $log.events | Select-Object -Last 5 | ForEach-Object {
        Write-Host "  $($_.time) | +$($_.new_pageviews) views | +$($_.new_visitors) visitors | +$($_.new_cta_clicks) CTA | +$($_.new_recordings.Count) rec"
    }
}

if ($Deep) {
    Write-Host "`n--- DEEP: KAMPAGNE GESAMT (2 Tage) ---"
    $r = PQ "SELECT toDate(timestamp) as day, count() as views, uniq(person_id) as visitors, countIf(event='whatsapp_cta_click') as cta, countIf(event='tribe_dwell') as dwell FROM events WHERE timestamp > now() - interval 3 day AND event IN ('`$pageview','whatsapp_cta_click','tribe_dwell') GROUP BY day ORDER BY day"
    if ($r -and $r.results) { 
        Write-Host "  Day      | Views | Visitors | CTA | Dwell"
        $r.results | ForEach-Object { Write-Host "  $($_.value[0]) | $($_.value[1]) | $($_.value[2]) | $($_.value[3]) | $($_.value[4])" }
    }
}

Write-Host "`n========================================"
