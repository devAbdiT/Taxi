import { api, request } from "@/lib/api";
import type {
  LocationConsentResponse,
  TaxiLocationRequest,
  TaxiLocationResponse,
  NearbyTaxisResponse,
  TripTrackResponse,
  FleetResponse,
  CreatePickupRequest,
  CreatePickupResponse,
  MyPickupResponse,
  NearbyPickupsResponse,
  DriverPickupResponse,
  WaitEstimateResponse,
  DemandForecastResponse,
  InsightsResponse,
} from "@taxiflow/shared";

export const gpsAiApi = {
  setLocationConsent: async (body: { granted: boolean }): Promise<LocationConsentResponse> => {
    if (typeof (api as any).setLocationConsent === "function") {
      return (api as any).setLocationConsent(body);
    }
    return request<LocationConsentResponse>("POST", "/me/location-consent", body);
  },

  updateTaxiLocation: async (body: TaxiLocationRequest): Promise<TaxiLocationResponse> => {
    if (typeof (api as any).updateTaxiLocation === "function") {
      return (api as any).updateTaxiLocation(body);
    }
    return request<TaxiLocationResponse>("POST", "/taxis/me/location", body);
  },

  nearbyTaxis: async (lat: number, lng: number, radiusKm = 3): Promise<NearbyTaxisResponse> => {
    if (typeof (api as any).nearbyTaxis === "function") {
      return (api as any).nearbyTaxis(lat, lng, radiusKm);
    }
    return request<NearbyTaxisResponse>("GET", `/taxis/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
  },

  tripTrack: async (tripId: string): Promise<TripTrackResponse> => {
    if (typeof (api as any).tripTrack === "function") {
      return (api as any).tripTrack(tripId);
    }
    return request<TripTrackResponse>("GET", `/trips/${tripId}/track`);
  },

  fleet: async (): Promise<FleetResponse> => {
    if (typeof (api as any).fleet === "function") {
      return (api as any).fleet();
    }
    return request<FleetResponse>("GET", "/admin/fleet");
  },

  createPickup: async (body: CreatePickupRequest): Promise<CreatePickupResponse> => {
    if (typeof (api as any).createPickup === "function") {
      return (api as any).createPickup(body);
    }
    return request<CreatePickupResponse>("POST", "/pickups", body);
  },

  myPickup: async (): Promise<MyPickupResponse> => {
    if (typeof (api as any).myPickup === "function") {
      return (api as any).myPickup();
    }
    return request<MyPickupResponse>("GET", "/pickups/mine");
  },

  cancelPickup: async (id: string, body: { reason?: string } = {}): Promise<{ ok: boolean }> => {
    if (typeof (api as any).cancelPickup === "function") {
      return (api as any).cancelPickup(id, body);
    }
    return request<{ ok: boolean }>("POST", `/pickups/${id}/cancel`, body);
  },

  nearbyPickups: async (): Promise<NearbyPickupsResponse> => {
    if (typeof (api as any).nearbyPickups === "function") {
      return (api as any).nearbyPickups();
    }
    return request<NearbyPickupsResponse>("GET", "/driver/pickups/nearby");
  },

  acceptPickup: async (id: string): Promise<DriverPickupResponse> => {
    if (typeof (api as any).acceptPickup === "function") {
      return (api as any).acceptPickup(id);
    }
    return request<DriverPickupResponse>("POST", `/driver/pickups/${id}/accept`);
  },

  arrivedPickup: async (id: string): Promise<{ ok: boolean }> => {
    if (typeof (api as any).arrivedPickup === "function") {
      return (api as any).arrivedPickup(id);
    }
    return request<{ ok: boolean }>("POST", `/driver/pickups/${id}/arrived`);
  },

  completePickup: async (id: string): Promise<{ ok: boolean }> => {
    if (typeof (api as any).completePickup === "function") {
      return (api as any).completePickup(id);
    }
    return request<{ ok: boolean }>("POST", `/driver/pickups/${id}/complete`);
  },

  waitEstimate: async (routeId: string): Promise<WaitEstimateResponse> => {
    if (typeof (api as any).waitEstimate === "function") {
      return (api as any).waitEstimate(routeId);
    }
    return request<WaitEstimateResponse>("GET", `/ai/wait-estimate?routeId=${routeId}`);
  },

  demandForecast: async (stationId: string): Promise<DemandForecastResponse> => {
    if (typeof (api as any).demandForecast === "function") {
      return (api as any).demandForecast(stationId);
    }
    return request<DemandForecastResponse>("GET", `/ai/demand-forecast?stationId=${stationId}`);
  },

  aiInsights: async (days = 7, stationId?: string): Promise<InsightsResponse> => {
    if (typeof (api as any).aiInsights === "function") {
      return (api as any).aiInsights(days, stationId);
    }
    return request<InsightsResponse>("GET", `/admin/ai/insights?days=${days}${stationId ? `&stationId=${stationId}` : ""}`);
  },
};
