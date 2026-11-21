import type { PublicPulseResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";

export async function publicPulse(): Promise<PublicPulseResponse> {
  const waitingNow = await prisma.queueEntry.count({ where: { status: "WAITING" } });
  return { waitingNow };
}
