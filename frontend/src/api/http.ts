import type { ApiErrorBody } from '@portal/shared';
import type { z } from 'zod';

export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * El cliente HTTP no importa stores (evita dependencias circulares):
 * el store de auth se registra aquí al arrancar la app.
 */
interface AuthBridge {
  getToken(): string | null;
  refresh(): Promise<string | null>;
}

let auth: AuthBridge | null = null;

export function configureAuth(bridge: AuthBridge): void {
  auth = bridge;
}

export const getAccessToken = (): string | null => auth?.getToken() ?? null;
export const refreshAccessToken = (): Promise<string | null> => auth?.refresh() ?? Promise.resolve(null);

export function toApiError(status: number, body: unknown): ApiError {
  const error = (body as Partial<ApiErrorBody> | null)?.error;
  // 502/503/504 de un proxy no traen nuestro cuerpo de error: mensaje entendible para el usuario.
  const fallback = status >= 500 ? 'El servidor no está disponible. Intenta de nuevo en unos segundos.' : `Error ${status}`;
  return new ApiError(status, error?.code ?? 'HTTP_ERROR', error?.message ?? fallback, error?.details);
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  /** false en /auth/*: un 401 ahí no debe disparar otro refresh. */
  retryOnUnauthorized?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, retryOnUnauthorized = true, ...init } = options;
  const headers = new Headers(init.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Sin conexión con el servidor');
  }

  // Access token expirado: un refresh silencioso (single-flight en el store) y un único reintento.
  if (response.status === 401 && retryOnUnauthorized && auth) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(path, { ...options, retryOnUnauthorized: false });
  }

  if (!response.ok) throw toApiError(response.status, await response.json().catch(() => null));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Igual que `request`, pero valida la respuesta en runtime con el contrato compartido. */
export async function requestParsed<S extends z.ZodType>(
  schema: S,
  path: string,
  options?: RequestOptions,
): Promise<z.output<S>> {
  return schema.parse(await request<unknown>(path, options));
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Ocurrió un error inesperado';
}
