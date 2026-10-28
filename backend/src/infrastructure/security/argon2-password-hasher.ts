import argon2 from 'argon2';
import type { PasswordHasher } from '../../domain/auth/ports';

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash con formato inválido: se trata como contraseña incorrecta.
      return false;
    }
  }
}