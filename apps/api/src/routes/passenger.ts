import { Router } from "express";
import { CreateRatingRequest, CreateReportRequest } from "@taxiflow/shared";
import { getAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { createRating, createReport, listMyTrips } from "../services/passenger.js";

export const passengerRouter = Router();

passengerRouter.use("/trips", requireAuth, requireRole("PASSENGER"));
passengerRouter.use("/ratings", requireAuth, requireRole("PASSENGER"));
passengerRouter.use("/reports", requireAuth, requireRole("PASSENGER"));

passengerRouter.get("/trips/mine", async (req, res) => {
  res.json(await listMyTrips(getAuth(req).userId));
});

passengerRouter.post("/ratings", async (req, res) => {
  res.status(201).json(await createRating(getAuth(req).userId, CreateRatingRequest.parse(req.body)));
});

passengerRouter.post("/reports", async (req, res) => {
  res.status(201).json(await createReport(getAuth(req).userId, CreateReportRequest.parse(req.body)));
});
