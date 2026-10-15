
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM properties
        WHERE currency NOT IN ('COP', 'USD')
    ) THEN
        RAISE EXCEPTION
            'Hay propiedades con monedas no soportadas. Corrígelas antes de migrar.';
    END IF;
END $$;

ALTER TABLE properties
    DROP CONSTRAINT IF EXISTS properties_currency_check;

ALTER TABLE properties
    ADD CONSTRAINT properties_currency_check
    CHECK (currency IN ('COP', 'USD'));

INSERT INTO schema_migrations (version)
VALUES ('002_moneda_colombia')
ON CONFLICT (version) DO NOTHING;

COMMIT;
