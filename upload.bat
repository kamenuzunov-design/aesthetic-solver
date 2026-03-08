@echo off
chcp 65001 >nul

echo --- 1. Aktualizacia na GitHub ---
:: Насилствено се връщаме на main, за да избегнем detached HEAD
git checkout main

:: Указваме точно откъде и кой клон да се издърпа
git pull origin main

git add .
:: Ако няма нищо за качване, Git ще прескочи commit-а без грешка
git commit -m "Auto-update: %date% %time%"

:: Качваме директно в main в GitHub
git push origin main

echo.
echo --- 2. Deployment vav Firebase ---
:: Използваме директния път до командата
call firebase deploy --only hosting

echo.
echo.
echo --- It's OK ---
pause