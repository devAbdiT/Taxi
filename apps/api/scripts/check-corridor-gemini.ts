import { generateShortageAdvice } from "../src/ai/gemini.js";
import { makeCorridorId } from "../src/services/corridor.js";

async function run() {
  console.log("=== Testing Corridor & Gemini AI Advice ===");

  // 1. Test corridor id generator
  const cid1 = makeCorridorId("Jiren", "Merkato");
  const cid2 = makeCorridorId("Merkato", "Jiren");
  if (cid1 !== cid2 || cid1 !== "jiren_merkato") {
    throw new Error(`Corridor ID mismatch: got ${cid1}, expected jiren_merkato`);
  }
  console.log("✓ Corridor ID generation works symmetrically:", cid1);

  // 2. Test Shortage Advice Generation (Gemini or Rule-based fallback)
  const advice = await generateShortageAdvice({
    corridorName: "Jiren ⇄ Merkato",
    currentDemand: 3,
    assignedRouteBreakdown: [
      { name: "Jiren → Merkato", waiting: 3 },
      { name: "Merkato → Jiren", waiting: 0 },
    ],
    currentStationName: "Merkato",
    taxiCapacity: 14,
    otherStations: [
      { id: "st_ju", name: "Jimma University", waiting: 12 },
      { id: "st_bus", name: "Bus station", waiting: 5 },
      { id: "st_ho", name: "University Hospital", waiting: 5 },
    ],
    totalActiveInCity: 39,
  });

  console.log("✓ Shortage advice evaluated successfully:");
  console.log("  - hasShortage:", advice.hasShortage);
  console.log("  - corridorName:", advice.corridorName);
  console.log("  - currentDemand:", advice.currentDemand);
  console.log("  - method:", advice.method);
  console.log("  - suggestedStation:", advice.suggestedStation?.name, `(${advice.suggestedStation?.waitingCount} waiting)`);
  console.log("  - message:", advice.message);

  if (!advice.hasShortage) {
    throw new Error("Expected hasShortage to be true for 3 waiting passengers");
  }
  if (!advice.message.toLowerCase().includes("bus") && !advice.message.toLowerCase().includes("shortage")) {
    throw new Error("Expected message to mention Bus station or task shortage");
  }

  console.log("\nAll Corridor & Gemini Advice checks PASSED!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
