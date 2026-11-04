-- Prepara PostgreSQL local para desarrollo (solo una vez). Ejecutar como superusuario:
--   psql -U postgres -f backend/scripts/setup-local-db.sql
-- Usuario y contraseña de DESARROLLO, coinciden con .env.example.

CREATE ROLE portal LOGIN PASSWORD 'portal';
CREATE DATABASE portal OWNER portal;
CREATE DATABASE portal_test OWNER portal;

-- PostGIS requiere superusuario para instalarse; luego la migración lo encuentra ya creado.
\connect portal
CREATE EXTENSION IF NOT EXISTS postgis;

\connect portal_test
CREATE EXTENSION IF NOT EXISTS postgis;
