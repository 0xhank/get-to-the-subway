#!/usr/bin/env tsx
/**
 * Process detailed NYC Subway GeoJSON into clean route paths
 * Reads Subway_view_5083976324868604013.geojson (5800 segments) and outputs merged routes
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, LineString, MultiLineString } from "@turf/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// Map LINE names to MTA line identifiers for coloring
const LINE_TO_MTA: Record<string, string> = {
  "BROADWAY/7TH AVE LINE": "1",
  "LENOX AVE LINE": "3",
  "CLARK ST LINE": "2",
  "JEROME AVE LINE": "4",
  "LEXINGTON AVE": "6",
  "WHITE PLAINS RD LINE": "5",
  "PELHAM LINE": "6",
  "DYRE AVE LINE": "5",
  "NOSTRAND AVE LINE": "3",
  "EASTERN PKY LINE": "3",
  "NEW LOTS LINE": "3",
  "FLUSHING LINE": "7",
  "FLUSHING/ASTORIA LINE": "7",
  "8TH AVE LINE": "A",
  "FULTON ST LINE": "A",
  "ROCKAWAY LINE": "A",
  "CONCOURSE LINE": "D",
  "6TH AVE LINE": "F",
  "CROSSTOWN LINE": "G",
  "JAMAICA LINE": "J",
  "NASSAU ST LINE": "J",
  "MYRTLE AVE LINE": "M",
  "14ST/CANARSIE LINE": "L",
  "BROADWAY LINE": "N",
  "4TH AVE LINE": "R",
  "SEA BEACH LINE": "N",
  "WEST END LINE": "D",
  "WEST END/SEA BEACH LINE": "D",
  "BRIGHTON LINE": "Q",
  "BRIGHTON/CULVER LINE": "Q",
  "QUEENS BLVD LINE": "E",
  "CULVER LINE": "F",
  "CULVER/6TH AVE LINE": "F",
  "SECOND AVENUE LINE": "Q",
  "STATEN ISLAND RWY LINE": "SIR",
  "ASTORIA LINE": "N",
  "ASTORIA/QUEENS LINE": "N",
  "ARCHER AVE LINE": "E",
  "63RD ST LINE": "F",
  "HOUSTON/ESSEX ST LINE": "F",
  "MANHATTAN BRIDGE LINE": "B",
  "42ND ST SHUTTLE LINE": "S",
  "FRANKLIN AVE SHUTTLE LINE": "S",
  "INTERBOROUGH YARD": "3",
};

interface SourceProperties {
  OBJECTID: number;
  SEGMENTID: number;
  ROUTE: string;
  DIVISION: string;
  LINE: string;
  SUBWAY_LABEL: string;
  [key: string]: unknown;
}

type SourceFeature = Feature<LineString | MultiLineString, SourceProperties>;

type SourceGeoJSON = FeatureCollection<LineString | MultiLineString, SourceProperties>;

async function main() {
  console.log("Processing NYC Subway routes...");

  // Read source GeoJSON
  const sourcePath = path.join(rootDir, "Subway_view_5083976324868604013.geojson");
  const sourceData = JSON.parse(await fs.readFile(sourcePath, "utf-8")) as SourceGeoJSON;

  console.log(`Loaded ${sourceData.features.length} features`);

  // Group features by LINE
  const lineGroups = new Map<string, SourceFeature[]>();
  for (const feature of sourceData.features) {
    const line = feature.properties?.LINE;
    if (!line) continue;

    if (!lineGroups.has(line)) {
      lineGroups.set(line, []);
    }
    lineGroups.get(line)!.push(feature);
  }

  console.log(`Found ${lineGroups.size} unique LINE values`);

  // Process each LINE group
  const outputFeatures: Feature<LineString | MultiLineString>[] = [];

  for (const [lineName, features] of lineGroups) {
    const mtaLine = LINE_TO_MTA[lineName] || "S";

    // Collect all coordinates from all features
    const lineStrings: Feature<LineString>[] = [];

    for (const feature of features) {
      if (feature.geometry.type === "LineString") {
        lineStrings.push(turf.lineString(feature.geometry.coordinates));
      } else if (feature.geometry.type === "MultiLineString") {
        // Convert MultiLineString to individual LineStrings
        for (const coords of feature.geometry.coordinates) {
          lineStrings.push(turf.lineString(coords));
        }
      }
    }

    if (lineStrings.length === 0) continue;

    // Create a FeatureCollection of all line segments
    const lineCollection = turf.featureCollection(lineStrings);

    // Note: turf.lineToPolygon doesn't work for our use case, use combine instead

    // Use combine to merge all features, then dissolve
    const combined = turf.combine(lineCollection as FeatureCollection<LineString>);

    // The combined result will have MultiLineString geometry
    if (combined.features.length > 0) {
      const combinedFeature = combined.features[0];

      // Create output feature
      outputFeatures.push({
        type: "Feature",
        id: lineName.replace(/[^a-zA-Z0-9]/g, "-"),
        geometry: combinedFeature.geometry as MultiLineString,
        properties: {
          line: mtaLine,
          lineName: lineName,
        },
      });
    }

    console.log(`  ${lineName}: ${features.length} segments -> merged (${mtaLine})`);
  }

  // Create output GeoJSON
  const outputGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: outputFeatures,
  };

  // Write to both locations
  const backendPath = path.join(rootDir, "backend/data/routes.geojson");
  const dataPath = path.join(rootDir, "data/routes.geojson");

  const outputJson = JSON.stringify(outputGeoJSON);

  await fs.writeFile(backendPath, outputJson);
  await fs.writeFile(dataPath, outputJson);

  console.log(`\nWrote ${outputFeatures.length} merged features to:`);
  console.log(`  - ${backendPath}`);
  console.log(`  - ${dataPath}`);

  // Report file sizes
  const stats = await fs.stat(backendPath);
  console.log(`\nOutput file size: ${(stats.size / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
