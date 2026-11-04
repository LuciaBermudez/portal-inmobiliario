import type { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import type { TabularReader } from '../../domain/import/import-job';

/** CSV en streaming (memoria constante sin importar el tamaño del archivo). */
export class CsvTabularReader implements TabularReader {
  async *read(source: Readable): AsyncIterable<Record<string, string>> {
    const parser = parse({
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    source.on('error', (error) => parser.destroy(error));
    source.pipe(parser);
    for await (const record of parser) {
      yield record as Record<string, string>;
    }
  }
}
