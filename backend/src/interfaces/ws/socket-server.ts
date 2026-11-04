import type { Server as HttpServer } from 'node:http';
import type { ServerToClientEvents } from '@portal/shared';
import { Server } from 'socket.io';
import type { AccessTokenService } from '../../domain/auth/ports';
import { userRoom, type EventEnvelope } from '../../infrastructure/realtime/pg-event-bus';

interface SocketData {
  userId: string;
}

/**
 * WebSockets autenticados con el access token (handshake.auth.token).
 * Cada usuario entra a su sala `user:<id>`; `deliver` reenvía los eventos que llegan por LISTEN/NOTIFY.
 */
export function attachRealtime(httpServer: HttpServer, deps: { tokens: AccessTokenService; corsOrigin: string }) {
  const io = new Server<Record<string, never>, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: deps.corsOrigin.split(',').map((o) => o.trim()), credentials: true },
  });

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth['token'];
    if (typeof token !== 'string') return next(new Error('unauthorized'));
    try {
      const claims = await deps.tokens.verify(token);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(userRoom(socket.data.userId));
  });

  function deliver({ room, event }: EventEnvelope): void {
    switch (event.name) {
      case 'import:progress':
        io.to(room).emit(event.name, event.payload);
        break;
      case 'notification:new':
        io.to(room).emit(event.name, event.payload);
        break;
    }
  }

  return { io, deliver };
}
