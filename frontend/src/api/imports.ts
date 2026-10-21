import { ImportJobSchema, ImportRowErrorSchema, type ImportJob } from '@portal/shared';
import { z } from 'zod';
import { API_BASE, ApiError, getAccessToken, refreshAccessToken, requestParsed, toApiError } from './http';

export const importsApi = {
  list: () => requestParsed(z.array(ImportJobSchema), '/imports'),
  get: (id: string) => requestParsed(ImportJobSchema, `/imports/${id}`),
  errors: (id: string) => requestParsed(z.array(ImportRowErrorSchema), `/imports/${id}/errors`),
};

interface XhrResult {
  status: number;
  body: unknown;
}

/**
 * Sube el CSV con XMLHttpRequest (fetch no expone progreso de subida).
 * La misma Idempotency-Key en cada reintento garantiza que el servidor cree un solo job.
 */
export async function uploadImport(
  file: File,
  idempotencyKey: string,
  onProgress: (ratio: number) => void,
): Promise<ImportJob> {
  const send = (token: string | null) =>
    new Promise<XhrResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/imports`);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
      xhr.setRequestHeader('idempotency-key', idempotencyKey);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // respuesta sin JSON
        }
        resolve({ status: xhr.status, body });
      };
      xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Error de red al subir el archivo'));
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });

  let result = await send(getAccessToken());
  if (result.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) result = await send(fresh);
  }
  if (result.status >= 400) throw toApiError(result.status, result.body);
  return ImportJobSchema.parse(result.body);
}
