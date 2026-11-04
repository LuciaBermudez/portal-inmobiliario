# ADR 0002 — Autenticación con doble token y rotación con detección de reuso

- Estado: aceptado

## Decisión

- **Access token**: JWT HS256 de 15 minutos. El cliente lo guarda **solo en memoria** (store de Pinia), nunca en `localStorage`.
- **Refresh token**: valor opaco aleatorio de 256 bits, en una cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`. En la BD solo se guarda su SHA-256.
- **Rotación**: cada `/auth/refresh` invalida el token usado y emite uno nuevo de la misma *familia*.
- **Detección de reuso**: si llega un token ya rotado, se revoca toda la familia (posible robo).
- La fila se bloquea con `SELECT … FOR UPDATE`, así que dos refresh concurrentes no pueden rotar el mismo token dos veces.
- En el cliente, el refresh es *single-flight*: N peticiones con 401 comparten una única llamada.

## Autorización

- **RBAC**: los roles `admin`, `agent` y `client` se comprueban en el preHandler de las rutas.
- **ABAC**: atributos del recurso, como "un agente solo edita avisos de *su* inmobiliaria". Se comprueban en los casos de uso con las funciones puras de `shared/src/policies.ts`. El frontend reutiliza esas mismas funciones solo para mostrar u ocultar la UI.

## Alternativas descartadas

- *JWT en localStorage*: expuesto a XSS.
- *Sesiones con estado en Redis*: viables, pero no aportan frente a lo anterior.

## Limitación conocida

- Dos pestañas que refrescan exactamente a la vez pueden disparar la detección de reuso y cerrar la sesión. Se mitigaría con `BroadcastChannel` para compartir el refresh entre pestañas.
