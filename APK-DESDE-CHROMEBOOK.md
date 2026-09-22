# Crear el APK desde un Chromebook

No necesitas instalar Android Studio. Este proyecto incluye una automatización de
GitHub que compila un APK de prueba en la nube.

## Primera vez

1. En GitHub crea un repositorio **privado**, por ejemplo
   `tamper-rewards-mobile`, y activa **Add a README file** al crearlo. Esto crea
   la rama `main` necesaria para abrir Codespaces.
2. En el repositorio abre **Code > Codespaces > Create codespace on main**.
3. En el explorador de Codespaces sube el archivo completo
   `Tamper-Rewards-Mobile-Source.zip` a la raíz.
4. En la terminal de Codespaces ejecuta:

```bash
unzip -o Tamper-Rewards-Mobile-Source.zip
rm Tamper-Rewards-Mobile-Source.zip
git add .
git commit -m "Preparar Tamper Rewards Android"
git push
```

Al terminar, en la raíz deben verse `package.json`, `android`, `ios`, `www` y
`.github`. Extraer el ZIP dentro de Codespaces evita que ChromeOS oculte la
carpeta `.github`, que contiene el constructor del APK.

## Descargar el APK

1. Abre la pestaña **Actions** del repositorio.
2. Entra a **Construir APK Android**.
3. Presiona **Run workflow** y nuevamente **Run workflow**.
4. Espera a que el proceso muestre una marca verde.
5. Abre la ejecución terminada y, en **Artifacts**, descarga
   `Tamper-Rewards-APK-v1.0.5`.
6. Extrae el ZIP descargado. Dentro estará
   `Tamper-Rewards-v1.0.5-debug.apk`.

Para instalarlo en un teléfono Android, transfiere el APK al teléfono, ábrelo y
autoriza temporalmente la instalación desde esa fuente cuando Android lo pida.

## Cuando cambies la app

Actualiza los archivos, confirma el cambio con Git y súbelo. Si el cambio toca la
app, Android o la configuración, GitHub vuelve a construir el APK automáticamente.
También puedes iniciarlo manualmente desde **Actions**.

## Alcance de este APK

`Tamper-Rewards-v1.0.5-debug.apk` sirve para probar e instalar directamente. No es el
archivo final para Google Play. La tienda requiere un AAB firmado con una llave
privada y una ficha de publicación.

El constructor se detiene si falta el archivo Android de Firebase, porque no se
debe publicar otro APK en el que Google Sign-In quede incompleto. Antes de
compilar agrega:

- `android/app/google-services.json`
- `ios/App/App/GoogleService-Info.plist`

Consulta `FIREBASE-NATIVO.md` antes de publicar una versión de producción.
