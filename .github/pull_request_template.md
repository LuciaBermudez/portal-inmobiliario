## Qué cambia

<!-- Resumen en 1-3 líneas. Enlaza el issue: Closes #123 -->

## Cómo se probó

- [ ] `npm run lint && npm run typecheck && npm test`
- [ ] `npm run test:integration` (si toca SQL / repositorios)
- [ ] Probado manualmente en el navegador (si toca UI)

## Checklist

- [ ] Respeta la regla de dependencias (domain ← application ← infrastructure/interfaces)
- [ ] Nuevos endpoints validan entrada con esquemas de `shared/`
- [ ] Commits con Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`…)
