import type { Logger } from '../../domain/shared/ports';

/** Logs estructurados en JSON (una línea por evento), legibles por cualquier agregador. */
export class ConsoleLogger implements Logger {
  constructor(private readonly scope: string) {}

  private write(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    const line = JSON.stringify({ time: new Date().toISOString(), level, scope: this.scope, message, ...meta });
    if (level === 'error') console.error(line);
    else console.log(line);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }
}
