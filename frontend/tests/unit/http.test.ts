import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, configureAuth, request } from '@/api/http';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('cliente HTTP', () => {
  it('ante un 401 refresca el token una vez y reintenta con el nuevo', async () => {
    let token = 'viejo';
    const refresh = vi.fn(async () => {
      token = 'nuevo';
      return token;
    });
    configureAuth({ getToken: () => token, refresh });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expirado' } }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/zones')).resolves.toEqual({ ok: true });

    expect(refresh).toHaveBeenCalledTimes(1);
    const retryHeaders = fetchMock.mock.calls[1]![1].headers as Headers;
    expect(retryHeaders.get('authorization')).toBe('Bearer nuevo');
  });

  it('no entra en bucle si el refresh falla', async () => {
    configureAuth({ getToken: () => 'x', refresh: async () => null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'no' } })));

    await expect(request('/zones')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('traduce el cuerpo de error del API a ApiError', async () => {
    configureAuth({ getToken: () => null, refresh: async () => null });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(409, { error: { code: 'CONFLICT', message: 'modificado', details: { currentVersion: 4 } } })),
    );

    const error = await request('/listings/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'modificado', details: { currentVersion: 4 } });
  });

  it('un fallo de red se convierte en NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
