import {
  CreateZoneRequestSchema,
  DomainError,
  ForbiddenError,
  IdParamsSchema,
  IdempotencyKeySchema,
  LoginRequestSchema,
  MarkNotificationsReadSchema,
  PgEventListener,
  RegisterRequestSchema,
  SearchListingsQuerySchema,
  UnauthorizedError,
  UpdateListingRequestSchema,
  ValidationError,
  createContainer,
  startBoss,
  userRoom
} from "./chunk-ZRGAE6EC.js";
import "./chunk-RLUFD6GR.js";
import {
  loadEnv
} from "./chunk-VVXHO5AN.js";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

var STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409
};
var body = (code, message, details) => ({
  error: details === void 0 ? { code, message } : { code, message, details }
});
function errorHandler(error, request, reply) {
  const cause = error;
  if (cause instanceof DomainError) {
    return reply.status(STATUS_BY_CODE[cause.code] ?? 400).send(body(cause.code, cause.message, cause.details));
  }
  const status = typeof error.statusCode === "number" ? error.statusCode : 500;
  if (status >= 500) {
    request.log.error({ err: error }, "error no controlado");
    return reply.status(500).send(body("INTERNAL", "Error interno del servidor"));
  }
  return reply.status(status).send(body(error.code ?? "HTTP_ERROR", error.message));
}

function authenticate(tokens) {
  return async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedError("Falta el token de acceso");
    const claims = await tokens.verify(header.slice("Bearer ".length));
    request.actor = { id: claims.sub, role: claims.role, agencyId: claims.agencyId };
  };
}
function requireRoles(...roles) {
  return async (request) => {
    const actor = requireActor(request);
    if (!roles.includes(actor.role)) throw new ForbiddenError("Tu rol no tiene acceso a este recurso");
  };
}
function requireActor(request) {
  if (!request.actor) throw new UnauthorizedError("No autenticado");
  return request.actor;
}

function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "Datos inv\xE1lidos",
      result.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }))
    );
  }
  return result.data;
}

function zoneRoutes(c) {
  const { useCases } = c;
  return async (app2) => {
    app2.addHook("preHandler", authenticate(c.tokens));
    app2.get("/", async (request) => useCases.listZones.execute(requireActor(request)));
    app2.post("/", async (request, reply) => {
      const zone = await useCases.createZone.execute(
        requireActor(request),
        parseOrThrow(CreateZoneRequestSchema, request.body)
      );
      return reply.status(201).send(zone);
    });
    app2.delete("/:id", async (request, reply) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      await useCases.deleteZone.execute(requireActor(request), id);
      return reply.status(204).send();
    });
  };
}
function notificationRoutes(c) {
  const { useCases } = c;
  return async (app2) => {
    app2.addHook("preHandler", authenticate(c.tokens));
    app2.get("/", async (request) => useCases.listNotifications.execute(requireActor(request)));
    app2.post("/read", async (request, reply) => {
      const { ids } = parseOrThrow(MarkNotificationsReadSchema, request.body);
      await useCases.markNotificationsRead.execute(requireActor(request), ids);
      return reply.status(204).send();
    });
  };
}

var REFRESH_COOKIE = "rt";
var COOKIE_PATH = "/api/auth";
function authRoutes(c) {
  const { env: env2, useCases } = c;
  const sendSession = (reply, session) => {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: env2.COOKIE_SECURE,
      sameSite: env2.COOKIE_SAMESITE,
      path: COOKIE_PATH,
      maxAge: env2.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
    });
    return { accessToken: session.accessToken, user: session.user };
  };
  const clearCookie = (reply) => reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  return async (app2) => {
    const strictLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };
    app2.post("/register", { config: strictLimit }, async (request, reply) => {
      const session = await useCases.register.execute(parseOrThrow(RegisterRequestSchema, request.body));
      return reply.status(201).send(sendSession(reply, session));
    });
    app2.post("/login", { config: strictLimit }, async (request, reply) => {
      const session = await useCases.login.execute(parseOrThrow(LoginRequestSchema, request.body));
      return sendSession(reply, session);
    });
    app2.post("/refresh", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) throw new UnauthorizedError("Sin sesi\xF3n");
      try {
        return sendSession(reply, await useCases.refresh.execute(token));
      } catch (error) {
        clearCookie(reply);
        throw error;
      }
    });
    app2.post("/logout", async (request, reply) => {
      await useCases.logout.execute(request.cookies[REFRESH_COOKIE]);
      clearCookie(reply);
      return reply.status(204).send();
    });
    app2.get(
      "/me",
      { preHandler: authenticate(c.tokens) },
      async (request) => useCases.currentUser.execute(requireActor(request).id)
    );
  };
}

