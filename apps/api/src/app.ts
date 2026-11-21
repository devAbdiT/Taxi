import cors from "cors";
import express from "express";
import type { HealthResponse } from "@taxiflow/shared";
import { env } from "./lib/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { referenceRouter } from "./routes/reference.js";
import { roleGuards } from "./routes/roleGuards.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, uptimeSeconds: Math.round(process.uptime()) };
    res.json(body);
  });

  app.use(authRouter);
  app.use(referenceRouter);
  app.use(roleGuards);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
