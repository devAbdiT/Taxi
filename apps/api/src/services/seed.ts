import type { AssistanceType } from "@taxiflow/shared";
import { hashPassword } from "../lib/auth.js";
import type { Db } from "../lib/db.js";

export const DEMO_PASSWORD = "demo1234";

/** Waiting passengers, in the order they appear on the station desks. Phones stay 0911000101 onward. */
const QUEUE_NAMES = [
  "Tigist Abebe", "Chaltu Gemechu", "Dawit Mekonnen", "Ayantu Tesfaye", "Fikadu Bekele",
  "Lensa Tadesse", "Yonas Hailu", "Mekdes Alemu", "Gemechu Diriba", "Selamawit Kebede",
  "Birhanu Tolasa", "Rahel Girma", "Nahom Desta", "Sifan Ahmed", "Samuel Worku",
  "Eleni Assefa", "Tariku Negash", "Hawi Mohammed", "Genet Bekele", "Abdi Wakjira",
  "Marta Solomon", "Tesfaye Chala", "Birtukan Haile", "Obsa Tadesse", "Helen Getachew",
  "Mulugeta Dagne", "Daniel Teshome", "Zinash Bekele", "Jafar Abdela", "Meseret Wolde",
  "Tolasa Girma", "Bethlehem Tadesse", "Kedir Aman", "Liya Mengistu", "Wondimu Bekele",
  "Aster Fikre", "Ibsa Tamiru", "Meron Ashenafi", "Getachew Bulcha",
];

const STATIONS = [
  ["merkato", "Merkato", "መርካቶ"],
  ["ju", "Jimma University", "ጅማ ዩኒቨርሲቲ"],
  ["awetu", "Awetu", "አዌቱ"],
  ["jiren", "Jiren", "ጅረን"],
  ["hospital", "University Hospital", "ዩኒቨርሲቲ ሆስፒታል"],
  ["hermata", "Hermata", "ሄርማታ"],
  ["bishishe", "Bishishe", "ቢሺሼ"],
  ["bus", "Bus station", "አውቶቢስ ጣቢያ"],
] as const;

/** Each spoke has a route out of Merkato and the return back. The return to Merkato is the busy line. */
const SPOKES = [
  ["ju", "ju"],
  ["aw", "awetu"],
  ["jr", "jiren"],
  ["ho", "hospital"],
  ["he", "hermata"],
  ["bi", "bishishe"],
  ["bus", "bus"],
] as const;

/**
 * Opening queues. Jimma University → Merkato is the busy return, with elderly,
 * pregnant and disability priority. Merkato → Jimma University is the short outbound line.
 */
const LINES: [string, number, AssistanceType[]][] = [
  ["ju_mk", 12, ["NONE", "NONE", "ELDERLY", "NONE", "NONE", "NONE", "PREGNANT", "NONE", "NONE", "DISABILITY", "NONE", "NONE"]],
  ["mk_ju", 6, ["NONE", "ELDERLY"]],
  ["mk_ho", 5, ["PREGNANT"]],
  ["mk_aw", 4, []],
  ["mk_bus", 5, ["NONE", "NONE", "NONE", "DISABILITY"]],
  ["jr_mk", 3, []],
  ["he_mk", 2, []],
  ["bi_mk", 2, []],
];

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - Math.round(minutes * 60_000));

/** Deletes every row in one statement. */
export async function wipeDatabase(db: Db) {
  await db.$executeRaw`
    TRUNCATE "Rating", "Report", "ContractRequest", "Notification", "QueueEntry",
             "Trip", "Taxi", "User", "Route", "Station"
    CASCADE`;
}