function importRoutes(c) {
  const { useCases } = c;
  return async (app2) => {
    app2.addHook("preHandler", authenticate(c.tokens));
    app2.addHook("preHandler", requireRoles("admin", "agent"));
    app2.post("/", async (request, reply) => {
      const actor = requireActor(request);
      const idempotencyKey = parseOrThrow(IdempotencyKeySchema, request.headers["idempotency-key"]);
      const file = await request.file();
      if (!file) throw new ValidationError('Adjunta un archivo CSV en el campo "file"');
      if (!/\.csv$/i.test(file.filename)) {
        file.file.resume();
        throw new ValidationError("Solo se aceptan archivos .csv");
      }
      const result = await useCases.createImport.execute({
        actor,
        idempotencyKey,
        originalName: file.filename,
        file: file.file
      });
      return reply.status(result.created ? 202 : 200).send(result.job);
    });
    app2.get("/", async (request) => useCases.listImports.execute(requireActor(request)));
    app2.get("/:id", async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.getImport.execute(requireActor(request), id);
    });
    app2.get("/:id/errors", async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.listImportErrors.execute(requireActor(request), id);
    });
  };
}

// src/interfaces/http/routes/listings.routes.ts
import { z } from "zod";
var TileParamsSchema = z.object({
  z: z.coerce.number().int().min(0).max(22),
  x: z.coerce.number().int().min(0),
  y: z.string().regex(/^\d+(\.mvt)?$/, "Tesela inv\xE1lida").transform((value) => Number.parseInt(value, 10))
});
function listingRoutes(c) {
  const { useCases } = c;
  return async (app2) => {
    app2.post(
      "/search",
      async (request) => useCases.searchListings.execute(parseOrThrow(SearchListingsQuerySchema, request.body))
    );
    app2.get("/:id", async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.getListing.execute(id);
    });
    app2.patch("/:id", { preHandler: [authenticate(c.tokens), requireRoles("admin", "agent")] }, async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      const body2 = parseOrThrow(UpdateListingRequestSchema, request.body);
      return useCases.updateListing.execute(requireActor(request), id, body2);
    });
  };
}
function tileRoutes(c) {
  return async (app2) => {
    app2.get(
      "/:z/:x/:y",
      { config: { rateLimit: { max: 3e3, timeWindow: "1 minute" } } },
      async (request, reply) => {
        const { z: zoom, x, y } = parseOrThrow(TileParamsSchema, request.params);
        const tile = await c.useCases.getTile.execute(zoom, x, y);
        return reply.header("content-type", "application/vnd.mapbox-vector-tile").header("cache-control", "public, max-age=30").send(tile);
      }
    );
  };
}

// src/interfaces/http/server.ts
async function buildServer(c) {
  const { env: env2 } = c;
  const app2 = Fastify({
    logger: env2.NODE_ENV === "test" ? false : { level: env2.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: true,
    bodyLimit: 1024 * 1024
  });
  app2.decorateRequest("actor", null);
  app2.setErrorHandler(errorHandler);
  await app2.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
  await app2.register(cors, {
    origin: env2.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "authorization", "idempotency-key"]
  });
  await app2.register(cookie);
  await app2.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app2.register(multipart, { limits: { fileSize: env2.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
  app2.get("/api/health", async () => {
    await c.pool.query("SELECT 1");
    return { status: "ok" };
  });
  await app2.register(authRoutes(c), { prefix: "/api/auth" });
  await app2.register(listingRoutes(c), { prefix: "/api/listings" });
  await app2.register(tileRoutes(c), { prefix: "/api/tiles" });
  await app2.register(importRoutes(c), { prefix: "/api/imports" });
  await app2.register(zoneRoutes(c), { prefix: "/api/zones" });
  await app2.register(notificationRoutes(c), { prefix: "/api/notifications" });
  return app2;
}

// src/interfaces/ws/socket-server.ts
import { Server } from "socket.io";
function attachRealtime(httpServer, deps) {
  const io = new Server(httpServer, {
    cors: { origin: deps.corsOrigin.split(",").map((o) => o.trim()), credentials: true }
  });
  io.use(async (socket, next) => {
    const token = socket.handshake.auth["token"];
    if (typeof token !== "string") return next(new Error("unauthorized"));
    try {
      const claims = await deps.tokens.verify(token);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    void socket.join(userRoom(socket.data.userId));
  });
  function deliver({ room, event }) {
    switch (event.name) {
      case "import:progress":
        io.to(room).emit(event.name, event.payload);
        break;
      case "notification:new":
        io.to(room).emit(event.name, event.payload);
        break;
    }
  }
  return { io, deliver };
}

// src/main.ts
var env = loadEnv();
var container = createContainer(env, "api");
container.boss.on("error", (error) => container.logger.error("pg-boss", { error: error.message }));
await startBoss(container.boss);
var app = await buildServer(container);
var realtime = attachRealtime(app.server, { tokens: container.tokens, corsOrigin: env.CORS_ORIGIN });
var listener = new PgEventListener(env.DATABASE_URL, realtime.deliver, container.logger);
await listener.start();
await app.listen({ host: "0.0.0.0", port: env.PORT });
var closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "cerrando API");
  realtime.io.disconnectSockets(true);
  await app.close();
  await listener.stop();
  await container.boss.stop({ graceful: true });
  await container.close();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
