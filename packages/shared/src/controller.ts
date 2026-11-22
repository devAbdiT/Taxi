import { z } from "zod";
import { Id, IsoDate } from "./common.js";
import {
  AppealStatus,
  AssistanceType,
  ControllerActionType,
  DisputeStatus,
  DisputeType,
  DriverQueueStatus,
  QueueStatus,
  TaxiStatus,
} from "./enums.js";
import { RouteSummary, Station } from "./models.js";

/** A reason is always written down: 10 to 500 characters. */
export const Reason = z.string().trim().min(10).max(500);

/** How long a person has to appeal a controller decision. */
export const APPEAL_WINDOW_HOURS = 48;

// ---------------------------------------------------------------------------
// Driver line (turn order at a station)
// ---------------------------------------------------------------------------

/** POST /driver/queue/join. The line is per station; routeId is only a hint about where the driver is heading. */
export const JoinDriverQueueRequest = z.object({
  routeId: Id.optional(),
});
export type JoinDriverQueueRequest = z.input<typeof JoinDriverQueueRequest>;

export const DriverLineEntry = z.object({
  id: z.string(),
  plate: z.string(),
  driverFirstName: z.string(),
  status: DriverQueueStatus,
  /** 1-based rank among WAITING drivers. Null once the driver is loading or gone. */
  position: z.number().int().nullable(),
  /** True for the signed-in driver's own place. Always false in the controller's view. */
  isMe: z.boolean(),
  /** A controller allowed this driver to start once out of turn. */
  outOfTurnAllowed: z.boolean(),
});
export type DriverLineEntry = z.infer<typeof DriverLineEntry>;

/** GET /driver/queue, and the response of join and leave. */
export const DriverQueueResponse = z.object({
  station: Station.nullable(),
  /** DRIVER_TURN_ORDER_ENFORCED. When false the line is only informational. */
  enforced: z.boolean(),
  mine: DriverLineEntry.nullable(),
  line: z.array(DriverLineEntry),
  /** True when this driver may start loading now. */
  canStart: z.boolean(),
});
export type DriverQueueResponse = z.infer<typeof DriverQueueResponse>;

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export const CreateDisputeRequest = z.object({
  type: DisputeType,
  description: z.string().trim().min(10).max(500),
  againstUserId: Id.optional(),
  queueEntryId: Id.optional(),
  tripId: Id.optional(),
});
export type CreateDisputeRequest = z.input<typeof CreateDisputeRequest>;

export const DisputeLinkedEntry = z.object({
  id: z.string(),
  route: RouteSummary,
  status: QueueStatus,
  position: z.number().int().nullable(),
  isPriority: z.boolean(),
  firstName: z.string(),
  waitingMinutes: z.number().int(),
});
export type DisputeLinkedEntry = z.infer<typeof DisputeLinkedEntry>;

/** A dispute with first names only. Never a phone number. */
export const Dispute = z.object({
  id: z.string(),
  stationId: z.string(),
  stationName: z.string(),
  type: DisputeType,
  status: DisputeStatus,
  description: z.string(),
  openedByFirstName: z.string(),
  openedByIsPriority: z.boolean(),
  againstFirstName: z.string().nullable(),
  queueEntryId: z.string().nullable(),
  tripId: z.string().nullable(),
  entry: DisputeLinkedEntry.nullable(),
  resolutionNote: z.string().nullable(),
  /** The reason on the controller action that resolved it. */
  controllerReason: z.string().nullable(),
  resolutionActionId: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  resolvedAt: IsoDate.nullable(),
  /** Minutes since it was opened. */
  waitingMinutes: z.number().int(),
  /** True for the opener of a RESOLVED dispute inside the 48 hour window and without an appeal. */
  canAppeal: z.boolean(),
});
export type Dispute = z.infer<typeof Dispute>;

export const CreateDisputeResponse = z.object({ dispute: Dispute });
export type CreateDisputeResponse = z.infer<typeof CreateDisputeResponse>;

export const DisputesResponse = z.object({ disputes: z.array(Dispute) });
export type DisputesResponse = z.infer<typeof DisputesResponse>;

/** GET /station/disputes?status= */
export const StationDisputesQuery = z.object({ status: DisputeStatus.optional() });
export type StationDisputesQuery = z.input<typeof StationDisputesQuery>;

