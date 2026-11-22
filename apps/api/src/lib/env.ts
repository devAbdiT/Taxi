import { existsSync } from "node:fs";
import { z } from "zod";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(4000),
  DEMO_MODE: booleanString.default(false),
  PRIORITY_ENABLED: booleanString.default(true),
  // Advanced features (see docs/FEATURES_RULES.md).
  PICKUP_RADIUS_KM: z.coerce.number().positive().default(3),
  PICKUP_EXPIRY_MINUTES: z.coerce.number().positive().default(10),
  LOCATION_STALE_SECONDS: z.coerce.number().positive().default(60),
  DRIVER_TURN_ORDER_ENFORCED: booleanString.default(true),
  DEMO_SIMULATE_GPS: booleanString.default(true),
  AI_PROVIDER: z.string().default("none"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables (see apps/api/.env.example):");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
};
