import { APPEAL_WINDOW_HOURS, type ControllerActionView, type Role } from "@taxiflow/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";
import { firstName } from "../lib/serialize.js";

type Tx = Prisma.TransactionClient;

export type Actor = { userId: string; role: Role };

export const notYourStation = () => new AppError(403, "not_your_station", "This queue is not at your station");

export const actionInclude = { station: true, actor: true, targetUser: true } satisfies Prisma.ControllerActionInclude;
export type ActionRow = Prisma.ControllerActionGetPayload<{ include: typeof actionInclude }>;

/** A rep acts only on their own station. An admin acts on any station (returns null). */
export async function repStationOf(db: Tx, actor: Actor): Promise<string | null> {
  if (actor.role === "ADMIN") return null;
  const user = await db.user.findUnique({ where: { id: actor.userId }, select: { stationId: true } });
  if (!user?.stationId) throw notYourStation();
  return user.stationId;
}

export function assertStationAccess(repStationId: string | null, stationId: string): void {
  if (repStationId !== null && repStationId !== stationId) throw notYourStation();
}

export const appealDeadline = (createdAt: Date) => new Date(createdAt.getTime() + APPEAL_WINDOW_HOURS * 3_600_000);

/** Only these facts leave the API. The raw `before` snapshot used for reversal stays on the server. */
const PUBLIC_DETAIL_KEYS = ["positions", "direction", "minutes", "endsAt", "fromPosition", "toPosition", "appealId", "reversedActionId"];

export function publicDetails(details: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_DETAIL_KEYS) {
    if (key in details) out[key] = (details as Record<string, unknown>)[key];
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function toActionView(row: ActionRow): ControllerActionView {
  return {
    id: row.id,
    stationId: row.stationId,
    stationName: row.station.name,
    actorFirstName: firstName(row.actor.name),
    action: row.action,
    targetFirstName: row.targetUser ? firstName(row.targetUser.name) : null,
    queueEntryId: row.queueEntryId,
    driverQueueEntryId: row.driverQueueEntryId,
    disputeId: row.disputeId,
    reason: row.reason,
    details: publicDetails(row.details),
    createdAt: row.createdAt.toISOString(),
  };
}

export type SortKeyChange = { id: string; before: Date; after: Date };

/**
 * Plans a reorder inside one group without touching joinedAt. The group's own sortKey values are
 * reused (made strictly increasing) and handed out in the new order, so the entry moves by exactly
 * the requested number of places and nobody else changes order.
 */
export function planReorder(group: { id: string; sortKey: Date }[], from: number, to: number): SortKeyChange[] {
  const keys = group.map((item) => item.sortKey.getTime());
  for (let i = 1; i < keys.length; i += 1) {
    const previous = keys[i - 1] ?? 0;
    if ((keys[i] ?? 0) <= previous) keys[i] = previous + 1;
  }
  const order = group.slice();
  const [moved] = order.splice(from, 1);
  if (moved) order.splice(to, 0, moved);
  const changes: SortKeyChange[] = [];
  order.forEach((item, index) => {
    const after = keys[index] ?? item.sortKey.getTime();
    if (item.sortKey.getTime() !== after) changes.push({ id: item.id, before: item.sortKey, after: new Date(after) });
  });
  return changes;
}
