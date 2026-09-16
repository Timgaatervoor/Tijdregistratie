param([switch]$InitializeSigning)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Run([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "$program failed (exit $LASTEXITCODE)" }
}

# Use the optional portable toolchain when no system installation is configured.
$toolsDir = Join-Path $root 'build/tools'
$node = Get-ChildItem "$toolsDir/node-*-win-x64" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($node) { $env:PATH = "$($node.FullName);$env:PATH" }
if (!(Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path "$env:LOCALAPPDATA/Programs/Git/cmd/git.exe")) {
    $env:PATH = "$env:LOCALAPPDATA/Programs/Git/cmd;$env:PATH"
}
if (!$env:JAVA_HOME) {
    $jdk = Get-ChildItem "$toolsDir/jdk-*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME/bin;$env:PATH" }
if (!$env:ANDROID_HOME -and (Test-Path "$toolsDir/android-sdk")) { $env:ANDROID_HOME = "$toolsDir/android-sdk" }
if (!$env:ANDROID_HOME) { throw 'Set ANDROID_HOME to your Android SDK directory.' }
$env:GRADLE_USER_HOME = Join-Path $root 'build/gradle-cache'
$env:ANDROID_USER_HOME = Join-Path $root 'build/android-user'

$propertiesPath = Join-Path $root 'android/keystore.properties'
$keyPath = Join-Path $root 'signing/tijdregistratie-release.jks'
if ($InitializeSigning) {
    if ((Test-Path $propertiesPath) -or (Test-Path $keyPath)) { throw 'Signing files already exist; refusing to replace the release identity.' }
    New-Item -ItemType Directory -Force (Split-Path $keyPath) | Out-Null
    $account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    Run 'icacls.exe' @((Split-Path $keyPath), '/inheritance:r', '/grant:r', "${account}:(OI)(CI)F")
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $env:TIJDREGISTRATIE_SIGNING_PASSWORD = [Convert]::ToBase64String($bytes)
    try {
        Run 'keytool.exe' @('-genkeypair', '-keystore', $keyPath, '-storetype', 'JKS', '-alias', 'tijdregistratie', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Tijdregistratie, O=Kids Atletiek De Haan, C=BE', '-storepass:env', 'TIJDREGISTRATIE_SIGNING_PASSWORD', '-keypass:env', 'TIJDREGISTRATIE_SIGNING_PASSWORD')
        $lines = @('storeFile=../signing/tijdregistratie-release.jks', "storePassword=$env:TIJDREGISTRATIE_SIGNING_PASSWORD", 'keyAlias=tijdregistratie', "keyPassword=$env:TIJDREGISTRATIE_SIGNING_PASSWORD")
        [IO.File]::WriteAllLines($propertiesPath, $lines, [Text.Encoding]::ASCII)
        Run 'icacls.exe' @($propertiesPath, '/inheritance:r', '/grant:r', "${account}:F")
    } finally { Remove-Item Env:TIJDREGISTRATIE_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
}
if (!(Test-Path $propertiesPath)) { throw 'No release signing key configured. Run with -InitializeSigning once, or restore your existing signing files.' }

Run 'npm.cmd' @('run', 'typecheck')
Run 'npm.cmd' @('test')
Run 'npm.cmd' @('run', 'android:sync')
Run 'npm.cmd' @('run', 'check:secrets')
Push-Location android
try { Run '.\gradlew.bat' @('--no-daemon', 'assembleRelease', 'lintRelease') } finally { Pop-Location }

$apk = Join-Path $root 'android/app/build/outputs/apk/release/app-release.apk'
$buildTools = Get-ChildItem "$env:ANDROID_HOME/build-tools" -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
Run "$($buildTools.FullName)/apksigner.bat" @('verify', '--verbose', '--print-certs', $apk)
Run "$($buildTools.FullName)/zipalign.exe" @('-c', '-P', '16', '-v', '4', $apk)
$outputDir = Join-Path $root 'release/android'
New-Item -ItemType Directory -Force $outputDir | Out-Null
$output = Join-Path $outputDir 'Tijdregistratie-release.apk'
Copy-Item -LiteralPath $apk -Destination $output -Force
$hash = (Get-FileHash $output -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$output.sha256", "$hash  Tijdregistratie-release.apk`n")
Write-Output "Verified signed APK: $output"
