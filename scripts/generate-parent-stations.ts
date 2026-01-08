#!/usr/bin/env tsx
/**
 * Generate parent stations JSON from MTA GTFS static feed
 * Parses data/stops.txt and outputs parent stations (location_type = 1)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

interface StopRecord {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  location_type: string;
  parent_station: string;
}

interface ParentStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

async function generateParentStations() {
  try {
    const stopsPath = path.join(rootDir, "data", "stops.txt");
    const backendOutputPath = path.join(
      rootDir,
      "backend",
      "data",
      "parent-stations.json"
    );
    const frontendOutputPath = path.join(
      rootDir,
      "frontend",
      "public",
      "data",
      "parent-stations.json"
    );

    // Read stops.txt
    console.log("Reading stops.txt...");
    const stopsContent = await fs.readFile(stopsPath, "utf-8");

    // Parse CSV
    const result = Papa.parse<StopRecord>(stopsContent, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      console.error("CSV parse errors:", result.errors);
      process.exit(1);
    }

    // Filter for parent stations (location_type = "1")
    const parentStations: ParentStation[] = result.data
      .filter((row) => row.location_type === "1")
      .map((row) => ({
        id: row.stop_id,
        name: row.stop_name,
        latitude: parseFloat(row.stop_lat),
        longitude: parseFloat(row.stop_lon),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    console.log(`Found ${parentStations.length} parent stations`);

    // Write to backend data directory
    console.log(`Writing to ${backendOutputPath}...`);
    await fs.mkdir(path.dirname(backendOutputPath), { recursive: true });
    await fs.writeFile(
      backendOutputPath,
      JSON.stringify(parentStations, null, 2)
    );

    // Write to frontend public directory
    console.log(`Writing to ${frontendOutputPath}...`);
    await fs.mkdir(path.dirname(frontendOutputPath), { recursive: true });
    await fs.writeFile(
      frontendOutputPath,
      JSON.stringify(parentStations, null, 2)
    );

    console.log("✓ Parent stations generated successfully");
  } catch (error) {
    console.error("Error generating parent stations:", error);
    process.exit(1);
  }
}

generateParentStations();
