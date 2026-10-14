CREATE ROLE portal LOGIN PASSWORD 'portal';
CREATE DATABASE portal OWNER portal;
CREATE DATABASE portal_test OWNER portal;

\connect portal
CREATE EXTENSION IF NOT EXISTS postgis;

\connect portal_test
CREATE EXTENSION IF NOT EXISTS postgis;
