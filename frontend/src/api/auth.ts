import { AuthResponseSchema, type LoginRequest, type RegisterRequest } from '@portal/shared';
import { request, requestParsed } from './http';

export const authApi = {
  login: (body: LoginRequest) =>
    requestParsed(AuthResponseSchema, '/auth/login', { method: 'POST', json: body, retryOnUnauthorized: false }),

  register: (body: RegisterRequest) =>
    requestParsed(AuthResponseSchema, '/auth/register', { method: 'POST', json: body, retryOnUnauthorized: false }),

  /** El refresh token viaja solo en la cookie HttpOnly (credentials: 'include'). */
  refresh: () => requestParsed(AuthResponseSchema, '/auth/refresh', { method: 'POST', retryOnUnauthorized: false }),

  logout: () => request<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
};
