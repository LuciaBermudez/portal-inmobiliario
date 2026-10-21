import type { ServerToClientEvents } from '@portal/shared';
import type { Pinia } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import { watch } from 'vue';
import { useNotificationsStore } from '@/stores/alerts';
import { useAuthStore } from '@/stores/auth';
import { useImportsStore } from '@/stores/imports';
import { useToastStore } from '@/stores/toasts';

const WS_URL = import.meta.env.VITE_WS_URL ?? '';
const MAX_AUTH_RETRIES = 2;

/**
 * Conexión WebSocket ligada a la sesión: se abre al iniciar sesión y se cierra al salir.
 * El token se lee en cada (re)conexión, así sobrevive a la rotación del access token.
 */
export function startRealtime(pinia: Pinia): void {
  const auth = useAuthStore(pinia);
  const imports = useImportsStore(pinia);
  const notifications = useNotificationsStore(pinia);
  const toasts = useToastStore(pinia);
  let socket: Socket<ServerToClientEvents> | null = null;

  watch(
    () => auth.user?.id ?? null,
    (userId) => {
      socket?.disconnect();
      socket = null;
      if (!userId) {
        notifications.reset();
        return;
      }

      const options = {
        transports: ['websocket'],
        auth: (cb: (data: object) => void) => cb({ token: auth.accessToken }),
      };
      const s: Socket<ServerToClientEvents> = WS_URL ? io(WS_URL, options) : io(options);
      socket = s;
      let authRetries = 0;

      s.on('connect', () => {
        authRetries = 0;
      });
      s.on('import:progress', (job) => {
        imports.applyProgress(job);
        if (job.status === 'completed') toasts.push('success', `Importación "${job.originalName}" completada`);
        if (job.status === 'failed') toasts.push('error', `Importación "${job.originalName}" falló`);
      });
      s.on('notification:new', (notification) => {
        notifications.push(notification);
        toasts.push('info', `Nueva propiedad en "${notification.zoneName}": ${notification.listing.title}`);
      });
      // Un rechazo del middleware (token expirado) no se reintenta solo: refrescamos y reconectamos.
      s.on('connect_error', async () => {
        if (s.active || authRetries >= MAX_AUTH_RETRIES) return;
        authRetries++;
        if (await auth.refresh()) s.connect();
      });

      void notifications.fetchAll();
    },
    { immediate: true },
  );
}
