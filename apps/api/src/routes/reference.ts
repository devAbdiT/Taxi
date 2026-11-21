import { Router } from "express";
import type { RoutesResponse, StationsResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { toStation } from "../lib/serialize.js";
import { requireAuth } from "../middleware/auth.js";
import { listRoutesWithDemand } from "../services/demand.js";
import { publicPulse } from "../services/pulse.js";

export const referenceRouter = Router();

referenceRouter.get("/public/pulse", async (_req, res) => {
  res.json(await publicPulse());
});

referenceRouter.get("/stations", requireAuth, async (_req, res) => {
  const stations = await prisma.station.findMany({ orderBy: { name: "asc" } });
  const response: StationsResponse = { stations: stations.map(toStation) };
  res.json(response);
});

referenceRouter.get("/routes", requireAuth, async (_req, res) => {
  const response: RoutesResponse = { routes: await listRoutesWithDemand() };
  res.json(response);
});
