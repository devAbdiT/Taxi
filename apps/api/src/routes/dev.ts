import { Router } from "express";
import { env } from "../lib/env.js";
import { notFound } from "../lib/errors.js";
import { listSms, resetDemo } from "../services/dev.js";

export const devRouter = Router();

devRouter.use((req, _res, next) => {
  if (!env.DEMO_MODE) {
    next(notFound("not_found", `No endpoint for ${req.method} ${req.baseUrl}${req.path}`));
    return;
  }
  next();
});

devRouter.post("/reset", async (_req, res) => {
  res.json(await resetDemo());
});

devRouter.get("/sms", async (_req, res) => {
  res.json(await listSms());
});
