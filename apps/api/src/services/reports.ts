import type { RespondReportRequest } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { AppError, conflict, notFound } from "../lib/errors.js";
import { toReport } from "../lib/serialize.js";

export async function respondToReport(driverId: string, reportId: string, body: RespondReportRequest) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("report_not_found", "This report does not exist");
  if (report.driverId !== driverId) throw new AppError(403, "not_your_report", "This report is not about you");
  if (report.driverResponse) throw conflict("already_responded", "You already responded to this report");

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { driverResponse: body.response },
  });
  return { report: toReport(updated) };
}
