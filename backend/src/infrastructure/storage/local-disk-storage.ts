import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { NotFoundError, ValidationError } from '../../domain/shared/errors';
import type { ObjectStorage } from '../../domain/shared/ports';

/** Almacenamiento en disco (desarrollo / un solo servidor). */
export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    // Defensa contra path traversal ("../../etc/passwd").
    if (!full.startsWith(this.root + sep)) throw new ValidationError('Clave de archivo inválida');
    return full;
  }

  async put(key: string, body: Readable): Promise<{ bytes: number }> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await pipeline(body, createWriteStream(path));
    return { bytes: (await stat(path)).size };
  }

  async get(key: string): Promise<Readable> {
    const path = this.pathFor(key);
    try {
      await access(path);
    } catch {
      throw new NotFoundError(`Archivo ${key} no encontrado`);
    }
    return createReadStream(path);
  }
}
