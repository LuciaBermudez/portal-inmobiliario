# ADR 0005 — Alertas por zona: por evento y programadas

- Estado: aceptado

## Decisión

- **Por evento (instant)**: cada lote importado encola `match(listingIds nuevos)`.
  - La consulta espacial inversa `JOIN zones ON ST_Intersects(z.geom, l.geom)` aplica los filtros JSONB de cada zona.
  - El resultado se notifica por WebSocket.
- **Programadas (daily)**: `boss.schedule` de pg-boss con cron (`DIGEST_CRON`). Es un upsert: idempotente aunque arranquen varios workers.
- **Exactamente una notificación por (zona, aviso)**: `UNIQUE(zone_id, listing_id)` + `ON CONFLICT DO NOTHING`. Los reintentos no duplican.
- **Resumen diario sin envíos dobles**: el reclamo es un único `UPDATE … SET digested_at = now() WHERE digested_at IS NULL RETURNING …`. Si dos ejecuciones compiten, la segunda re-evalúa la condición tras el bloqueo de fila y no reclama nada.
- El email pasa por el puerto `Mailer` (en desarrollo, `LogMailer`; en producción, SMTP/Resend/SES).
