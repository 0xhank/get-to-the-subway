export interface StopTiming {
  stopId: string;
  latitude: number;
  longitude: number;
  time: number; // Unix timestamp in seconds
}

export interface Train {
  id: string;
  line: string;
  direction: "N" | "S";
  latitude: number;
  longitude: number;
  timestamp: number;
  stopId?: string;
  status: "INCOMING" | "AT_STOP" | "IN_TRANSIT";
  // Timing data for frontend interpolation
  prevStop?: StopTiming;
  nextStop?: StopTiming;
  // Bearing for directional arrow (degrees, 0 = North, 90 = East)
  bearing?: number;
}

export interface FeedStatus {
  feedId: string;
  lastUpdate: number;
  isHealthy: boolean;
  errorCount: number;
}

export interface TrainsResponse {
  trains: Train[];
  feedStatuses: FeedStatus[];
  timestamp: number;
}

export interface StopArrival {
  routeId: string;
  headsign: string;
  direction: "N" | "S";
  arrivalTime: number; // Unix timestamp in seconds
  vehicleId: string;
}

export interface StopInfo {
  id: string;
  name: string;
  routes: string[];
  northArrivals: StopArrival[];
  southArrivals: StopArrival[];
}

export interface StopArrivalsResponse {
  stop: StopInfo;
  timestamp: number;
}
