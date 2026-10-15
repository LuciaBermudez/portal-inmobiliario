DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM listings WHERE currency NOT IN ('COP', 'USD')) THEN
    RAISE EXCEPTION 'Hay avisos en monedas no soportadas. Elimínalos o conviértelos antes de migrar.';
  END IF;
END $$;

ALTER TABLE listings DROP CONSTRAINT listings_currency_check;
ALTER TABLE listings ADD CONSTRAINT listings_currency_check CHECK (currency IN ('COP', 'USD'));
