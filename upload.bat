@echo off
chcp 65001 >nul

echo --- 1. Aktualizacia na GitHub ---
git pull
git add .
git commit -m "Auto-update: %date% %time%"
git push

echo.
echo --- 2. Deployment vav Firebase ---
:: Използваме директния път до командата
call firebase deploy --only hosting

echo.
echo.
echo --- It's OK ---
pause