# v2 (v6-bgslide) Tagesanalyse: WER hat geklickt / nicht — und WARUM (Session-Signale).
# One-shot, druckt JSON-Blöcke. Aufruf: powershell -File .tribe-v2-daily.ps1
$phx  = 'phx_XGyeW69v6n3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'
$base = 'https://eu.posthog.com/api/projects/175210'
$hb   = @{Authorization="Bearer $phx"; "Content-Type"="application/json"}
function PQ($q){ try{ $b=@{query=@{kind='HogQLQuery';query=$q}}|ConvertTo-Json -Depth 5; (Invoke-RestMethod -Uri "$base/query/" -Method POST -Headers $hb -Body $b).results }catch{ Write-Host "ERR: $($_.Exception.Message)"; $null } }

$DAY  = "timestamp>=toStartOfDay(now())"
$PAID = "properties.utm_source='ig'"

Write-Host "=== 1. HEUTE GESAMT (alle Quellen) ==="
PQ "SELECT uniq(person_id) bes, uniqIf(person_id,event='whatsapp_cta_click') cta_u, countIf(event='whatsapp_cta_click') cta_k FROM events WHERE $DAY AND event IN ('`$pageview','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 1b. HEUTE PAID (utm_source=ig) ==="
PQ "SELECT uniq(person_id) bes, uniqIf(person_id,event='whatsapp_cta_click') cta_u FROM events WHERE $DAY AND $PAID AND event IN ('`$pageview','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 2. DWELL heute (Tab-Zeit != Engagement) ==="
PQ "SELECT count() n, countIf(toFloat(properties.dwell_ms)<3000) instant_bounce, countIf(properties.reached_cta=true OR properties.reached_cta='true') reached_cta, round(median(toFloat(properties.dwell_ms)/1000),1) med_s FROM events WHERE $DAY AND event='tribe_dwell'" | ConvertTo-Json -Compress

Write-Host "`n=== 3. NUDGE: gezeigt vs. danach geklickt ==="
PQ "SELECT countIf(event='cta_nudge_shown') nudge_shown, countIf(event='whatsapp_cta_click') clicks FROM events WHERE $DAY AND event IN ('cta_nudge_shown','whatsapp_cta_click')" | ConvertTo-Json -Compress

Write-Host "`n=== 4. RAGECLICKS heute (Friktion) ==="
PQ "SELECT count() rageclicks, uniq(person_id) betroffene FROM events WHERE $DAY AND event='`$rageclick'" | ConvertTo-Json -Compress

Write-Host "`n=== 5. SESSIONS HEUTE: geklickt vs. nicht (Recording-Signale) ==="
try{
 $today = (Get-Date).Date
 $sr = Invoke-RestMethod -Uri "$base/session_recordings/?limit=150" -Headers @{Authorization="Bearer $phx"}
 $clk=@(); $noclk=@(); $rows=@()
 foreach($s in $sr.results){
   $st=[DateTime]::Parse($s.start_time)
   if($st.Date -ne $today){continue}
   $clicked = ($s.click_count -gt 0)
   $o=[pscustomobject]@{
     t=$st.ToString('HH:mm'); dur=[math]::Round($s.recording_duration,0);
     act=[math]::Round($s.active_seconds,0); clicks=$s.click_count;
     mouse=$s.mouse_activity_count; cerr=$s.console_error_count; clicked=$clicked }
   $rows += $o
   if($clicked){ $clk += $s.active_seconds } else { $noclk += $s.active_seconds }
 }
 Write-Host ("Sessions heute (Recordings): "+$rows.Count+" | geklickt="+$clk.Count+" | nicht="+$noclk.Count)
 if($clk.Count){   Write-Host ("AVG_ACTIVE_geklickt="   +[math]::Round(($clk  |Measure-Object -Average).Average,1)+"s") }
 if($noclk.Count){ Write-Host ("AVG_ACTIVE_nicht="     +[math]::Round(($noclk|Measure-Object -Average).Average,1)+"s") }
 Write-Host "--- alle Sessions heute (neueste zuerst) ---"
 $rows | Sort-Object t -Descending | ConvertTo-Json -Compress
}catch{ Write-Host "REC-ERR: $($_.Exception.Message)" }

Write-Host "`n=== DONE ==="
