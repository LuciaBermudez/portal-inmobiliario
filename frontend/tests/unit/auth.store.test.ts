import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';

const session = {
  accessToken: 'access-1',
  user: { id: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f', email: 'a@b.cl', name: 'A', role: 'agent' as const, agencyId: null },
};

const { authApi } = vi.hoisted(() => ({
  authApi: { login: vi.fn(), register: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}));
vi.mock('@/api/auth', () => ({ authApi }));

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
});

describe('store de autenticación', () => {
  it('refresh es single-flight: llamadas concurrentes comparten una sola petición', async () => {
    authApi.refresh.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(session), 10)));
    const auth = useAuthStore();

    const [a, b, c] = await Promise.all([auth.refresh(), auth.refresh(), auth.refresh()]);

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(['access-1', 'access-1', 'access-1']);
    expect(auth.isAuthenticated).toBe(true);
  });

  it('si el refresh falla, limpia la sesión en memoria', async () => {
    authApi.refresh.mockRejectedValue(new Error('401'));
    const auth = useAuthStore();
    auth.accessToken = 'algo';

    await expect(auth.refresh()).resolves.toBeNull();
    expect(auth.accessToken).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('el access token vive solo en memoria (nunca en localStorage)', async () => {
    authApi.login.mockResolvedValue(session);
    const auth = useAuthStore();

    await auth.login({ email: 'a@b.cl', password: '12345678' });

    expect(auth.accessToken).toBe('access-1');
    expect(JSON.stringify({ ...localStorage })).not.toContain('access-1');
  });

  it('login fallido expone el error y deja status=error', async () => {
    authApi.login.mockRejectedValue(new Error('x'));
    const auth = useAuthStore();

    await expect(auth.login({ email: 'a@b.cl', password: '12345678' })).resolves.toBe(false);
    expect(auth.status).toBe('error');
    expect(auth.error).toBeTruthy();
  });
});
