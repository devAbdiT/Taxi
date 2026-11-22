import { z } from "zod";
import { Id } from "./common.js";
import { AssistanceType } from "./enums.js";
import { QueueEntry } from "./models.js";

/** POST /queue/join. Any assistance other than NONE makes the entry priority. */
export const JoinQueueRequest = z.object({
  routeId: Id,
  assistance: AssistanceType.default("NONE"),
});
export type JoinQueueRequest = z.input<typeof JoinQueueRequest>;

/** Response of POST /queue/join (201). */
export const JoinQueueResponse = z.object({
  entry: QueueEntry,
  /** 1-based rank among WAITING entries on the route. */
  position: z.number().int().min(1),
});
export type JoinQueueResponse = z.infer<typeof JoinQueueResponse>;

/** GET /queue/me. `entry` is null when the passenger has no active entry. */
export const MyQueueResponse = z.object({
  entry: QueueEntry.nullable(),
  /** Set only while entry.status is WAITING. */
  position: z.number().int().min(1).nullable(),
  /** Set only while entry.status is CALLED. */
  taxiPlate: z.string().nullable(),
  /** Added later. Minutes until called, from GET /ai/wait-estimate. Absent or null when unknown. */
  estimatedWaitMinutes: z.number().nullable().optional(),
});
export type MyQueueResponse = z.infer<typeof MyQueueResponse>;

/** Response of POST /queue/leave: the entry, now CANCELLED. */
export const LeaveQueueResponse = z.object({
  entry: QueueEntry,
});
export type LeaveQueueResponse = z.infer<typeof LeaveQueueResponse>;
