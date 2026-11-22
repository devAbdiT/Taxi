import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ErrorResponse } from "@taxiflow/shared";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorResponse = { error: "not_found", message: `No endpoint for ${req.method} ${req.path}` };
  res.status(404).json(body);
};

/** Body-parser errors carry an HTTP status and a `type` string. */
function isHttpError(err: unknown): err is { status: number; type?: string } {
  return typeof err === "object" && err !== null && typeof (err as { status?: unknown }).status === "number";
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ErrorResponse = { error: "internal_error", message: "Something went wrong. Please try again." };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: err.code, message: err.message, ...err.extra };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: "validation_error",
      message: "Some fields are missing or invalid",
      details: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  } else if (isHttpError(err) && err.type === "entity.parse.failed") {
    status = 400;
    body = { error: "invalid_json", message: "The request body is not valid JSON" };
  } else if (isHttpError(err) && err.status >= 400 && err.status < 500) {
    status = err.status;
    body = { error: "validation_error", message: err instanceof Error ? err.message : "Bad request" };
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(body);
};
