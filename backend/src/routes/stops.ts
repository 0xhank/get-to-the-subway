// REST endpoint for stop arrival information

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { fetchStopArrivals } from "../transiter/stops.js";
import type { StopArrivalsResponse } from "@live-subway/shared";

export function createStopsRouter(): Router {
  const router = createRouter();

  // GET /api/stops/:stopId/arrivals - arrival information for a specific stop
  router.get("/api/stops/:stopId/arrivals", async (req: Request, res: Response) => {
    const { stopId } = req.params;

    if (!stopId || typeof stopId !== "string") {
      res.status(400).json({ error: "Invalid stop ID" });
      return;
    }

    try {
      const arrivals = await fetchStopArrivals(stopId);

      if (!arrivals) {
        res.status(404).json({ error: "STOP_NOT_FOUND" });
        return;
      }

      const response: StopArrivalsResponse = arrivals;
      res.json(response);
    } catch (error) {
      console.error("Error fetching arrivals:", error);

      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: "TIMEOUT" });
      } else {
        res.status(503).json({ error: "SERVICE_UNAVAILABLE" });
      }
    }
  });

  return router;
}
