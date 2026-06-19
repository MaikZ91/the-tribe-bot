@echo off
cd /d "%~dp0.."
echo.
echo ═══════════════════════════════════════
echo  MZ.9 Lead Agent - Lokaler Daemon
echo ═══════════════════════════════════════
echo.
echo  Intervall: 5 Minuten (config via INTERVAL_MINUTES)
echo  Queue:     lead_agent_deepseek\queue.json
echo.
echo  Ctrl+C zum Beenden.
echo ═══════════════════════════════════════
echo.
node lead_agent_deepseek\scripts\daemon.js
pause