/** Builds the Jimma demo. Expects an empty database. */
export async function seedDemoData(db: Db) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  await db.$transaction(async (tx) => {
    const stationId: Record<string, string> = {};
    for (const [key, name, nameAm] of STATIONS) {
      const station = await tx.station.create({ data: { name, nameAm } });
      stationId[key] = station.id;
    }

    const routeId: Record<string, string> = {};
    for (const [code, station] of SPOKES) {
      const outbound = await tx.route.create({
        data: { originId: stationId.merkato, destinationId: stationId[station] },
      });
      const back = await tx.route.create({
        data: { originId: stationId[station], destinationId: stationId.merkato },
      });
      routeId[`mk_${code}`] = outbound.id;
      routeId[`${code}_mk`] = back.id;
    }

    const user = (name: string, phone: string, role: "PASSENGER" | "DRIVER" | "STATION_REP" | "ADMIN", station?: string) =>
      tx.user.create({ data: { name, phone, passwordHash, role, stationId: station ? stationId[station] : null } });

    await user("Selam Tadesse", "0911000099", "ADMIN");
    await user("Meron Desta", "0911000011", "STATION_REP", "merkato");
    await user("Getachew Tolosa", "0911000012", "STATION_REP", "ju");

    const kebede = await user("Kebede Alemu", "0911000001", "DRIVER");
    const abebe = await user("Abebe Chala", "0911000002", "DRIVER");
    const fatuma = await user("Fatuma Ahmed", "0911000003", "DRIVER");
    const hana = await user("Hana Bekele", "0911000100", "PASSENGER");

    const kebedeTaxi = await tx.taxi.create({
      data: { plate: "OR 3-42115", capacity: 14, driverId: kebede.id, status: "AT_STATION", currentStationId: stationId.merkato },
    });
    const abebeTaxi = await tx.taxi.create({
      data: { plate: "OR 2-31880", capacity: 16, driverId: abebe.id, status: "OFFLINE" },
    });
    await tx.taxi.create({
      data: { plate: "OR 3-55012", capacity: 19, driverId: fatuma.id, status: "AT_STATION", currentStationId: stationId.ju },
    });

    const passengers = await tx.user.createManyAndReturn({
      data: QUEUE_NAMES.map((name, index) => ({
        name,
        phone: `0911000${101 + index}`,
        passwordHash,
        role: "PASSENGER" as const,
      })),
    });
    passengers.sort((a, b) => a.phone.localeCompare(b.phone));

    const waitingCount = LINES.reduce((sum, line) => sum + line[1], 0);
    const waiting = [];
    let person = 0;
    for (const [routeKey, count, help] of LINES) {
      for (let index = 0; index < count; index += 1) {
        const assistance = help[index] ?? "NONE";
        const minutes = 40 - (person * 39) / (waitingCount - 1);
        waiting.push({
          passengerId: passengers[person].id,
          routeId: routeId[routeKey],
          assistance,
          isPriority: assistance !== "NONE",
          joinedAt: minutesAgo(now, minutes),
        });
        person += 1;
      }
    }

    const toUniversity = await tx.trip.create({
      data: {
        taxiId: kebedeTaxi.id,
        routeId: routeId.mk_ju,
        status: "COMPLETED",
        createdAt: minutesAgo(now, 150),
        departedAt: minutesAgo(now, 140),
        arrivedAt: minutesAgo(now, 110),
      },
    });
    const toAwetu = await tx.trip.create({
      data: {
        taxiId: abebeTaxi.id,
        routeId: routeId.mk_aw,
        status: "COMPLETED",
        createdAt: minutesAgo(now, 90),
        departedAt: minutesAgo(now, 80),
        arrivedAt: minutesAgo(now, 50),
      },
    });

    const boarded = (
      passengerId: string,
      routeKey: string,
      tripId: string,
      joinedMinutes: number,
      calledMinutes: number,
      boardedMinutes: number,
    ) => ({
      passengerId,
      routeId: routeId[routeKey],
      status: "BOARDED" as const,
      assistance: "NONE" as const,
      isPriority: false,
      joinedAt: minutesAgo(now, joinedMinutes),
      calledAt: minutesAgo(now, calledMinutes),
      boardedAt: minutesAgo(now, boardedMinutes),
      tripId,
    });

    await tx.queueEntry.createMany({
      data: [
        ...waiting,
        boarded(hana.id, "mk_ju", toUniversity.id, 170, 155, 150),
        boarded(passengers[17].id, "mk_ju", toUniversity.id, 168, 155, 150),
        boarded(passengers[18].id, "mk_ju", toUniversity.id, 166, 155, 150),
        boarded(passengers[34].id, "mk_aw", toAwetu.id, 110, 95, 90),
        boarded(passengers[35].id, "mk_aw", toAwetu.id, 108, 95, 90),
        boarded(passengers[36].id, "mk_aw", toAwetu.id, 106, 95, 90),
        boarded(passengers[37].id, "mk_aw", toAwetu.id, 104, 95, 90),
      ],
    });

    await tx.report.createMany({
      data: [
        {
          reporterId: passengers[17].id,
          tripId: toUniversity.id,
          driverId: kebede.id,
          type: "OVERCHARGING",
          description: "On the Merkato to Jimma University line, the driver asked for more than the fare.",
          status: "OPEN",
          createdAt: minutesAgo(now, 120),
        },
        {
          reporterId: passengers[34].id,
          tripId: toAwetu.id,
          driverId: abebe.id,
          type: "DISRESPECT",
          description: "The driver was rude when I asked the fare at the Awetu stop.",
          status: "IN_REVIEW",
          createdAt: minutesAgo(now, 70),
        },
        {
          reporterId: passengers[20].id,
          driverId: kebede.id,
          type: "UNSAFE_DRIVING",
          description: "The minibus was driving too fast on the road down from Jiren.",
          status: "OPEN",
          createdAt: minutesAgo(now, 40),
        },
      ],
    });

    await tx.notification.create({
      data: {
        userId: hana.id,
        type: "TRIP_COMPLETED",
        title: "You arrived",
        body: "You arrived at Jimma University with taxi OR 3-42115. Please rate your trip.",
        read: true,
        createdAt: minutesAgo(now, 110),
      },
    });
  }, { maxWait: 60_000, timeout: 120_000 });
}

export async function resetDemoData(db: Db) {
  await wipeDatabase(db);
  await seedDemoData(db);
}
