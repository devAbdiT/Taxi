import type { DriverCorridor, DriverCorridorResponse, ShortageRecommendation } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { generateShortageAdvice } from "../ai/gemini.js";
import { listRoutesWithDemand } from "./demand.js";

/** Runtime mapping of driverId or phone or plate to corridor ID */
const driverCorridorMap = new Map<string, string>();

/** Helper to identify corridor keys from station names or codes */
export function makeCorridorId(stationAName: string, stationBName: string): string {
  const normA = stationAName.toLowerCase().replace(/[^a-z]/g, "");
  const normB = stationBName.toLowerCase().replace(/[^a-z]/g, "");
  return normA < normB ? `${normA}_${normB}` : `${normB}_${normA}`;
}

/**
 * Discovers all 2-station corridors (pairs of reciprocal routes) from the database.
 */
export async function getCorridors(): Promise<DriverCorridor[]> {
  const routes = await prisma.route.findMany({
    include: { origin: true, destination: true },
  });

  const corridorMap = new Map<
    string,
    {
      id: string;
      stationA: { id: string; name: string; nameAm: string | null };
      stationB: { id: string; name: string; nameAm: string | null };
      routeIds: string[];
    }
  >();

  for (const r of routes) {
    const key = makeCorridorId(r.origin.name, r.destination.name);
    const existing = corridorMap.get(key);
    if (existing) {
      if (!existing.routeIds.includes(r.id)) {
        existing.routeIds.push(r.id);
      }
    } else {
      const isAOrigin = r.origin.name.localeCompare(r.destination.name) < 0;
      corridorMap.set(key, {
        id: key,
        stationA: isAOrigin ? r.origin : r.destination,
        stationB: isAOrigin ? r.destination : r.origin,
        routeIds: [r.id],
      });
    }
  }

  return Array.from(corridorMap.values()).map((c) => ({
    id: c.id,
    name: `${c.stationA.name} ⇄ ${c.stationB.name}`,
    stationA: c.stationA,
    stationB: c.stationB,
    routeIds: c.routeIds,
  }));
}

/**
 * Finds the assigned corridor for a given driver.
 * Default mapping:
 * - Kebede Alemu (phone 0911000001 / OR 3-42115): Jiren ⇄ Merkato (explicit user request example)
 * - Abebe Chala (0911000002): Awetu ⇄ Merkato
 * - Fatuma Ahmed (0911000003): Jimma University ⇄ Merkato
 * - Other: defaults to Jiren ⇄ Merkato or first available corridor.
 */
export async function getDriverCorridor(driverId: string): Promise<DriverCorridor> {
  const corridors = await getCorridors();
  const first = corridors[0];
  if (!first) {
    throw notFound("route_not_found", "No route corridors found");
  }

  // Check if driver has an explicitly assigned corridor ID
  const explicitlySet = driverCorridorMap.get(driverId);
  if (explicitlySet) {
    const found = corridors.find((c) => c.id === explicitlySet);
    if (found) return found;
  }

  // Check driver profile / taxi details
  const user = await prisma.user.findUnique({
    where: { id: driverId },
    include: { taxi: true },
  });

  if (user) {
    const custom = driverCorridorMap.get(user.phone) || (user.taxi && driverCorridorMap.get(user.taxi.plate));
    if (custom) {
      const match = corridors.find((c) => c.id === custom);
      if (match) return match;
    }

    // Default seeded drivers
    if (user.phone === "0911000001" || user.taxi?.plate === "OR 3-42115") {
      // Kebede -> Jiren ⇄ Merkato (user prompt example)
      const jirenMerkato = corridors.find((c) => c.id.includes("jiren") && c.id.includes("merkato"));
      if (jirenMerkato) return jirenMerkato;
    }

    if (user.phone === "0911000002") {
      const awetuMerkato = corridors.find((c) => c.id.includes("awetu") && c.id.includes("merkato"));
      if (awetuMerkato) return awetuMerkato;
    }

    if (user.phone === "0911000003") {
      const juMerkato = corridors.find((c) => (c.id.includes("ju") || c.id.includes("university")) && c.id.includes("merkato"));
      if (juMerkato) return juMerkato;
    }
  }

  // Prefer Jiren ⇄ Merkato if available, else first corridor
  const jirenDefault = corridors.find((c) => c.id.includes("jiren") && c.id.includes("merkato"));
  return jirenDefault ?? first;
}

/**
 * Updates a driver's corridor assignment.
 */
export async function setDriverCorridor(driverId: string, corridorId: string): Promise<DriverCorridor> {
  const corridors = await getCorridors();
  const target = corridors.find((c) => c.id === corridorId);
  if (!target) {
    throw notFound("route_not_found", `Corridor ${corridorId} does not exist`);
  }
  driverCorridorMap.set(driverId, target.id);
  return target;
}

/**
 * Returns the current driver's assigned corridor and all available corridors.
 */
export async function getDriverCorridorInfo(driverId: string): Promise<DriverCorridorResponse> {
  const [current, available] = await Promise.all([getDriverCorridor(driverId), getCorridors()]);
  return { current, available };
}

/**
 * Checks if the driver's assigned corridor has a passenger / task shortage.
 * If shortage detected, generates an AI dispatch recommendation (using Gemini API or fallback rules)
 * advising on other stations' demand (e.g. Bus station, Jimma University).
 */
export async function checkShortageRecommendation(
  corridor: DriverCorridor,
  taxiCapacity: number,
  currentStationName: string | null,
): Promise<ShortageRecommendation | null> {
  const allRoutes = await listRoutesWithDemand();

  // Filter routes on driver's assigned corridor
  const corridorRoutes = allRoutes.filter((r) => corridor.routeIds.includes(r.id));
  const currentDemand = corridorRoutes.reduce((sum, r) => sum + r.waiting, 0);

  // Shortage threshold: total corridor waiting <= 4 passengers, or less than 1/3 taxi capacity
  const SHORTAGE_THRESHOLD = Math.min(4, Math.floor(taxiCapacity / 3));
  const hasShortage = currentDemand <= SHORTAGE_THRESHOLD;

  if (!hasShortage) {
    return null;
  }

  // Group demand by station for all other stations
  const otherStationWaiting = new Map<string, { id: string; name: string; waiting: number }>();
  let totalActiveInCity = 0;

  for (const r of allRoutes) {
    totalActiveInCity += r.waiting;
    // We want stations outside the driver's corridor or where passenger queues are high
    const originStation = r.origin;
    const existing = otherStationWaiting.get(originStation.id) ?? {
      id: originStation.id,
      name: originStation.name,
      waiting: 0,
    };
    existing.waiting += r.waiting;
    otherStationWaiting.set(originStation.id, existing);
  }

  const assignedRouteBreakdown = corridorRoutes.map((r) => ({
    name: `${r.origin.name} → ${r.destination.name}`,
    waiting: r.waiting,
  }));

  const otherStations = Array.from(otherStationWaiting.values());

  return generateShortageAdvice({
    corridorName: corridor.name,
    currentDemand,
    assignedRouteBreakdown,
    currentStationName,
    taxiCapacity,
    otherStations,
    totalActiveInCity,
  });
}
