# ADR 0006 — PostgreSQL como único servicio de datos (sin Redis)

- Estado: aceptado (reemplaza el uso de BullMQ/Redis)
- Fecha: 2026-10-13

## Contexto

El equipo desarrolla en Windows, con PostgreSQL instalado directamente (sin contenedores). Redis no tiene versión oficial para Windows, y operar dos servicios de datos duplica configuración, backups y costos de despliegue.

## Decisión

PostgreSQL + PostGIS cubre las tres necesidades:

| Necesidad | Antes | Ahora |
|---|---|---|
| Datos y consultas espaciales | PostgreSQL + PostGIS | PostgreSQL + PostGIS |
| Colas con reintentos, backoff y cron | BullMQ (Redis) | **pg-boss**: tablas en el esquema `pgboss`; los workers toman jobs con `FOR UPDATE SKIP LOCKED` |
| Eventos worker → API (progreso, alertas) | Redis pub/sub | **`LISTEN/NOTIFY`**: el worker hace `pg_notify` y cada instancia de la API escucha con una conexión dedicada que se reconecta con backoff |

Solo cambiaron adaptadores de `infrastructure/` (`pg-boss-queues.ts`, `pg-event-bus.ts`) y la raíz de composición. Los puertos (`ImportQueue`, `AlertQueue`, `EventPublisher`) y todos los casos de uso quedaron intactos: es la demostración práctica de la arquitectura por capas (ADR 0001).

## Consecuencias

- \+ Un solo servicio que instalar, respaldar y desplegar.
- \+ Las colas son transaccionales con los datos: encolar puede hacerse dentro de la misma transacción (`boss.send(..., { db })`), lo que habilita un outbox sin infraestructura extra.
- − `NOTIFY` limita el payload a 8000 bytes (los eventos son DTOs pequeños) y no persiste mensajes si la API está caída. Es aceptable porque el progreso también se consulta por HTTP.
- − A volúmenes muy altos de jobs (miles por segundo), Redis rinde más. No es el caso de este sistema.
