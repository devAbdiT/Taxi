import type { ErrorCode } from "@taxiflow/shared";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (code: ErrorCode, message: string) => new AppError(400, code, message);
export const unauthorized = (message = "Log in to continue") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You are not allowed to do this") => new AppError(403, "forbidden", message);
export const notFound = (code: ErrorCode, message: string) => new AppError(404, code, message);
export const conflict = (code: ErrorCode, message: string) => new AppError(409, code, message);
