import { randomInt } from "node:crypto";
import type { Role } from "@taxiflow/shared";
import { signToken } from "../src/lib/auth.js";
import { prisma } from "../src/lib/db.js";
import { env } from "../src/lib/env.js";
import { wipeDatabase } from "../src/services/seed.js";

export async function resetDatabase() {
  if (!process.env.TEST_DATABASE_URL || env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Refusing to wipe: the API is not connected to TEST_DATABASE_URL");
  }
  await wipeDatabase(prisma);
}

/** Area A and Area B with routes both ways. */
export async function createRoutes() {
  const areaA = await prisma.station.create({ data: { name: "Area A" } });
  const areaB = await prisma.station.create({ data: { name: "Area B" } });
  const aToB = await prisma.route.create({ data: { originId: areaA.id, destinationId: areaB.id } });
  const bToA = await prisma.route.create({ data: { originId: areaB.id, destinationId: areaA.id } });
  return { areaA, areaB, aToB, bToA };
}

export async function createUser(role: Role, name = `${role.toLowerCase()} user`) {
  const user = await prisma.user.create({
    data: {
      name,
      phone: `09${String(randomInt(0, 100_000_000)).padStart(8, "0")}`,
      passwordHash: "not-used-in-tests",
      role,
    },
  });
  return { user, token: signToken({ userId: user.id, role: user.role }) };
}

export const createPassenger = (name?: string) => createUser("PASSENGER", name);

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
