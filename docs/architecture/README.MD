# Arquitectura

## Vista de despliegue

```mermaid
flowchart LR
  U[Navegador<br/>Vue 3 + Pinia + MapLibre] -- HTTPS /api --> A[API Fastify<br/>REST + Socket.IO]
  U -- WSS /socket.io --> A
  A -- SQL · encola · LISTEN --> P[(PostgreSQL + PostGIS<br/>datos · colas pg-boss · NOTIFY)]
  A -- CSV stream --> S[(S3 / disco)]
  W[Worker pg-boss] -- toma jobs SKIP LOCKED --> P
  W -- lee CSV --> S
  W -- upsert por lotes --> P
  W -- pg_notify progreso --> P
```

- **backend** y **frontend** son paquetes independientes (dependencias, scripts y build propios).
- **shared** contiene solo contratos: esquemas Zod, tipos de eventos y políticas de acceso puras.
- API y worker son la misma imagen con comandos distintos y escalan por separado.

## Capas del backend (Clean Architecture)

```mermaid
flowchart TB
  subgraph interfaces [interfaces: HTTP Fastify, WebSocket]
  end
  subgraph infrastructure [infrastructure: Postgres/PostGIS, pg-boss, LISTEN/NOTIFY, S3, argon2, jose]
  end
  subgraph application [application: casos de uso]
  end
  subgraph domain [domain: entidades, puertos, errores]
  end
  interfaces --> application
  infrastructure --> application
  application --> domain
  infrastructure -. implementa puertos .-> domain
```

| Capa | Carpeta | Puede importar |
|---|---|---|
| Dominio | `backend/src/domain` | `@portal/shared` |
| Aplicación | `backend/src/application` | dominio |
| Infraestructura | `backend/src/infrastructure` | dominio, librerías |
| Interfaces | `backend/src/interfaces` | aplicación, dominio |
| Composición | `backend/src/container.ts` | todo (único punto de ensamblaje) |

La regla se hace cumplir **dos veces**: con ESLint (`no-restricted-imports` por carpeta) y con un test de arquitectura (`backend/tests/unit/architecture.test.ts`).

## Pipeline de carga masiva

```mermaid
sequenceDiagram
  participant UI as Vue (ImportsView)
  participant API
  participant S3 as Storage
  participant Q as Cola (pg-boss)
  participant W as Worker
  participant DB as PostGIS
  UI->>API: POST /api/imports (multipart, Idempotency-Key)
  API->>S3: stream del archivo (sin cargarlo en memoria)
  API->>DB: INSERT import_jobs ON CONFLICT DO NOTHING
  API->>Q: send(jobId)  (id único = sin duplicados)
  API-->>UI: 202 Accepted + job
  Q->>W: process(jobId)
  loop por cada lote de N filas
    W->>S3: lee CSV en streaming
    W->>W: valida fila (Zod) · dedup external_id
    W->>DB: BEGIN · upsert avisos · errores · avance del job · COMMIT
    W-->>UI: import:progress (pg_notify → LISTEN en la API → Socket.IO)
    W->>Q: match(listingIds nuevos) → alertas
  end
  W-->>UI: import:progress (completed)
```

## Autenticación de doble token

```mermaid
sequenceDiagram
  participant B as Navegador
  participant A as API
  B->>A: POST /auth/login
  A-->>B: { accessToken (15 min) } + Set-Cookie rt (HttpOnly, SameSite=Strict)
  Note over B: access token SOLO en memoria (Pinia)
  B->>A: GET /api/... Authorization: Bearer
  A-->>B: 401 (expiró)
  B->>A: POST /auth/refresh (cookie rt)
  A->>A: rota rt (FOR UPDATE) · si rt ya rotado → revoca familia
  A-->>B: { accessToken } + nueva cookie rt
```
