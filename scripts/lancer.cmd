@echo off
setlocal
set "mode=%~1"
if "%mode%"=="dev" goto prepare
if "%mode%"=="preview" goto prepare
if "%mode%"=="install" goto prepare
echo Mode inconnu. Utilisez installer.cmd, demarrer.cmd ou apercu.cmd.
exit /b 2

:prepare
pushd "%~dp0.."
if errorlevel 1 exit /b 1
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est introuvable. Installez Node.js 22.13 ou plus recent, puis relancez ce script.
  goto failed
)
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 22.13 ou plus recent est requis.
  goto failed
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm est introuvable. Verifiez votre installation de Node.js.
  goto failed
)
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  if errorlevel 1 goto failed
  echo Configuration locale creee dans .env.
)
if "%mode%"=="install" goto install
if not exist "node_modules\" goto install
goto launch

:install
echo Installation des dependances depuis package-lock.json...
call npm.cmd ci
if errorlevel 1 goto failed
if "%mode%"=="install" (
  echo Installation terminee. Lancez demarrer.cmd pour ouvrir le projet.
  if not defined CI pause
  popd
  exit /b 0
)

:launch
echo Gardez cette fenetre ouverte. Pour arreter le serveur : Ctrl+C.
echo Ouvrez l'adresse affichee par le serveur, par defaut http://localhost:3000.
if "%mode%"=="preview" (
  call npm.cmd run build
  if errorlevel 1 goto failed
)
if "%mode%"=="preview" (
  call npm.cmd run preview
) else (
  call npm.cmd run dev
)
if errorlevel 1 goto failed
popd
exit /b 0

:failed
echo.
echo Echec du lancement. Consultez le message ci-dessus.
if not defined CI pause
popd
exit /b 1
