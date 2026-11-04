# Casos de uso

| Caso de uso | Actor | Clase |
|---|---|---|
| CU-01 Registrarse | Visitante | `RegisterUser` |
| CU-02 Iniciar sesión / refrescar / cerrar sesión | Usuario | `LoginUser`, `RefreshSession`, `Logout` |
| CU-03 Buscar propiedades (filtros + polígono) | Cualquiera | `SearchListings` |
| CU-04 Ver detalle de propiedad | Cualquiera | `GetListing` |
| CU-05 Editar propiedad | Agente de la inmobiliaria, admin | `UpdateListing` |
| CU-06 Importar catálogo CSV | Agente, admin | `CreateImport` → `ProcessImport` (worker) |
| CU-07 Consultar importaciones y sus errores | Agente, admin | `ListImports`, `GetImport`, `ListImportErrors` |
| CU-08 Crear / listar / borrar zona de alerta | Usuario autenticado | `CreateZone`, `ListZones`, `DeleteZone` |
| CU-09 Notificar avisos nuevos en zonas | Sistema (worker) | `MatchNewListings` |
| CU-10 Enviar resumen diario | Sistema (cron) | `SendDailyDigests` |

## CU-06 Importar catálogo CSV (detalle)

**Precondición:** el usuario es agente o admin de una inmobiliaria.

**Flujo principal:**

1. El usuario elige un CSV. La UI genera una `Idempotency-Key`.
2. El archivo se sube mostrando el progreso de subida.
3. La API guarda el archivo en streaming, crea el job y responde `202`.
4. El worker procesa por lotes y la UI muestra el progreso en vivo.
5. Al terminar, el mapa recarga sus teselas y aparece un toast.

**Flujos alternativos:**

- 3a. Reintento con la misma clave: se devuelve el mismo job (`200`).
- 4a. Filas inválidas: se registran y la carga continúa.
- 4b. El worker cae: pg-boss reintenta (con backoff) y se reanuda desde `last_committed_row`.
- 4c. Agota los reintentos: el job queda `failed` con su mensaje.
