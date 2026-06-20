# v6-focus Loop-Readout (paid IG/FB only). One-shot, prints JSON-ish blocks.
$phx = 'phx_XGyeW69v6n3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'
$base = 'https://eu.posthog.com/api/projects/175210'
$hb = @{Authorization="Bearer $phx"; "Content-Type"="application/json"}
function PQ($q){ try{ $b=@{query=@{kind='HogQLQuery';query=$q}}|ConvertTo-Json -Depth 5; (Invoke-RestMethod -Uri "$base/query/" -Method POST -Headers $hb -Body $b).results }catch{ Write-Host "ERR: $($_.Exception.Message)"; $null } }

$V6="timestamp>=toDateTime('2026-05-16 19:33:00')"
$PAID="properties.utm_source='ig'"

Write-Host "=== 1. GESAMT seit v6-Launch (IG only) ==="
PQ "SELECT uniq(person_id) bes, uniqIf(person_id,event='whatsapp_cta_click') cta_u, countIf(event='whatsapp_cta_click') cta_k FROM events WHERE $V6 AND $PAID AND event IN ('`$pageview','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 2. HEUTE (IG only, ab toStartOfDay) ==="
PQ "SELECT uniq(person_id) bes, uniqIf(person_id,event='whatsapp_cta_click') cta_u, countIf(event='whatsapp_cta_click') cta_k FROM events WHERE timestamp>=toStartOfDay(now()) AND $PAID AND event IN ('`$pageview','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 2b. LETZTE 60 MIN (paid) ==="
PQ "SELECT uniqIf(person_id,event='`$pageview') bes, countIf(event='whatsapp_cta_click') cta FROM events WHERE timestamp>now()-interval 60 minute AND $PAID AND event IN ('`$pageview','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 2c. LETZTER PAID HIT ==="
PQ "SELECT max(timestamp), argMax(properties.utm_source,timestamp) FROM events WHERE $PAID AND event='`$pageview'" | ConvertTo-Json -Compress

Write-Host "`n=== 3a. CTA-Position-Split (v6, paid) ==="
PQ "SELECT coalesce(properties.cta_location,'?') loc, count() k, uniq(person_id) u FROM events WHERE $V6 AND $PAID AND event='whatsapp_cta_click' GROUP BY loc ORDER BY k DESC" | ConvertTo-Json -Compress

Write-Host "`n=== 3b. Dwell (v6, paid) Tab-Zeit kein Engagement ==="
PQ "SELECT count() n, countIf(toFloat(properties.dwell_ms)<3000) instant, countIf(properties.reached_cta=true OR properties.reached_cta='true') reached, median(toFloat(properties.dwell_ms)/1000) med_s FROM events WHERE $V6 AND $PAID AND event='tribe_dwell'" | ConvertTo-Json -Compress

Write-Host "`n=== 4. LETZTE 6 PAID SESSIONS (recordings) ==="
try{
 $sr=Invoke-RestMethod -Uri "$base/session_recordings/?limit=40" -Headers @{Authorization="Bearer $phx"}
 $rows=@(); $acts=@()
 foreach($s in ($sr.results | Sort-Object start_time -Descending)){
   $u=$s.start_url
   $src = if($u -match 'utm_source=ig'){'IG'} elseif($u -match 'utm_source=fb' -or $u -match 'fbclid'){'FB'} else {$null}
   if(-not $src){continue}
   $rows += [pscustomobject]@{t=[DateTime]::Parse($s.start_time).ToString('MM-dd HH:mm');src=$src;dur=[math]::Round($s.recording_duration,0);act=[math]::Round($s.active_seconds,0);mouse=$s.mouse_activity_count;clk=$s.click_count;cta=($s.click_count -gt 0);cerr=$s.console_error_count}
   $acts += [double]$s.active_seconds
   if($rows.Count -ge 6){break}
 }
 $rows | ConvertTo-Json -Compress
 if($acts.Count){ Write-Host ("AVG_ACTIVE_SECONDS="+[math]::Round(($acts|Measure-Object -Average).Average,1)+" n="+$acts.Count) }
}catch{ Write-Host "REC-ERR: $($_.Exception.Message)" }

Write-Host "`n=== DONE ==="
