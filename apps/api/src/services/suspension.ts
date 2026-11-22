import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";

type Client = Prisma.TransactionClient;

export function activeSuspension(db: Client, userId: string) {
  return db.suspension.findFirst({
    where: { userId, liftedAt: null, endsAt: { gt: new Date() } },
    include: { station: true },
    orderBy: { endsAt: "desc" },
  });
}

/** 403 suspended, with the end time in the body, while a controller's suspension is running. */
export async function assertNotSuspended(db: Client, userId: string): Promise<void> {
  const suspension = await activeSuspension(db, userId);
  if (suspension) {
    const endsAt = suspension.endsAt.toISOString();
    throw new AppError(403, "suspended", `You are suspended from the queues until ${endsAt}. Reason: ${suspension.reason}`, { endsAt });
  }
}
