import type { ShortageRecommendation } from "@taxiflow/shared";

interface StationDemandSummary {
  id: string;
  name: string;
  waiting: number;
}

interface GenerateShortageParams {
  corridorName: string;
  currentDemand: number;
  assignedRouteBreakdown: { name: string; waiting: number }[];
  currentStationName: string | null;
  taxiCapacity: number;
  otherStations: StationDemandSummary[];
  totalActiveInCity: number;
}

/**
 * Calls Google Gemini API using GEMINI_API_KEY if configured,
 * otherwise falls back to a deterministic rule-based dispatch advisory.
 */
export async function generateShortageAdvice(params: GenerateShortageParams): Promise<ShortageRecommendation> {
  const {
    corridorName,
    currentDemand,
    assignedRouteBreakdown,
    currentStationName,
    taxiCapacity,
    otherStations,
    totalActiveInCity,
  } = params;

  // Identify highest demand stations outside the corridor
  const sortedOthers = [...otherStations].sort((a, b) => b.waiting - a.waiting);
  const busStation = otherStations.find((s) => s.name.toLowerCase().includes("bus")) ?? sortedOthers[0];
  const topStation = sortedOthers[0];

  const suggestedStation = busStation && busStation.waiting > 0
    ? { id: busStation.id, name: busStation.name, waitingCount: busStation.waiting }
    : topStation && topStation.waiting > 0
    ? { id: topStation.id, name: topStation.name, waitingCount: topStation.waiting }
    : null;

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (apiKey) {
    try {
      const prompt = `You are TaxiFlow Dispatch AI for the Jimma, Ethiopia minibus taxi system.
A driver with a ${taxiCapacity}-passenger minibus is assigned to operate exclusively on the "${corridorName}" corridor.
Current situation: TASK SHORTAGE on this route.
- Corridor demand: Only ${currentDemand} passenger(s) waiting across this corridor (${assignedRouteBreakdown.map((r) => `${r.name}: ${r.waiting}`).join(", ")}).
- Driver current station: ${currentStationName ?? "En route"}.

Passenger queue counts at other stations across Jimma:
${sortedOthers.map((s) => `- ${s.name}: ${s.waiting} waiting`).join("\n")}

In 2 short sentences, provide a dispatch recommendation to the driver. State the task shortage on ${corridorName}, and explicitly advise them on the high-demand situation at ${busStation ? `Bus station (${busStation.waiting} waiting)` : ""} and ${topStation && topStation.id !== busStation?.id ? `${topStation.name} (${topStation.waiting} waiting)` : ""} so they know where passengers need service. Keep the advice professional and direct.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 150,
            },
          }),
        },
      );

      if (response.ok) {
        const json = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return {
            hasShortage: true,
            corridorName,
            currentDemand,
            suggestedStation,
            message: text,
            method: "llm",
            basedOnSamples: totalActiveInCity,
            synthetic: false,
          };
        }
      }
    } catch {
      // Fall through to deterministic rule-based advice on any API or network error
    }
  }

  // Fallback: Rule-based advice (honest attribution to 'rules')
  const busPart = busStation
    ? `Bus station (${busStation.waiting} waiting passengers)`
    : "";
  const topPart = topStation && topStation.id !== busStation?.id && topStation.waiting > 0
    ? ` and ${topStation.name} (${topStation.waiting} waiting)`
    : "";

  const destinationHint = busPart ? `${busPart}${topPart}` : `${topStation?.name ?? "central stations"} (${topStation?.waiting ?? 0} waiting)`;

  const message = `Task Shortage Alert: Low passenger demand on ${corridorName} (${currentDemand} waiting vs ${taxiCapacity} seats). Heavy passenger queues detected at ${destinationHint}. Recommended: Coordinate with station rep to assist at ${busStation?.name ?? topStation?.name ?? "Bus station"} or prepare for passenger transfers.`;

  return {
    hasShortage: true,
    corridorName,
    currentDemand,
    suggestedStation,
    message,
    method: "rules",
    basedOnSamples: totalActiveInCity,
    synthetic: true,
  };
}
