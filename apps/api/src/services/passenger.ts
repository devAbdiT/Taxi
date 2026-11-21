import type { CreateRatingRequest, CreateReportRequest, MyTripsResponse, PassengerTrip } from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { AppError, conflict, notFound } from "../lib/errors.js";
import { reportFiledText } from "../lib/messages.js";
import { firstName, toRating, toReport, toRouteSummary } from "../lib/serialize.js";
import { createNotification } from "../realtime/emitter.js";

const notOnTrip = () => new AppError(403, "not_on_trip", "You did not board this trip");

export async function listMyTrips(passengerId: string): Promise<MyTripsResponse> {
  const entries = await prisma.queueEntry.findMany({
    where: { passengerId, status: "BOARDED", tripId: { not: null } },
    include: {
      route: { include: { origin: true, destination: true } },
      trip: { include: { taxi: { include: { driver: true } }, ratings: { where: { passengerId } } } },
    },
    orderBy: [{ boardedAt: "desc" }, { id: "desc" }],
  });

  const trips: PassengerTrip[] = [];
  for (const entry of entries) {
    if (!entry.trip) continue;
    const rated = entry.trip.ratings.length > 0;
    trips.push({
      tripId: entry.trip.id,
      entryId: entry.id,
      route: toRouteSummary(entry.route),
      status: entry.trip.status,
      taxiPlate: entry.trip.taxi.plate,
      driverFirstName: firstName(entry.trip.taxi.driver.name),
      boardedAt: entry.boardedAt?.toISOString() ?? null,
      departedAt: entry.trip.departedAt?.toISOString() ?? null,
      arrivedAt: entry.trip.arrivedAt?.toISOString() ?? null,
      rated,
      canRate: entry.trip.status === "COMPLETED" && !rated,
    });
  }
  return { trips };
}

export async function createRating(passengerId: string, body: CreateRatingRequest) {
  try {
    const rating = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: body.tripId }, select: { id: true, status: true } });
      if (!trip) throw notFound("trip_not_found", "This trip does not exist");

      const boarded = await tx.queueEntry.findFirst({
        where: { passengerId, tripId: trip.id, status: "BOARDED" },
        select: { id: true },
      });
      if (!boarded) throw notOnTrip();
      if (trip.status !== "COMPLETED") throw conflict("trip_not_completed", "You can rate a trip after it arrives");

      return tx.rating.create({
        data: {
          tripId: trip.id,
          passengerId,
          stars: body.stars,
          tags: body.tags ?? [],
          comment: body.comment ?? null,
        },
      });
    });
    return { rating: toRating(rating) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("already_rated", "You already rated this trip");
    }
    throw err;
  }
}

export async function createReport(passengerId: string, body: CreateReportRequest) {
  const created = await prisma.$transaction(async (tx) => {
    let driver: { id: string; language: string } | null = null;
    if (body.tripId) {
      const trip = await tx.trip.findUnique({
        where: { id: body.tripId },
        select: { id: true, taxi: { select: { driver: { select: { id: true, language: true } } } } },
      });
      if (!trip) throw notFound("trip_not_found", "This trip does not exist");
      if (!(await tx.queueEntry.findFirst({ where: { passengerId, tripId: trip.id, status: "BOARDED" }, select: { id: true } }))) {
        throw notOnTrip();
      }
      driver = trip.taxi.driver;
    }

    const report = await tx.report.create({
      data: {
        reporterId: passengerId,
        tripId: body.tripId ?? null,
        driverId: driver?.id ?? null,
        type: body.type,
        description: body.description,
      },
    });
    return { report, driver };
  });

  if (created.driver) {
    const text = reportFiledText(created.driver.language);
    await createNotification({ userId: created.driver.id, type: "REPORT_FILED", ...text });
  }
  return { report: toReport(created.report) };
}
