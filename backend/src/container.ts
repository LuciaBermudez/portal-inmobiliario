import { resolve } from 'node:path';
import {
  CreateZone,
  DeleteZone,
  ListNotifications,
  ListZones,
  MarkNotificationsRead,
  MatchNewListings,
  SendDailyDigests,
} from './application/alerts/alert-use-cases';
import { GetCurrentUser, LoginUser, Logout, RefreshSession, RegisterUser } from './application/auth/auth-use-cases';
import { CreateImport, GetImport, ListImportErrors, ListImports } from './application/imports/import-use-cases';
import { ProcessImport } from './application/imports/process-import';
import { GetListing, GetListingTile, SearchListings, UpdateListing } from './application/listings/listing-use-cases';
import type { Env } from './config/env';
import type { ObjectStorage } from './domain/shared/ports';
import { CsvTabularReader } from './infrastructure/csv/csv-tabular-reader';
import { createPool } from './infrastructure/db/pool';
import { ConsoleLogger } from './infrastructure/logging/console-logger';
import { LogMailer } from './infrastructure/mail/log-mailer';
import { createBoss, PgBossAlertQueue, PgBossImportQueue } from './infrastructure/queue/pg-boss-queues';
import { PgNotifyEventPublisher } from './infrastructure/realtime/pg-event-bus';
import { PgImportJobRepository } from './infrastructure/repositories/pg-import-job-repository';
import { PgListingRepository, PgListingTileSource } from './infrastructure/repositories/pg-listing-repository';
import { PgNotificationRepository } from './infrastructure/repositories/pg-notification-repository';
import { PgRefreshTokenStore } from './infrastructure/repositories/pg-refresh-token-store';
import { PgUserRepository } from './infrastructure/repositories/pg-user-repository';
import { PgZoneRepository } from './infrastructure/repositories/pg-zone-repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { JoseAccessTokenService } from './infrastructure/security/jose-access-token-service';
import { LocalDiskStorage } from './infrastructure/storage/local-disk-storage';
import { S3Storage } from './infrastructure/storage/s3-storage';

/**
 * Raíz de composición: el ÚNICO lugar donde se conocen las implementaciones concretas.
 * Los casos de uso reciben puertos por constructor (inyección de dependencias explícita, sin magia).
 */
export function createContainer(env: Env, scope = 'api') {
  const logger = new ConsoleLogger(scope);
  const pool = createPool(env.DATABASE_URL);
  // Colas (pg-boss) y eventos en tiempo real (LISTEN/NOTIFY) también viven en PostgreSQL.
  const boss = createBoss(env.DATABASE_URL);

  // Adaptadores
  const users = new PgUserRepository(pool);
  const listings = new PgListingRepository(pool);
  const importJobs = new PgImportJobRepository(pool);
  const zones = new PgZoneRepository(pool);
  const notifications = new PgNotificationRepository(pool);
  const hasher = new Argon2PasswordHasher();
  const tokens = new JoseAccessTokenService(env.JWT_ACCESS_SECRET, env.ACCESS_TOKEN_TTL);
  const refreshTokens = new PgRefreshTokenStore(pool, env.REFRESH_TOKEN_TTL_DAYS);
  const storage: ObjectStorage =
    env.STORAGE_DRIVER === 's3'
      ? new S3Storage({ bucket: env.S3_BUCKET ?? '', region: env.S3_REGION, endpoint: env.S3_ENDPOINT })
      : new LocalDiskStorage(resolve(env.UPLOADS_DIR));
  const events = new PgNotifyEventPublisher(pool);
  const importQueue = new PgBossImportQueue(boss);
  const alertQueue = new PgBossAlertQueue(boss);
  const session = { tokens, refreshTokens };

  const useCases = {
    register: new RegisterUser(users, hasher, session),
    login: new LoginUser(users, hasher, session),
    refresh: new RefreshSession(users, session),
    logout: new Logout(refreshTokens),
    currentUser: new GetCurrentUser(users),

    searchListings: new SearchListings(listings),
    getListing: new GetListing(listings),
    updateListing: new UpdateListing(listings),
    getTile: new GetListingTile(new PgListingTileSource(pool)),

    createImport: new CreateImport(importJobs, storage, importQueue),
    listImports: new ListImports(importJobs),
    getImport: new GetImport(importJobs),
    listImportErrors: new ListImportErrors(importJobs),
    processImport: new ProcessImport({
      jobs: importJobs,
      storage,
      reader: new CsvTabularReader(),
      events,
      alerts: alertQueue,
      logger,
      batchSize: env.IMPORT_BATCH_SIZE,
    }),

    createZone: new CreateZone(zones),
    listZones: new ListZones(zones),
    deleteZone: new DeleteZone(zones),
    matchNewListings: new MatchNewListings(zones, notifications, events),
    sendDailyDigests: new SendDailyDigests(notifications, new LogMailer(logger), logger),
    listNotifications: new ListNotifications(notifications),
    markNotificationsRead: new MarkNotificationsRead(notifications),
  };

  return {
    env,
    logger,
    pool,
    boss,
    tokens,
    useCases,
    /** Cierra el pool. pg-boss lo detiene cada proceso (API/worker) antes, con `boss.stop({ graceful: true })`. */
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
