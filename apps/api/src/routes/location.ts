import { Router } from "express";
import { Id, LocationConsentRequest, NearbyTaxisQuery, TaxiLocationRequest } from "@taxiflow/shared";
import { getAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { getFleet, getNearbyTaxis, getTripTrack, setLocationConsent, updateTaxiLocation } from "../services/location.js";

export const locationRouter = Router();

function param(value: string | string[] | undefined): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

locationRouter.post("/me/location-consent", requireAuth, requireRole("PASSENGER", "DRIVER"), async (req, res) => {
  res.json(await setLocationConsent(getAuth(req).userId, LocationConsentRequest.parse(req.body)));
});

locationRouter.post("/taxis/me/location", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const result = await updateTaxiLocation(getAuth(req).userId, TaxiLocationRequest.parse(req.body));
  res.status(result.status).json(result.body);
});

locationRouter.get("/taxis/nearby", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  res.json(await getNearbyTaxis(getAuth(req).userId, NearbyTaxisQuery.parse(req.query)));
});

locationRouter.get("/trips/:id/track", requireAuth, async (req, res) => {
  const auth = getAuth(req);
  res.json(await getTripTrack({ userId: auth.userId, role: auth.role }, param(req.params.id)));
});

locationRouter.get("/admin/fleet", requireAuth, requireRole("ADMIN", "STATION_REP"), async (_req, res) => {
  res.json(await getFleet());
});
