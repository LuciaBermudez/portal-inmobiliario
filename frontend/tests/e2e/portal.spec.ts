import { expect, test } from '@playwright/test';

/**
 * Requiere el stack corriendo con datos seed (npm run db:seed).
 * Credenciales demo desde variables de entorno para no fijarlas en el código.
 */
const AGENT_EMAIL = process.env['E2E_AGENT_EMAIL'] ?? 'agente@demo.test';
const AGENT_PASSWORD = process.env['E2E_AGENT_PASSWORD'] ?? process.env['SEED_PASSWORD'] ?? '';

test('la búsqueda pública muestra mapa vectorial y listado', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Inmuebles/ })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});

test('rutas protegidas redirigen al login conservando el destino', async ({ page }) => {
  await page.goto('/imports');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fimports/);
});

test('un agente inicia sesión y accede a la carga masiva', async ({ page }) => {
  test.skip(!AGENT_PASSWORD, 'Define E2E_AGENT_PASSWORD o SEED_PASSWORD');
  await page.goto('/login?redirect=/imports');
  await page.getByLabel('Correo').fill(AGENT_EMAIL);
  await page.getByLabel('Contraseña').fill(AGENT_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Carga masiva de propiedades' })).toBeVisible();

  // Recargar conserva la sesión: el access token se recupera vía refresh token en cookie HttpOnly.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Carga masiva de propiedades' })).toBeVisible();
});
