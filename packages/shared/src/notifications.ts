import { z } from "zod";
import { Id } from "./common.js";
import { Notification } from "./models.js";

/** GET /notifications, newest first, at most 50. */
export const NotificationsResponse = z.object({
  notifications: z.array(Notification),
  unread: z.number().int(),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponse>;

/** POST /notifications/read. Omit `ids` to mark every notification read. */
export const MarkNotificationsReadRequest = z.object({
  ids: z.array(Id).max(200).optional(),
});
export type MarkNotificationsReadRequest = z.input<typeof MarkNotificationsReadRequest>;

export const MarkNotificationsReadResponse = z.object({
  updated: z.number().int(),
});
export type MarkNotificationsReadResponse = z.infer<typeof MarkNotificationsReadResponse>;
