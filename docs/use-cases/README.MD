# Estrategia de pruebas

| Nivel | Herramienta | Qué cubre | Comando |
|---|---|---|---|
| Contratos | Vitest | Esquemas Zod y políticas ABAC compartidas | `npm test -w @portal/shared` |
| Unitarias backend | Vitest + fakes en memoria | Casos de uso: pipeline de ingesta, auth, ABAC, cursor, **test de arquitectura** | `npm test -w @portal/backend` |
| Integración backend | Vitest + **PostgreSQL + PostGIS reales** | SQL espacial, upsert idempotente, rollback, **concurrencia** (bloqueo optimista, rotación de refresh concurrente, resumen diario concurrente), teselas MVT | `npm run test:integration` |
| Unitarias frontend | Vitest + happy-dom | Cliente HTTP (refresh + reintento), stores (single-flight, respuestas obsoletas, normalización, offline, eventos desordenados) | `npm test -w @portal/frontend` |
| E2E | Playwright (desktop + móvil) | Mapa, guards de navegación, login y persistencia de sesión al recargar | `npm run test:e2e -w @portal/frontend` |

## Tests de concurrencia destacados

- `listings.int.test.ts`: dos `UPDATE` simultáneos con la misma versión; exactamente uno gana y el otro recibe `409`.
- `auth.int.test.ts`: dos `/refresh` simultáneos con el mismo token; uno rota y el otro dispara la revocación de la familia.
- `auth.int.test.ts`: dos registros simultáneos con el mismo email; el índice único lo resuelve.
- `alerts.int.test.ts`: dos resúmenes diarios concurrentes no reclaman la misma notificación.
- `listings.int.test.ts`: un lote con progreso obsoleto hace rollback completo (no quedan avisos sueltos).
- `postgres-infra.int.test.ts`: encolar dos veces la misma importación crea un único job (pg-boss), y un `pg_notify` del worker llega al `LISTEN` de la API.

Los tests de integración usan la base de `TEST_DATABASE_URL`. Debe ser una base dedicada, porque los tests escriben datos.

- **Local:** PostgreSQL instalado en Windows; `backend/scripts/setup-local-db.sql` crea `portal_test`.
- **CI (GitHub Actions):** el job instala PostGIS en el runner y ejecuta el mismo script en cada PR.
