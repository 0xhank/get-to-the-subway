import express from "express";
import cors from "cors";

import { createStreamRouter, broadcastTrains, startHeartbeat } from "./routes/stream.js";
import { createTrainsRouter } from "./routes/trains.js";
import { createStatusRouter } from "./routes/status.js";
import { createStopsRouter } from "./routes/stops.js";
import { startPolling, setOnDataChanged } from "./transiter/poller.js";

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Routes
app.use(createStreamRouter());
app.use(createTrainsRouter());
app.use(createStatusRouter());
app.use(createStopsRouter());

// Wire up data change callback to broadcast SSE
setOnDataChanged(broadcastTrains);

// Start server
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Transiter URL: ${process.env.TRANSITER_URL || "http://localhost:8080"}`);

  // Start heartbeat for SSE clients
  startHeartbeat();

  // Start polling Transiter
  await startPolling();
});
