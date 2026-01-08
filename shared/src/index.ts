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
