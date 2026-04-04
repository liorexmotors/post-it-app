@echo off
chcp 65001 >nul
title POST-IT - התקנה ראשונית
color 0B

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║         POST-IT - התקנה ראשונית        ║
echo  ╚═══════════════════════════════════════╝
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ❌ שגיאה: Node.js לא מותקן!
    echo.
    echo  יש להוריד ולהתקין Node.js מהאתר:
    echo  https://nodejs.org
    echo.
    echo  לאחר ההתקנה, הפעל שוב קובץ זה.
    echo.
    pause
    exit /b 1
)

echo  ✓ Node.js מותקן
node --version

echo.
echo  📦 מתקין חבילות שרת...
cd /d "%~dp0server"
call npm install
if errorlevel 1 (
    echo  ❌ שגיאה בהתקנת חבילות שרת
    pause
    exit /b 1
)
echo  ✓ חבילות שרת הותקנו

echo.
echo  📦 מתקין חבילות ממשק משתמש...
cd /d "%~dp0web"
call npm install
if errorlevel 1 (
    echo  ❌ שגיאה בהתקנת חבילות ממשק
    pause
    exit /b 1
)
echo  ✓ חבילות ממשק הותקנו

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║      ✅ ההתקנה הושלמה בהצלחה!        ║
echo  ╠═══════════════════════════════════════╣
echo  ║  כעת הפעל את: start.bat              ║
echo  ╚═══════════════════════════════════════╝
echo.
pause
