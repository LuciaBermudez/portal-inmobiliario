import type { AsyncStatus, AuthResponse, LoginRequest, RegisterRequest, Role, SessionUser } from '@portal/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api/auth';
import { messageOf } from '@/api/http';

/**
 * Sesión con doble token:
 *  - access token: SOLO en memoria (este store). Nunca en localStorage → inaccesible tras recargar o por XSS persistente.
 *  - refresh token: cookie HttpOnly gestionada por el navegador; recargar la página recupera la sesión con /auth/refresh.
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<SessionUser | null>(null);
  const status = ref<AsyncStatus>('idle');
  const error = ref<string | null>(null);
  let bootstrap: Promise<boolean> | null = null;
  let refreshing: Promise<string | null> | null = null;

  const isAuthenticated = computed(() => user.value !== null && accessToken.value !== null);

  function setSession(session: AuthResponse) {
    accessToken.value = session.accessToken;
    user.value = session.user;
  }

  function clear() {
    accessToken.value = null;
    user.value = null;
  }

  async function run(action: () => Promise<AuthResponse>): Promise<boolean> {
    status.value = 'loading';
    error.value = null;
    try {
      setSession(await action());
      status.value = 'success';
      return true;
    } catch (e) {
      status.value = 'error';
      error.value = messageOf(e);
      return false;
    }
  }

  const login = (body: LoginRequest) => run(() => authApi.login(body));
  const register = (body: RegisterRequest) => run(() => authApi.register(body));

  /** Single-flight: N peticiones con 401 simultáneas comparten UN solo refresh (el servidor rota el token). */
  function refresh(): Promise<string | null> {
    refreshing ??= authApi
      .refresh()
      .then((session) => {
        setSession(session);
        return session.accessToken;
      })
      .catch(() => {
        clear();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  /** Lo llama el guard de navegación una vez por carga de página. */
  function ensureSession(): Promise<boolean> {
    bootstrap ??= accessToken.value ? Promise.resolve(true) : refresh().then((token) => token !== null);
    return bootstrap;
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }

  const hasRole = (...roles: Role[]) => user.value !== null && roles.includes(user.value.role);

  return {
    accessToken,
    user,
    status,
    error,
    isAuthenticated,
    login,
    register,
    refresh,
    ensureSession,
    logout,
    hasRole,
  };
});
