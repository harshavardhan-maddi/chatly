import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "Not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const message = issue ? issue.message : "Validation failed";
    return res.status(400).json({ error: message });
  }

  console.error("Server Error:", err);
  const message = err instanceof Error ? err.message : "Something went wrong";
  return res.status(500).json({ error: message });
}
