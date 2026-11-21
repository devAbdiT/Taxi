export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API_URL;
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Every live screen also polls at this rate, so it keeps working if the socket drops. */
export const REFRESH_MS = 10_000;
