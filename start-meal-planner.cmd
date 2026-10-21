@echo off
rem Double-click to start the meal planner. Leave this window open while you use it.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing for the first time...
  call npm install || goto :error
)
if not exist web\dist\index.html (
  echo Building the app...
  call npm run build || goto :error
)
call npm start
goto :eof
:error
echo.
echo Something went wrong. Is Node.js 22.13 or newer installed? See docs\WINDOWS_SETUP.md
pause
