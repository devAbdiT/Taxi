// ASSUMPTION: the master prompt and events.ts already define the socket payloads
// (demand has no taxisAvailable/updatedAt; queue:update is flat; trip:update is
// tripId/status/seatsUsed/capacity). Those names and fields are kept.
export * from "./events.js";
