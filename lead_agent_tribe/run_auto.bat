@echo off
cd /d "%~dp0.."
echo.
echo ═══════════════════════════════════════
echo  The Tribe - E-Mail Auto-Loop
echo ═══════════════════════════════════════
echo.
echo  Intervall: 10 Minuten (config via INTERVAL_MINUTES)
echo  Queue:     lead_agent_tribe\queue.json
echo  Sent:      lead_agent_tribe\sent.json
echo.
echo  Sendet automatisch Einladungen an neue
echo  E-Mail-Leads. Bereits gesendete werden
echo  uebersprungen (sent.json Dedup).
echo.
echo  Strg+C zum Beenden.
echo ═══════════════════════════════════════
echo.
node lead_agent_tribe\scripts\auto.js
pause
