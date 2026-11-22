-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('LINE_JUMPING', 'PRIORITY_CLAIM', 'DRIVER_SKIPPED_TURN', 'FARE_DISPUTE', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ControllerActionType" AS ENUM ('WARN', 'MOVE_BACK', 'MOVE_FORWARD', 'CONFIRM_PRIORITY', 'REJECT_PRIORITY', 'MARK_NO_SHOW', 'REMOVE', 'SUSPEND', 'ALLOW_OUT_OF_TURN', 'REORDER_DRIVER', 'RESOLVE_DISPUTE', 'APPEAL_REVERSED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UPHELD', 'REVERSED');

-- CreateEnum
CREATE TYPE "DriverQueueStatus" AS ENUM ('WAITING', 'LOADING', 'DEPARTED', 'LEFT');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('OPEN', 'ACCEPTED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONTROLLER_ACTION';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'APPEAL_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'PICKUP_UPDATE';

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "priorityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortKey" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "synthetic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "waypoints" JSONB;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "type" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "againstUserId" TEXT,
    "queueEntryId" TEXT,
    "tripId" TEXT,
    "description" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControllerAction" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ControllerActionType" NOT NULL,
    "targetUserId" TEXT,
    "queueEntryId" TEXT,
    "driverQueueEntryId" TEXT,
    "disputeId" TEXT,
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControllerAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdByActionId" TEXT NOT NULL,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "actionId" TEXT,
    "disputeId" TEXT,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverQueueEntry" (
    "id" TEXT NOT NULL,
    "taxiId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "routeId" TEXT,
    "status" "DriverQueueStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortKey" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outOfTurnGrantedAt" TIMESTAMP(3),
    "startedOutOfTurn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DriverQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiLocation" (
    "id" TEXT NOT NULL,
    "taxiId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speedKmh" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxiLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeNote" TEXT,
    "seats" INTEGER NOT NULL,
    "status" "PickupStatus" NOT NULL DEFAULT 'OPEN',
    "acceptedTaxiId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelReason" TEXT,
    "notifiedDriverIds" TEXT[],
    "widenedAt" TIMESTAMP(3),

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandHistory" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "joins" INTEGER NOT NULL,
    "avgWaitSeconds" DOUBLE PRECISION,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DemandHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_stationId_status_createdAt_idx" ON "Dispute"("stationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ControllerAction_stationId_createdAt_idx" ON "ControllerAction"("stationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Suspension_createdByActionId_key" ON "Suspension"("createdByActionId");

-- CreateIndex
CREATE INDEX "Suspension_userId_endsAt_idx" ON "Suspension"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_actionId_key" ON "Appeal"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_disputeId_userId_key" ON "Appeal"("disputeId", "userId");

-- CreateIndex
CREATE INDEX "DriverQueueEntry_stationId_status_sortKey_idx" ON "DriverQueueEntry"("stationId", "status", "sortKey");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiLocation_taxiId_key" ON "TaxiLocation"("taxiId");

-- CreateIndex
CREATE INDEX "PickupRequest_status_expiresAt_idx" ON "PickupRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "DemandHistory_routeId_date_hour_idx" ON "DemandHistory"("routeId", "date", "hour");

-- CreateIndex
CREATE INDEX "QueueEntry_routeId_status_isPriority_sortKey_idx" ON "QueueEntry"("routeId", "status", "isPriority", "sortKey");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_againstUserId_fkey" FOREIGN KEY ("againstUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_driverQueueEntryId_fkey" FOREIGN KEY ("driverQueueEntryId") REFERENCES "DriverQueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControllerAction" ADD CONSTRAINT "ControllerAction_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_createdByActionId_fkey" FOREIGN KEY ("createdByActionId") REFERENCES "ControllerAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ControllerAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverQueueEntry" ADD CONSTRAINT "DriverQueueEntry_taxiId_fkey" FOREIGN KEY ("taxiId") REFERENCES "Taxi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverQueueEntry" ADD CONSTRAINT "DriverQueueEntry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverQueueEntry" ADD CONSTRAINT "DriverQueueEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverQueueEntry" ADD CONSTRAINT "DriverQueueEntry_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiLocation" ADD CONSTRAINT "TaxiLocation_taxiId_fkey" FOREIGN KEY ("taxiId") REFERENCES "Taxi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_acceptedTaxiId_fkey" FOREIGN KEY ("acceptedTaxiId") REFERENCES "Taxi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandHistory" ADD CONSTRAINT "DemandHistory_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written part (Prisma cannot express these).
-- ---------------------------------------------------------------------------

-- Queue order uses sortKey. Existing rows keep their joinedAt order.
UPDATE "QueueEntry" SET "sortKey" = "joinedAt";

-- New rows start with sortKey = joinedAt, wherever they are inserted from.
CREATE FUNCTION queue_entry_default_sort_key() RETURNS trigger AS $$
BEGIN
  NEW."sortKey" := NEW."joinedAt";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_entry_sort_key_default
  BEFORE INSERT ON "QueueEntry"
  FOR EACH ROW EXECUTE FUNCTION queue_entry_default_sort_key();

-- A taxi has at most one active place in the driver line.
CREATE UNIQUE INDEX "one_active_driver_queue_entry"
  ON "DriverQueueEntry" ("taxiId")
  WHERE "status" IN ('WAITING', 'LOADING');

-- A passenger has at most one live pickup request.
CREATE UNIQUE INDEX "one_live_pickup_request"
  ON "PickupRequest" ("passengerId")
  WHERE "status" IN ('OPEN', 'ACCEPTED', 'ARRIVED');

-- The audit log is append-only. Nothing may change or remove a row.
-- (TRUNCATE is not blocked on purpose: the demo reset and the tests wipe the database with it.)
CREATE FUNCTION controller_action_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ControllerAction is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER controller_action_no_change
  BEFORE UPDATE OR DELETE ON "ControllerAction"
  FOR EACH ROW EXECUTE FUNCTION controller_action_append_only();
