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
