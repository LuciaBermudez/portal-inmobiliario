import { z } from 'zod';
import { UuidSchema } from './common';

export const RoleSchema = z.enum(['admin', 'agent', 'client']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido').max(254),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = LoginRequestSchema.extend({
  name: z.string().trim().min(2, 'Nombre demasiado corto').max(100),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const SessionUserSchema = z.object({
  id: UuidSchema,
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  agencyId: UuidSchema.nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** El refresh token NUNCA viaja en el cuerpo: va en una cookie HttpOnly. */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: SessionUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
