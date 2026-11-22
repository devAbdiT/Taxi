import type { z } from "zod";
import {
  CreateAppealRequest,
  DecideAppealRequest,
  type AppealsResponse,
  type AppealStatus,
  type AppealView,
  type CreateAppealResponse,
  type DecideAppealResponse,
} from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { appealDecidedText } from "../lib/controllerMessages.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { firstName } from "../lib/serialize.js";
import { publishDispute, publishQueueChange, publishQueueControl } from "../realtime/emitter.js";
import { actionInclude, appealDeadline, toActionView, type Actor } from "./controllerCommon.js";
import { notifyTx, publishNotes } from "./notify.js";

type Tx = Prisma.TransactionClient;

const appealInclude = { user: true, action: { include: actionInclude } } satisfies Prisma.AppealInclude;
type AppealRow = Prisma.AppealGetPayload<{ include: typeof appealInclude }>;

function toAppeal(row: AppealRow): AppealView {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    adminNote: row.adminNote,
    appellantFirstName: firstName(row.user.name),
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    action: row.action ? toActionView(row.action) : null,
    disputeId: row.disputeId,
  };
}

export async function createAppeal(actor: Actor, body: z.output<typeof CreateAppealRequest>): Promise<CreateAppealResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    if (body.actionId) {
      const action = await tx.controllerAction.findUnique({ where: { id: body.actionId } });
      if (!action || action.targetUserId !== actor.userId) throw notFound("action_not_found", "There is no decision like this about you");
      if (appealDeadline(action.createdAt).getTime() <= Date.now()) {
        throw conflict("appeal_window_closed", "The 48 hours to appeal this decision have passed");
      }
      const existing = await tx.appeal.findUnique({ where: { actionId: action.id } });
      if (existing) throw conflict("already_appealed", "You already appealed this decision");
      const appeal = await tx.appeal.create({
        data: { actionId: action.id, userId: actor.userId, reason: body.reason },
        include: appealInclude,
      });
      return { appeal: toAppeal(appeal), dispute: null };
    }

    const dispute = await tx.dispute.findUnique({ where: { id: body.disputeId ?? "" } });
    if (!dispute || dispute.openedById !== actor.userId) throw notFound("dispute_not_found", "There is no dispute like this opened by you");
    if (dispute.status !== "RESOLVED" || !dispute.resolvedAt) throw conflict("invalid_dispute_status", "Only a resolved dispute can be appealed");
    if (appealDeadline(dispute.resolvedAt).getTime() <= Date.now()) {
      throw conflict("appeal_window_closed", "The 48 hours to appeal this decision have passed");
    }
    const existing = await tx.appeal.findUnique({ where: { disputeId_userId: { disputeId: dispute.id, userId: actor.userId } } });
    if (existing) throw conflict("already_appealed", "You already appealed this decision");
    const appeal = await tx.appeal.create({
      data: { disputeId: dispute.id, userId: actor.userId, reason: body.reason },
      include: appealInclude,
    });
    const updated = await tx.dispute.update({ where: { id: dispute.id }, data: { status: "APPEALED" } });
    return { appeal: toAppeal(appeal), dispute: updated };
  });

  if (committed.dispute) {
    publishDispute(
      { disputeId: committed.dispute.id, stationId: committed.dispute.stationId, type: committed.dispute.type, status: committed.dispute.status },
      [committed.dispute.openedById],
    );
  }
  return { appeal: committed.appeal };
}

export async function listMyAppeals(userId: string): Promise<AppealsResponse> {
  const rows = await prisma.appeal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30, include: appealInclude });
  return { appeals: rows.map(toAppeal) };
}

export async function listAdminAppeals(status: AppealStatus | undefined): Promise<AppealsResponse> {
  const rows = await prisma.appeal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "asc" },
    take: 100,
    include: appealInclude,
  });
  return { appeals: rows.map(toAppeal) };
}

type BeforeSnapshot = {
  kind?: string;
  rows?: { id: string; sortKey: string }[];
  isPriority?: boolean;
  priorityVerified?: boolean;
};

