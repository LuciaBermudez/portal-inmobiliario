import { CreateZoneRequestSchema, IdParamsSchema, MarkNotificationsReadSchema } from '@portal/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Container } from '../../../container';
import { authenticate, requireActor } from '../auth';
import { parseOrThrow } from '../validation';

export function zoneRoutes(c: Container): FastifyPluginAsync {
  const { useCases } = c;
  return async (app) => {
    app.addHook('preHandler', authenticate(c.tokens));

    app.get('/', async (request) => useCases.listZones.execute(requireActor(request)));

    app.post('/', async (request, reply) => {
      const zone = await useCases.createZone.execute(
        requireActor(request),
        parseOrThrow(CreateZoneRequestSchema, request.body),
      );
      return reply.status(201).send(zone);
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      await useCases.deleteZone.execute(requireActor(request), id);
      return reply.status(204).send();
    });
  };
}

export function notificationRoutes(c: Container): FastifyPluginAsync {
  const { useCases } = c;
  return async (app) => {
    app.addHook('preHandler', authenticate(c.tokens));

    app.get('/', async (request) => useCases.listNotifications.execute(requireActor(request)));

    app.post('/read', async (request, reply) => {
      const { ids } = parseOrThrow(MarkNotificationsReadSchema, request.body);
      await useCases.markNotificationsRead.execute(requireActor(request), ids);
      return reply.status(204).send();
    });
  };
}
