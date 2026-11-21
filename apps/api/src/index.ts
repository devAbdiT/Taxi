import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { initSocket } from "./realtime/socket.js";

const server = createServer(createApp());
initSocket(server);

server.listen(env.PORT, () => {
  console.log(`TaxiFlow API listening on http://localhost:${env.PORT} (demo mode: ${env.DEMO_MODE})`);
});
