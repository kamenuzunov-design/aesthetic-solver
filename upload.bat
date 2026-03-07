@echo off
echo Proverka za novi promeni v servera...
git pull

@echo off
echo --- Zapochvam kachvaneto v GitHub ---

:: 1. Dobavyane na promhenite
git add .

:: 2. Commit s tekushtata data i chas (avtomatichno)
git commit -m "Auto-upload: %date% %time%"

:: 3. Izprashtane kum servera
git push

echo
echo --- -------- ---
echo ---  It's OK ---
echo --- -------- ---
pause