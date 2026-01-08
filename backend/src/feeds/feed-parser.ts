// GTFS-RT protobuf parser
// Uses standard GTFS-RT fields only (no NYC-specific extensions)
// MTA feeds don't provide GPS positions - we derive them from stopId

import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { Train } from "@live-subway/shared";
import { getStopCoordinates } from "../data/stops.js";

const { transit_realtime } = GtfsRealtimeBindings;

export interface ParsedFeedResult {
  trains: Train[];
  timestamp: number;
}

// Map GTFS-RT vehicle stop status to our status enum
function mapVehicleStatus(
  status: number | null | undefined
): Train["status"] {
  // GTFS-RT VehicleStopStatus enum values:
  // 0 = INCOMING_AT, 1 = STOPPED_AT, 2 = IN_TRANSIT_TO
  switch (status) {
    case 0:
      return "INCOMING";
    case 1:
      return "AT_STOP";
    case 2:
    default:
      return "IN_TRANSIT";
  }
}

// Determine direction from trip_id or stop_id (MTA convention: N/S suffix)
function extractDirection(
  tripId?: string | null,
  stopId?: string | null
): "N" | "S" {
  // MTA uses N/S suffix on stop IDs
  if (stopId) {
    if (stopId.endsWith("N")) return "N";
    if (stopId.endsWith("S")) return "S";
  }
  // Also check trip_id for direction indicator
  if (tripId) {
    if (tripId.includes("..N")) return "N";
    if (tripId.includes("..S")) return "S";
  }
  // Default to N if we can't determine
  return "N";
}

export function parseFeed(buffer: ArrayBuffer, feedId: string): ParsedFeedResult {
  const message = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
  const trains: Train[] = [];
  const feedTimestamp = message.header?.timestamp
    ? Number(message.header.timestamp) * 1000
    : Date.now();

  for (const entity of message.entity) {
    const vehicle = entity.vehicle;
    if (!vehicle) continue;

    // Extract route/line
    const routeId = vehicle.trip?.routeId;
    if (!routeId) continue;

    // Get stop ID for position lookup
    const stopId = vehicle.stopId;
    if (!stopId) continue;

    // Try to get position from stop coordinates
    // MTA feeds don't provide GPS positions, so we use the stop location
    let latitude: number;
    let longitude: number;

    const position = vehicle.position;
    if (position?.latitude != null && position?.longitude != null) {
      // Use GPS position if available (rare)
      latitude = position.latitude;
      longitude = position.longitude;
    } else {
      // Look up coordinates from stop ID
      const stopCoords = getStopCoordinates(stopId);
      if (!stopCoords) {
        // Skip trains at unknown stops
        continue;
      }
      latitude = stopCoords.lat;
      longitude = stopCoords.lon;
    }

    // Use vehicle ID or trip ID as unique identifier
    const vehicleId =
      vehicle.vehicle?.id || vehicle.trip?.tripId || `${feedId}_${entity.id}`;

    const timestamp = vehicle.timestamp
      ? Number(vehicle.timestamp) * 1000
      : feedTimestamp;

    trains.push({
      id: vehicleId,
      line: routeId,
      direction: extractDirection(vehicle.trip?.tripId, stopId),
      latitude,
      longitude,
      timestamp,
      stopId,
      status: mapVehicleStatus(vehicle.currentStatus),
    });
  }

  return { trains, timestamp: feedTimestamp };
}
