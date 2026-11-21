import { Router } from "express";
import type { Role } from "@taxiflow/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Role guards for whole path prefixes, checked before any endpoint runs, so a wrong-role
 * token gets 403 even for endpoints not built yet. Board and no-show are shared with station reps.
 */
export const roleGuards = Router();

const SHARED_WITH_REPS = /^\/entries\/[^/]+\/(board|no-show)\/?$/;
const DRIVER_ONLY: Role[] = ["DRIVER"];
const DRIVER_OR_REP: Role[] = ["DRIVER", "STATION_REP"];

roleGuards.use("/driver", requireAuth, (req, res, next) => {
  requireRole(...(SHARED_WITH_REPS.test(req.path) ? DRIVER_OR_REP : DRIVER_ONLY))(req, res, next);
});
roleGuards.use("/station", requireAuth, requireRole("STATION_REP"));
roleGuards.use("/admin", requireAuth, requireRole("ADMIN"));
