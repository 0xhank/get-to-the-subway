// Transiter API integration for stop arrivals
// Fetches real-time arrival information for a specific stop

import { StopArrival, StopArrivalsResponse, StopInfo } from "@live-subway/shared";

const TRANSITER_URL = process.env.TRANSITER_URL || "https://demo.transiter.dev";
const SYSTEM_ID = "us-ny-subway";
const TIMEOUT_MS = 5000;

interface TransiterStopTime {
  stop: {
    id: string;
    name: string;
  };
  arrival?: {
    time: string;
  };
  departure?: {
    time: string;
  };
  trip?: {
    id: string;
    route?: {
      id: string;
    };
    directionId?: boolean;
    headsign?: string;
  };
  future: boolean;
  stopSequence: number;
}

interface TransiterStopResponse {
  id: string;
  name: string;
  stopTimes?: TransiterStopTime[];
}

/**
 * Fetch arrival information for a specific stop from Transiter
 * Returns null if the stop is not found or on error
 */
export async function fetchStopArrivals(stopId: string): Promise<StopArrivalsResponse | null> {
  try {
    const url = `${TRANSITER_URL}/systems/${SYSTEM_ID}/stops/${stopId}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404) {
      console.warn(`Stop ${stopId} not found`);
      return null;
    }

    if (!response.ok) {
      console.error(`Failed to fetch stop ${stopId}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as TransiterStopResponse;

    // Extract arrivals by direction
    const northArrivals: StopArrival[] = [];
    const southArrivals: StopArrival[] = [];
    const routeIds = new Set<string>();

    console.log(`Fetched stop ${stopId}: ${data.name}, stopTimes count: ${data.stopTimes?.length || 0}`);

    if (data.stopTimes) {
      // Filter to future arrivals only
      for (const stopTime of data.stopTimes) {
        const isFuture = stopTime.future;
        const hasRoute = !!stopTime.trip?.route;

        if (!isFuture || !hasRoute) {
          continue;
        }

        const arrivalTimeStr = stopTime.arrival?.time || stopTime.departure?.time;
        if (!arrivalTimeStr) continue;

        const arrivalTime = parseTransiterTime(arrivalTimeStr);
        if (!arrivalTime) {
          console.warn(`Failed to parse time: ${arrivalTimeStr}`);
          continue;
        }

        const now = Date.now() / 1000;
        if (arrivalTime <= now) {
          console.log(`Arrival time ${arrivalTime} is in the past (now: ${now})`);
          continue;
        }

        const routeId = stopTime.trip?.route?.id;
        if (!routeId) {
          console.warn(`No route ID found for stop time: ${JSON.stringify(stopTime)}`);
          continue;
        }
        routeIds.add(routeId);

        // Get headsign from trip or fallback to destination stop name
        const headsign = stopTime.trip?.headsign || stopTime.stop.name;
        if (!headsign) {
          console.warn(`No headsign found for stop time: ${JSON.stringify(stopTime)}`);
          continue;
        }

        const arrival: StopArrival = {
          routeId,
          headsign,
          direction: stopTime.trip?.directionId ? "S" : "N",
          arrivalTime,
          vehicleId: stopTime.trip?.id || "",
        };

        if (stopTime.trip?.directionId) {
          southArrivals.push(arrival);
        } else {
          northArrivals.push(arrival);
        }
      }
    }

    // Sort arrivals by arrival time
    northArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);
    southArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

    console.log(`Stop ${stopId} arrivals: N=${northArrivals.length}, S=${southArrivals.length}`);

    // Take only the first 10 arrivals per direction (limit for performance)
    northArrivals.splice(10);
    southArrivals.splice(10);

    const stopInfo: StopInfo = {
      id: data.id,
      name: data.name,
      routes: Array.from(routeIds).sort(),
      northArrivals,
      southArrivals,
    };

    return {
      stop: stopInfo,
      timestamp: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`Timeout fetching stop ${stopId}`);
    } else {
      console.error(`Error fetching stop ${stopId}:`, error);
    }
    return null;
  }
}

/**
 * Parse Transiter time format (Unix timestamp in seconds or ISO 8601 string)
 * Returns Unix timestamp in seconds or null if invalid
 */
function parseTransiterTime(timeStr: string): number | null {
  try {
    // Try parsing as Unix timestamp (seconds) first
    const asNumber = parseInt(timeStr, 10);
    if (!isNaN(asNumber) && asNumber > 0) {
      // Unix timestamp in seconds
      return asNumber;
    }

    // Try parsing as ISO 8601 string
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / 1000);
  } catch {
    return null;
  }
}
