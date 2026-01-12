// ESP32 departure display endpoint
// Returns pre-calculated "leave by" times for configured stations

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { fetchStopArrivals } from "../transiter/stops.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Station configuration from environment variables
// Direction: N = northbound, S = southbound
// Walk time in seconds for precise control

interface StationConfig {
  line: string;
  stopId: string;
  direction: "N" | "S";
  walkSeconds: number;
}

function getStationConfigs(): StationConfig[] {
  return [
    {
      // L train at Lorimer St (toward 8 Av)
      line: "L",
      stopId: process.env.ESP32_L_STOP_ID || "L10",
      direction: (process.env.ESP32_L_DIRECTION || "S") as "N" | "S",
      walkSeconds: parseInt(process.env.ESP32_L_WALK_SECONDS || "300", 10),
    },
    {
      // G train at Metropolitan Av (toward Church Ave)
      line: "G",
      stopId: process.env.ESP32_G_STOP_ID || "G29",
      direction: (process.env.ESP32_G_DIRECTION || "S") as "N" | "S",
      walkSeconds: parseInt(process.env.ESP32_G_WALK_SECONDS || "300", 10),
    },
    {
      // M train at Marcy Av (toward Manhattan)
      line: "M",
      stopId: process.env.ESP32_MJ_STOP_ID || "M16",
      direction: (process.env.ESP32_MJ_DIRECTION || "S") as "N" | "S",
      walkSeconds: parseInt(process.env.ESP32_MJ_WALK_SECONDS || "300", 10),
    },
    {
      // J train at Marcy Av (toward Manhattan)
      line: "J",
      stopId: process.env.ESP32_MJ_STOP_ID || "M16",
      direction: (process.env.ESP32_MJ_DIRECTION || "S") as "N" | "S",
      walkSeconds: parseInt(process.env.ESP32_MJ_WALK_SECONDS || "300", 10),
    },
  ];
}

// =============================================================================
// TYPES
// =============================================================================

interface ESP32StationData {
  line: string;
  arrivalTime: number | null;    // Unix timestamp (seconds) when train arrives
  leaveByTime: number | null;    // Unix timestamp (seconds) when to leave apartment
  status: "normal" | "leave_now" | "run" | "none";
}

interface ESP32Response {
  timestamp: number;             // Current time (seconds)
  stations: ESP32StationData[];
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export function createESP32Router(): Router {
  const router = createRouter();

  // GET /api/esp32/departures - optimized endpoint for ESP32 display
  router.get("/api/esp32/departures", async (_req: Request, res: Response) => {
    const now = Math.floor(Date.now() / 1000);
    const configs = getStationConfigs();

    try {
      // Fetch arrivals for all unique stops in parallel
      const uniqueStopIds = [...new Set(configs.map(c => c.stopId))];
      const arrivalPromises = uniqueStopIds.map(stopId => fetchStopArrivals(stopId));
      const arrivalResults = await Promise.all(arrivalPromises);

      // Create a map of stopId -> arrivals response
      const arrivalsMap = new Map<string, Awaited<ReturnType<typeof fetchStopArrivals>>>();
      uniqueStopIds.forEach((stopId, index) => {
        arrivalsMap.set(stopId, arrivalResults[index]);
      });

      // Process each station config
      const stations: ESP32StationData[] = configs.map(config => {
        const arrivals = arrivalsMap.get(config.stopId);

        if (!arrivals) {
          return {
            line: config.line,
            arrivalTime: null,
            leaveByTime: null,
            status: "none" as const,
          };
        }

        // Get arrivals for the configured direction
        const directionArrivals = config.direction === "N"
          ? arrivals.stop.northArrivals
          : arrivals.stop.southArrivals;

        // Filter to only this line's trains
        const lineArrivals = directionArrivals.filter(a => a.routeId === config.line);

        if (lineArrivals.length === 0) {
          return {
            line: config.line,
            arrivalTime: null,
            leaveByTime: null,
            status: "none" as const,
          };
        }

        // Get the soonest arrival
        const nextArrival = lineArrivals[0]; // Already sorted by time
        const arrivalTime = nextArrival.arrivalTime;
        const walkSeconds = config.walkSeconds;
        const leaveByTime = arrivalTime - walkSeconds;

        // Calculate status based on leave-by time
        // <= -10 seconds: too late (show next train)
        // -10 to 5 seconds: RUN!
        // 5 to 30 seconds: LEAVE NOW
        // > 30 seconds: normal countdown (displayed offset by 30s)
        const secondsUntilLeave = leaveByTime - now;
        let status: "normal" | "leave_now" | "run" | "none";

        if (secondsUntilLeave <= -10) {
          // More than 10 seconds past - find next train
          status = "none";
        } else if (secondsUntilLeave <= 5) {
          status = "run";
        } else if (secondsUntilLeave <= 30) {
          status = "leave_now";
        } else {
          status = "normal";
        }

        // If missed, try to get the next train
        if (status === "none" && lineArrivals.length > 1) {
          const nextNextArrival = lineArrivals[1];
          const nextArrivalTime = nextNextArrival.arrivalTime;
          const nextLeaveByTime = nextArrivalTime - walkSeconds;
          const nextSecondsUntilLeave = nextLeaveByTime - now;

          if (nextSecondsUntilLeave > -10) {
            let nextStatus: "normal" | "leave_now" | "run";
            if (nextSecondsUntilLeave <= 5) {
              nextStatus = "run";
            } else if (nextSecondsUntilLeave <= 30) {
              nextStatus = "leave_now";
            } else {
              nextStatus = "normal";
            }
            return {
              line: config.line,
              arrivalTime: nextArrivalTime,
              leaveByTime: nextLeaveByTime,
              status: nextStatus,
            };
          }
        }

        if (status === "none") {
          return {
            line: config.line,
            arrivalTime: null,
            leaveByTime: null,
            status: "none" as const,
          };
        }

        return {
          line: config.line,
          arrivalTime,
          leaveByTime,
          status,
        };
      });

      const response: ESP32Response = {
        timestamp: now,
        stations,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in ESP32 endpoint:", error);
      res.status(503).json({ error: "SERVICE_UNAVAILABLE" });
    }
  });

  // GET /api/esp32/config - returns current configuration (for debugging)
  router.get("/api/esp32/config", (_req: Request, res: Response) => {
    const configs = getStationConfigs();
    res.json({
      stations: configs.map(c => ({
        line: c.line,
        stopId: c.stopId,
        direction: c.direction,
        walkSeconds: c.walkSeconds,
      })),
    });
  });

  return router;
}
