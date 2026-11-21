import cors from "cors";
import express from "express";
import type { HealthResponse } from "@taxiflow/shared";
import { env } from "./lib/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { devRouter } from "./routes/dev.js";
import { driverRouter } from "./routes/driver.js";
import { notificationsRouter } from "./routes/notifications.js";
import { passengerRouter } from "./routes/passenger.js";
import { queueRouter } from "./routes/queue.js";
import { referenceRouter } from "./routes/reference.js";
import { roleGuards } from "./routes/roleGuards.js";
import { stationRouter } from "./routes/station.js";

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
  app.use("/dev", devRouter);
  app.use(referenceRouter);
  app.use(queueRouter);
  app.use(notificationsRouter);
  app.use(passengerRouter);
  app.use(roleGuards);
  app.use(driverRouter);
  app.use(stationRouter);
  app.use(adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
