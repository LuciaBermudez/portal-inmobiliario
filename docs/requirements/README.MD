# Requisitos

## Funcionales

| ID | Requisito | Dónde |
|---|---|---|
| RF-01 | Registro e inicio de sesión; la sesión persiste al recargar | `auth.routes.ts`, `stores/auth.ts` |
| RF-02 | Búsqueda pública con filtros (operación, tipo, precio, dormitorios) | `POST /api/listings/search` |
| RF-03 | Filtrado espacial dibujando un polígono sobre un mapa vectorial | `MapView.vue`, `PgListingRepository.search` |
| RF-04 | Mapa con capa de avisos en teselas vectoriales | `GET /api/tiles/{z}/{x}/{y}.mvt` |
| RF-05 | Carga masiva de catálogos CSV en background, con progreso en vivo | `ImportsView.vue`, `ProcessImport` |
| RF-06 | Reporte de errores por fila sin detener la carga | `GET /api/imports/:id/errors` |
| RF-07 | Edición de avisos solo por agentes de la misma inmobiliaria (o admin) | `UpdateListing`, `policies.ts` |
| RF-08 | Alertas por zona (polígono + filtros), instantáneas o en resumen diario | `zones`, `MatchNewListings`, `SendDailyDigests` |
| RF-09 | Favoritos y última búsqueda disponibles sin conexión | `stores/listings.ts`, PWA |

## No funcionales

| ID | Requisito | Cómo se cumple |
|---|---|---|
| RNF-01 | Ingesta de 100k+ filas sin bloquear la API ni agotar memoria | Streaming + lotes + worker separado |
| RNF-02 | Consistencia ante reintentos y concurrencia | Transacción por lote, idempotencia, bloqueo optimista, `FOR UPDATE` |
| RNF-03 | Seguridad de sesión | Doble token, argon2id, cookie HttpOnly, rate limiting, Helmet |
| RNF-04 | Búsqueda espacial < 200 ms con 1M de avisos | Índice GIST + keyset pagination |
| RNF-05 | UI fluida con miles de resultados | Virtualización (`@tanstack/vue-virtual`) |
| RNF-06 | Calidad verificable | CI: lint, tipos, unitarios, integración con PostGIS real, build |
