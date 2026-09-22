# Firebase nativo para `com.tamper.rewards`

Tamper Rewards conserva el proyecto Firebase existente `tamperpos`. No debe
crearse otra base de datos ni copiar colecciones.

## Android

1. En Firebase Console abre el proyecto `tamperpos`.
2. Agrega una aplicación Android con el paquete `com.tamper.rewards`.
3. Ejecuta una vez `Construir APK Android` en GitHub Actions. En el resumen de
   la ejecución copia la huella que aparece como `SHA-1`. El flujo conserva esa
   firma de prueba para que la huella no cambie en cada compilación.
4. En la configuración de la aplicación Android de Firebase, selecciona
   **Agregar huella digital** y registra ese SHA-1.
5. En Firebase Authentication > Sign-in method confirma que Google esté
   habilitado.
6. Descarga el `google-services.json` actualizado.
7. En Codespaces colócalo exactamente en
   `android/app/google-services.json` y ejecuta:

```bash
git add -f android/app/google-services.json
git commit -m "Configurar Firebase Android"
git push origin Tamper
git push origin Tamper:main
```

El archivo está ignorado por Git de forma predeterminada para evitar subirlo
accidentalmente a otro repositorio; por eso el primer comando usa `-f`.

## iOS

1. En el mismo proyecto agrega una aplicación iOS.
2. Usa el Bundle ID `com.tamper.rewards`.
3. Descarga `GoogleService-Info.plist`.
4. Colócalo en `ios/App/App/GoogleService-Info.plist`.
5. En Xcode agrégalo al target `App` y confirma que se copie en el bundle.

## Estado de la integración

Google Sign-In nativo ya está conectado con la sesión web existente de Firebase,
por lo que conserva el mismo UID, perfil, XP, niveles y recompensas. Android usa
un puente propio que solicita únicamente el ID token necesario; no solicita un
access token ni un server auth code que Tamper Rewards no utiliza. Las
notificaciones push, APNs y la apertura directa de promociones siguen
pendientes.

No publiques ni compartas las llaves privadas de firma, certificados APNs ni
archivos de cuentas de servicio. Los archivos de configuración de cliente sí
deben vivir dentro de sus proyectos nativos, pero no se incluyen en este ZIP
porque Firebase tiene que generarlos para el identificador definitivo.
