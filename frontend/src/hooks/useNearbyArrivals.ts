import { useEffect, useState, useCallback, useRef } from "react";
import { StopArrival, StopArrivalsResponse } from "@live-subway/shared";
import { useSpatialIndex } from "./useSpatialIndex";
import { useUIStore } from "@/store/ui-store";
import { calculateWalkingTime, formatWalkingTime } from "./useWalkingTime";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface ProcessedTrain extends StopArrival {
  leaveAtMinutes: number; // When user should leave to catch this train
  isIdeal: boolean; // In the ideal timing window
  isAlternative: boolean; // Next best option when no ideal
  severity?: "ideal" | "too-soon" | "long-wait";
}

export interface NearbyStation {
  id: string;
  name: string;
  routes: string[];
  walkTimeMinutes: number;
  walkTimeFormatted: string;
  distanceKm: number;
  northbound: ProcessedTrain[];
  southbound: ProcessedTrain[];
  error?: string;
  isLoading: boolean;
}

interface CacheEntry {
  data: StopArrivalsResponse;
  timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const IDEAL_WINDOW_MIN = 0.5; // 30 seconds
const IDEAL_WINDOW_MAX = 3; // 3 minutes
const LOCATION_DEBOUNCE_MS = 500;
const RADIUS_KM = 0.8047; // 0.5 miles

/**
 * Calculate severity of a train based on walking time and arrival
 */
function getTrainSeverity(
  arrivalTimeSec: number,
  walkingTimeMin: number,
  now: number
): "ideal" | "too-soon" | "long-wait" {
  const leaveAtSec = arrivalTimeSec - walkingTimeMin * 60;
  const minutesToLeave = (leaveAtSec - now) / 60;

  if (minutesToLeave >= IDEAL_WINDOW_MIN && minutesToLeave <= IDEAL_WINDOW_MAX) {
    return "ideal";
  }

  if (minutesToLeave < IDEAL_WINDOW_MIN) {
    return "too-soon";
  }

  return "long-wait";
}

/**
 * Process arrivals for a station, filtering and sorting by ideal timing window
 */
function processArrivals(
  arrivals: StopArrival[],
  walkingTimeMin: number,
  now: number
): ProcessedTrain[] {
  const now_sec = now / 1000;

  return arrivals
    .filter((arrival) => arrival.arrivalTime > now_sec) // Only future arrivals
    .map((arrival) => {
      const severity = getTrainSeverity(arrival.arrivalTime, walkingTimeMin, now_sec);
      const leaveAtSec = arrival.arrivalTime - walkingTimeMin * 60;
      const leaveAtMin = (leaveAtSec - now_sec) / 60;

      return {
        ...arrival,
        leaveAtMinutes: Math.max(0, leaveAtMin),
        isIdeal: severity === "ideal",
        isAlternative: false,
        severity,
      };
    })
    .sort((a, b) => a.arrivalTime - b.arrivalTime);
}

/**
 * Select best trains ensuring at least one per route
 * Prioritizes ideal trains, then picks best catchable (not too-soon)
 */
function selectBestTrains(processed: ProcessedTrain[]): ProcessedTrain[] {
  // Group by route
  const byRoute = new Map<string, ProcessedTrain[]>();
  for (const train of processed) {
    const existing = byRoute.get(train.routeId) || [];
    existing.push(train);
    byRoute.set(train.routeId, existing);
  }

  const result: ProcessedTrain[] = [];

  // For each route, pick the best catchable train
  for (const [, trains] of byRoute) {
    // Filter out too-soon trains (user can't catch them)
    const catchable = trains.filter((t) => t.severity !== "too-soon");
    if (catchable.length === 0) continue;

    const ideal = catchable.find((t) => t.isIdeal);
    if (ideal) {
      result.push(ideal);
    } else {
      // No ideal train for this route, pick the first catchable as alternative
      result.push({
        ...catchable[0],
        isAlternative: true,
      });
    }
  }

  // Sort by arrival time
  return result.sort((a, b) => a.arrivalTime - b.arrivalTime);
}

/**
 * Hook to fetch and process arrivals for nearby stations
 */
export function useNearbyArrivals() {
  const userLocation = useUIStore((state) => state.userLocation);
  const { getNearbyStations } = useSpatialIndex();
  const [stations, setStations] = useState<NearbyStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache for arrivals with TTL
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // Debounce timer for location changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Get cached arrivals if still fresh
   */
  const getCachedArrivals = useCallback((stopId: string): StopArrivalsResponse | null => {
    const entry = cacheRef.current.get(stopId);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      cacheRef.current.delete(stopId);
      return null;
    }

    return entry.data;
  }, []);

