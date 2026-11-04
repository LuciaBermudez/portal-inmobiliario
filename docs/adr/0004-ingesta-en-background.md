# ADR 0004 — Ingesta masiva en background, idempotente y reanudable

- Estado: aceptado

## Decisión

1. **El request HTTP no procesa nada.** Hace streaming del multipart al storage, crea el job y responde `202`.
2. **Idempotencia en tres niveles:**
   - header `Idempotency-Key` con `UNIQUE(user_id, idempotency_key)`;
   - id del job de cola = id de la importación en pg-boss (un segundo envío se ignora);
   - upsert por la clave natural `UNIQUE(agency_id, external_id)`: re-importar un catálogo actualiza en lugar de duplicar.
3. **Procesamiento en lotes con transacción ACID por lote:** en una sola transacción se hace el upsert de los avisos (`unnest`), se registran los errores de fila y se avanza `last_committed_row`.
   - Una guarda optimista (`WHERE last_committed_row = $esperado`) impide que dos workers avancen el mismo job.
4. **Reanudable**: tras una caída, el reintento salta las filas ya confirmadas.
5. **Validación por fila** con el esquema Zod compartido. Una fila inválida no detiene la carga: queda en `import_row_errors` y la UI la muestra.
6. **Progreso en vivo**: el worker publica con `pg_notify` y la API (que escucha con `LISTEN`) lo reenvía por Socket.IO a la sala `user:<id>`.

## Limitación conocida

- El encolado de alertas tras el `COMMIT` de un lote no es atómico con él. Si el encolado falla justo en ese momento, esos avisos no generan alerta.
- Solución futura: como la cola ya vive en PostgreSQL, basta con pasar el cliente de la transacción a `boss.send(..., { db })` para que el encolado sea atómico con el lote.
