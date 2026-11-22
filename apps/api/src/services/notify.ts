import { NotificationNewPayload, type NotificationType } from "@taxiflow/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { publishNotification } from "../realtime/emitter.js";

type Tx = Prisma.TransactionClient;

export type NoteInput = { userId: string; type: NotificationType; title: string; body: string };

/**
 * Writes a notification inside the caller's transaction and returns the payload.
 * Send it with publishNotes() only after the transaction has committed.
 */
export async function notifyTx(tx: Tx, input: NoteInput): Promise<NotificationNewPayload> {
  const row = await tx.notification.create({ data: input });
  return NotificationNewPayload.parse({
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  });
}

export function publishNotes(notes: NotificationNewPayload[]): void {
  for (const note of notes) publishNotification(note);
}
