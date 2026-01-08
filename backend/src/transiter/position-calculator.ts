// Position calculator - extracts timing data for frontend interpolation
import type { TransiterVehicle, TripData, StopTime } from "./client.js";
import { getCachedStopCoordinates } from "./client.js";
import type { StopTiming } from "@live-subway/shared";

export interface PositionData {
  latitude: number;
  longitude: number;
  prevStop?: StopTiming;
  nextStop?: StopTiming;
  bearing?: number;
}

/**
 * Calculate bearing from point A to point B using haversine formula.
 * Returns degrees where 0 = North, 90 = East, 180 = South, 270 = West.
 */
function calculateBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Find a stop in the trip by stop ID.
 * Stop IDs may have N/S suffix that needs matching.
 */
function findStopInTrip(
  stopTimes: StopTime[],
  stopId: string
): { index: number; stopTime: StopTime } | null {
  // Try exact match first
  let index = stopTimes.findIndex((st) => st.stop.id === stopId);
  if (index >= 0) {
    return { index, stopTime: stopTimes[index] };
  }

  // Try without N/S suffix
  const baseId = stopId.replace(/[NS]$/, "");
  index = stopTimes.findIndex((st) => st.stop.id.replace(/[NS]$/, "") === baseId);
  if (index >= 0) {
    return { index, stopTime: stopTimes[index] };
  }

  return null;
}

/**
 * Extract position and timing data for a train.
 * Returns current position plus prev/next stop timing for frontend interpolation.
 */
export function calculateTrainPosition(
  vehicle: TransiterVehicle,
  tripData: TripData | null
): PositionData | null {
  // Must have stop info
  if (!vehicle.stop?.id) {
    return null;
  }

  const currentStopCoords = getCachedStopCoordinates(vehicle.stop.id);
  if (!currentStopCoords) {
    return null;
  }

  // If stopped at a station, calculate bearing to next stop if available
  if (vehicle.currentStatus === "STOPPED_AT") {
    if (tripData) {
      const currentMatch = findStopInTrip(tripData.stopTimes, vehicle.stop.id);
      if (currentMatch && currentMatch.index < tripData.stopTimes.length - 1) {
        const nextStopTime = tripData.stopTimes[currentMatch.index + 1];
        const nextCoords = getCachedStopCoordinates(nextStopTime.stop.id);
        if (nextCoords) {
          const bearing = calculateBearing(
            currentStopCoords.lat,
            currentStopCoords.lon,
            nextCoords.lat,
            nextCoords.lon
          );
          return {
            latitude: currentStopCoords.lat,
            longitude: currentStopCoords.lon,
            bearing,
          };
        }
      }
    }
    return {
      latitude: currentStopCoords.lat,
      longitude: currentStopCoords.lon,
    };
  }

  // No trip data - return static position without bearing
  if (!tripData) {
    return {
      latitude: currentStopCoords.lat,
      longitude: currentStopCoords.lon,
    };
  }

  const stopTimes = tripData.stopTimes;
  if (stopTimes.length === 0) {
    return {
      latitude: currentStopCoords.lat,
      longitude: currentStopCoords.lon,
    };
  }

  // Find current stop in the trip by ID (not sequence number)
  const currentMatch = findStopInTrip(stopTimes, vehicle.stop.id);
  if (!currentMatch || currentMatch.index === 0) {
    // Can't find stop or it's the first stop (no previous)
    return {
      latitude: currentStopCoords.lat,
      longitude: currentStopCoords.lon,
    };
  }

  // Get previous stop (the one before current in the array)
  const prevStopTime = stopTimes[currentMatch.index - 1];
  const currentStopTime = currentMatch.stopTime;

  // INCOMING_AT or IN_TRANSIT_TO: Train is between previous stop and current stop
  if (
    vehicle.currentStatus === "INCOMING_AT" ||
    vehicle.currentStatus === "IN_TRANSIT_TO" ||
    vehicle.currentStatus === undefined // null status often means in transit
  ) {
    const prevCoords = getCachedStopCoordinates(prevStopTime.stop.id);
    if (!prevCoords) {
      return {
        latitude: currentStopCoords.lat,
        longitude: currentStopCoords.lon,
      };
    }

    // Get departure time from previous stop and arrival time at current stop
    const prevDeparture = prevStopTime.departure?.time
      ? parseInt(prevStopTime.departure.time, 10)
      : prevStopTime.arrival?.time
        ? parseInt(prevStopTime.arrival.time, 10)
        : null;

    const currentArrival = currentStopTime.arrival?.time
      ? parseInt(currentStopTime.arrival.time, 10)
      : null;

    if (prevDeparture && currentArrival && currentArrival > prevDeparture) {
      // Build timing data for frontend
      const prevStop: StopTiming = {
        stopId: prevStopTime.stop.id,
        latitude: prevCoords.lat,
        longitude: prevCoords.lon,
        time: prevDeparture,
      };

      const nextStop: StopTiming = {
        stopId: currentStopTime.stop.id,
        latitude: currentStopCoords.lat,
        longitude: currentStopCoords.lon,
        time: currentArrival,
      };

      // Calculate current position for initial render
      const now = Date.now() / 1000;
      const totalTime = currentArrival - prevDeparture;
      const elapsed = now - prevDeparture;
      const progress = Math.max(0, Math.min(1, elapsed / totalTime));

      const currentLat = prevCoords.lat + (currentStopCoords.lat - prevCoords.lat) * progress;
      const currentLon = prevCoords.lon + (currentStopCoords.lon - prevCoords.lon) * progress;

      // Calculate bearing from current interpolated position to next stop
      const bearing = calculateBearing(
        currentLat,
        currentLon,
        currentStopCoords.lat,
        currentStopCoords.lon
      );

      return {
        latitude: currentLat,
        longitude: currentLon,
        prevStop,
        nextStop,
        bearing,
      };
    }
  }

  // Default: return current stop position
  return {
    latitude: currentStopCoords.lat,
    longitude: currentStopCoords.lon,
  };
}
