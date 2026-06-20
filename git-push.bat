@echo off
cd /d "C:\Users\Maik Zschach\the-tribe"
move "lead_agent_deepseek\discoveries\batch-hamburg-koeln-20260620.json" "lead_agent_deepseek\discoveries\used\"
del "update-dashboard.ps1"
git add docs/leads/ lead_agent_deepseek/queue.json
git status
git commit -m "lead-agent: parallel run — 6 neue Leads (Sanitär/Heizung/Fahrschule)"
git push