/** Undoes what can be undone. Returns the routes whose order may have changed. */
async function undoAction(tx: Tx, action: NonNullable<AppealRow["action"]>): Promise<string[]> {
  const details = (action.details ?? {}) as { before?: BeforeSnapshot | null };
  const before = details.before ?? null;
  const routeIds: string[] = [];

  if (before?.kind === "queue" && before.rows) {
    for (const row of before.rows) {
      const entry = await tx.queueEntry.findUnique({ where: { id: row.id }, select: { status: true, routeId: true } });
      if (entry?.status === "WAITING") {
        await tx.queueEntry.update({ where: { id: row.id }, data: { sortKey: new Date(row.sortKey) } });
        routeIds.push(entry.routeId);
      }
    }
  } else if (before?.kind === "driver" && before.rows) {
    for (const row of before.rows) {
      await tx.driverQueueEntry.updateMany({ where: { id: row.id, status: "WAITING" }, data: { sortKey: new Date(row.sortKey) } });
    }
  } else if (before?.kind === "priority" && action.queueEntryId) {
    const entry = await tx.queueEntry.findUnique({ where: { id: action.queueEntryId }, select: { status: true, routeId: true } });
    if (entry && (entry.status === "WAITING" || entry.status === "CALLED")) {
      await tx.queueEntry.update({
        where: { id: action.queueEntryId },
        data: { isPriority: before.isPriority ?? false, priorityVerified: before.priorityVerified ?? false },
      });
      routeIds.push(entry.routeId);
    }
  } else if (before?.kind === "driver_grant" && action.driverQueueEntryId) {
    await tx.driverQueueEntry.updateMany({ where: { id: action.driverQueueEntryId }, data: { outOfTurnGrantedAt: null } });
  }

  if (action.action === "SUSPEND") {
    await tx.suspension.updateMany({ where: { createdByActionId: action.id, liftedAt: null }, data: { liftedAt: new Date() } });
  }

  if (action.action === "REMOVE" && action.queueEntryId) {
    const entry = await tx.queueEntry.findUnique({ where: { id: action.queueEntryId } });
    if (entry?.status === "CANCELLED") {
      const active = await tx.queueEntry.findFirst({ where: { passengerId: entry.passengerId, status: { in: ["WAITING", "CALLED"] } } });
      if (!active) {
        await tx.queueEntry.update({ where: { id: entry.id }, data: { status: "WAITING", calledAt: null, boardedAt: null, tripId: null } });
        routeIds.push(entry.routeId);
      }
    }
  }
  return routeIds;
}

/** UPHELD keeps the decision. REVERSED undoes it, writes an audit row and tells the person. */
export async function decideAppeal(admin: Actor, id: string, body: z.output<typeof DecideAppealRequest>): Promise<DecideAppealResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const row = await tx.appeal.findUnique({ where: { id }, include: appealInclude });
    if (!row) throw notFound("appeal_not_found", "This appeal does not exist");
    if (row.status !== "OPEN") throw conflict("appeal_not_open", "This appeal was already decided");

    let routeIds: string[] = [];
    let disputeRow: Prisma.DisputeGetPayload<object> | null = null;
    let stationId: string | null = row.action?.stationId ?? null;

    if (body.status === "REVERSED") {
      if (row.action) {
        routeIds = await undoAction(tx, row.action);
      } else if (row.disputeId) {
        disputeRow = await tx.dispute.update({
          where: { id: row.disputeId },
          data: { status: "IN_REVIEW", resolutionNote: null, resolvedAt: null, resolvedById: null },
        });
        stationId = disputeRow.stationId;
      }
    } else if (row.disputeId) {
      disputeRow = await tx.dispute.update({ where: { id: row.disputeId }, data: { status: "RESOLVED" } });
      stationId = disputeRow.stationId;
    }
    if (!stationId) throw forbidden("This appeal has no station to record the decision against");

    const updated = await tx.appeal.update({
      where: { id },
      data: { status: body.status, adminNote: body.adminNote, decidedById: admin.userId, decidedAt: new Date() },
      include: appealInclude,
    });

    let auditId: string | null = null;
    if (body.status === "REVERSED") {
      const audit = await tx.controllerAction.create({
        data: {
          stationId,
          actorId: admin.userId,
          action: "APPEAL_REVERSED",
          targetUserId: row.userId,
          queueEntryId: row.action?.queueEntryId ?? null,
          driverQueueEntryId: row.action?.driverQueueEntryId ?? null,
          disputeId: row.disputeId,
          reason: body.adminNote,
          details: { appealId: row.id, reversedActionId: row.actionId } as Prisma.InputJsonValue,
        },
      });
      auditId = audit.id;
    }
    const note = await notifyTx(tx, {
      userId: row.userId,
      type: "APPEAL_UPDATE",
      ...appealDecidedText(row.user.language, body.status, body.adminNote),
    });
    return { appeal: toAppeal(updated), note, routeIds, disputeRow, auditId, userId: row.userId };
  });

  publishNotes([committed.note]);
  if (committed.routeIds.length > 0) await publishQueueChange({ routeIds: [...new Set(committed.routeIds)] });
  if (committed.disputeRow) {
    publishDispute(
      {
        disputeId: committed.disputeRow.id,
        stationId: committed.disputeRow.stationId,
        type: committed.disputeRow.type,
        status: committed.disputeRow.status,
      },
      [committed.userId],
    );
  }
  if (committed.auditId) {
    publishQueueControl(committed.userId, {
      actionId: committed.auditId,
      action: "APPEAL_REVERSED",
      entryId: null,
      reason: body.adminNote,
      canAppealUntil: new Date().toISOString(),
    });
  }
  return { appeal: committed.appeal };
}
