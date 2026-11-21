import { Router } from "express";
import { MarkNotificationsReadRequest } from "@taxiflow/shared";
import { getAuth, requireAuth } from "../middleware/auth.js";
import { listNotifications, markNotificationsRead } from "../services/notifications.js";

export const notificationsRouter = Router();

notificationsRouter.use("/notifications", requireAuth);

notificationsRouter.get("/notifications", async (req, res) => {
  res.json(await listNotifications(getAuth(req).userId));
});

notificationsRouter.post("/notifications/read", async (req, res) => {
  const body = MarkNotificationsReadRequest.parse(req.body ?? {});
  res.json(await markNotificationsRead(getAuth(req).userId, body));
});
