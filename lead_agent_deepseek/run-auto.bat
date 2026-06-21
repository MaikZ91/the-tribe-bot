@echo off
cd /d "%~dp0.."
echo.
echo ===============================================
echo   MZ.9 Lead Agent - AUTONOMER 3-Stufen-Loop
echo ===============================================
echo.
echo   Stufe 1  Discovery (Overpass)      -^> Build-Job
echo   Stufe 2  Custom-Build (LLM-Agent)  -^> Premium-Seite
echo   Stufe 3  Publish + Auto-Push       -^> Screenshot + gestaffelte Mail
echo.
REM Build-Agent = Claude Code (claude CLI, voller Build-Prompt).
REM Fuer DeepSeek stattdessen:  set BUILD_CMD=deepseek run build-lead --id {ID}
set BUILD_CMD=claude

echo   Intervall : %INTERVAL_MINUTES% min (Default 5, via INTERVAL_MINUTES)
echo   Build-Tool: %BUILD_CMD%
echo.
echo   Laeuft endlos. Strg+C zum Beenden.
echo ===============================================
echo.

REM Einmal-Durchlauf zum Testen:  set ONCE=1

node lead_agent_deepseek\scripts\auto.js
pause
