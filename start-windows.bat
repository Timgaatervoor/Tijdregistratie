@echo off
setlocal

rem Start altijd vanuit de map waarin dit script staat.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is nodig om Tijdregistratie lokaal te starten.
  echo Het kan nu automatisch via Windows Package Manager worden geinstalleerd.
  echo Hiervoor is een internetverbinding nodig en Windows kan toestemming vragen.
  echo.
  choice /C JN /N /M "Node.js LTS nu installeren? [J/N] "
  if errorlevel 2 goto node_required

  where winget >nul 2>&1
  if errorlevel 1 goto node_manual_install

  echo.
  echo Node.js LTS wordt geinstalleerd...
  winget install --exact --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 goto node_install_failed

  rem Neem een pas uitgevoerde systeeminstallatie meteen op in dit venster.
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  where node >nul 2>&1
  if errorlevel 1 goto node_restart_required
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [FOUT] npm is niet beschikbaar. Herinstalleer de LTS-versie van Node.js.
  set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
  exit /b 1
)

if not exist "package.json" (
  echo [FOUT] package.json ontbreekt. Pak eerst de volledige ZIP uit.
  set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
  exit /b 1
)

echo.
choice /C JN /N /M "Snelkoppeling naar Tijdregistratie op het bureaublad maken of bijwerken? [J/N] "
if errorlevel 2 goto shortcut_done

rem Gebruik omgevingsvariabelen zodat spaties en apostrofs in het pad veilig blijven.
set "TIJDREGISTRATIE_START=%~f0"
set "TIJDREGISTRATIE_DIR=%~dp0"
powershell.exe -NoProfile -Command "try { $ErrorActionPreference = 'Stop'; $desktop = [Environment]::GetFolderPath('DesktopDirectory'); if (-not $desktop) { throw 'Bureaubladmap niet gevonden.' }; $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut((Join-Path $desktop 'Tijdregistratie.lnk')); $shortcut.TargetPath = $env:TIJDREGISTRATIE_START; $shortcut.WorkingDirectory = $env:TIJDREGISTRATIE_DIR; $shortcut.Description = 'Start Tijdregistratie'; $shortcut.Save(); exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo [FOUT] De snelkoppeling kon niet worden gemaakt. De app kan wel starten.
  set /p "continuePrompt=Druk op Enter om verder te gaan... "
) else (
  echo De snelkoppeling Tijdregistratie staat op je bureaublad.
)

:shortcut_done
if not exist "node_modules\vite\bin\vite.js" (
  echo Eerste start: de benodigde onderdelen worden eenmalig geinstalleerd...
  echo Hiervoor is een internetverbinding nodig.
  call npm install
  if errorlevel 1 (
    echo.
    echo [FOUT] Installatie mislukt. Controleer de internetverbinding en probeer opnieuw.
    set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
    exit /b 1
  )
)

echo.
echo Tijdregistratie wordt gestart op http://localhost:3000
echo De lokale Stamhoofd-koppeling start automatisch mee.
echo Dit venster mag open blijven. Druk op Ctrl+C om te stoppen.
echo.
call npm run dev -- --open

if errorlevel 1 (
  echo.
  echo [FOUT] De applicatie kon niet worden gestart.
  set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
  exit /b 1
)

echo.
echo Tijdregistratie is gestopt.
set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
endlocal
exit /b 0

:node_required
echo.
echo Zonder Node.js kan de lokale programmamap niet worden gestart.
echo Gebruik de knop "Node.js installeren" in de app of ga naar:
echo https://nodejs.org/en/download
set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
exit /b 1

:node_manual_install
echo.
echo Automatische installatie is op deze Windows-versie niet beschikbaar.
echo De officiele downloadpagina wordt geopend. Installeer daar de LTS-versie,
echo sluit dit venster en dubbelklik daarna opnieuw op start-windows.bat.
start "" "https://nodejs.org/en/download"
set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
exit /b 1

:node_install_failed
echo.
echo [FOUT] De automatische installatie van Node.js is mislukt.
echo Installeer Node.js LTS handmatig via https://nodejs.org/en/download
set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
exit /b 1

:node_restart_required
echo.
echo Node.js is geinstalleerd, maar Windows moet de nieuwe instelling nog laden.
echo Sluit dit venster en dubbelklik opnieuw op start-windows.bat.
set /p "exitPrompt=Druk op Enter om dit venster te sluiten... "
exit /b 0
