# Android NFC · piloto 1.0.5

## Alcance y base

Se parte de la rama `Tamper`, commit `33c97be37f83ebd85e85e5f6b92618861dd19b74`, del repositorio `vidalesenrique33-oss/tamperrewards`.

Esta rama añade un lector NFC nativo Android al proyecto existente. Conserva la interfaz Rewards y su QR `TAMPER_CLIENT_<uid>`. No crea GO, EXPLORE o ACTIVE, no cambia archivos de iOS y no modifica datos, reglas o funciones de Firebase, POS, Contabilidad, inventario o reglas comerciales. Se actualiza únicamente la configuración cliente de Firebase suministrada por el usuario.

**Es una prueba real del lector, sin acreditación de beneficios.** La aplicación identifica si pudo leer NDEF, pero no autentica un sello comercial, no transmite su UID/payload y no concede sellos ni recompensas. Un teléfono con NFC necesita además una etiqueta física compatible para comprobar la lectura; otro teléfono o una tarjeta bancaria no son equivalentes a esa prueba.

## Cambios

- `TamperNfcPlugin.java`: lector Android en primer plano, detección NFC A/B/F/V, NDEF, timeout de 30 segundos, cancelación y cierre al salir de la app. No escribe etiquetas ni accede a red o Firebase. No devuelve enlaces, UID o textos de la etiqueta a la interfaz.
- `MainActivity.java`: registro explícito del plugin, conservando Firebase Authentication.
- `AndroidManifest.xml`: permiso NFC y hardware opcional; el QR sigue disponible en equipos sin NFC.
- `nfc-reader.js` / `.css`: acción principal «Recibir sello» en el inicio autenticado, ventana de lectura, ajustes, reintentos y acceso al QR original. La interfaz sólo se carga dentro de Android nativo; no cambia la PWA ni iOS.
- `native-bridge.js`: carga los recursos nuevos, conservando el puente de autenticación y sus diagnósticos existentes.
- `build.gradle`: versión 1.0.5, código 6.
- `tests/nfc-reader.test.cjs`: 18 pruebas con adaptador nativo simulado. Comprueban estados, cancelación, resultados tardíos, alternativa QR, ausencia de hardware, NFC apagado, salida de sesión y ausencia de acceso a Firebase.
- Flujo de GitHub: compila esta rama aislada y conserva la comprobación existente entre firma de prueba y configuración OAuth de Firebase. No despliega a Netlify ni publica en Google Play.
- Se retira únicamente `android/app/src/main/res/drawable-land-xxxhdpi/splash.png`, que estaba vacío (0 bytes). Android puede usar las imágenes válidas de otras densidades. No se cambia el diseño del splash.

## Pruebas locales

Ejecutado: instalación con `npm ci`, pruebas `npm run test:nfc`, `npm run doctor` y sintaxis de los dos scripts modificados. Las 18 pruebas pasaron sin errores DOM no controlados. Son pruebas de código/DOM con lector simulado, no pruebas de radio NFC.

La compilación Android y su resultado deben comprobarse en la ejecución de GitHub Actions de esta rama. Un workflow correcto no demuestra que una sesión Google o una etiqueta funcionen en un dispositivo físico.

## Comprobación en el POCO del usuario

1. Descargar el artefacto de una ejecución exitosa y extraer `Tamper-Rewards-v1.0.5-NFC-pilot-debug.apk`.
2. Instalarlo en el Android de pruebas. Si informa una firma incompatible con una instalación anterior, no desinstalar precipitadamente: primero cotejar firmas y preservar el acceso a la cuenta. No se debe prometer actualización sobre otro APK firmado con una llave diferente.
3. Activar NFC en los ajustes del teléfono, iniciar sesión y comprobar que el perfil/QR corresponden a la misma cuenta.
4. Pulsar «Recibir sello» y acercar una etiqueta NDEF al lector del teléfono. Debe mostrar «Etiqueta leída» y explicar que se trata de una prueba sin acreditación.
5. Repetir con NFC apagado, cancelación, botón Atrás, pantalla bloqueada/cambio de app, etiqueta retirada, dos pulsaciones rápidas y timeout. El lector no debe reiniciarse solo al volver.
6. Probar «Usar mi QR» desde la tarjeta y desde la ventana NFC; verificar lectura en POS sin registrar compras ficticias.
7. Comprobar Matcha, Halloween y Navidad; texto grande, scroll hasta el último control y reducción de movimiento.

No se han realizado estas pruebas físicas ni se ha registrado una compra real. No se afirma compatibilidad certificada con un modelo por conocer únicamente su nombre y que el usuario indique que tiene NFC.

## Firma y Firebase

