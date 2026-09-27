# Actualizar Tamper Rewards a 1.0.8

Esta actualización corrige el detalle de los personajes de **Ratio Halloween
Collection 2026**:

- tocar un personaje encontrado abre su historia, pista y fecha;
- `CONOCER A…` al terminar la animación abre ese mismo personaje;
- los personajes encontrados siguen abriendo aunque después queden inactivos o
  agotados;
- el botón Atrás de Android cierra primero la animación o el detalle.

No requiere volver a desplegar Cloud Functions ni cambiar Firebase.

## 1. Subir y descomprimir

Sube `Tamper-Rewards-APK-Update-v1.0.8.zip` a la raíz del repositorio de
**Tamper Rewards**. En la terminal, dentro de ese repositorio, ejecuta:

```bash
unzip -o Tamper-Rewards-APK-Update-v1.0.8.zip
npm ci
npm run doctor
npm run sync -- android
```

El comando `npm run doctor` debe terminar con:

```text
Tamper Rewards Mobile: estructura, identificador, puente nativo y plataformas correctos.
```

## 2. Publicar los cambios

```bash
git add -A ':!*.zip'
git commit -m "Corregir detalle de personajes Halloween Rewards 1.0.8"
git push origin Tamper:main
```

Si tu rama local ya se llama `main`, usa:

```bash
git push origin main
```

## 3. Descargar el APK

1. Abre el repositorio en GitHub.
2. Entra en **Actions**.
3. Abre **Construir APK Android**.
4. Espera el círculo verde de la ejecución nueva.
5. Descarga el artefacto `Tamper-Rewards-APK-v1.0.8`.
6. Dentro estará `Tamper-Rewards-v1.0.8-debug.apk`.

Instálalo como actualización sobre la app existente. No desinstales la versión
anterior si deseas conservar los datos locales de la aplicación.

## 4. Prueba final

1. Abre **Premios** en Rewards.
2. Toca un personaje ya encontrado: debe abrir nombre, subtítulo, historia,
   pista y fecha.
3. Realiza una entrega nueva desde POS.
4. En la animación de Rewards pulsa `CONOCER A…`: debe abrir inmediatamente la
   ficha del personaje recibido.
5. Cierra la ficha con la X, con `VOLVER A MI COLECCIÓN` o con Atrás de Android.

