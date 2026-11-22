import type { z } from "zod";
import {
  CreateDisputeRequest,
  UpdateDisputeRequest,
  type CreateDisputeResponse,
  type Dispute,
  type DisputesResponse,
  type DisputeStatus,
  type UpdateDisputeResponse,
} from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { disputeInReviewText, disputeOpenedText, disputeResolvedText } from "../lib/controllerMessages.js";
import { firstName, toRouteSummary } from "../lib/serialize.js";
import { publishDispute } from "../realtime/emitter.js";
import { actionInclude, appealDeadline, assertStationAccess, repStationOf, type Actor } from "./controllerCommon.js";
import { notifyTx, publishNotes } from "./notify.js";
import { positionOf } from "./queue.js";

type Tx = Prisma.TransactionClient;

const disputeInclude = {
  station: true,
  openedBy: true,
  againstUser: true,
  queueEntry: { include: { route: { include: { origin: true, destination: true } }, passenger: true } },
  appeals: { select: { userId: true } },
  actions: { where: { action: "RESOLVE_DISPUTE" }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.DisputeInclude;
type DisputeRow = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;

const minutesSince = (date: Date) => Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));

async function toDispute(tx: Tx, row: DisputeRow, viewerId: string | null): Promise<Dispute> {
  const entry = row.queueEntry;
  const resolution = row.actions[0] ?? null;
  const resolvedAt = row.resolvedAt;
  const canAppeal =
    viewerId !== null &&
    viewerId === row.openedById &&
    row.status === "RESOLVED" &&
    resolvedAt !== null &&
    appealDeadline(resolvedAt).getTime() > Date.now() &&
    !row.appeals.some((appeal) => appeal.userId === viewerId);
  return {
    id: row.id,
    stationId: row.stationId,
    stationName: row.station.name,
    type: row.type,
    status: row.status,
    description: row.description,
    openedByFirstName: firstName(row.openedBy.name),
    openedByIsPriority: entry ? entry.isPriority && entry.passengerId === row.openedById : false,
    againstFirstName: row.againstUser ? firstName(row.againstUser.name) : null,
    queueEntryId: row.queueEntryId,
    tripId: row.tripId,
    entry: entry
      ? {
          id: entry.id,
          route: toRouteSummary(entry.route),
          status: entry.status,
          position: entry.status === "WAITING" ? await positionOf(tx, entry) : null,
          isPriority: entry.isPriority,
          firstName: firstName(entry.passenger.name),
          waitingMinutes: minutesSince(entry.joinedAt),
        }
      : null,
    resolutionNote: row.resolutionNote,
    controllerReason: resolution?.reason ?? null,
    resolutionActionId: resolution?.id ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: resolvedAt?.toISOString() ?? null,
    waitingMinutes: minutesSince(row.createdAt),
    canAppeal,
  };
}

async function loadDispute(tx: Tx, id: string): Promise<DisputeRow> {
  const row = await tx.dispute.findUnique({ where: { id }, include: disputeInclude });
  if (!row) throw notFound("dispute_not_found", "This dispute does not exist");
  return row;
}

const partyIds = (row: { openedById: string; againstUserId: string | null }) =>
  [row.openedById, row.againstUserId].filter((id): id is string => id !== null);

