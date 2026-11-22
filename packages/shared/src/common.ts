import { z } from "zod";

/** ISO 8601 timestamp string, e.g. "2026-11-21T12:30:00.000Z". Show it as relative text in the UI. */
export const IsoDate = z.string();
export type IsoDate = z.infer<typeof IsoDate>;

export const Id = z.string().min(1);

const PHONE_PATTERN = /^(?:\+?251|0)?([79]\d{8})$/;

/**
 * Normalises an Ethiopian mobile number to its stored form "09XXXXXXXX" or "07XXXXXXXX".
 * Accepts 09..., 07..., +2519..., 2519..., 9... (spaces and dashes are ignored).
 * Returns null when the input is not an Ethiopian mobile number.
 */
export function normalizePhone(input: string): string | null {
  const match = PHONE_PATTERN.exec(input.replace(/[\s-]/g, ""));
  return match ? `0${match[1]}` : null;
}

export const Phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Phone must be an Ethiopian mobile number starting 09 or 07" });
      return z.NEVER;
    }
    return phone;
  });

export const ErrorCode = z.enum([
  "validation_error",
  "invalid_json",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "internal_error",
  "invalid_credentials",
  "phone_taken",
  "route_not_found",
  "station_not_found",
  "already_in_queue",
  "not_in_queue",
  "entry_not_found",
  "invalid_entry_status",
  "taxi_not_found",
  "invalid_taxi_status",
  "route_not_from_current_station",
  "active_trip_exists",
  "trip_not_found",
  "not_your_trip",
  "trip_not_loading",
  "trip_not_departed",
  "trip_not_completed",
  "not_enough_seats",
  "no_boarded_passengers",
  "not_on_trip",
  "already_rated",
  "report_not_found",
  "not_your_report",
  "already_responded",
  "not_your_station",
  "not_your_turn",
  "priority_boundary",
  "suspended",
  "duplicate_open_dispute",
  "dispute_not_found",
  "invalid_dispute_status",
  "appeal_not_found",
  "already_appealed",
  "appeal_window_closed",
  "appeal_not_open",
  "action_not_found",
  "not_in_driver_queue",
  "driver_queue_entry_not_found",
  "consent_required",
  "too_fast",
  "already_open",
  "already_taken",
  "pickup_not_found",
  "invalid_pickup_status",
  "no_location",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Every error response has this shape. `details` is only present on validation_error. */
export const ErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  /** Only on 403 suspended: when the suspension ends (ISO 8601). */
  endsAt: z.string().optional(),
  details: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const HealthResponse = z.object({
  ok: z.literal(true),
  uptimeSeconds: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