  /**
   * Fetch arrivals for a single station
   */
  const fetchStationArrivals = useCallback(
    async (stopId: string): Promise<StopArrivalsResponse | null> => {
      // Check cache first
      const cached = getCachedArrivals(stopId);
      if (cached) return cached;

      try {
        const url = `${API_URL}/api/stops/${stopId}/arrivals`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: StopArrivalsResponse = await response.json();

        // Cache the result
        cacheRef.current.set(stopId, {
          data,
          timestamp: Date.now(),
        });

        return data;
      } catch (err) {
        console.error(`Failed to fetch arrivals for ${stopId}:`, err);
        return null;
      }
    },
    [getCachedArrivals]
  );

  /**
   * Load nearby stations and their arrivals
   */
  const loadNearbyStations = useCallback(async () => {
    if (!userLocation) {
      console.warn("No user location available for nearby stations");
      setStations([]);
      setError(null);
      return;
    }


    setIsLoading(true);
    setError(null);

    try {
      // Find nearby stations
      const nearby = getNearbyStations(userLocation.latitude, userLocation.longitude, RADIUS_KM);

      if (nearby.length === 0) {
        setStations([]);
        setIsLoading(false);
        return;
      }

      // Calculate walking time for each station
      const stationData = nearby.map((station) => ({
        ...station,
        walkTimeMinutes: calculateWalkingTime(
          userLocation.latitude,
          userLocation.longitude,
          station.latitude,
          station.longitude
        ),
      }));

      // Fetch arrivals in parallel
      const arrivalPromises = stationData.map(async (station) => {
        const arrivals = await fetchStationArrivals(station.id);

        if (!arrivals) {
          return {
            ...station,
            routes: [], // Default to empty if not available
            walkTimeFormatted: formatWalkingTime(station.walkTimeMinutes),
            distanceKm: 0, // Not used in display
            northbound: [],
            southbound: [],
            error: "Unable to load trains",
            isLoading: false,
          } as NearbyStation;
        }

        const now = Date.now();
        const northbound = selectBestTrains(
          processArrivals(arrivals.stop.northArrivals, station.walkTimeMinutes, now)
        );
        const southbound = selectBestTrains(
          processArrivals(arrivals.stop.southArrivals, station.walkTimeMinutes, now)
        );

        return {
          id: station.id,
          name: station.name,
          routes: arrivals.stop.routes,
          walkTimeMinutes: station.walkTimeMinutes,
          walkTimeFormatted: formatWalkingTime(station.walkTimeMinutes),
          distanceKm: 0, // Not used in display
          northbound,
          southbound,
          isLoading: false,
        } as NearbyStation;
      });

      const results = await Promise.all(arrivalPromises);
      setStations(results);
    } catch (err) {
      console.error("Error loading nearby stations:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, getNearbyStations, fetchStationArrivals]);

  /**
   * Trigger load on user location change, debounced
   */
  useEffect(() => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      loadNearbyStations();
    }, LOCATION_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [userLocation, loadNearbyStations]);

  /**
   * Refresh a specific station's arrivals
   */
  const retryStation = useCallback(
    async (stopId: string) => {
      const station = stations.find((s) => s.id === stopId);
      if (!station || !userLocation) return;

      const arrivals = await fetchStationArrivals(stopId);

      if (arrivals) {
        const now = Date.now();
        const northbound = selectBestTrains(
          processArrivals(arrivals.stop.northArrivals, station.walkTimeMinutes, now)
        );
        const southbound = selectBestTrains(
          processArrivals(arrivals.stop.southArrivals, station.walkTimeMinutes, now)
        );

        setStations((prev) =>
          prev.map((s) =>
            s.id === stopId
              ? {
                  ...s,
                  northbound,
                  southbound,
                  error: undefined,
                  isLoading: false,
                }
              : s
          )
        );
      }
    },
    [stations, userLocation, fetchStationArrivals]
  );

  return {
    stations,
    isLoading,
    error,
    retryStation,
  };
}
