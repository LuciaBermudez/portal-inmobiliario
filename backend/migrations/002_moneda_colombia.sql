-- El portal opera en Colombia (Cali): pesos colombianos (COP) y dólares (USD).
-- Reemplaza las monedas chilenas (CLP, UF) del esquema inicial.
--
-- Los avisos en CLP/UF no tienen una conversión fiable a COP: si existen, la migración falla
-- en lugar de inventar precios. En desarrollo, re-importa el catálogo con los datos nuevos.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM listings WHERE currency NOT IN ('COP', 'USD')) THEN
    RAISE EXCEPTION 'Hay avisos en monedas no soportadas (CLP/UF). Elimínalos o conviértelos antes de migrar.';
  END IF;
END $$;

ALTER TABLE listings DROP CONSTRAINT listings_currency_check;
ALTER TABLE listings ADD CONSTRAINT listings_currency_check CHECK (currency IN ('COP', 'USD'));
