# Portal Inmobiliario

Portal de propiedades con:

- **pipeline de carga masiva** de catálogos en background;
- **filtrado espacial por polígonos** sobre **mapas vectoriales**;
- **alertas programadas por zona**.

| | |
|---|---|
| **Backend** | Node 22 · Fastify 5 · TypeScript estricto · Clean Architecture · PostgreSQL + PostGIS (datos, colas pg-boss y eventos LISTEN/NOTIFY) · Socket.IO |
| **Frontend** | Vue 3 · Pinia · Vue Router · MapLibre GL (teselas vectoriales) · PWA |
| **Calidad** | Vitest · PostgreSQL real en tests de integración · Playwright · ESLint · GitHub Actions |

## Estructura

```
portal-inmobiliario/
├── backend/            API + worker (paquete independiente)
│   ├── src/
│   │   ├── domain/          entidades, puertos (interfaces), errores — sin frameworks
│   │   ├── application/     casos de uso (dependen solo de puertos)
│   │   ├── infrastructure/  PostGIS, pg-boss, LISTEN/NOTIFY, S3, argon2, JWT
│   │   ├── interfaces/      HTTP (Fastify) y WebSocket
│   │   ├── container.ts     raíz de composición (inyección de dependencias)
│   │   ├── main.ts          proceso API
│   │   └── worker.ts        proceso worker (ingesta + alertas + cron)
│   ├── migrations/      SQL versionado
│   ├── tests/           unit/ (fakes) · integration/ (PostGIS real)
│   └── uploads/         CSV subidos en desarrollo (STORAGE_DRIVER=local)
├── frontend/           SPA Vue (paquete independiente)
│   ├── src/  api/ · stores/ · components/ · views/ · router/ · realtime/
│   └── tests/ unit/ · e2e/
├── shared/             contratos: esquemas Zod, eventos WS, políticas RBAC/ABAC
└── docs/               adr/ · architecture/ · diagrams/ · requirements/ · testing/ · use-cases/
```

Backend y frontend **no se importan entre sí**: cada uno se instala, compila, prueba y despliega por separado. Lo único común es `shared/`, que contiene solo contratos tipados. Así el frontend valida en runtime exactamente lo mismo que el backend.

## Puesta en marcha (desarrollo)

Requisitos: **Node 22+** y **PostgreSQL 16+ con PostGIS** (recomendado 18). No hace falta Redis: las colas (pg-boss) y los eventos en tiempo real (`LISTEN/NOTIFY`) también viven en PostgreSQL (ver [ADR 0006](docs/adr/0006-solo-postgresql.md)).

### 1. Instalar PostgreSQL + PostGIS en Windows

1. Descarga el instalador de PostgreSQL 18 desde https://www.postgresql.org/download/windows/ (EDB) y ejecútalo. Anota la contraseña del usuario `postgres`.
2. Al terminar, abre **Stack Builder** → *Spatial Extensions* → **PostGIS** e instálalo.
3. Agrega `C:\Program Files\PostgreSQL\18\bin` al `PATH` para tener `psql` (el instalador no lo hace). En PowerShell:
   `[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\PostgreSQL\18\bin", "User")` y abre una terminal nueva.

### 2. Crear las bases y preparar el proyecto

```bash
psql -U postgres -f backend/scripts/setup-local-db.sql   # usuario portal, bases portal y portal_test, PostGIS
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed               # usuarios demo, contraseña = SEED_PASSWORD de .env
```

Luego, en tres terminales:

```bash
npm run dev:api       # http://localhost:3000
npm run dev:worker
npm run dev:web       # http://localhost:5173
```

Usuarios demo:

| Email | Rol |
|---|---|
| `admin@demo.test` | admin |
| `agente@demo.test` | agente de "Inmobiliaria Demo" |
| `cliente@demo.test` | cliente |

Generar un catálogo de prueba (con ~1% de filas inválidas a propósito) y subirlo en **Carga masiva**:

```bash
npm run generate:csv -w @portal/backend -- 100000 uploads/listings-100k.csv
```


## Formato del CSV

```
external_id,title,description,operation,property_type,price,currency,bedrooms,bathrooms,area_m2,address,lat,lng
EXT-1,"Apartamento en Granada","Cerca al Bulevar del Río",rent,apartment,2500000,COP,2,2,68,"Avenida 9N # 12-30, Granada",3.458,-76.533
```

| Columna | Valores |
|---|---|
| `operation` | `sale` \| `rent` |
| `property_type` | `house` \| `apartment` \| `land` \| `office` \| `commercial` |
| `currency` | `COP` \| `USD` |

Re-importar el mismo `external_id` **actualiza** el aviso; no lo duplica.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint en todos los paquetes (incluye la regla de capas) |
| `npm run typecheck` | `tsc` / `vue-tsc` estricto |
| `npm test` | Tests unitarios (shared, backend, frontend) |
| `npm run test:integration` | Integración contra PostgreSQL + PostGIS real (base de `TEST_DATABASE_URL`) |
| `npm run test:e2e -w @portal/frontend` | Playwright contra el stack levantado |
| `npm run build` | Bundle del backend (tsup) y del frontend (Vite + PWA) |

## API

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/refresh` · `/logout` | público (refresh vía cookie) |
| GET | `/api/auth/me` | autenticado |
| POST | `/api/listings/search` | público (filtros + polígono GeoJSON + cursor) |
| GET | `/api/listings/:id` | público |
| PATCH | `/api/listings/:id` | admin · agente de la misma inmobiliaria (ABAC), con `version` |
| GET | `/api/tiles/:z/:x/:y.mvt` | público (Mapbox Vector Tiles) |
| POST | `/api/imports` | admin · agente (multipart + header `Idempotency-Key`) |
| GET | `/api/imports` · `/:id` · `/:id/errors` | admin · agente |
| GET/POST/DELETE | `/api/zones` | autenticado (solo sus zonas) |
| GET · POST | `/api/notifications` · `/read` | autenticado |
| WS | `import:progress`, `notification:new` | autenticado (token en el handshake) |

## Mapeo a la rúbrica

| Criterio | Evidencia en el código |
|---|---|
| **Arquitectura** | Capas en `backend/src/*`; puertos en `domain/`; DI en `container.ts`; ESLint `no-restricted-imports` + `tests/unit/architecture.test.ts`; `strict` + `no-explicit-any: error`; contratos Zod compartidos validados en servidor **y** cliente |
| **Seguridad / concurrencia** | Doble token (ADR 0002), argon2id, cookie HttpOnly, rotación con reuso → revocación (`pg-refresh-token-store.ts`); RBAC (`requireRoles`) + ABAC (`shared/src/policies.ts`); bloqueo optimista (`version`); transacción por lote con guarda; `UNIQUE` para idempotencia; tests de concurrencia en `tests/integration` |
| **Frontend** | Pinia normalizado (`byId` + ids); `AsyncStatus` en cada store; guards asíncronos con refresh silencioso; virtualización + scroll infinito por cursor; descarte de respuestas obsoletas; skeletons, toasts y reintentos |
| **Desafío técnico** | Ingesta en streaming + lotes + upsert `unnest` + reanudación (`process-import.ts`); PostGIS `ST_Intersects` + MVT (`ST_AsMVT`); alertas por evento y cron; WebSockets vía `LISTEN/NOTIFY` de Postgres; PWA offline |
| **Testing / DevOps** | Tests unitarios, de integración (PostgreSQL real), E2E (Playwright); CI con lint, tipos, tests unitarios, integración y build; plantilla de PR; Conventional Commits |

Más detalle en [`docs/`](docs/architecture/README.md).
