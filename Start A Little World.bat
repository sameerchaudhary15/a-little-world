@echo off
cd /d "%~dp0"
echo Starting A Little World...
start "" http://localhost:3000/admin
node start-local.js
pause
