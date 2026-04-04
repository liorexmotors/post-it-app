@echo off
chcp 65001 >nul
title POST-IT - מערכת פרסום אוטומטי

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js לא מותקן! הפעל תחילה את install.bat
    pause
    exit /b 1
)

:: Check if installed
if not exist "%~dp0server\node_modules" (
    echo ❌ יש להריץ תחילה את install.bat
    pause
    exit /b 1
)

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║      POST-IT - מפעיל את המערכת...      ║
echo  ╚═══════════════════════════════════════╝
echo.

:: Start server in new window
start "POST-IT Server" cmd /k "cd /d "%~dp0server" && node index.js"

:: Wait for server to start
timeout /t 2 /nobreak >nul

:: Start web in new window
start "POST-IT Web" cmd /k "cd /d "%~dp0web" && npm run dev"

:: Wait for web to start
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:3000

echo.
echo  ✅ המערכת הופעלה!
echo.
echo  🌐 דשבורד:  http://localhost:3000
echo  🔧 שרת:     http://localhost:3001
echo.
echo  סגור חלון זה כדי לסגור את המערכת
echo  (חלונות השרת והאינטרפייס יישארו פתוחים)
echo.
