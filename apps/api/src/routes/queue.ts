import { Router } from "express";
import { JoinQueueRequest } from "@taxiflow/shared";
import { getAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { queueJoinLimiter } from "../middleware/rateLimit.js";
import { getMyQueue, joinQueue, leaveQueue } from "../services/queue.js";

export const queueRouter = Router();

queueRouter.use("/queue", requireAuth, requireRole("PASSENGER"));

queueRouter.post("/queue/join", queueJoinLimiter, async (req, res) => {
  const body = JoinQueueRequest.parse(req.body);
  res.status(201).json(await joinQueue(getAuth(req).userId, body));
});

queueRouter.get("/queue/me", async (req, res) => {
  res.json(await getMyQueue(getAuth(req).userId));
});

queueRouter.post("/queue/leave", async (req, res) => {
  res.json(await leaveQueue(getAuth(req).userId));
});
