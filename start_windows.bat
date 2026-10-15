@echo off
setlocal
cd /d "%~dp0"
title CyberPath V2 Launcher
set PORT=8080
where py >nul 2>nul
if %errorlevel%==0 (
  start "CyberPath V2 Server - KEEP OPEN" cmd /k "cd /d ""%~dp0"" && py -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" http://localhost:%PORT%
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "CyberPath V2 Server - KEEP OPEN" cmd /k "cd /d ""%~dp0"" && python -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" http://localhost:%PORT%
  exit /b
)
echo Python was not found. Opening index.html directly.
start "" index.html
pause
