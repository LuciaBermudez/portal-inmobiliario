# ADR 0001 — Clean Architecture con inyección de dependencias explícita

- Estado: aceptado
- Fecha: 2026-10-13

## Contexto

El sistema combina lógica de negocio (ingesta, alertas, permisos) con mucha infraestructura (PostGIS, colas, S3, WebSockets). Necesitamos testear la lógica sin levantar infraestructura y poder cambiar adaptadores (disco ↔ S3, log ↔ SMTP).

## Decisión

- Cuatro capas: `domain`, `application`, `infrastructure` e `interfaces`. Las dependencias solo apuntan hacia adentro.
- El dominio define **puertos** (interfaces TypeScript); la infraestructura los implementa.
- Fastify sin contenedor DI con decoradores: una **raíz de composición** (`container.ts`) instancia todo por constructor.
- La regla se verifica con ESLint y con un test de arquitectura.

## Consecuencias

- \+ Los casos de uso se prueban con fakes en memoria (milisegundos).
- \+ Sin magia ni metadatos de decoradores; el bundle (tsup/esbuild) es simple.
- − Hay más archivos e interfaces que en un MVC plano.
