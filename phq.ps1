$phx = 'phx_XGyeW69v6n3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'
$base = 'https://eu.posthog.com/api/projects/175210'
$h = @{Authorization="Bearer $phx"}
$hb = @{Authorization="Bearer $phx"; "Content-Type"="application/json"}
$ErrorActionPreference = 'Continue'

function PQ($q) {
    try { $body = @{query=@{kind='HogQLQuery'; query=$q}} | ConvertTo-Json; return Invoke-RestMethod -Uri "$base/query/" -Method POST -Headers $hb -Body $body } catch { return $null }
}
function GET($path) {
    try { return Invoke-RestMethod -Uri "$base$path" -Headers $h } catch { return $null }
}

# ALLE Session Recordings (paginated, max 50)
Write-Host "=== ALLE SESSION RECORDINGS ==="
$all = @()
$cursor = $null
$max = 50
$page = 0
do {
    $page++
    $url = "/session_recordings/?limit=20"
    if ($cursor) { $url += "&cursor=$cursor" }
    $resp = GET $url
    if ($resp -and $resp.results) {
        $all += $resp.results
        $cursor = $resp.next_cursor
        Write-Host "Page $page : $($resp.results.Count) recordings (total so far: $($all.Count))"
        if (-not $resp.has_next) { break }
        if ($all.Count -ge $max) { break }
    } else { break }
} while ($true)

Write-Host "`n=== SUMMARY: $($all.Count) recordings ==="
$bounce = ($all | Where-Object { $_.recording_duration -le 10 }).Count
$engaged = ($all | Where-Object { $_.recording_duration -gt 30 }).Count
$clicked = ($all | Where-Object { $_.click_count -gt 0 }).Count
$total = $all.Count
Write-Host "Bounce (<10s): $bounce / $total"
Write-Host "Engaged (>30s): $engaged / $total"
Write-Host "Clicked anything: $clicked / $total"

# Session stats
$avg_dur = if ($total -gt 0) { ($all | Measure-Object -Property recording_duration -Average).Average } else { 0 }
$avg_active = if ($total -gt 0) { ($all | Measure-Object -Property active_seconds -Average).Average } else { 0 }
Write-Host "Avg duration: $([math]::Round($avg_dur,0))s"
Write-Host "Avg active: $([math]::Round($avg_active,0))s"

# Source breakdown
Write-Host "`n=== SOURCE BREAKDOWN ==="
$sources = $all | ForEach-Object {
    $url = $_.start_url
    if ($url -match 'utm_source=ig') { 'Instagram' }
    elseif ($url -match 'utm_source=fb') { 'Facebook' }
    elseif ($url -match 'fbclid=') { 'Facebook (fbclid)' }
    else { 'Direct/Other' }
} | Group-Object | Sort-Object Count -Descending
$sources | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }

# Individual sessions (compact table)
Write-Host "`n=== ALLE SESSIONS ==="
foreach ($s in $all | Sort-Object start_time) {
    $src = ''
    if ($s.start_url -match 'utm_source=ig') { $src = 'IG' }
    elseif ($s.start_url -match 'utm_source=fb') { $src = 'FB' }
    elseif ($s.start_url -match 'fbclid=') { $src = 'FB' }
    else { $src = 'DIR' }
    
    $dur = [math]::Round($s.recording_duration, 0)
    $act = [math]::Round($s.active_seconds, 0)
    $time = [DateTime]::Parse($s.start_time).ToString('dd.MM HH:mm')
    $id = $s.id.Substring(0,8)
    $clicks = if ($s.click_count -gt 0) { "CLICK:${s.click_count}" } else { "-" }
    $flag = if ($dur -le 10) { "BOUNCE" } elseif ($dur -gt 60) { "LONG" } else { "" }
    
    Write-Host ("{0} | {1} | dur={2}s act={3}s | {4} {5}" -f $time, $src, $dur, $act, $clicks, $flag)
}

# SCROLL DEPTH (fixed query)
Write-Host "`n=== SCROLL DEPTH ==="
$r = PQ "SELECT count() as samples, round(avg(CAST(properties.scroll_pct AS Float64)),0) as avg_scroll FROM events WHERE event = 'tribe_dwell' AND timestamp > now() - interval 7 day AND has(properties, 'scroll_pct')"
if ($r -and $r.results) { Write-Host ($r.results | ConvertTo-Json) } else { Write-Host "Keine Daten" }

# PAGEVIEWS vs DWELL pro Session (Bounce Rate aus Events)
Write-Host "`n=== BOUNCE AUS EVENTS ==="
$r = PQ "SELECT count(DISTINCT properties.`$session_id) as total_sessions FROM events WHERE event = '`$pageview' AND timestamp > now() - interval 7 day"
if ($r -and $r.results) { 
    $totalSessions = $r.results[0][0]
    Write-Host "Total Sessions (7d): $totalSessions"
}
$r = PQ "SELECT count(DISTINCT properties.`$session_id) as bounced FROM events WHERE event = '`$pageview' AND timestamp > now() - interval 7 day AND properties.`$session_id NOT IN (SELECT DISTINCT properties.`$session_id FROM events WHERE event = 'tribe_dwell' AND timestamp > now() - interval 7 day)"
if ($r -and $r.results) {
    $bouncedSessions = $r.results[0][0]
    Write-Host "Bounced (no dwell): $bouncedSessions"
}

Write-Host "`n=== FERTIG ==="
