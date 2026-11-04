# ADR 0003 — PostGIS + teselas vectoriales generadas en la base de datos

- Estado: aceptado

## Decisión

- Ubicaciones como `geometry(Point, 4326)` con índice **GIST**.
- El filtrado por polígono usa `ST_Intersects(geom, ST_MakeValid(ST_GeomFromGeoJSON($1)))`.
  - El índice se usa porque la geometría de la consulta es constante.
  - `ST_MakeValid` tolera polígonos dibujados con auto-intersecciones.
- Los mapas usan **MapLibre GL** con un mapa base vectorial libre (OpenFreeMap, sin API key).
- La capa de avisos se sirve como **Mapbox Vector Tiles** desde `/api/tiles/{z}/{x}/{y}.mvt`, generadas con `ST_AsMVT` + `ST_TileEnvelope`. No hace falta un servidor de teselas aparte.
- La paginación del listado es **keyset** `(created_at, id)`, nunca `OFFSET`.
  - El cursor conserva los microsegundos de Postgres (`created_at::text`).

## Consecuencias

- \+ Un solo sistema de datos; los avisos recién importados aparecen en el mapa sin un proceso de exportación.
- \+ Las teselas se cachean en el cliente (service worker) y por HTTP (`max-age=30`).
- − Con millones de puntos conviene clustering en zoom bajo (`ST_SnapToGrid`) o un servidor dedicado (Martin).
