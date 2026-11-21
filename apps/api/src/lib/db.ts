import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  // Hosted databases can take several seconds to open a connection.
  transactionOptions: { maxWait: 20_000, timeout: 60_000 },
});

export type Db = typeof prisma;
