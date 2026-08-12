import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "Not found"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Never leak internals (stack traces, DB errors, etc.) to the client.
  console.error(err);
  const message = env.nodeEnv === "development" && err instanceof Error ? err.message : "Something went wrong";
  return res.status(500).json({ error: message });
}
