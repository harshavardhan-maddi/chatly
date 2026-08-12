import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens.js";
import { ApiError } from "../utils/apiError.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
    }
  }
}

/**
 * Requires a valid access token. Reads from the HTTP-only cookie first,
 * falling back to an Authorization header for non-browser clients.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = req.cookies?.access_token ?? bearer;

    if (!token) {
      throw new ApiError(401, "Session expired");
    }

    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch {
    next(new ApiError(401, "Session expired"));
  }
}
