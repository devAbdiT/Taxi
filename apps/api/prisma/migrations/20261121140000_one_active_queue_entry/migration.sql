-- Hand-written: Prisma cannot express a partial unique index.
-- A passenger has at most one active queue entry (WAITING or CALLED).
CREATE UNIQUE INDEX "one_active_queue_entry"
  ON "QueueEntry" ("passengerId")
  WHERE "status" IN ('WAITING', 'CALLED');
