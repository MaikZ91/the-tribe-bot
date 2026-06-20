# PostHog Live Monitor für The Tribe Landing Page
# Pollt alle 30s und loggt neue Besucher + aktualisiert Dashboard
$phx = 'phx_XGyeW69v6n3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'
$base = 'https://eu.posthog.com/api/projects/175210'
$hb = @{Authorization="Bearer $phx"; "Content-Type"="application/json"}
$logFile = Join-Path $PSScriptRoot '.tribe-live-monitor.json'
$checkpointFile = Join-Path $PSScriptRoot '.tribe-monitor-checkpoint.txt'

function PQ($q) {
    try { $body = @{query=@{kind='HogQLQuery'; query=$q}} | ConvertTo-Json; return Invoke-RestMethod -Uri "$base/query/" -Method POST -Headers $hb -Body $body } catch { return $null }
}
function GET($path) {
    try { return Invoke-RestMethod -Uri "$base$path" -Headers @{Authorization="Bearer $phx"} } catch { return $null }
}

# Letzten bekannten Stand laden
$lastCheck = if (Test-Path $checkpointFile) { Get-Content $checkpointFile } else { "2026-05-10T00:00:00Z" }
$knownRecordings = if (Test-Path $logFile) { 
    $data = Get-Content $logFile -Raw | ConvertFrom-Json
    $data.recording_ids
} else { @() }

Write-Host "Monitor gestartet um $(Get-Date -Format 'HH:mm:ss')"
Write-Host "Checkpoint: $lastCheck"
Write-Host "Bekannte Recordings: $($knownRecordings.Count)`n"

while ($true) {
    try {
        $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        
        # Pageviews seit letztem Check
        $r = PQ "SELECT count() as new_pageviews, uniq(person_id) as new_visitors FROM events WHERE event = '`$pageview' AND timestamp > '$lastCheck'"
        $newViews = 0; $newVisitors = 0
        if ($r -and $r.results) { $newViews = $r.results[0]; $newVisitors = $r.results[1] }
        
        # CTA clicks seit letztem Check
        $r = PQ "SELECT count() FROM events WHERE event = 'whatsapp_cta_click' AND timestamp > '$lastCheck'"
        $newClicks = 0
        if ($r -and $r.results) { $newClicks = $r.results[0] }
        
        # Neue Session Recordings
        $recordings = GET "/session_recordings/?limit=10"
        $newRecordings = @()
        if ($recordings -and $recordings.results) {
            $newRecordings = $recordings.results | Where-Object { $_.id -notin $knownRecordings }
        }
        
        # Wenn etwas passiert ist, loggen
        if ($newViews -gt 0 -or $newRecordings.Count -gt 0) {
            $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
            $entry = @{
                time = $timestamp
                new_pageviews = $newViews
                new_visitors = $newVisitors
                new_cta_clicks = $newClicks
                new_recordings = @($newRecordings | ForEach-Object {
                    @{
                        id = $_.id
                        duration = $_.recording_duration
                        active = $_.active_seconds
                        clicks = $_.click_count
                        start_time = $_.start_time
                        source = if ($_.start_url -match 'utm_source=ig') { 'IG' } elseif ($_.start_url -match 'utm_source=fb' -or $_.start_url -match 'fbclid=') { 'FB' } else { 'DIR' }
                        start_url = $_.start_url
                    }
                })
            }
            
            # In Log-Datei speichern (kumulativ)
            $allData = if (Test-Path $logFile) { 
                $d = Get-Content $logFile -Raw | ConvertFrom-Json
                @{
                    recording_ids = @($d.recording_ids) + @($newRecordings.id)
                    events = @($d.events) + @($entry)
                    last_update = $timestamp
                }
            } else {
                @{
                    recording_ids = @($newRecordings.id)
                    events = @($entry)
                    last_update = $timestamp
                }
            }
            $allData | ConvertTo-Json -Depth 3 | Set-Content $logFile
            
            # Meldung
            $srcs = ($newRecordings | ForEach-Object { 
                if ($_.start_url -match 'utm_source=ig') { 'IG' } 
                elseif ($_.start_url -match 'utm_source=fb' -or $_.start_url -match 'fbclid=') { 'FB' } 
                else { 'DIR' } 
            }) -join ', '
            
            Write-Host "$timestamp | +$newViews views | +$newVisitors visitors | +$newClicks CTA | +$($newRecordings.Count) recordings [$srcs]"
        }
        
        # Checkpoint updaten
        $lastCheck = $now
        $lastCheck | Set-Content $checkpointFile
        
        # 30s warten
        Start-Sleep -Seconds 30
        
    } catch {
        Write-Host "Fehler: $($_.Exception.Message)"
        Start-Sleep -Seconds 30
    }
}
