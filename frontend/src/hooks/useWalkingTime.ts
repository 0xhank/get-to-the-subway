/**
 * Walking time calculation utilities
 * Estimates time to reach a subway station from current location
 */

const WALKING_SPEED_MPH = 3; // Average urban walking speed
const WALKING_SPEED_KMH = WALKING_SPEED_MPH * 1.60934;
const STATION_ENTRY_BUFFER_MIN = 2; // Time to enter station, go through turnstile, reach platform

/**
 * Calculate haversine distance between two geographic points
 */
export function calculateDistance(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate walking time from current location to a station
 * Includes the base walking time plus a station entry buffer
 */
export function calculateWalkingTime(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const distanceKm = calculateDistance(fromLat, fromLon, toLat, toLon);

  // Convert distance to walking time: distance / speed = time
  // 3 mph = 4.828 km/h
  const walkingTimeMin = (distanceKm / WALKING_SPEED_KMH) * 60;

  // Add station entry buffer and round up
  const totalMinutes = Math.ceil(walkingTimeMin + STATION_ENTRY_BUFFER_MIN);

  return totalMinutes;
}

/**
 * Format walking time for display
 */
export function formatWalkingTime(minutes: number): string {
  if (minutes === 1) return "1 min walk";
  return `${minutes} min walk`;
}

/**
 * Export constants for testing
 */
export const WALKING_TIME_CONSTANTS = {
  WALKING_SPEED_MPH,
  WALKING_SPEED_KMH,
  STATION_ENTRY_BUFFER_MIN,
};
