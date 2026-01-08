#!/usr/bin/env tsx
/**
 * Generate route paths GeoJSON from MTA GTFS static feed
 * Downloads shapes.txt and trips.txt, processes them, and outputs data/routes.geojson
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";
import AdmZip from "adm-zip";
import { simplify, lineString } from "@turf/turf";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// Type definitions
interface ShapePoint {
  shape_id: string;
  shape_pt_lat: string;
  shape_pt_lon: string;
  shape_pt_sequence: string;
}

interface Trip {
  trip_id: string;
  route_id: string;
  shape_id: string;
  direction_id: string;
}

interface RouteShape {
  routeId: string;
  direction: string;
  coordinates: [number, number][];
}

// Helper to download file
function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          reject(new Error("Downloaded file is empty"));
        } else {
          resolve(buffer);
        }
      });
      response.on("error", reject);
    }).on("error", reject);
  });
}

// Helper to parse CSV
function parseCSV<T>(csvText: string): T[] {
  const results: T[] = [];
  const lines = csvText.split("\n");

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim());

  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic cases)
    const values = line.split(",").map((v) => v.trim());
    const row: any = {};

    for (let j = 0; j < header.length && j < values.length; j++) {
      row[header[j]] = values[j];
    }

    // Filter out incomplete rows
    if (row.shape_id || row.trip_id) {
      results.push(row);
    }
  }

  return results;
}

// MTA color mapping (must match frontend/src/lib/mta-colors.ts)
const MTA_COLORS: Record<string, string> = {
  A: "#7ba3d4",
  C: "#7ba3d4",
  E: "#7ba3d4",
  B: "#f4a683",
  D: "#f4a683",
  F: "#f4a683",
  M: "#f4a683",
  G: "#8ed4a0",
  J: "#c9a87c",
  Z: "#c9a87c",
  L: "#b8bcc4",
  N: "#e8d07a",
  Q: "#e8d07a",
  R: "#e8d07a",
  W: "#e8d07a",
  "1": "#e88a87",
  "2": "#e88a87",
  "3": "#e88a87",
  "4": "#6bb87f",
  "5": "#6bb87f",
  "6": "#6bb87f",
  "7": "#c78ac5",
  S: "#a8aaad",
  SIR: "#7ba3d4",
};

function getLineColor(line: string): string {
  return MTA_COLORS[line.toUpperCase()] ?? "#808183";
}

function getDesaturatedLineColor(line: string): string {
  const baseColor = getLineColor(line);

  // Parse hex color to RGB
  const hex = baseColor.substring(1);
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Apply desaturation: reduce saturation by 40%, lightness by 30%
  s = Math.max(0, s - 0.4);
  const newL = Math.max(0.2, l - 0.3);

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let newR, newG, newB;

  if (s === 0) {
    newR = newG = newB = newL;
  } else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    newR = hue2rgb(p, q, h + 1 / 3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

async function main() {
  console.log("🚇 Generating NYC subway route paths GeoJSON...\n");

  try {
    // Step 1: Download GTFS
    console.log("📥 Downloading MTA GTFS static feed...");
    const gtfsUrl =
      "http://web.mta.info/developers/data/nyct/subway/google_transit.zip";
    const gtfsBuffer = await downloadFile(gtfsUrl);
    console.log(`✓ Downloaded ${(gtfsBuffer.length / 1024 / 1024).toFixed(2)}MB\n`);

    // Step 2: Extract files
    console.log("📦 Extracting GTFS files...");
    const zip = new AdmZip(gtfsBuffer);
    const shapesEntry = zip.getEntry("shapes.txt");
    const tripsEntry = zip.getEntry("trips.txt");

    if (!shapesEntry || !tripsEntry) {
      throw new Error("shapes.txt or trips.txt not found in GTFS");
    }

    const shapesText = shapesEntry.getData().toString("utf8");
    const tripsText = tripsEntry.getData().toString("utf8");
    console.log("✓ Extracted shapes.txt and trips.txt\n");

    // Step 3: Parse CSV
    console.log("🔍 Parsing GTFS data...");
    const shapes = parseCSV<ShapePoint>(shapesText);
    const trips = parseCSV<Trip>(tripsText);
    console.log(`✓ Parsed ${shapes.length} shape points and ${trips.length} trips\n`);

    // Step 4: Build mappings
    console.log("🗺️  Building shape → route-direction mappings...");
    const shapeIdToRoute = new Map<string, { routeId: string; direction: string }>();

    for (const trip of trips) {
      if (trip.shape_id && trip.route_id) {
        const direction = trip.direction_id === "0" ? "N" : "S";
        shapeIdToRoute.set(trip.shape_id, {
          routeId: trip.route_id,
          direction,
        });
      }
    }
    console.log(`✓ Mapped ${shapeIdToRoute.size} unique shape IDs\n`);

    // Step 5: Group shape points by route-direction
    console.log("🔀 Grouping shape points by route-direction...");
    const routeShapes = new Map<string, RouteShape>();

    for (const shape of shapes) {
      const mapping = shapeIdToRoute.get(shape.shape_id);
      if (!mapping) continue;

      const key = `${mapping.routeId}-${mapping.direction}`;
      if (!routeShapes.has(key)) {
        routeShapes.set(key, {
          routeId: mapping.routeId,
          direction: mapping.direction,
          coordinates: [],
        });
      }

      const route = routeShapes.get(key)!;
      route.coordinates.push([
        parseFloat(shape.shape_pt_lon),
        parseFloat(shape.shape_pt_lat),
      ]);
    }

    // GTFS shapes are already ordered by sequence in the source data, no need to sort
    console.log(`✓ Created ${routeShapes.size} route-direction shapes\n`);

    // Step 6: Simplify and create GeoJSON features
    console.log("📐 Simplifying geometries...");
    const features = Array.from(routeShapes.entries()).map(([key, route]) => {
      try {
        // Create LineString
        const line = lineString(route.coordinates);

        // Simplify with tolerance of 0.0005° (~50m)
        const simplified = simplify(line, { tolerance: 0.0005, highQuality: false });

        // Extract simplified coordinates
        const coords = (simplified.geometry as any).coordinates;

        // Get desaturated color
        const color = getDesaturatedLineColor(route.routeId);

        return {
          type: "Feature" as const,
          id: key,
          geometry: {
            type: "LineString" as const,
            coordinates: coords,
          },
          properties: {
            line: route.routeId,
            direction: route.direction,
            routeId: key,
            color,
          },
        };
      } catch (error) {
        console.error(`Failed to simplify route ${key}:`, error);
        return null;
      }
    }).filter(Boolean);

    console.log(`✓ Simplified ${features.length} features\n`);

    // Step 7: Create FeatureCollection
    console.log("📦 Creating GeoJSON FeatureCollection...");
    const geojson = {
      type: "FeatureCollection" as const,
      features,
    };

    // Step 8: Write output
    const outputPath = path.join(rootDir, "data", "routes.geojson");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(geojson, null, 2));

    const fileSize = (await fs.stat(outputPath)).size;
    console.log(`✓ Wrote ${features.length} features to ${outputPath}`);
    console.log(`  File size: ${(fileSize / 1024).toFixed(2)}KB uncompressed\n`);

    // Final summary
    console.log("✅ Done! Route paths GeoJSON generated successfully.");
    console.log(`\nSummary:`);
    console.log(`- Total routes: ${features.length}`);
    console.log(`- Sample routes: ${features.slice(0, 3).map((f) => f.id).join(", ")}`);
    console.log(
      `- Coordinate precision: ~${(fileSize / features.length).toFixed(0)}B per route`
    );
  } catch (error) {
    console.error("❌ Error generating routes:", error);
    process.exit(1);
  }
}

main();
