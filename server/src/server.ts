import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { initSockets } from "./sockets/index.js";

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// Global baseline rate limit; auth routes layer stricter limits on top.
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

initSockets(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Chatly server listening on ${env.serverUrl}`);
});
