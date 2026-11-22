import type { z } from "zod";
import {
  AuditLogQuery,
  type AuditLogResponse,
  type ControllerActionType,
  type MyActionsResponse,
  type MySuspensionResponse,
  type StationActionRequest,
  type StationActionResponse,
} from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { AppError, conflict, notFound } from "../lib/errors.js";
import { actionText } from "../lib/controllerMessages.js";
import { publishQueueChange, publishQueueControl, publishTripUpdate } from "../realtime/emitter.js";
import {
  actionInclude,
  appealDeadline,
  assertStationAccess,
  planReorder,
  repStationOf,
  toActionView,
  type Actor,
  type SortKeyChange,
} from "./controllerCommon.js";
import { notifyTx, publishNotes } from "./notify.js";
import { activeSuspension } from "./suspension.js";

type Tx = Prisma.TransactionClient;
type Body = z.output<typeof StationActionRequest>;

/** Snapshot kept on the audit row so an admin can reverse the decision. Never sent to clients. */
type Before =
  | { kind: "queue" | "driver"; rows: { id: string; sortKey: string }[] }
  | { kind: "priority"; isPriority: boolean; priorityVerified: boolean }
  | { kind: "driver_grant" };

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function beforeRows(kind: "queue" | "driver", changes: SortKeyChange[]): Before {
  return { kind, rows: changes.map((change) => ({ id: change.id, sortKey: change.before.toISOString() })) };
}

type Effect = {
  details: Record<string, unknown>;
  routeIds: string[];
  endedUserIds: string[];
  tripId: string | null;
  suspendMinutes: number | null;
};

