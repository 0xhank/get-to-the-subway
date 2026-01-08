// REST endpoint for subway route geometry

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesPath = join(__dirname, "../../data/routes.geojson");

// Cache the route data in memory (loaded once at startup)
let routesData: object | null = null;

function loadRoutesData(): object {
  if (!routesData) {
    const fileContent = readFileSync(routesPath, "utf-8");
    routesData = JSON.parse(fileContent) as object;
  }
  return routesData as object;
}

export function createRoutesRouter(): Router {
  const router = createRouter();

  // GET /api/routes - static route geometry
  router.get("/api/routes", (_req: Request, res: Response) => {
    try {
      const data = loadRoutesData();
      res.json(data);
    } catch (error) {
      console.error("Failed to load routes data:", error);
      res.status(500).json({ error: "Failed to load route data" });
    }
  });

  return router;
}