/** PATCH /station/disputes/:id. RESOLVED needs a note. */
export const UpdateDisputeRequest = z
  .object({
    status: z.enum(["IN_REVIEW", "RESOLVED"]),
    resolutionNote: Reason.optional(),
  })
  .refine((body) => body.status !== "RESOLVED" || body.resolutionNote !== undefined, {
    message: "Write a resolution note of at least 10 characters",
    path: ["resolutionNote"],
  });
export type UpdateDisputeRequest = z.input<typeof UpdateDisputeRequest>;

export const UpdateDisputeResponse = z.object({ dispute: Dispute });
export type UpdateDisputeResponse = z.infer<typeof UpdateDisputeResponse>;

// ---------------------------------------------------------------------------
// Controller actions and the audit log
// ---------------------------------------------------------------------------

/** Actions a controller may start through POST /station/actions. */
export const CONTROLLER_REQUEST_ACTIONS = [
  "WARN",
  "MOVE_BACK",
  "MOVE_FORWARD",
  "CONFIRM_PRIORITY",
  "REJECT_PRIORITY",
  "MARK_NO_SHOW",
  "REMOVE",
  "SUSPEND",
  "ALLOW_OUT_OF_TURN",
  "REORDER_DRIVER",
] as const satisfies readonly ControllerActionType[];

export const StationActionRequest = z
  .object({
    action: z.enum(CONTROLLER_REQUEST_ACTIONS),
    reason: Reason,
    queueEntryId: Id.optional(),
    driverQueueEntryId: Id.optional(),
    targetUserId: Id.optional(),
    disputeId: Id.optional(),
    /** SUSPEND only: 5 to 1440 minutes. */
    minutes: z.number().int().min(5).max(1440).optional(),
    /** MOVE_BACK, MOVE_FORWARD and REORDER_DRIVER: 1 to 10 places. Default 1. */
    positions: z.number().int().min(1).max(10).optional(),
    /** REORDER_DRIVER only. */
    direction: z.enum(["EARLIER", "LATER"]).optional(),
  })
  .superRefine((body, ctx) => {
    const need = (field: "queueEntryId" | "driverQueueEntryId") => {
      if (!body[field]) ctx.addIssue({ code: "custom", message: `${field} is required for ${body.action}`, path: [field] });
    };
    switch (body.action) {
      case "WARN":
        if (!body.queueEntryId && !body.driverQueueEntryId && !body.targetUserId) {
          ctx.addIssue({ code: "custom", message: "Choose who to warn", path: ["queueEntryId"] });
        }
        break;
      case "SUSPEND":
        if (!body.queueEntryId && !body.targetUserId && !body.driverQueueEntryId) {
          ctx.addIssue({ code: "custom", message: "Choose who to suspend", path: ["queueEntryId"] });
        }
        if (body.minutes === undefined) ctx.addIssue({ code: "custom", message: "minutes is required for SUSPEND", path: ["minutes"] });
        break;
      case "ALLOW_OUT_OF_TURN":
      case "REORDER_DRIVER":
        need("driverQueueEntryId");
        break;
      default:
        need("queueEntryId");
    }
  });
export type StationActionRequest = z.input<typeof StationActionRequest>;

export const ControllerActionView = z.object({
  id: z.string(),
  stationId: z.string(),
  stationName: z.string(),
  actorFirstName: z.string(),
  action: ControllerActionType,
  targetFirstName: z.string().nullable(),
  queueEntryId: z.string().nullable(),
  driverQueueEntryId: z.string().nullable(),
  disputeId: z.string().nullable(),
  reason: z.string(),
  /** Safe extra facts such as positions moved or suspension minutes. */
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDate,
});
export type ControllerActionView = z.infer<typeof ControllerActionView>;

export const StationActionResponse = z.object({ action: ControllerActionView });
export type StationActionResponse = z.infer<typeof StationActionResponse>;

/** GET /station/audit-log and GET /admin/audit-log. Newest first. Read only. */
export const AuditLogQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: Id.optional(),
  stationId: Id.optional(),
  actorId: Id.optional(),
  action: ControllerActionType.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AuditLogQuery = z.input<typeof AuditLogQuery>;

export const AuditLogResponse = z.object({
  actions: z.array(ControllerActionView),
  nextCursor: z.string().nullable(),
});
export type AuditLogResponse = z.infer<typeof AuditLogResponse>;

/** An action as the affected person sees it (GET /actions/mine). */
export const MyActionView = ControllerActionView.extend({
  canAppealUntil: IsoDate,
  canAppeal: z.boolean(),
  appealStatus: AppealStatus.nullable(),
});
export type MyActionView = z.infer<typeof MyActionView>;

