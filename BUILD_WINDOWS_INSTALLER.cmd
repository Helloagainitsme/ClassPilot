@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js LTS from https://nodejs.org/ and retry.
  pause
  exit /b 1
)
echo Installing build dependencies (internet required)...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
call npm run check
if errorlevel 1 goto failed
echo Creating Windows installer...
call npm run build:win
if errorlevel 1 goto failed
echo.
echo SUCCESS: The Windows installer is inside the dist folder.
explorer "dist"
pause
exit /b 0
:failed
echo.
echo ERROR: The Windows build was not successful. Review the messages above.
pause
exit /b 1
