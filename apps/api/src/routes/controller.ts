import { Router } from "express";
import {
  AdminAppealsQuery,
  AuditLogQuery,
  CreateAppealRequest,
  CreateDisputeRequest,
  DecideAppealRequest,
  Id,
  JoinDriverQueueRequest,
  StationActionRequest,
  StationDisputesQuery,
  UpdateDisputeRequest,
} from "@taxiflow/shared";
import { z } from "zod";
import { getAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { disputeLimiter } from "../middleware/rateLimit.js";
import { decideAppeal, createAppeal, listAdminAppeals, listMyAppeals } from "../services/appeals.js";
import { getStationAlerts, getStationDesk } from "../services/alerts.js";
import { getMySuspension, listAuditLog, listMyActions, performControllerAction } from "../services/controllerActions.js";
import { createDispute, listMyDisputes, listStationDisputes, updateDispute } from "../services/disputes.js";
import { getDriverQueue, joinDriverQueue, leaveDriverQueue } from "../services/driverQueue.js";

function param(value: string | string[]): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

const StationQuery = z.object({ stationId: Id.optional() });

// Passenger and driver side. These routes carry their own auth because /disputes and /appeals are not role-guarded prefixes.
export const controllerPublicRouter = Router();

controllerPublicRouter.post("/disputes", requireAuth, requireRole("PASSENGER", "DRIVER"), disputeLimiter, async (req, res) => {
  const body = CreateDisputeRequest.parse(req.body);
  res.status(201).json(await createDispute(getAuth(req), body));
});

controllerPublicRouter.get("/disputes/mine", requireAuth, async (req, res) => {
  res.json(await listMyDisputes(getAuth(req).userId));
});

controllerPublicRouter.get("/actions/mine", requireAuth, async (req, res) => {
  res.json(await listMyActions(getAuth(req).userId));
});

controllerPublicRouter.get("/suspensions/me", requireAuth, async (req, res) => {
  res.json(await getMySuspension(getAuth(req).userId));
});

controllerPublicRouter.post("/appeals", requireAuth, requireRole("PASSENGER", "DRIVER"), async (req, res) => {
  const body = CreateAppealRequest.parse(req.body);
  res.status(201).json(await createAppeal(getAuth(req), body));
});

controllerPublicRouter.get("/appeals/mine", requireAuth, async (req, res) => {
  res.json(await listMyAppeals(getAuth(req).userId));
});

// Behind the role guards: /driver is DRIVER only.
export const driverLineRouter = Router();

driverLineRouter.get("/driver/queue", async (req, res) => {
  res.json(await getDriverQueue(getAuth(req).userId));
});

driverLineRouter.post("/driver/queue/join", async (req, res) => {
  const body = JoinDriverQueueRequest.parse(req.body ?? {});
  res.status(201).json(await joinDriverQueue(getAuth(req).userId, body));
});

driverLineRouter.post("/driver/queue/leave", async (req, res) => {
  res.json(await leaveDriverQueue(getAuth(req).userId));
});

// Behind the role guards: /station is the queue controller (station rep); an administrator may use these too.
export const controllerStationRouter = Router();

controllerStationRouter.get("/station/desk", async (req, res) => {
  res.json(await getStationDesk(getAuth(req), StationQuery.parse(req.query).stationId));
});

controllerStationRouter.get("/station/alerts", async (req, res) => {
  res.json(await getStationAlerts(getAuth(req), StationQuery.parse(req.query).stationId));
});

controllerStationRouter.get("/station/disputes", async (req, res) => {
  const query = StationDisputesQuery.parse(req.query);
  res.json(await listStationDisputes(getAuth(req), query.status, StationQuery.parse(req.query).stationId));
});

controllerStationRouter.patch("/station/disputes/:id", async (req, res) => {
  const body = UpdateDisputeRequest.parse(req.body);
  res.json(await updateDispute(getAuth(req), param(req.params.id), body));
});

controllerStationRouter.post("/station/actions", async (req, res) => {
  const body = StationActionRequest.parse(req.body);
  res.status(201).json(await performControllerAction(getAuth(req), body));
});

controllerStationRouter.get("/station/audit-log", async (req, res) => {
  res.json(await listAuditLog(getAuth(req), AuditLogQuery.parse(req.query)));
});

// Behind the role guards: /admin is ADMIN only.
export const controllerAdminRouter = Router();

controllerAdminRouter.get("/admin/audit-log", async (req, res) => {
  res.json(await listAuditLog(getAuth(req), AuditLogQuery.parse(req.query)));
});

controllerAdminRouter.get("/admin/appeals", async (req, res) => {
  res.json(await listAdminAppeals(AdminAppealsQuery.parse(req.query).status));
});

controllerAdminRouter.patch("/admin/appeals/:id", async (req, res) => {
  const body = DecideAppealRequest.parse(req.body);
  res.json(await decideAppeal(getAuth(req), param(req.params.id), body));
});
