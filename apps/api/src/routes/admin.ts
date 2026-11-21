import { Router } from "express";
import { AdminReportsQuery, Id, UpdateReportRequest } from "@taxiflow/shared";
import { getAdminStats, listAdminReports, updateAdminReport } from "../services/admin.js";

export const adminRouter = Router();

function param(value: string | string[]): string {
  return Id.parse(Array.isArray(value) ? value[0] : value);
}

adminRouter.get("/admin/stats", async (_req, res) => {
  res.json(await getAdminStats());
});

adminRouter.get("/admin/reports", async (req, res) => {
  const query = AdminReportsQuery.parse({ status: req.query.status });
  res.json(await listAdminReports(query));
});

adminRouter.patch("/admin/reports/:id", async (req, res) => {
  res.json(await updateAdminReport(param(req.params.id), UpdateReportRequest.parse(req.body)));
});
