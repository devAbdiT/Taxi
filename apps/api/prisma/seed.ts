import { prisma } from "../src/lib/db.js";
import { resetDemoData, seedDemoData } from "../src/services/seed.js";

async function main() {
  if (process.argv.includes("--reset")) {
    await resetDemoData(prisma);
    console.log("Database wiped and demo data seeded.");
    return;
  }

  if ((await prisma.user.count()) > 0) {
    console.log("Database already has data. Run `npm run seed -- --reset` to wipe and reseed.");
    return;
  }

  await seedDemoData(prisma);
  console.log("Demo data seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