El archivo `google-services.json` existente pertenece a `com.tamper.rewards` en `tamperpos`. Se actualiza con `google-services (3).json` suministrado por el usuario, que incluye la huella de este piloto y conserva la anterior. El workflow requiere que su cliente OAuth Android coincida con la huella de la firma utilizada.

El mecanismo de firma de prueba existente se conserva mediante caché de GitHub. Si esa caché ya no existe, se generará otra firma y el workflow se detendrá indicando la huella pendiente. En ese caso hay que registrar la huella correcta en Firebase y descargar la configuración actualizada; no se elimina el control para que parezca que Google Sign-In funciona. Para publicación se necesita una estrategia de firma duradera, no depender sólo de caché.

## Siguiente etapa

Definir y provisionar el tamper físico; autenticar su mensaje con el servidor y vincular la operación al UID y al ticket pagado elegible. El estampado de recompensas sólo se activará después de autorización transaccional e idempotente. No basta con leer una URL fija ni con GPS.

## Reversión

Los cambios están aislados en `codex/android-nfc-pilot`. No hay migraciones de datos que revertir. Cerrar la propuesta o volver al commit base recupera el código anterior. Si se instala un APK anterior, Android puede bloquear la reducción de versión; debe prepararse un build de reversión con código de versión superior y la misma firma, sin borrar datos por defecto.

## Primer intento de Actions

La ejecución 40610865874 pasó las 18 pruebas y doctor, pero se detuvo al comprobar OAuth: la caché de la firma anterior ya no existía. Se corrige la persistencia guardando la firma nueva antes de la comprobación de Firebase, incluso si esa comprobación falla. La compilación se realiza antes de esa comprobación para poder detectar errores Java; el APK sólo se ofrece para descarga si la configuración OAuth coincide. La huella del primer intento se descarta: el siguiente intento proporciona la que realmente queda conservada en caché para esta rama.

Revisión visual: interfaz del lector probada en Chrome con adaptador NFC simulado, a 320/390/430 px; sin desbordamiento lateral y controles de 44/48 px. Matcha, Halloween y Navidad conservan textos legibles. Se comprobó estado de lectura y acción QR. Esto no es una prueba del APK en Android ni de radio NFC.

## Verificación de firma reforzada

La ejecución 40612460753 compiló pero el control posterior heredado sólo advertía, sin fallar, cuando no podía verificar la firma o faltaban recursos OAuth. La inspección independiente del APK detectó un certificado distinto al preparado y ausencia del recurso OAuth. Ese APK se descartó para entrega y no se instaló.

El commit `d63dfd30fef3ccbdbcd8aec980c0253fb3329fa7` configura explícitamente la llave de piloto por `TAMPER_DEBUG_KEYSTORE`, aplica Google Services sin ocultar excepciones y exige verificación criptográfica con apksigner, igualdad de huellas y recursos OAuth generados antes de subir el artefacto. La configuración Firebase coincide con:

```text
1E:1C:7C:BB:D5:36:F5:BA:8F:C1:71:1D:7E:E7:82:12:9B:92:CE:6E
```

Las pruebas físicas de NFC, cámara/QR y sesión en el POCO siguen pendientes. La firma de prueba vive en caché para el piloto; debe sustituirse por una estrategia de firma duradera antes de distribuir públicamente.

## Entrega verificada

- Commit compilado: `6756ab1fd1d76a1e499c2fc6ad05a56bc57a80b0`.
- Ejecución exitosa: https://github.com/vidalesenrique33-oss/tamperrewards/actions/runs/40613329943
- 18 pruebas automatizadas aprobadas; doctor y sincronización aprobados.
- `:app:assembleDebug`: BUILD SUCCESSFUL.
- `:app:processDebugGoogleServices` ejecutado, recursos OAuth y google_app_id comprobados.
- Firma criptográfica APK v2 verificada con apksigner; certificado SHA-1 coincide con la configuración Firebase.
- APK: `Tamper-Rewards-v1.0.5-NFC-pilot-debug.apk`, 11,017,587 bytes.
- SHA-256 del APK: `2b90516e48d720dd2564259a8e756c564aeefad0e5d1d4ae15d10fb7336b54e6`.
- Descarga e inspección independiente: ZIP íntegro, paquete/versiones, permiso NFC opcional, clase del plugin y recursos JS/CSS presentes, QR original conservado y certificado esperado.
- La herramienta SDK actual usa la etiqueta `V2 Signer:`; el control acepta ese formato y el anterior, sin omitir la verificación ni permitir certificados diferentes.
- No hay publicación en Netlify/Play, fusión a la rama estable ni cambios de saldos. El artefacto de Actions es únicamente una descarga del piloto.
- Pendientes: instalación y sesión Google reales, NFC físico con etiqueta NDEF, QR/cámara y regresión en POCO. No se han ejecutado pruebas físicas de iPhone; esta entrega sólo añade Android.
