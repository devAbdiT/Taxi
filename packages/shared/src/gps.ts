import { z } from "zod";
import { Id, IsoDate } from "./common.js";
import { PickupStatus, TaxiStatus } from "./enums.js";
import { Station } from "./models.js";

export const Lat = z.number().min(-90).max(90);
export const Lng = z.number().min(-180).max(180);

/** POST /me/location-consent (passenger or driver). */
export const LocationConsentRequest = z.object({ granted: z.boolean() });
export type LocationConsentRequest = z.input<typeof LocationConsentRequest>;

export const LocationConsentResponse = z.object({
  /** When consent was given. Null when not granted or withdrawn. */
  locationConsentAt: IsoDate.nullable(),
});
export type LocationConsentResponse = z.infer<typeof LocationConsentResponse>;

/** POST /taxis/me/location (driver). 1 request per 2 seconds. */
export const TaxiLocationRequest = z.object({
  lat: Lat,
  lng: Lng,
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).max(200).optional(),
  accuracyM: z.number().min(0).optional(),
});
export type TaxiLocationRequest = z.input<typeof TaxiLocationRequest>;

/** 200 when stored, 202 with ignored "low_accuracy" when accuracyM is above 200 m. */
export const TaxiLocationResponse = z.object({
  ok: z.literal(true),
  ignored: z.literal("low_accuracy").optional(),
  updatedAt: IsoDate.nullable(),
});
export type TaxiLocationResponse = z.infer<typeof TaxiLocationResponse>;

export const TaxiPosition = z.object({
  lat: z.number(),
  lng: z.number(),
  heading: z.number().nullable(),
  speedKmh: z.number().nullable(),
  updatedAt: IsoDate,
  /** True when the last ping is older than LOCATION_STALE_SECONDS. */
  stale: z.boolean(),
});
export type TaxiPosition = z.infer<typeof TaxiPosition>;

/** GET /taxis/nearby?lat&lng&radiusKm (passenger). Positions are rounded to about 100 m. */
export const NearbyTaxisQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(20).default(3),
});
export type NearbyTaxisQuery = z.input<typeof NearbyTaxisQuery>;

export const NearbyTaxi = z.object({
  id: z.string(),
  plate: z.string(),
  driverFirstName: z.string(),
  status: TaxiStatus,
  freeSeats: z.number().int(),
  lat: z.number(),
  lng: z.number(),
  distanceKm: z.number(),
  etaMinutes: z.number(),
  stale: z.boolean(),
});
export type NearbyTaxi = z.infer<typeof NearbyTaxi>;

export const NearbyTaxisResponse = z.object({
  taxis: z.array(NearbyTaxi),
  /** Positions are rounded, so they are never exact. */
  roundedToMeters: z.number(),
});
export type NearbyTaxisResponse = z.infer<typeof NearbyTaxisResponse>;

/** GET /trips/:id/track */
export const TripTrackResponse = z.object({
  tripId: z.string(),
  taxiPlate: z.string(),
  taxi: TaxiPosition.nullable(),
  /** Minutes until the taxi reaches the boarding station. Null when unknown. */
  etaMinutes: z.number().nullable(),
  boardingStation: Station.extend({ lat: z.number().nullable(), lng: z.number().nullable() }),
  /** [lat, lng] pairs from the origin to the destination. Approximate. */
  polyline: z.array(z.tuple([z.number(), z.number()])),
});
export type TripTrackResponse = z.infer<typeof TripTrackResponse>;

// ---------------------------------------------------------------------------
// Pickup requests
// ---------------------------------------------------------------------------

export const CreatePickupRequest = z.object({
  lat: Lat,
  lng: Lng,
  placeNote: z.string().trim().max(120).optional(),
  seats: z.number().int().min(1).max(4).default(1),
});
export type CreatePickupRequest = z.input<typeof CreatePickupRequest>;

export const PickupTaxi = z.object({
  plate: z.string(),
  driverFirstName: z.string(),
  position: TaxiPosition.nullable(),
  etaMinutes: z.number().nullable(),
});
export type PickupTaxi = z.infer<typeof PickupTaxi>;

/** A pickup as its passenger sees it. lat and lng are null once it has ended. */
export const PickupPassengerView = z.object({
  id: z.string(),
  status: PickupStatus,
  seats: z.number().int(),
  placeNote: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  createdAt: IsoDate,
  expiresAt: IsoDate,
  /** How many drivers were told about the request so far. */
  driversNotified: z.number().int(),
  taxi: PickupTaxi.nullable(),
});
export type PickupPassengerView = z.infer<typeof PickupPassengerView>;

export const CreatePickupResponse = z.object({ pickup: PickupPassengerView });
export type CreatePickupResponse = z.infer<typeof CreatePickupResponse>;

/** GET /pickups/mine */
export const MyPickupResponse = z.object({ pickup: PickupPassengerView.nullable() });
export type MyPickupResponse = z.infer<typeof MyPickupResponse>;

export const CancelPickupRequest = z.object({ reason: z.string().trim().max(200).optional() });
export type CancelPickupRequest = z.input<typeof CancelPickupRequest>;

export const MatchScoreParts = z.object({
  distance: z.number(),
  freeSeats: z.number(),
  rating: z.number(),
  idle: z.number(),
});
export type MatchScoreParts = z.infer<typeof MatchScoreParts>;

/** One open request as a nearby driver sees it. Rounded to about 300 m, no note. */
export const NearbyPickup = z.object({
  id: z.string(),
  approxLat: z.number(),
  approxLng: z.number(),
  seats: z.number().int(),
  distanceKm: z.number(),
  etaMinutes: z.number(),
  expiresAt: IsoDate,
  score: z.number(),
  parts: MatchScoreParts,
  method: z.literal("rules"),
  /** Plain-words explanation of why this request fits this driver. */
  why: z.string(),
});
export type NearbyPickup = z.infer<typeof NearbyPickup>;

export const NearbyPickupsResponse = z.object({ pickups: z.array(NearbyPickup), roundedToMeters: z.number() });
export type NearbyPickupsResponse = z.infer<typeof NearbyPickupsResponse>;

/** The exact view, only for the accepting driver while ACCEPTED or ARRIVED. */
export const DriverPickupView = z.object({
  id: z.string(),
  status: PickupStatus,
  seats: z.number().int(),
  placeNote: z.string().nullable(),
  passengerFirstName: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  expiresAt: IsoDate,
  acceptedAt: IsoDate.nullable(),
});
export type DriverPickupView = z.infer<typeof DriverPickupView>;

export const DriverPickupResponse = z.object({ pickup: DriverPickupView });
export type DriverPickupResponse = z.infer<typeof DriverPickupResponse>;

/** GET /driver/pickups/mine: the pickup this driver is serving, if any. */
export const DriverMyPickupResponse = z.object({ pickup: DriverPickupView.nullable() });
export type DriverMyPickupResponse = z.infer<typeof DriverMyPickupResponse>;

/** GET /fleet (controller, admin): every taxi, plus open pickups without exact coordinates. */
export const FleetResponse = z.object({
  taxis: z.array(
    z.object({
      id: z.string(),
      plate: z.string(),
      status: TaxiStatus,
      driverFirstName: z.string(),
      position: TaxiPosition.nullable(),
    }),
  ),
  stations: z.array(Station.extend({ lat: z.number().nullable(), lng: z.number().nullable() })),
  openPickups: z.array(z.object({ id: z.string(), approxLat: z.number(), approxLng: z.number(), seats: z.number().int() })),
});
export type FleetResponse = z.infer<typeof FleetResponse>;

export const PickupIdParam = Id;