export const MyActionsResponse = z.object({ actions: z.array(MyActionView) });
export type MyActionsResponse = z.infer<typeof MyActionsResponse>;

export const MySuspensionResponse = z.object({
  suspension: z
    .object({
      stationName: z.string(),
      reason: z.string(),
      startsAt: IsoDate,
      endsAt: IsoDate,
    })
    .nullable(),
});
export type MySuspensionResponse = z.infer<typeof MySuspensionResponse>;

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

export const CreateAppealRequest = z
  .object({
    actionId: Id.optional(),
    disputeId: Id.optional(),
    reason: Reason,
  })
  .refine((body) => (body.actionId === undefined) !== (body.disputeId === undefined), {
    message: "Appeal either an action or a dispute",
    path: ["actionId"],
  });
export type CreateAppealRequest = z.input<typeof CreateAppealRequest>;

export const AppealView = z.object({
  id: z.string(),
  status: AppealStatus,
  reason: z.string(),
  adminNote: z.string().nullable(),
  appellantFirstName: z.string(),
  createdAt: IsoDate,
  decidedAt: IsoDate.nullable(),
  action: ControllerActionView.nullable(),
  disputeId: z.string().nullable(),
});
export type AppealView = z.infer<typeof AppealView>;

export const CreateAppealResponse = z.object({ appeal: AppealView });
export type CreateAppealResponse = z.infer<typeof CreateAppealResponse>;

export const AppealsResponse = z.object({ appeals: z.array(AppealView) });
export type AppealsResponse = z.infer<typeof AppealsResponse>;

export const AdminAppealsQuery = z.object({ status: AppealStatus.optional() });
export type AdminAppealsQuery = z.input<typeof AdminAppealsQuery>;

export const DecideAppealRequest = z.object({
  status: z.enum(["UPHELD", "REVERSED"]),
  adminNote: Reason,
});
export type DecideAppealRequest = z.input<typeof DecideAppealRequest>;

export const DecideAppealResponse = z.object({ appeal: AppealView });
export type DecideAppealResponse = z.infer<typeof DecideAppealResponse>;

// ---------------------------------------------------------------------------
// Fairness alerts (rules, not machine learning)
// ---------------------------------------------------------------------------

export const FairnessAlert = z.object({
  id: z.string(),
  type: z.enum(["LONG_WAIT", "REPEAT_REJOIN", "PRIORITY_SHARE", "OUT_OF_TURN_START", "DISPUTE_OPEN_LONG"]),
  severity: z.enum(["info", "warning"]),
  message: z.string(),
  target: z.object({ kind: z.enum(["entry", "driver", "dispute", "station"]), id: z.string() }).nullable(),
});
export type FairnessAlert = z.infer<typeof FairnessAlert>;

export const AlertsResponse = z.object({
  alerts: z.array(FairnessAlert),
  method: z.literal("rules"),
});
export type AlertsResponse = z.infer<typeof AlertsResponse>;

// ---------------------------------------------------------------------------
// Control desk (one call for the whole screen)
// ---------------------------------------------------------------------------

export const DeskEntry = z.object({
  id: z.string(),
  firstName: z.string(),
  isPriority: z.boolean(),
  priorityVerified: z.boolean(),
  assistance: AssistanceType,
  status: QueueStatus,
  position: z.number().int().nullable(),
  joinedAt: IsoDate,
  waitingMinutes: z.number().int(),
  tripId: z.string().nullable(),
});
export type DeskEntry = z.infer<typeof DeskEntry>;

export const DeskRoute = z.object({
  route: RouteSummary,
  waiting: z.number().int(),
  priorityWaiting: z.number().int(),
  entries: z.array(DeskEntry),
});
export type DeskRoute = z.infer<typeof DeskRoute>;

export const DeskTaxi = z.object({
  id: z.string(),
  plate: z.string(),
  status: TaxiStatus,
});

/** GET /station/desk. Admin may pass ?stationId=. */
export const StationDeskResponse = z.object({
  station: Station,
  routes: z.array(DeskRoute),
  driverLine: z.array(DriverLineEntry),
  counts: z.object({
    waiting: z.number().int(),
    priority: z.number().int(),
    openDisputes: z.number().int(),
    alerts: z.number().int(),
  }),
});
export type StationDeskResponse = z.infer<typeof StationDeskResponse>;
