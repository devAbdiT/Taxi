import { Router } from "express";
import { CallPassengersRequest, DriverArriveRequest, Id, StartTripRequest } from "@taxiflow/shared";
import { getAuth } from "../middleware/auth.js";
import {
  arriveAtStation,
  arriveTrip,
  callPassengers,
  cancelTrip,
  departTrip,
  getDemand,
  getDriverMe,
  getTrip,
  setEntryOutcome,
  startTrip,
} from "../services/driver.js";

export const driverRouter = Router();

function param(value: string | string[]): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

driverRouter.get("/driver/me", async (req, res) => {
  res.json(await getDriverMe(getAuth(req).userId));
});

driverRouter.post("/driver/arrive", async (req, res) => {
  res.json(await arriveAtStation(getAuth(req).userId, DriverArriveRequest.parse(req.body)));
});

driverRouter.get("/driver/demand", async (req, res) => {
  res.json(await getDemand(getAuth(req).userId));
});

driverRouter.post("/driver/trips/start", async (req, res) => {
  res.status(201).json(await startTrip(getAuth(req).userId, StartTripRequest.parse(req.body)));
});

driverRouter.get("/driver/trips/:id", async (req, res) => {
  res.json(await getTrip(getAuth(req).userId, param(req.params.id)));
});

driverRouter.post("/driver/trips/:id/call", async (req, res) => {
  const body = CallPassengersRequest.parse(req.body ?? {});
  res.json(await callPassengers(getAuth(req).userId, param(req.params.id), body));
});

driverRouter.post("/driver/entries/:id/board", async (req, res) => {
  const auth = getAuth(req);
  res.json(await setEntryOutcome(auth, param(req.params.id), "BOARDED"));
});

driverRouter.post("/driver/entries/:id/no-show", async (req, res) => {
  const auth = getAuth(req);
  res.json(await setEntryOutcome(auth, param(req.params.id), "NO_SHOW"));
});

driverRouter.post("/driver/trips/:id/depart", async (req, res) => {
  res.json(await departTrip(getAuth(req).userId, param(req.params.id)));
});

driverRouter.post("/driver/trips/:id/cancel", async (req, res) => {
  res.json(await cancelTrip(getAuth(req).userId, param(req.params.id)));
});

driverRouter.post("/driver/trips/:id/arrive", async (req, res) => {
  res.json(await arriveTrip(getAuth(req).userId, param(req.params.id)));
});
