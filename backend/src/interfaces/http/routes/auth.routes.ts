import { LoginRequestSchema, RegisterRequestSchema, type AuthResponse } from '@portal/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Session } from '../../../application/auth/auth-use-cases';
import type { Container } from '../../../container';
import { UnauthorizedError } from '../../../domain/shared/errors';
import { authenticate, requireActor } from '../auth';
import { parseOrThrow } from '../validation';

export const REFRESH_COOKIE = 'rt';
const COOKIE_PATH = '/api/auth';

export function authRoutes(c: Container): FastifyPluginAsync {
  const { env, useCases } = c;

  /** Refresh token en cookie HttpOnly: inaccesible para JavaScript (mitiga robo por XSS). */
  const sendSession = (reply: FastifyReply, session: Session): AuthResponse => {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      path: COOKIE_PATH,
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
    return { accessToken: session.accessToken, user: session.user };
  };

  const clearCookie = (reply: FastifyReply) => reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });

  return async (app) => {
    const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

    app.post('/register', { config: strictLimit }, async (request, reply) => {
      const session = await useCases.register.execute(parseOrThrow(RegisterRequestSchema, request.body));
      return reply.status(201).send(sendSession(reply, session));
    });

    app.post('/login', { config: strictLimit }, async (request, reply) => {
      const session = await useCases.login.execute(parseOrThrow(LoginRequestSchema, request.body));
      return sendSession(reply, session);
    });

    app.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) throw new UnauthorizedError('Sin sesión');
      try {
        return sendSession(reply, await useCases.refresh.execute(token));
      } catch (error) {
        clearCookie(reply);
        throw error;
      }
    });

    app.post('/logout', async (request, reply) => {
      await useCases.logout.execute(request.cookies[REFRESH_COOKIE]);
      clearCookie(reply);
      return reply.status(204).send();
    });

    app.get('/me', { preHandler: authenticate(c.tokens) }, async (request) =>
      useCases.currentUser.execute(requireActor(request).id),
    );
  };
}
