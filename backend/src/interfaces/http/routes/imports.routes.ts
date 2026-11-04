import { IdempotencyKeySchema, IdParamsSchema } from '@portal/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Container } from '../../../container';
import { ValidationError } from '../../../domain/shared/errors';
import { authenticate, requireActor, requireRoles } from '../auth';
import { parseOrThrow } from '../validation';

export function importRoutes(c: Container): FastifyPluginAsync {
  const { useCases } = c;
  return async (app) => {
    app.addHook('preHandler', authenticate(c.tokens));
    app.addHook('preHandler', requireRoles('admin', 'agent'));

    /** Sube el CSV en streaming (multipart) y responde 202: el procesamiento ocurre en el worker. */
    app.post('/', async (request, reply) => {
      const actor = requireActor(request);
      const idempotencyKey = parseOrThrow(IdempotencyKeySchema, request.headers['idempotency-key']);
      const file = await request.file();
      if (!file) throw new ValidationError('Adjunta un archivo CSV en el campo "file"');
      if (!/\.csv$/i.test(file.filename)) {
        file.file.resume();
        throw new ValidationError('Solo se aceptan archivos .csv');
      }
      const result = await useCases.createImport.execute({
        actor,
        idempotencyKey,
        originalName: file.filename,
        file: file.file,
      });
      return reply.status(result.created ? 202 : 200).send(result.job);
    });

    app.get('/', async (request) => useCases.listImports.execute(requireActor(request)));

    app.get('/:id', async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.getImport.execute(requireActor(request), id);
    });

    app.get('/:id/errors', async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.listImportErrors.execute(requireActor(request), id);
    });
  };
}
