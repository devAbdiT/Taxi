import type { DevResetResponse, DevSmsResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { closeOpenSockets } from "../realtime/socket.js";
import { resetDemoData } from "./seed.js";

/** Wipes the database and loads the demo seed. Demo mode only. */
export async function resetDemo(): Promise<DevResetResponse> {
  await resetDemoData(prisma);
  closeOpenSockets();
  return { ok: true };
}

/** The newest 100 notifications, shown as text messages. Nothing is sent. */
export async function listSms(): Promise<DevSmsResponse> {
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });
  return {
    messages: rows.map((row) => ({
      id: row.id,
      to: row.user.phone,
      recipientName: row.user.name,
      text: `TaxiFlow: ${row.body}`,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
