import { z } from "zod";
import { IsoDate } from "./common.js";

/** Response of POST /dev/reset (demo mode only). */
export const DevResetResponse = z.object({
  ok: z.literal(true),
});
export type DevResetResponse = z.infer<typeof DevResetResponse>;

/** A notification shown as a simulated text message. Nothing is ever sent. */
export const SmsMessage = z.object({
  id: z.string(),
  to: z.string(),
  recipientName: z.string(),
  text: z.string(),
  createdAt: IsoDate,
});
export type SmsMessage = z.infer<typeof SmsMessage>;

/** GET /dev/sms (demo mode only), newest first, at most 100. */
export const DevSmsResponse = z.object({
  messages: z.array(SmsMessage),
});
export type DevSmsResponse = z.infer<typeof DevSmsResponse>;
