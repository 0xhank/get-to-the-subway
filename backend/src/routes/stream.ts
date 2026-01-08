// SSE endpoint for real-time train updates
// Broadcasts train data when it changes, heartbeat every 5 seconds

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { getTrains, getFeedStatuses } from "../transiter/poller.js";

// Heartbeat interval (5 seconds)
const HEARTBEAT_INTERVAL_MS = 5_000;

// Connected SSE clients
const clients = new Set<Response>();

// Broadcast train data to all connected clients
export function broadcastTrains(): void {
  const data = {
    type: "trains",
    data: {
      trains: getTrains(),
      feedStatuses: getFeedStatuses(),
      timestamp: Date.now(),
    },
  };

  const message = `event: trains\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }

  console.log(`Broadcast ${data.data.trains.length} trains to ${clients.size} clients`);
}

// Send heartbeat to all clients
function broadcastHeartbeat(): void {
  const data = {
    type: "heartbeat",
    data: {
      timestamp: Date.now(),
    },
  };

  const message = `event: heartbeat\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

// Start heartbeat interval
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(broadcastHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log("Started SSE heartbeat");
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Create the router
export function createStreamRouter(): Router {
  const router = createRouter();

  // SSE endpoint
  router.get("/api/trains/stream", (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Add to clients set
    clients.add(res);
    console.log(`SSE client connected (${clients.size} total)`);

    // Send initial data immediately
    const initialData = {
      type: "trains",
      data: {
        trains: getTrains(),
        feedStatuses: getFeedStatuses(),
        timestamp: Date.now(),
      },
    };
    res.write(`event: trains\ndata: ${JSON.stringify(initialData)}\n\n`);

    // Handle client disconnect
    req.on("close", () => {
      clients.delete(res);
      console.log(`SSE client disconnected (${clients.size} remaining)`);
    });
  });

  return router;
}

// Get number of connected clients
export function getClientCount(): number {
  return clients.size;
}
