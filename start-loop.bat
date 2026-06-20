@echo off
cd /d "C:\Users\Maik Zschach\the-tribe"
echo ==========================================
echo  MZ.9 Lead Agent — Dauerloop (autonom)
echo ==========================================
echo.
echo  Der Loop laeuft kontinuierlich:
echo    Stufe 1: Discovery (daemon.js --once)
echo    Stufe 2: Build (braucht LLM CLI)
echo    Stufe 3: Publish (publish.js --all)
echo    Stufe 4: E-Mail (send_mail.js)
echo.
echo  Zum Beenden: Fenster schliessen oder Ctrl+C
echo.
echo  Lade .env ...
if exist lead_agent_deepseek\.env (
  for /f "tokens=*" %%a in (lead_agent_deepseek\.env) do set %%a
)
echo  Starte Loop (INTERVAL_MINUTES=5, MAX_BUILDS=2, ONCE=0)...
node lead_agent_deepseek/scripts/auto.js
pause
