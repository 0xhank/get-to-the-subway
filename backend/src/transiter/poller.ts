// Polls Transiter API and enriches vehicle data with coordinates

import type { Train, FeedStatus } from "@live-subway/shared";
import {
  fetchAllVehicles,
  fetchTripsForVehicles,
  preloadStopCoordinates,
  checkTransiterHealth,
  type TransiterVehicle,
  type TripData,
} from "./client.js";
import { calculateTrainPosition } from "./position-calculator.js";

// Polling interval (15 seconds)
const POLL_INTERVAL_MS = 15_000;

// Stale threshold (5 minutes)
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

// Current train data
let currentTrains: Train[] = [];
let lastUpdateHash = "";
let lastPollTime = 0;
let isTransiterHealthy = false;

// Callback for when data changes
let onDataChanged: (() => void) | null = null;

export function setOnDataChanged(callback: () => void): void {
  onDataChanged = callback;
}

// Convert Transiter vehicle to our Train type
function vehicleToTrain(
  vehicle: TransiterVehicle,
  tripData: TripData | null
): Train | null {
  const routeId = vehicle.trip?.route?.id;
  if (!routeId) return null;

  // Get coordinates from stop
  if (!vehicle.stop?.id) return null;

  // Calculate position using trip data and arrival times
  const positionData = calculateTrainPosition(vehicle, tripData);
  if (!positionData) return null;

  // Parse timestamp (updatedAt is Unix timestamp string)
  const timestamp = vehicle.updatedAt
    ? parseInt(vehicle.updatedAt, 10) * 1000
    : Date.now();

  // Determine direction from trip or stop ID
  let direction: "N" | "S" = "N";
  if (vehicle.trip?.directionId != null) {
    direction = vehicle.trip.directionId ? "S" : "N";
  } else if (vehicle.stop?.id) {
    direction = vehicle.stop.id.endsWith("S") ? "S" : "N";
  }

  // Map status
  let status: Train["status"] = "IN_TRANSIT";
  switch (vehicle.currentStatus) {
    case "INCOMING_AT":
      status = "INCOMING";
      break;
    case "STOPPED_AT":
      status = "AT_STOP";
      break;
    case "IN_TRANSIT_TO":
      status = "IN_TRANSIT";
      break;
  }

  return {
    id: vehicle.id,
    line: routeId,
    direction,
    latitude: positionData.latitude,
    longitude: positionData.longitude,
    timestamp,
    stopId: vehicle.stop?.id,
    status,
    prevStop: positionData.prevStop,
    nextStop: positionData.nextStop,
    bearing: positionData.bearing,
  };
}

// Compute hash for change detection
function computeHash(trains: Train[]): string {
  const sorted = [...trains].sort((a, b) => a.id.localeCompare(b.id));
  return sorted
    .map((t) => `${t.id}:${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`)
    .join("|");
}

// Poll Transiter for vehicle updates
async function poll(): Promise<void> {
  console.log("Polling Transiter for vehicles...");

  try {
    const vehicles = await fetchAllVehicles();
    const now = Date.now();

    // Fetch trip data for all vehicles (for position calculation)
    const tripDataMap = await fetchTripsForVehicles(vehicles);

    // Convert to trains, filter stale
    const trains: Train[] = [];
    for (const vehicle of vehicles) {
      const tripData = tripDataMap.get(vehicle.id) || null;
      const train = vehicleToTrain(vehicle, tripData);
      if (train && now - train.timestamp <= STALE_THRESHOLD_MS) {
        trains.push(train);
      }
    }

    // Count how many trains have timing data
    const withTiming = trains.filter((t) => t.prevStop && t.nextStop).length;

    currentTrains = trains;
    lastPollTime = now;
    isTransiterHealthy = true;

    console.log(`Processed ${trains.length} trains (${withTiming} with timing data)`);

    // Check if data changed
    const hash = computeHash(trains);
    if (hash !== lastUpdateHash) {
      lastUpdateHash = hash;
      if (onDataChanged) {
        onDataChanged();
      }
    }
  } catch (error) {
    console.error("Failed to poll Transiter:", error);
    isTransiterHealthy = false;
  }
}

// Polling interval handle
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Start polling
export async function startPolling(): Promise<void> {
  if (pollInterval) {
    console.warn("Polling already started");
    return;
  }

  // Run health check and preload in parallel
  console.log("Waiting for Transiter to be ready...");
  const [healthCheckResult] = await Promise.all([
    (async () => {
      let attempts = 0;
      while (attempts < 30) {
        const healthy = await checkTransiterHealth();
        if (healthy) {
          console.log("Transiter is ready!");
          return true;
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
        console.log(`  Attempt ${attempts}/30...`);
      }
      return false;
    })(),
    preloadStopCoordinates(), // Runs in parallel with health checks
  ]);

  if (!healthCheckResult) {
    console.warn("Transiter failed to become healthy after 30 attempts, proceeding anyway");
  }

  console.log(`Starting Transiter polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Initial poll
  await poll();

  // Set up interval
  pollInterval = setInterval(poll, POLL_INTERVAL_MS);
}

// Stop polling
export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("Stopped Transiter polling");
  }
}

// Get current trains
export function getTrains(): Train[] {
  return currentTrains;
}

// Get feed status (simplified for Transiter)
export function getFeedStatuses(): FeedStatus[] {
  return [
    {
      feedId: "transiter",
      lastUpdate: lastPollTime,
      isHealthy: isTransiterHealthy,
      errorCount: isTransiterHealthy ? 0 : 1,
    },
  ];
}