export async function createDispute(actor: Actor, body: z.output<typeof CreateDisputeRequest>): Promise<CreateDisputeResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const opener = await tx.user.findUnique({ where: { id: actor.userId }, include: { taxi: true } });
    if (!opener) throw notFound("not_found", "This account does not exist");

    let stationId: string | null = null;
    let queueEntryId: string | null = null;
    let tripId: string | null = null;

    if (body.queueEntryId) {
      const entry = await tx.queueEntry.findUnique({ where: { id: body.queueEntryId }, include: { route: true } });
      if (!entry) throw notFound("entry_not_found", "This queue entry does not exist");
      if (actor.role === "PASSENGER" && entry.passengerId !== actor.userId) throw forbidden("You can only open a dispute about your own place in line");
      queueEntryId = entry.id;
      stationId = entry.route.originId;
    }
    if (body.tripId) {
      const trip = await tx.trip.findUnique({ where: { id: body.tripId }, include: { route: true, taxi: true, entries: { select: { passengerId: true } } } });
      if (!trip) throw notFound("trip_not_found", "This trip does not exist");
      const involved = actor.role === "DRIVER" ? trip.taxi.driverId === actor.userId : trip.entries.some((entry) => entry.passengerId === actor.userId);
      if (!involved) throw forbidden("You were not on this trip");
      tripId = trip.id;
      stationId ??= trip.route.originId;
    }
    if (!stationId) {
      if (actor.role === "PASSENGER") {
        const active = await tx.queueEntry.findFirst({
          where: { passengerId: actor.userId, status: { in: ["WAITING", "CALLED"] } },
          include: { route: true },
        });
        if (active) {
          queueEntryId = active.id;
          stationId = active.route.originId;
        }
      } else {
        stationId = opener.taxi?.currentStationId ?? null;
      }
    }
    if (!stationId) throw badRequest("validation_error", "Open a dispute from your place in line, a trip, or while your taxi is at a station");
    if (body.againstUserId) {
      const against = await tx.user.findUnique({ where: { id: body.againstUserId }, select: { id: true } });
      if (!against) throw notFound("not_found", "The person you named does not exist");
    }

    const duplicate = await tx.dispute.findFirst({
      where: { openedById: actor.userId, type: body.type, queueEntryId, status: { in: ["OPEN", "IN_REVIEW"] } },
      select: { id: true },
    });
    if (duplicate) throw conflict("duplicate_open_dispute", "You already have an open dispute of this kind for this place in line");

    const created = await tx.dispute.create({
      data: {
        stationId,
        type: body.type,
        openedById: actor.userId,
        againstUserId: body.againstUserId ?? null,
        queueEntryId,
        tripId,
        description: body.description,
      },
      include: disputeInclude,
    });
    const note = await notifyTx(tx, { userId: actor.userId, type: "DISPUTE_UPDATE", ...disputeOpenedText(opener.language) });
    return { dispute: await toDispute(tx, created, actor.userId), note, row: created };
  });

  publishNotes([committed.note]);
  publishDispute(
    { disputeId: committed.row.id, stationId: committed.row.stationId, type: committed.row.type, status: committed.row.status },
    partyIds(committed.row),
  );
  return { dispute: committed.dispute };
}

export async function listMyDisputes(userId: string): Promise<DisputesResponse> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.dispute.findMany({
      where: { openedById: userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: disputeInclude,
    });
    return { disputes: await Promise.all(rows.map((row) => toDispute(tx, row, userId))) };
  });
}

/** The controller's station only. An admin sees every station (optionally one). */
export async function listStationDisputes(actor: Actor, status: DisputeStatus | undefined, stationId?: string): Promise<DisputesResponse> {
  return prisma.$transaction(async (tx) => {
    const repStationId = await repStationOf(tx, actor);
    if (repStationId !== null && stationId) assertStationAccess(repStationId, stationId);
    const rows = await tx.dispute.findMany({
      where: {
        ...(repStationId ? { stationId: repStationId } : stationId ? { stationId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: disputeInclude,
    });
    return { disputes: await Promise.all(rows.map((row) => toDispute(tx, row, null))) };
  });
}

export async function updateDispute(actor: Actor, id: string, body: z.output<typeof UpdateDisputeRequest>): Promise<UpdateDisputeResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const repStationId = await repStationOf(tx, actor);
    const row = await loadDispute(tx, id);
    assertStationAccess(repStationId, row.stationId);

    const notes = [];
    if (body.status === "IN_REVIEW") {
      if (row.status !== "OPEN") throw conflict("invalid_dispute_status", "Only an open dispute can be put in review");
      await tx.dispute.update({ where: { id }, data: { status: "IN_REVIEW" } });
      notes.push(await notifyTx(tx, { userId: row.openedById, type: "DISPUTE_UPDATE", ...disputeInReviewText(row.openedBy.language) }));
    } else {
      if (row.status === "RESOLVED" || row.status === "APPEALED") throw conflict("invalid_dispute_status", "This dispute is already resolved");
      const note = body.resolutionNote ?? "";
      await tx.dispute.update({
        where: { id },
        data: { status: "RESOLVED", resolutionNote: note, resolvedById: actor.userId, resolvedAt: new Date() },
      });
      await tx.controllerAction.create({
        data: {
          stationId: row.stationId,
          actorId: actor.userId,
          action: "RESOLVE_DISPUTE",
          targetUserId: row.openedById,
          queueEntryId: row.queueEntryId,
          disputeId: row.id,
          reason: note,
        },
        include: actionInclude,
      });
      for (const party of [row.openedBy, row.againstUser]) {
        if (party) notes.push(await notifyTx(tx, { userId: party.id, type: "DISPUTE_UPDATE", ...disputeResolvedText(party.language, note) }));
      }
    }
    const updated = await loadDispute(tx, id);
    return { dispute: await toDispute(tx, updated, null), notes, row: updated };
  });

  publishNotes(committed.notes);
  publishDispute(
    { disputeId: committed.row.id, stationId: committed.row.stationId, type: committed.row.type, status: committed.row.status },
    partyIds(committed.row),
  );
  return { dispute: committed.dispute };
}

export { toDispute, disputeInclude, loadDispute };
