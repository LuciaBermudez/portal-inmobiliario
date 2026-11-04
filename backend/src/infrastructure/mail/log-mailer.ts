import type { Logger, Mailer } from '../../domain/shared/ports';

/**
 * Adaptador de correo para desarrollo: registra el email en el log.
 * En producción se reemplaza por uno SMTP/Resend/SES implementando el mismo puerto `Mailer`.
 */
export class LogMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.logger.info('email (simulado)', { to: message.to, subject: message.subject, text: message.text });
  }
}
