@echo off
chcp 65001 >nul

echo --- 1. Aktualizacia na GitHub ---
rem Add and commit local changes first to prevent git pull conflicts
git add .
git commit -m "Auto-update"

rem Pull latest changes from remote
git pull origin main --rebase

rem Push to remote
git push origin main

echo.
echo --- 2. Deployment vav Firebase ---
rem Use explicitly firebase.cmd to avoid PowerShell Execution Policy issues
call firebase.cmd deploy --only hosting

echo.
echo.
echo --- It's OK ---
pause