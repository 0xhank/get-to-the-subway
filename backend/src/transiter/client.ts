// Transiter API client
// Fetches vehicle and stop data from Transiter

const TRANSITER_URL = process.env.TRANSITER_URL || "https://demo.transiter.dev";
const SYSTEM_ID = "us-ny-subway";

export interface TransiterVehicle {
  id: string;
  trip?: {
    id: string;
    resource?: {
      path: string;
      url: string;
    };
    route: {
      id: string;
      color?: string;
    };
    directionId?: boolean;
  };
  stop?: {
    id: string;
    name: string;
  };
  stopSequence?: number;
  currentStatus?: "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO";
  updatedAt?: string;
}

export interface StopTime {
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
  future: boolean;
  stopSequence: number;
}

export interface TripData {
  id: string;
  stopTimes: StopTime[];
}

export interface TransiterStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Cache for stop coordinates (they don't change)
const stopCache = new Map<string, { lat: number; lon: number }>();

interface VehiclesResponse {
  vehicles?: TransiterVehicle[];
  nextId?: string;
}

// Fetch all vehicles from Transiter using the /vehicles endpoint
export async function fetchAllVehicles(): Promise<TransiterVehicle[]> {
  const allVehicles: TransiterVehicle[] = [];

  try {
    let nextId: string | null = null;

    // Paginate through all vehicles
    do {
      const url = nextId
        ? `${TRANSITER_URL}/systems/${SYSTEM_ID}/vehicles?limit=100&first_id=${encodeURIComponent(nextId)}`
        : `${TRANSITER_URL}/systems/${SYSTEM_ID}/vehicles?limit=100`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicles: ${response.status}`);
      }

      const data = (await response.json()) as VehiclesResponse;
      const vehicles = data.vehicles || [];
      allVehicles.push(...vehicles);

      nextId = data.nextId || null;
    } while (nextId);

    console.log(`Fetched ${allVehicles.length} vehicles from Transiter`);
  } catch (error) {
    console.error("Failed to fetch vehicles from Transiter:", error);
  }

  return allVehicles;
}

// Fetch a single stop's coordinates
export async function fetchStopCoordinates(
  stopId: string
): Promise<{ lat: number; lon: number } | null> {
  // Check cache first
  const cached = stopCache.get(stopId);
  if (cached) return cached;

  try {
    // Try the base stop ID (without N/S suffix)
    const baseStopId = stopId.replace(/[NS]$/, "");
    const response = await fetch(
      `${TRANSITER_URL}/systems/${SYSTEM_ID}/stops/${baseStopId}`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { latitude?: number; longitude?: number };
    if (data.latitude && data.longitude) {
      const coords = { lat: data.latitude, lon: data.longitude };
      stopCache.set(stopId, coords);
      stopCache.set(baseStopId, coords);
      return coords;
    }
  } catch {
    // Ignore errors
  }

  return null;
}

interface StopsResponse {
  stops?: Array<{ id: string; latitude?: number; longitude?: number }>;
  nextId?: string;
}

// Preload all stop coordinates
export async function preloadStopCoordinates(): Promise<void> {
  console.log("Preloading stop coordinates from Transiter...");

  try {
    let nextId: string | null = null;
    let totalStops = 0;

    // Paginate through all stops
    do {
      const url = nextId
        ? `${TRANSITER_URL}/systems/${SYSTEM_ID}/stops?limit=100&first_id=${nextId}`
        : `${TRANSITER_URL}/systems/${SYSTEM_ID}/stops?limit=100`;

      const response = await fetch(url);
      if (!response.ok) break;

      const data = (await response.json()) as StopsResponse;
      const stops = data.stops || [];

      for (const stop of stops) {
        if (stop.latitude && stop.longitude) {
          stopCache.set(stop.id, { lat: stop.latitude, lon: stop.longitude });
          totalStops++;
        }
      }

      nextId = data.nextId || null;
    } while (nextId);

    console.log(`Loaded ${totalStops} stop coordinates`);
  } catch (error) {
    console.error("Failed to preload stops:", error);
  }
}

// Get cached stop coordinates
export function getCachedStopCoordinates(
  stopId: string
): { lat: number; lon: number } | null {
  // Try exact match
  const exact = stopCache.get(stopId);
  if (exact) return exact;

  // Try without N/S suffix
  const baseId = stopId.replace(/[NS]$/, "");
  return stopCache.get(baseId) || null;
}

// Check if Transiter is healthy
export async function checkTransiterHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `${TRANSITER_URL}/systems/${SYSTEM_ID}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { status?: string };
    return data.status === "ACTIVE";
  } catch {
    return false;
  }
}

// Cache for trip data (short TTL since it changes)
const tripCache = new Map<string, { data: TripData; timestamp: number }>();
const TRIP_CACHE_TTL = 30_000; // 30 seconds

// Fetch trip stopTimes for position calculation
export async function fetchTripData(
  routeId: string,
  tripId: string
): Promise<TripData | null> {
  const cacheKey = tripId;
  const cached = tripCache.get(cacheKey);

  // Return cached if fresh
  if (cached && Date.now() - cached.timestamp < TRIP_CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `${TRANSITER_URL}/systems/${SYSTEM_ID}/routes/${routeId}/trips/${tripId}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) return null;

    const data = (await response.json()) as TripData;

    // Cache the result
    tripCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch {
    return null;
  }
}

// Batch fetch trips for multiple vehicles
export async function fetchTripsForVehicles(
  vehicles: TransiterVehicle[]
): Promise<Map<string, TripData>> {
  const results = new Map<string, TripData>();

  // Create unique trip requests
  const tripRequests: Array<{ vehicleId: string; routeId: string; tripId: string }> = [];

  for (const vehicle of vehicles) {
    if (vehicle.trip?.id && vehicle.trip?.route?.id) {
      tripRequests.push({
        vehicleId: vehicle.id,
        routeId: vehicle.trip.route.id,
        tripId: vehicle.trip.id,
      });
    }
  }

  // Fetch in parallel batches of 50 to avoid overwhelming the API
  const BATCH_SIZE = 50;
  for (let i = 0; i < tripRequests.length; i += BATCH_SIZE) {
    const batch = tripRequests.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async ({ vehicleId, routeId, tripId }) => {
        const tripData = await fetchTripData(routeId, tripId);
        return { vehicleId, tripData };
      })
    );

    for (const { vehicleId, tripData } of batchResults) {
      if (tripData) {
        results.set(vehicleId, tripData);
      }
    }
  }

  return results;
}
