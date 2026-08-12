import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { initSockets } from "./sockets/index.js";

const httpServer = http.createServer(app);

initSockets(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Chatly server listening on ${env.serverUrl}`);
});
