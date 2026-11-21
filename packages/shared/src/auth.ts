import { z } from "zod";
import { Phone } from "./common.js";
import { Language } from "./enums.js";
import { PublicUser } from "./models.js";

/** POST /auth/register. Always creates a PASSENGER. */
export const RegisterRequest = z.object({
  name: z.string().trim().min(2).max(80),
  phone: Phone,
  password: z.string().min(6).max(100),
  language: Language.default("en"),
});
export type RegisterRequest = z.input<typeof RegisterRequest>;

/** POST /auth/login */
export const LoginRequest = z.object({
  phone: Phone,
  password: z.string().min(1).max(100),
});
export type LoginRequest = z.input<typeof LoginRequest>;

/** Response of POST /auth/register (201) and POST /auth/login (200). */
export const AuthResponse = z.object({
  token: z.string(),
  user: PublicUser,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

/** GET /me */
export const MeResponse = z.object({
  user: PublicUser,
});
export type MeResponse = z.infer<typeof MeResponse>;
