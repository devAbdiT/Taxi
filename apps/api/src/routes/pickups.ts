import { Router } from "express";
import { CancelPickupRequest, CreatePickupRequest, Id } from "@taxiflow/shared";
import { getAuth, requireAuth, requireRole } from "../middleware/auth.js";
import {
  acceptPickup,
  cancelPickupAsDriver,
  cancelPickupAsPassenger,
  createPickup,
  getDriverMyPickup,
  getMyPickup,
  listNearbyPickups,
  markPickupArrived,
  completePickup,
} from "../services/pickups.js";

export const pickupsRouter = Router();
export const driverPickupsRouter = Router();

function param(value: string | string[] | undefined): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

// ---------------------------------------------------------------------------
// Passenger endpoints
// ---------------------------------------------------------------------------

pickupsRouter.post("/pickups", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  res.status(201).json(await createPickup(getAuth(req).userId, CreatePickupRequest.parse(req.body)));
});

pickupsRouter.get("/pickups/mine", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  res.json(await getMyPickup(getAuth(req).userId));
});

pickupsRouter.post("/pickups/:id/cancel", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const body = CancelPickupRequest.parse(req.body ?? {});
  res.json(await cancelPickupAsPassenger(getAuth(req).userId, param(req.params.id), body));
});

// ---------------------------------------------------------------------------
// Driver endpoints
// ---------------------------------------------------------------------------

driverPickupsRouter.get("/driver/pickups/nearby", requireAuth, requireRole("DRIVER"), async (req, res) => {
  res.json(await listNearbyPickups(getAuth(req).userId));
});

driverPickupsRouter.post("/driver/pickups/:id/accept", requireAuth, requireRole("DRIVER"), async (req, res) => {
  res.json(await acceptPickup(getAuth(req).userId, param(req.params.id)));
});

driverPickupsRouter.post("/driver/pickups/:id/arrived", requireAuth, requireRole("DRIVER"), async (req, res) => {
  res.json(await markPickupArrived(getAuth(req).userId, param(req.params.id)));
});

driverPickupsRouter.post("/driver/pickups/:id/complete", requireAuth, requireRole("DRIVER"), async (req, res) => {
  res.json(await completePickup(getAuth(req).userId, param(req.params.id)));
});

driverPickupsRouter.post("/driver/pickups/:id/cancel", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const body = CancelPickupRequest.parse(req.body ?? {});
  res.json(await cancelPickupAsDriver(getAuth(req).userId, param(req.params.id), { reason: body.reason ?? "" }));
});

driverPickupsRouter.get("/driver/pickups/mine", requireAuth, requireRole("DRIVER"), async (req, res) => {
  res.json(await getDriverMyPickup(getAuth(req).userId));
});