export async function performControllerAction(actor: Actor, body: Body): Promise<StationActionResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const repStationId = await repStationOf(tx, actor);

    // 1. Find who and what the action is about.
    let entry: Prisma.QueueEntryGetPayload<{ include: { route: true; passenger: true } }> | null = null;
    let driverEntry: Prisma.DriverQueueEntryGetPayload<{ include: { driver: true; taxi: true } }> | null = null;
    let targetUser: { id: string; language: string; stationId: string | null } | null = null;
    let stationId: string;

    if (body.queueEntryId) {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "QueueEntry" WHERE id = ${body.queueEntryId} FOR UPDATE`;
      if (!locked[0]) throw notFound("entry_not_found", "This queue entry does not exist");
      entry = await tx.queueEntry.findUnique({ where: { id: body.queueEntryId }, include: { route: true, passenger: true } });
      if (!entry) throw notFound("entry_not_found", "This queue entry does not exist");
      stationId = entry.route.originId;
      targetUser = entry.passenger;
    } else if (body.driverQueueEntryId) {
      driverEntry = await tx.driverQueueEntry.findUnique({ where: { id: body.driverQueueEntryId }, include: { driver: true, taxi: true } });
      if (!driverEntry) throw notFound("driver_queue_entry_not_found", "This driver line place does not exist");
      stationId = driverEntry.stationId;
      targetUser = driverEntry.driver;
    } else {
      const user = body.targetUserId ? await tx.user.findUnique({ where: { id: body.targetUserId } }) : null;
      if (!user) throw notFound("not_found", "This person does not exist");
      if (!repStationId) {
        throw conflict("invalid_entry_status", "An administrator must choose a queue place so the action has a station");
      }
      stationId = repStationId;
      targetUser = user;
    }
    assertStationAccess(repStationId, stationId);

    if (body.disputeId) {
      const dispute = await tx.dispute.findUnique({ where: { id: body.disputeId }, select: { stationId: true } });
      if (!dispute || dispute.stationId !== stationId) throw notFound("dispute_not_found", "This dispute does not exist at this station");
    }

    // 2. Apply the effect.
    const effect: Effect = { details: {}, routeIds: [], endedUserIds: [], tripId: null, suspendMinutes: null };
    let before: Before | null = null;
    const positions = body.positions ?? 1;

    switch (body.action) {
      case "WARN":
        break;

      case "MOVE_BACK":
      case "MOVE_FORWARD": {
        if (!entry || entry.status !== "WAITING") throw conflict("invalid_entry_status", "Only a waiting passenger can be moved");
        const group = await tx.queueEntry.findMany({
          where: { routeId: entry.routeId, status: "WAITING", isPriority: entry.isPriority },
          orderBy: [{ sortKey: "asc" }, { id: "asc" }],
          select: { id: true, sortKey: true },
        });
        const from = group.findIndex((item) => item.id === entry?.id);
        const to = body.action === "MOVE_BACK" ? from + positions : from - positions;
        if (to < 0 || to >= group.length) {
          throw conflict("priority_boundary", "This move would cross into the other priority group. Choose fewer places.");
        }
        const changes = planReorder(group, from, to);
        for (const change of changes) {
          await tx.queueEntry.update({ where: { id: change.id }, data: { sortKey: change.after } });
        }
        const offset = entry.isPriority ? 0 : await tx.queueEntry.count({ where: { routeId: entry.routeId, status: "WAITING", isPriority: true } });
        before = beforeRows("queue", changes);
        effect.details = { positions, fromPosition: offset + from + 1, toPosition: offset + to + 1 };
        effect.routeIds = [entry.routeId];
        break;
      }

      case "CONFIRM_PRIORITY": {
        if (!entry || !entry.isPriority || (entry.status !== "WAITING" && entry.status !== "CALLED")) {
          throw conflict("invalid_entry_status", "This passenger did not claim priority");
        }
        before = { kind: "priority", isPriority: entry.isPriority, priorityVerified: entry.priorityVerified };
        await tx.queueEntry.update({ where: { id: entry.id }, data: { priorityVerified: true } });
        effect.routeIds = [entry.routeId];
        break;
      }

      case "REJECT_PRIORITY": {
        if (!entry || !entry.isPriority || entry.status !== "WAITING") {
          throw conflict("invalid_entry_status", "Only a waiting passenger who claimed priority can lose it");
        }
        before = { kind: "priority", isPriority: entry.isPriority, priorityVerified: entry.priorityVerified };
        await tx.queueEntry.update({ where: { id: entry.id }, data: { isPriority: false, priorityVerified: false } });
        effect.routeIds = [entry.routeId];
        break;
      }

      case "MARK_NO_SHOW": {
        if (!entry || entry.status !== "CALLED" || !entry.tripId) {
          throw conflict("invalid_entry_status", "Only a called passenger can be marked as not boarded");
        }
        const trip = await tx.trip.findUnique({ where: { id: entry.tripId }, select: { status: true } });
        if (trip?.status !== "LOADING") throw conflict("trip_not_loading", "The taxi is no longer loading");
        await tx.queueEntry.update({ where: { id: entry.id }, data: { status: "NO_SHOW" } });
        effect.routeIds = [entry.routeId];
        effect.endedUserIds = [entry.passengerId];
        effect.tripId = entry.tripId;
        break;
      }

      case "REMOVE": {
        if (!entry || (entry.status !== "WAITING" && entry.status !== "CALLED")) {
          throw conflict("invalid_entry_status", "Only a waiting or called passenger can be removed");
        }
        await tx.queueEntry.update({ where: { id: entry.id }, data: { status: "CANCELLED" } });
        effect.routeIds = [entry.routeId];
        effect.endedUserIds = [entry.passengerId];
        effect.tripId = entry.status === "CALLED" ? entry.tripId : null;
        break;
      }

      case "SUSPEND": {
        effect.suspendMinutes = body.minutes ?? 60;
        effect.details = { minutes: effect.suspendMinutes, endsAt: new Date(Date.now() + effect.suspendMinutes * 60_000).toISOString() };
        break;
      }

      case "ALLOW_OUT_OF_TURN": {
        if (!driverEntry || driverEntry.status !== "WAITING") throw conflict("invalid_entry_status", "Only a waiting driver can start out of turn");
        before = { kind: "driver_grant" };
        await tx.driverQueueEntry.update({ where: { id: driverEntry.id }, data: { outOfTurnGrantedAt: new Date() } });
        break;
      }

      case "REORDER_DRIVER": {
        if (!driverEntry || driverEntry.status !== "WAITING") throw conflict("invalid_entry_status", "Only a waiting driver can be moved");
        const group = await tx.driverQueueEntry.findMany({
          where: { stationId: driverEntry.stationId, status: "WAITING" },
          orderBy: [{ sortKey: "asc" }, { id: "asc" }],
          select: { id: true, sortKey: true },
        });
        const from = group.findIndex((item) => item.id === driverEntry?.id);
        const direction = body.direction ?? "EARLIER";
        const to = Math.max(0, Math.min(group.length - 1, direction === "EARLIER" ? from - positions : from + positions));
        if (to === from) throw conflict("invalid_entry_status", "This driver cannot move any further that way");
        const changes = planReorder(group, from, to);
        for (const change of changes) {
          await tx.driverQueueEntry.update({ where: { id: change.id }, data: { sortKey: change.after } });
        }
        before = beforeRows("driver", changes);
        effect.details = { positions: Math.abs(to - from), direction, fromPosition: from + 1, toPosition: to + 1 };
        break;
      }
    }

    // 3. Write the audit row in the same transaction.
    const created = await tx.controllerAction.create({
      data: {
        stationId,
        actorId: actor.userId,
        action: body.action,
        targetUserId: targetUser?.id ?? null,
        queueEntryId: entry?.id ?? null,
        driverQueueEntryId: driverEntry?.id ?? null,
        disputeId: body.disputeId ?? null,
        reason: body.reason,
        details: asJson({ ...effect.details, before }),
      },
      include: actionInclude,
    });

    if (effect.suspendMinutes !== null && targetUser) {
      await tx.suspension.create({
        data: {
          userId: targetUser.id,
          stationId,
          reason: body.reason,
          endsAt: new Date(Date.now() + effect.suspendMinutes * 60_000),
          createdByActionId: created.id,
        },
      });
    }

    // 4. Tell the affected person, with the reason.
    const notes = [];
    if (targetUser) {
      const text = actionText(targetUser.language, body.action, body.reason);
      notes.push(await notifyTx(tx, { userId: targetUser.id, type: "CONTROLLER_ACTION", ...text }));
    }

    return { created, effect, notes, targetUserId: targetUser?.id ?? null, entryId: entry?.id ?? null };
  });

  // After commit: realtime only.
  publishNotes(committed.notes);
  if (committed.targetUserId) {
    publishQueueControl(committed.targetUserId, {
      actionId: committed.created.id,
      action: committed.created.action,
      entryId: committed.entryId,
      reason: committed.created.reason,
      canAppealUntil: appealDeadline(committed.created.createdAt).toISOString(),
    });
  }
  if (committed.effect.routeIds.length > 0) {
    await publishQueueChange({ routeIds: committed.effect.routeIds, endedUserIds: committed.effect.endedUserIds });
  }
  if (committed.effect.tripId) await publishTripUpdate(committed.effect.tripId);
  return { action: toActionView(committed.created) };
}

// ---------------------------------------------------------------------------
// Reading the audit log (read only: there is no code anywhere that edits or deletes a row)
// ---------------------------------------------------------------------------

export async function listAuditLog(actor: Actor, query: z.output<typeof AuditLogQuery>): Promise<AuditLogResponse> {
  const repStationId = await repStationOf(prisma, actor);
  if (repStationId !== null && query.stationId && query.stationId !== repStationId) {
    throw new AppError(403, "not_your_station", "This log belongs to another station");
  }
  const where: Prisma.ControllerActionWhereInput = {
    ...(repStationId ? { stationId: repStationId } : query.stationId ? { stationId: query.stationId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
      : {}),
  };
  const rows = await prisma.controllerAction.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: actionInclude,
  });
  const page = rows.slice(0, query.limit);
  return {
    actions: page.map(toActionView),
    nextCursor: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** What controllers did to me, with the appeal state. */
export async function listMyActions(userId: string): Promise<MyActionsResponse> {
  const rows = await prisma.controllerAction.findMany({
    where: { targetUserId: userId, action: { notIn: ["RESOLVE_DISPUTE", "APPEAL_REVERSED"] as ControllerActionType[] } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { ...actionInclude, appeals: { select: { status: true } } },
  });
  const now = Date.now();
  return {
    actions: rows.map((row) => {
      const until = appealDeadline(row.createdAt);
      const appeal = row.appeals[0] ?? null;
      return {
        ...toActionView(row),
        canAppealUntil: until.toISOString(),
        canAppeal: appeal === null && until.getTime() > now,
        appealStatus: appeal?.status ?? null,
      };
    }),
  };
}

export async function getMySuspension(userId: string): Promise<MySuspensionResponse> {
  const suspension = await activeSuspension(prisma, userId);
  return {
    suspension: suspension
      ? {
          stationName: suspension.station.name,
          reason: suspension.reason,
          startsAt: suspension.startsAt.toISOString(),
          endsAt: suspension.endsAt.toISOString(),
        }
      : null,
  };
}
