import type { MarkNotificationsReadRequest, NotificationsResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { toNotification } from "../lib/serialize.js";

const PAGE_SIZE = 50;

export async function listNotifications(userId: string): Promise<NotificationsResponse> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications: rows.map(toNotification), unread };
}

export async function markNotificationsRead(userId: string, body: MarkNotificationsReadRequest): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
      ...(body.ids ? { id: { in: body.ids } } : {}),
    },
    data: { read: true },
  });
  return { updated: result.count };
}
