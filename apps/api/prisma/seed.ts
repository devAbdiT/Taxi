import { prisma } from "../src/lib/db.js";
import { resetDemoData, seedDemoData } from "../src/services/seed.js";

export async function seedSyntheticDemand(db = prisma) {
  const routes = await db.route.findMany({ select: { id: true } });
  if (routes.length === 0) return;

  const now = new Date();
  const records = [];

  for (const route of routes) {
    for (let d = 1; d <= 14; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      for (let h = 0; h < 24; h++) {
        let baseJoins = 1;
        if (h >= 7 && h <= 9) {
          baseJoins = 8 + Math.floor(Math.random() * 8); // 8-15
        } else if (h >= 16 && h <= 18) {
          baseJoins = 10 + Math.floor(Math.random() * 9); // 10-18
        } else if (h >= 10 && h <= 15) {
          baseJoins = 3 + Math.floor(Math.random() * 5); // 3-7
        } else if (h === 19) {
          baseJoins = 3 + Math.floor(Math.random() * 4); // 3-6
        } else {
          // Night 20-6
          baseJoins = Math.floor(Math.random() * 3); // 0-2
        }

        // Add random noise ±20%
        const noise = 0.8 + Math.random() * 0.4;
        let joins = Math.round(baseJoins * noise);

        // Weekends: multiply by 0.7
        if (isWeekend) {
          joins = Math.round(joins * 0.7);
        }
        joins = Math.max(0, joins);

        const avgWaitSeconds = joins > 0 ? Math.round(180 + joins * 40 + Math.random() * 60) : null;

        records.push({
          routeId: route.id,
          date,
          hour: h,
          joins,
          avgWaitSeconds,
          synthetic: true,
        });
      }
    }
  }

  // Insert in batches of 1000
  for (let i = 0; i < records.length; i += 1000) {
    const batch = records.slice(i, i + 1000);
    await db.demandHistory.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }
}

async function main() {
  if (process.argv.includes("--reset")) {
    await resetDemoData(prisma);
    await seedSyntheticDemand(prisma);
    console.log("Database wiped and demo data seeded.");
    return;
  }

  if ((await prisma.user.count()) > 0) {
    await seedSyntheticDemand(prisma);
    console.log("Database already has data. Ensured synthetic demand history.");
    return;
  }

  await seedDemoData(prisma);
  await seedSyntheticDemand(prisma);
  console.log("Demo data seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
