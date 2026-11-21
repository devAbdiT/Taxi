import { execSync } from "node:child_process";

const ATTEMPTS = 3;

/** Brings the test database up to date with every migration before any test runs. */
export default function setup() {
  for (let attempt = 1; ; attempt++) {
    try {
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      });
      return;
    } catch (err) {
      // Hosted databases sometimes time out while waking up.
      if (attempt === ATTEMPTS) throw err;
      console.warn(`prisma migrate deploy failed (attempt ${attempt} of ${ATTEMPTS}), retrying`);
    }
  }
}
