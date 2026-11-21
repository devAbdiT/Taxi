import type { CreateContractRequest } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { toContract } from "../lib/serialize.js";

export async function createContract(requesterId: string, body: CreateContractRequest) {
  const notes = body.notes && body.notes.length > 0 ? body.notes : null;
  const row = await prisma.contractRequest.create({
    data: {
      requesterId,
      type: body.type,
      pickup: body.pickup,
      destination: body.destination,
      schedule: body.schedule,
      passengerCount: body.passengerCount,
      notes,
    },
  });
  return { request: toContract(row) };
}
