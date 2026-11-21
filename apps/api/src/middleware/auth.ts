import type { Request, RequestHandler } from "express";
import type { Role } from "@taxiflow/shared";
import { type AuthContext, verifyToken } from "../lib/auth.js";
import { forbidden, unauthorized } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  const auth = token ? verifyToken(token) : null;
  if (!auth) {
    throw unauthorized();
  }
  req.auth = auth;
  next();
};

/** Use after requireAuth. Rejects any role not listed with 403 forbidden. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const auth = getAuth(req);
    if (!roles.includes(auth.role)) {
      throw forbidden();
    }
    next();
  };
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw unauthorized();
  }
  return req.auth;
}
