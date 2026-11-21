import type { DemandUpdatePayload, Notification, QueueUpdatePayload, TripUpdatePayload } from "@taxiflow/shared";

export const LIVE_CHANNEL = "taxiflow-live";

export interface LiveMessage {
  event: "demand:update" | "queue:update" | "notification:new" | "trip:update";
  payload: DemandUpdatePayload | QueueUpdatePayload | Notification | TripUpdatePayload;
}

/** Other browser tabs hear mock changes. The tab that made the change already refreshed itself. */
export function publishMockLive(message: LiveMessage) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(LIVE_CHANNEL);
  channel.postMessage(message);
  channel.close();
}
