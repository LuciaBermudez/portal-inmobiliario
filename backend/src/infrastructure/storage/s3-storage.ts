import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable, Transform } from 'node:stream';
import { NotFoundError } from '../../domain/shared/errors';
import type { ObjectStorage } from '../../domain/shared/ports';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
}

/** S3 / MinIO / Cloudflare R2. Necesario en la nube: API y worker corren en máquinas distintas. */
export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
    });
  }

  async put(key: string, body: Readable): Promise<{ bytes: number }> {
    let bytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(null, chunk);
      },
    });
    body.on('error', (error) => counter.destroy(error));
    // Subida multiparte en streaming: el archivo nunca se carga entero en memoria.
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.options.bucket, Key: key, Body: body.pipe(counter), ContentType: 'text/csv' },
    });
    await upload.done();
    return { bytes };
  }

  async get(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
      if (result.Body instanceof Readable) return result.Body;
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') throw new NotFoundError(`Archivo ${key} no encontrado`);
      throw error;
    }
    throw new NotFoundError(`Archivo ${key} sin contenido`);
  }
}
