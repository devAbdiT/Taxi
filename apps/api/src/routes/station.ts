import { Router } from "express";
import { Id } from "@taxiflow/shared";
import { getAuth } from "../middleware/auth.js";
import { getStationQueues, removeQueueEntry } from "../services/station.js";

export const stationRouter = Router();

function param(value: string | string[]): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

stationRouter.get("/station/queues", async (req, res) => {
  res.json(await getStationQueues(getAuth(req).userId));
});

stationRouter.post("/station/entries/:id/remove", async (req, res) => {
  res.json(await removeQueueEntry(getAuth(req).userId, param(req.params.id)));
});
