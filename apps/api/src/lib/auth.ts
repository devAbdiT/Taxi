import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@taxiflow/shared";
import { z } from "zod";
import { env } from "./env.js";

const TOKEN_TTL = "7d";
const BCRYPT_ROUNDS = 10;

export interface AuthContext {
  userId: string;
  role: Role;
}

const TokenPayload = z.object({
  sub: z.string().min(1),
  role: Role,
});

export function signToken(auth: AuthContext): string {
  return jwt.sign({ role: auth.role }, env.JWT_SECRET, { subject: auth.userId, expiresIn: TOKEN_TTL });
}

/** Returns null for a missing, malformed, expired or forged token. */
export function verifyToken(token: string): AuthContext | null {
  try {
    const payload = TokenPayload.parse(jwt.verify(token, env.JWT_SECRET));
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export const hashPasswordSync = (password: string) => bcrypt.hashSync(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
