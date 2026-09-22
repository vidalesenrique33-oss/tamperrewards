# Notificaciones push de Tamper Rewards

Tamper Rewards 1.0.7 registra cada instalación Android con Firebase Cloud
Messaging. Después de que el usuario concede permiso, el token se guarda en:

```text
tamper_clients/{uid}/devices/{deviceId}
```

Como respaldo compatible con las reglas actuales, el token más reciente también
se guarda en `tamper_clients/{uid}.pushToken`. El backend debe consultar primero
la subcolección para admitir varios teléfonos y usar `pushToken` cuando todavía
no exista esa subcolección.

El documento contiene `token`, `platform`, `enabled`, `appVersion`, `updatedAt`
y las preferencias para pedidos, promociones, recordatorios y automatizaciones.

## Carga útil compartida

Los mensajes del servidor deben incluir una carga `notification` para que
Android pueda mostrarlos incluso con la app cerrada y una carga `data` con
valores de texto para indicar el destino:

```json
{
  "notification": {
    "title": "¡Tu pedido está listo!",
    "body": "Pasa a la barra por tu Pick & Go ☕"
  },
  "data": {
    "type": "pickgo_status",
    "screen": "tracking",
    "cafeId": "ratio-coffee",
    "orderId": "ID_DE_LA_ORDEN",
    "status": "ready"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "tamper_updates"
    }
  }
}
```

## Tipos admitidos

| `type` | `screen` recomendado | Datos adicionales |
| --- | --- | --- |
| `pickgo_status` | `tracking` | `cafeId`, `orderId`, `status` |
| `promotion` | `rewards` | `promotionId`, `cafeId` |
| `coupon` | `rewards` | `couponId` |
| `reward` | `rewards` | `rewardId`, `cafeId` |
| `gift` | `rewards` | `giftId`, `cafeId` |
| `visit_reminder` | `home` | `cafeId` opcional |
| `event` | `home` | `eventId`, `cafeId` |
| `generic` | `notifications` | — |

Cada envío deberá crear también un documento en
`tamper_clients/{uid}/notifications/{notificationId}` para conservar el mensaje
en la campana interna aunque el usuario borre la notificación del teléfono.

Las credenciales de Firebase Admin y el envío FCM deben permanecer en Cloud
Functions o en otro servidor confiable. Nunca deben incluirse en el HTML, en el
repositorio ni en el APK.
