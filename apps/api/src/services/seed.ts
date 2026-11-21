import type { AssistanceType } from "@taxiflow/shared";
import { hashPassword } from "../lib/auth.js";
import type { Db } from "../lib/db.js";

export const DEMO_PASSWORD = "demo1234";

const PASSENGER_NAMES = [
  "Almaz Tadesse", "Bekele Girma", "Chaltu Abdi", "Dawit Haile", "Eden Mekonnen",
  "Fikru Alemu", "Genet Wolde", "Hailu Bekele", "Iman Yusuf", "Kidist Assefa",
  "Lemma Tesfaye", "Meron Kebede", "Nardos Tilahun", "Obang Ochan", "Rahel Desta",
  "Samuel Gebru", "Tigist Ayele", "Yonas Mulugeta", "Zewdu Hailemariam", "Selam Negash",
];

/** Priority passengers in the B to A queue, by their index in that queue. */
const B_TO_A_PRIORITY: Record<number, AssistanceType> = { 2: "ELDERLY", 5: "PREGNANT", 8: "DISABILITY" };

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

/** Deletes every row in one statement. */
export async function wipeDatabase(db: Db) {
  await db.$executeRaw`
    TRUNCATE "Rating", "Report", "ContractRequest", "Notification", "QueueEntry",
             "Trip", "Taxi", "User", "Route", "Station"
    CASCADE`;
}

/** Builds the demo state from the master prompt. Expects an empty database. */
export async function seedDemoData(db: Db) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  await db.$transaction(async (tx) => {
    const areaA = await tx.station.create({ data: { name: "Area A", nameAm: "አካባቢ ሀ" } });
    const areaB = await tx.station.create({ data: { name: "Area B", nameAm: "አካባቢ ለ" } });

    const aToB = await tx.route.create({ data: { originId: areaA.id, destinationId: areaB.id } });
    const bToA = await tx.route.create({ data: { originId: areaB.id, destinationId: areaA.id } });

    const user = (name: string, phone: string, role: "PASSENGER" | "DRIVER" | "STATION_REP" | "ADMIN", stationId?: string) =>
      tx.user.create({ data: { name, phone, passwordHash, role, stationId: stationId ?? null } });

    await user("Admin User", "0911000099", "ADMIN");
    await user("Mulu Rep", "0911000011", "STATION_REP", areaA.id);
    await user("Tesfaye Rep", "0911000012", "STATION_REP", areaB.id);

    const driver1 = await user("Abebe Driver", "0911000001", "DRIVER");
    const driver2 = await user("Getachew Driver", "0911000002", "DRIVER");
    const driver3 = await user("Kebede Driver", "0911000003", "DRIVER");

    await tx.taxi.createMany({
      data: [
        { plate: "3-AA-10001", capacity: 14, driverId: driver1.id, status: "AT_STATION", currentStationId: areaA.id },
        { plate: "3-AA-10002", capacity: 16, driverId: driver2.id, status: "OFFLINE" },
        { plate: "3-AA-10003", capacity: 19, driverId: driver3.id, status: "AT_STATION", currentStationId: areaB.id },
      ],
    });

    await user("Demo Passenger", "0911000100", "PASSENGER");

    const passengers = await tx.user.createManyAndReturn({
      data: PASSENGER_NAMES.map((name, index) => ({
        name,
        phone: `0911000${101 + index}`,
        passwordHash,
        role: "PASSENGER" as const,
      })),
    });
    passengers.sort((a, b) => a.phone.localeCompare(b.phone));

    // 12 waiting at Area B for B to A, then 5 waiting at Area A for A to B. Joined over the last 40 minutes.
    const bQueue = passengers.slice(0, 12);
    const aQueue = passengers.slice(12, 17);

    await tx.queueEntry.createMany({
      data: [
        ...bQueue.map((passenger, index) => {
          const assistance = B_TO_A_PRIORITY[index] ?? "NONE";
          return {
            passengerId: passenger.id,
            routeId: bToA.id,
            assistance,
            isPriority: assistance !== "NONE",
            joinedAt: minutesAgo(now, 40 - index * 3),
          };
        }),
        ...aQueue.map((passenger, index) => ({
          passengerId: passenger.id,
          routeId: aToB.id,
          joinedAt: minutesAgo(now, 38 - index * 7),
        })),
      ],
    });
  }, { maxWait: 60_000, timeout: 120_000 });
}

export async function resetDemoData(db: Db) {
  await wipeDatabase(db);
  await seedDemoData(db);
}
