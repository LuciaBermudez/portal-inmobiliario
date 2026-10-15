CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE agencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL CHECK (role IN ('admin', 'agent', 'client')),
  agency_id      uuid REFERENCES agencies(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_needs_agency CHECK (role <> 'agent' OR agency_id IS NOT NULL)
);