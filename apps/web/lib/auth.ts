import { mutate } from "swr";
import { clearToken, setToken } from "@/lib/api";
import type { AuthResponse, Role } from "@/lib/types";

export const ME_KEY = "/me";

const homes: Record<Role, string> = {
  PASSENGER: "/passenger",
  DRIVER: "/driver",
  STATION_REP: "/station",
  ADMIN: "/admin",
};

export function homeFor(role: Role): string {
  return homes[role];
}

/** Store the token and prime the /me cache so the next page renders without a second request. */
export async function startSession({ token, user }: AuthResponse) {
  setToken(token);
  await mutate(ME_KEY, user, { revalidate: false });
}

/** Full page load so no cached data from this session survives. */
export function logout() {
  clearToken();
  window.location.replace("/");
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "");
  return /^0[79]\d{8}$/.test(digits) || /^\+?251[79]\d{8}$/.test(digits);
}

/** Spaces and dashes removed; the API does the final normalisation. */
export function cleanPhone(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}
