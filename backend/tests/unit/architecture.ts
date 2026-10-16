import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Test de arquitectura: verifica la regla de dependencias de Clean Architecture sobre el código real. */
const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const FRAMEWORKS = /^(pg|pg-boss|fastify|@fastify\/|@aws-sdk\/|socket\.io|csv-parse|jose|@node-rs\/)/;

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  );
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

function violations(layer: string, forbiddenLayers: string[]): string[] {
  return filesIn(join(SRC, layer)).flatMap((file) =>
    importsOf(file)
      .filter((spec) => FRAMEWORKS.test(spec) || forbiddenLayers.some((l) => spec.includes(`/${l}/`)))
      .map((spec) => `${relative(SRC, file)} → ${spec}`),
  );
}

describe('regla de dependencias', () => {
  it('domain no depende de application, infrastructure, interfaces ni frameworks', () => {
    expect(violations('domain', ['application', 'infrastructure', 'interfaces'])).toEqual([]);
  });

  it('application solo depende de domain (puertos)', () => {
    expect(violations('application', ['infrastructure', 'interfaces'])).toEqual([]);
  });
});
