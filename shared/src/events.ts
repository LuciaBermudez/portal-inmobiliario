import type { ImportJob } from './schemas/import';
import type { Notification } from './schemas/zone';

/** Eventos que el servidor emite por WebSocket (Socket.IO), tipados de punta a punta. */
export interface ServerToClientEvents {
  'import:progress': (job: ImportJob) => void;
  'notification:new': (notification: Notification) => void;
}
