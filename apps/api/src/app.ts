import cors from "cors";
import express from "express";
import type { HealthResponse } from "@taxiflow/shared";
import { env } from "./lib/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, uptimeSeconds: Math.round(process.uptime()) };
    res.json(body);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
