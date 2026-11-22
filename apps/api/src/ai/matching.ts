import type { MatchScoreParts } from "@taxiflow/shared";

/** Rules, not machine learning. The weights are fixed and shown to the user as the "why". */
export const MATCH_WEIGHTS = { distance: 0.5, freeSeats: 0.2, rating: 0.15, idle: 0.15 } as const;

export type MatchInput = {
  distanceKm: number;
  radiusKm: number;
  freeSeats: number;
  requestedSeats: number;
  /** Average stars 1 to 5, or null when the driver has no ratings yet. */
  averageRating: number | null;
  /** Minutes since the taxi last finished a trip or joined the station. */
  idleMinutes: number;
};

export type MatchResult = { score: number; parts: MatchScoreParts; why: string };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Each part is normalised to 0..1. score = 0.5 distance + 0.2 free seats + 0.15 rating + 0.15 idle. */
export function scoreCandidate(input: MatchInput): MatchResult {
  const parts: MatchScoreParts = {
    distance: round3(clamp01(1 - input.distanceKm / Math.max(input.radiusKm, 0.1))),
    freeSeats: round3(clamp01((input.freeSeats - input.requestedSeats + 1) / 6)),
    rating: round3(input.averageRating === null ? 0.6 : clamp01((input.averageRating - 1) / 4)),
    idle: round3(clamp01(input.idleMinutes / 60)),
  };
  const score = round3(
    MATCH_WEIGHTS.distance * parts.distance +
      MATCH_WEIGHTS.freeSeats * parts.freeSeats +
      MATCH_WEIGHTS.rating * parts.rating +
      MATCH_WEIGHTS.idle * parts.idle,
  );
  return { score, parts, why: explain(input, parts) };
}

function explain(input: MatchInput, parts: MatchScoreParts): string {
  const bits: string[] = [`${input.distanceKm.toFixed(1)} km away`];
  bits.push(`${input.freeSeats} free seat${input.freeSeats === 1 ? "" : "s"} for ${input.requestedSeats} passenger${input.requestedSeats === 1 ? "" : "s"}`);
  if (input.averageRating !== null) bits.push(`rated ${input.averageRating.toFixed(1)} of 5`);
  if (parts.idle >= 0.5) bits.push(`waiting ${Math.round(input.idleMinutes)} min for a trip`);
  return `Good match: ${bits.join(", ")}.`;
}
