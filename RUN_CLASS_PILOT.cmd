@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js is required. Install the LTS version from https://nodejs.org/
  echo Then double-click RUN_CLASS_PILOT.cmd again.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  echo Installing Electron dependencies. Internet is required for this first step.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Could not install dependencies. Check internet access and try again.
    pause
    exit /b 1
  )
)
echo Starting ClassPilot...
call npm start
if errorlevel 1 pause
