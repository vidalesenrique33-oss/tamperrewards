# Tamper Rewards Mobile

Proyecto móvil de Tamper Rewards para Android e iOS, con identificador
`com.tamper.rewards`. La interfaz se conserva en `www/` y Capacitor proporciona
el contenedor y los puentes nativos.

## Estado de esta entrega

- Android e iOS configurados con el mismo identificador.
- PWA existente incluida localmente; no depende de abrir Netlify para iniciar.
- Mapas Matcha, Halloween y Navidad incluidos.
- Puente para barra de estado, splash, red, teclado, botón Atrás y hápticos.
- Service worker desactivado dentro de la app y conservado para la web.
- Firebase web actual conservado para no duplicar datos.
- Iconos adaptativos de Android, icono de iOS y splash verde/crema incluidos.
- Orientación vertical configurada en teléfono y tablet.

## Archivos de Firebase

Firebase debe generar estos archivos para `com.tamper.rewards`:

- `android/app/google-services.json`
- `ios/App/App/GoogleService-Info.plist`

No se incluyen archivos inventados. El constructor Android exige el archivo
oficial antes de crear el APK con Google Sign-In; el archivo iOS será necesario
antes de compilar esa plataforma.
Consulta `FIREBASE-NATIVO.md` para las rutas exactas.

## Comandos

```bash
npm install
npm run sync
npm run doctor
npm run android
npm run ios
```

Android se abre con Android Studio. iOS se abre con Xcode en una Mac.

## APK desde Chromebook

El repositorio incluye `.github/workflows/build-android-apk.yml`. Ese flujo usa
GitHub Actions para generar un APK Android de prueba sin instalar Android Studio
en el Chromebook. Sigue `APK-DESDE-CHROMEBOOK.md`; al terminar podrás descargar
el artefacto `Tamper-Rewards-APK-v1.0.5` con el archivo
`Tamper-Rewards-v1.0.5-debug.apk`.

Esta entrega es el código fuente móvil completo, no un APK ni un IPA firmado.
El APK de prueba puede generarse con GitHub Actions. Una publicación de Android
requiere una firma privada y un AAB; iOS requiere Xcode en una Mac. En Android,
el selector de Google es nativo y entrega su ID token a la sesión web existente
de Firebase.

## Fuente web

Los cambios visuales y de negocio deben realizarse en `www/`. Después se ejecuta
`npm run sync` para copiar esa versión a Android e iOS. Para evitar divergencias,
la siguiente etapa será automatizar que la misma carpeta publique Netlify.
