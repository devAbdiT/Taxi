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
// The control desk endpoints are also open to administrators, who act on any station.
const STATION_OR_ADMIN = /^\/(desk|alerts|actions|audit-log|disputes(\/[^/]+)?)\/?$/;
const ADMIN_OR_REP = /^\/(ai\/insights|fleet)\/?$/;

roleGuards.use("/station", requireAuth, (req, res, next) => {
  requireRole(...(STATION_OR_ADMIN.test(req.path) ? (["STATION_REP", "ADMIN"] as Role[]) : (["STATION_REP"] as Role[])))(req, res, next);
});
roleGuards.use("/admin", requireAuth, (req, res, next) => {
  requireRole(...(ADMIN_OR_REP.test(req.path) ? (["ADMIN", "STATION_REP"] as Role[]) : (["ADMIN"] as Role[])))(req, res, next);
});
