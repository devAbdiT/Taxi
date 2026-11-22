import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { computeWaitEstimate } from "../ai/wait.js";
import { computeDemandForecast } from "../ai/forecast.js";
import { computeInsights } from "../ai/insights.js";

export const aiRouter = Router();

// GET /ai/wait-estimate?routeId=
aiRouter.get("/ai/wait-estimate", requireAuth, async (req, res) => {
  try {
    const routeId = String(req.query.routeId ?? "");
    if (!routeId) {
      return res.status(400).json({ error: "missing_routeId", message: "routeId query param required" });
    }
    const result = await computeWaitEstimate(routeId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal", message: "Failed to compute wait estimate" });
  }
});

// GET /ai/demand-forecast?stationId=
aiRouter.get("/ai/demand-forecast", requireAuth, async (req, res) => {
  try {
    const stationId = String(req.query.stationId ?? "");
    if (!stationId) {
      return res.status(400).json({ error: "missing_stationId", message: "stationId query param required" });
    }
    const result = await computeDemandForecast(stationId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal", message: "Failed to compute demand forecast" });
  }
});

// GET /admin/ai/insights?days=&stationId=
aiRouter.get(
  "/admin/ai/insights",
  requireAuth,
  requireRole("ADMIN", "STATION_REP"),
  async (req, res) => {
    try {
      const days = Number(req.query.days ?? 7);
      const stationId = req.query.stationId ? String(req.query.stationId) : undefined;
      const auth = (req as any).auth; // auth set by middleware
      const result = await computeInsights(auth, { days, stationId });
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal", message: "Failed to compute insights" });
    }
  }
);
