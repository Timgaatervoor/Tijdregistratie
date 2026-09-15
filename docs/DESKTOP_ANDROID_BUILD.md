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
