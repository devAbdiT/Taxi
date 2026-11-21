import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { type ErrorResponse, normalizePhone } from "@taxiflow/shared";

const rateLimitedBody: ErrorResponse = {
  error: "rate_limited",
  message: "Too many attempts. Please wait a minute and try again.",
};

/**
 * 10 login attempts per phone number per IP per minute. Keyed by phone as well as IP
 * because a whole demo room often shares one IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitedBody,
  keyGenerator: (req) => {
    const phone = typeof req.body?.phone === "string" ? normalizePhone(req.body.phone) : null;
    return `${ipKeyGenerator(req.ip ?? "127.0.0.1")}:${phone ?? "invalid"}`;
  },
});

/** 10 queue joins per passenger per minute. Use after requireAuth. */
export const queueJoinLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitedBody,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1"),
});

/** 10 registrations per IP per minute. */
export const registerLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitedBody,
});
