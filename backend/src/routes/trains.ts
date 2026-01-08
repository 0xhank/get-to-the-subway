// REST endpoint for train data (fallback for non-SSE clients)

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { getTrains, getFeedStatuses } from "../transiter/poller.js";
import type { TrainsResponse } from "@live-subway/shared";

export function createTrainsRouter(): Router {
  const router = createRouter();

  // GET /api/trains - current train positions
  router.get("/api/trains", (_req: Request, res: Response) => {
    const response: TrainsResponse = {
      trains: getTrains(),
      feedStatuses: getFeedStatuses(),
      timestamp: Date.now(),
    };

    res.json(response);
  });

  return router;
}
