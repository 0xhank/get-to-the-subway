// MTA GTFS-Realtime feed configuration
// No API key required - feeds are open access

export interface FeedConfig {
  id: string;
  lines: string[];
  url: string;
}

export const MTA_FEEDS: FeedConfig[] = [
  {
    id: "ace",
    lines: ["A", "C", "E"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
  },
  {
    id: "bdfm",
    lines: ["B", "D", "F", "M"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
  },
  {
    id: "g",
    lines: ["G"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
  },
  {
    id: "jz",
    lines: ["J", "Z"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
  },
  {
    id: "nqrw",
    lines: ["N", "Q", "R", "W"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
  },
  {
    id: "l",
    lines: ["L"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
  },
  {
    id: "1234567",
    lines: ["1", "2", "3", "4", "5", "6", "7"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
  },
  {
    id: "si",
    lines: ["SIR"],
    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
  },
];

// Map from line to feed ID for quick lookup
export const LINE_TO_FEED: Record<string, string> = {};
for (const feed of MTA_FEEDS) {
  for (const line of feed.lines) {
    LINE_TO_FEED[line] = feed.id;
  }
}

// Polling interval in milliseconds
export const POLL_INTERVAL_MS = 15_000;

// Stale data threshold - filter trains older than this (5 minutes)
export const STALE_THRESHOLD_MS = 5 * 60 * 1000;
