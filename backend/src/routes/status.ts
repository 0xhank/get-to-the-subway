// Health and status endpoints

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { getTrains, getFeedStatuses } from "../transiter/poller.js";
import { getClientCount } from "./stream.js";

export function createStatusRouter(): Router {
  const router = createRouter();

  // GET /health - simple health check
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
    });
  });

  // GET /api/status - detailed status
  router.get("/api/status", (_req: Request, res: Response) => {
    const feedStatuses = getFeedStatuses();
    const trains = getTrains();

    // Calculate overall health
    const isHealthy = feedStatuses.every((f) => f.isHealthy);

    res.json({
      feeds: feedStatuses,
      overallHealth: isHealthy ? "healthy" : "unhealthy",
      sseClients: getClientCount(),
      trainCount: trains.length,
      timestamp: Date.now(),
    });
  });

  return router;
}
