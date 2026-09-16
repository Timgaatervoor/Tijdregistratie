# Windows- en Android-build

De webapp kan vanuit dezelfde broncode als draagbare Windows-app en als Android-app worden gebouwd.

## Windows

```powershell
npm install
npm run dist:windows
```

Het draagbare programma verschijnt in `release/windows`.

## Android

Voor een ondertekende release zijn Android Studio en een lokale ondertekeningssleutel nodig. Zet de sleutel buiten Git en maak lokaal `android/keystore.properties` met:

```properties
storeFile=../signing/tijdregistratie-release.jks
storePassword=<wachtwoord>
keyAlias=tijdregistratie
keyPassword=<wachtwoord>
```

Bouw daarna met:

```powershell
npm run android:sync
cd android
./gradlew assembleRelease
```

De APK verschijnt in `android/app/build/outputs/apk/release`. Bewaar de `.jks` en het wachtwoord veilig: elke latere update van dezelfde Android-app moet met exact dezelfde sleutel worden ondertekend.

### Gecontroleerde release op Windows

Met Node.js 22, Java 21 en een Android SDK met platform 36 en build-tools 35.0.0 beschikbaar:

```powershell
npm ci
# Alleen de eerste keer, als er nog geen releasesleutel bestaat:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-release.ps1 -InitializeSigning
# Alle volgende builds gebruiken dezelfde sleutel:
npm run android:release
```

Stel `JAVA_HOME` en `ANDROID_HOME` in op de lokale installaties. De build kan ook de portable tools onder `build/tools` gebruiken. Het script controleert types, tests, secrets, Android lint, APK-handtekening en uitlijning. Het resultaat staat in `release/android/Tijdregistratie-release.apk`, met een SHA-256-controlebestand.

Maak een beveiligde back-up van **beide** bestanden: `signing/tijdregistratie-release.jks` en `android/keystore.properties`. Het tweede bestand bevat het wachtwoord. Beide blijven buiten Git en mogen niet samen met de APK worden gedeeld. Maak bij updates geen nieuwe sleutel en verhoog `versionCode` in `android/app/build.gradle`.

Een releasehandtekening voorkomt niet alle Android-installatiemeldingen. Buiten Google Play kan Android toestemming vragen voor installatie vanuit die bron en kan Play Protect een scan voorstellen. Schakel deze beveiliging niet uit. Distributie via Google Play is de gebruikelijke route om de melding over onbekende installatiebronnen te vermijden.
