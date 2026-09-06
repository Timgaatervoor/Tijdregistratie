@echo off
setlocal

rem Start altijd vanuit de map waarin dit script staat.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [FOUT] Node.js is niet geinstalleerd of staat niet in PATH.
  echo Installeer eerst de LTS-versie van Node.js via https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [FOUT] npm is niet beschikbaar. Herinstalleer de LTS-versie van Node.js.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [FOUT] package.json ontbreekt. Pak eerst de volledige ZIP uit.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Eerste start: de benodigde onderdelen worden eenmalig geinstalleerd...
  echo Hiervoor is een internetverbinding nodig.
  call npm install
  if errorlevel 1 (
    echo.
    echo [FOUT] Installatie mislukt. Controleer de internetverbinding en probeer opnieuw.
    pause
    exit /b 1
  )
)

echo.
echo Tijdregistratie wordt gestart op http://localhost:3000
echo Dit venster mag open blijven. Druk op Ctrl+C om te stoppen.
echo.
call npm run dev -- --open

if errorlevel 1 (
  echo.
  echo [FOUT] De applicatie kon niet worden gestart.
  pause
  exit /b 1
)

endlocal
