@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez la version LTS puis relancez.
  exit /b 1
)
if /I "%~1"=="preparer" (
  call npm run demo:tva
  exit /b
)
if not exist "data\demo-tva\latest.json" (
  echo Aucun kit disponible. Lancez d'abord : demo-tva.cmd preparer
  exit /b 1
)
call npm run demo:tva:serve
