// Stop coordinates lookup from GTFS static data
// Generated from MTA GTFS stops.txt

export interface StopCoordinate {
  lat: number;
  lon: number;
  name: string;
}

// Map from stop_id to coordinates
// This will be populated from GTFS stops.txt
export const STOPS: Map<string, StopCoordinate> = new Map();

// Load stops from CSV content
export function loadStopsFromCSV(csvContent: string): void {
  const lines = csvContent.split("\n");
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV (simple parser, handles quoted fields)
    const parts = parseCSVLine(line);
    if (parts.length < 4) continue;

    const [stopId, stopName, stopLat, stopLon] = parts;
    const lat = parseFloat(stopLat);
    const lon = parseFloat(stopLon);

    if (!isNaN(lat) && !isNaN(lon)) {
      STOPS.set(stopId, { lat, lon, name: stopName });
    }
  }

  console.log(`Loaded ${STOPS.size} stop coordinates`);
}

// Simple CSV line parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Get coordinates for a stop ID
export function getStopCoordinates(
  stopId: string
): { lat: number; lon: number } | null {
  const stop = STOPS.get(stopId);
  if (stop) {
    return { lat: stop.lat, lon: stop.lon };
  }

  // Try without direction suffix (N/S)
  const baseId = stopId.replace(/[NS]$/, "");
  const baseStop = STOPS.get(baseId);
  if (baseStop) {
    return { lat: baseStop.lat, lon: baseStop.lon };
  }

  return null;
}
