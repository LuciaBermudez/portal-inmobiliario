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

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid REFERENCES refresh_tokens(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

CREATE TABLE import_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  agency_id           uuid NOT NULL REFERENCES agencies(id),
  idempotency_key     text NOT NULL,
  file_key            text NOT NULL,
  original_name       text NOT NULL,
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  total_rows          integer,
  processed_rows      integer NOT NULL DEFAULT 0,
  inserted_rows       integer NOT NULL DEFAULT 0,
  updated_rows        integer NOT NULL DEFAULT 0,
  failed_rows         integer NOT NULL DEFAULT 0,
  last_committed_row  integer NOT NULL DEFAULT 0,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  CONSTRAINT import_jobs_idempotency UNIQUE (user_id, idempotency_key)
);
CREATE INDEX import_jobs_agency_idx ON import_jobs (agency_id, created_at DESC);

CREATE TABLE import_row_errors (
  job_id      uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number  integer NOT NULL,
  message     text NOT NULL,
  raw         jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (job_id, row_number)
);

CREATE TABLE listings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid NOT NULL REFERENCES agencies(id),
  external_id    text NOT NULL,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  operation      text NOT NULL CHECK (operation IN ('sale', 'rent')),
  property_type  text NOT NULL CHECK (property_type IN ('house', 'apartment', 'land', 'office', 'commercial')),
  price          numeric(16, 2) NOT NULL CHECK (price > 0),
  currency       text NOT NULL CHECK (currency IN ('CLP', 'UF', 'USD')),
  bedrooms       smallint CHECK (bedrooms >= 0),
  bathrooms      smallint CHECK (bathrooms >= 0),
  area_m2        numeric(10, 2) CHECK (area_m2 > 0),
  address        text NOT NULL DEFAULT '',
  geom           geometry(Point, 4326) NOT NULL,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  version        integer NOT NULL DEFAULT 1,
  import_job_id  uuid REFERENCES import_jobs(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
 
  CONSTRAINT listings_agency_external UNIQUE (agency_id, external_id)
);
CREATE INDEX listings_geom_idx ON listings USING gist (geom);
CREATE INDEX listings_feed_idx ON listings (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX listings_price_idx ON listings (price);

CREATE TABLE zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  geom        geometry(Polygon, 4326) NOT NULL CHECK (ST_IsValid(geom)),
  filters     jsonb NOT NULL DEFAULT '{}',
  frequency   text NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant', 'daily')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zones_geom_idx ON zones USING gist (geom);
CREATE INDEX zones_user_idx ON zones (user_id);

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id      uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  digested_at  timestamptz,
  
  CONSTRAINT notifications_once UNIQUE (zone_id, listing_id)
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_pending_digest_idx ON notifications (zone_id) WHERE digested_at IS NULL;
