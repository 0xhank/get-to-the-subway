// Feed polling loop with circuit breaker
// Polls all 8 MTA feeds in parallel every 15 seconds

import { MTA_FEEDS, POLL_INTERVAL_MS, type FeedConfig } from "./mta-feeds.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { parseFeed } from "./feed-parser.js";
import { trainCache } from "../cache/train-cache.js";

// Circuit breakers for each feed
const circuitBreakers = new Map<string, CircuitBreaker>();

// Initialize circuit breakers
for (const feed of MTA_FEEDS) {
  circuitBreakers.set(feed.id, new CircuitBreaker(feed.id));
}

// Callback for when data changes (used to trigger SSE broadcast)
let onDataChanged: (() => void) | null = null;

export function setOnDataChanged(callback: () => void): void {
  onDataChanged = callback;
}

// Fetch a single feed
async function fetchFeed(feed: FeedConfig): Promise<void> {
  const breaker = circuitBreakers.get(feed.id)!;

  // Skip if circuit is open
  if (breaker.isOpen) {
    console.log(`[${feed.id}] Circuit open, skipping fetch`);
    return;
  }

  try {
    const response = await fetch(feed.url, {
      headers: {
        Accept: "application/x-protobuf",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const { trains, timestamp } = parseFeed(buffer, feed.id);

    // Update cache with new trains
    trainCache.updateFromFeed(feed.id, trains, timestamp);

    // Record success
    breaker.recordSuccess();

    console.log(
      `[${feed.id}] Fetched ${trains.length} trains (${breaker.currentState})`
    );
  } catch (error) {
    breaker.recordFailure();
    trainCache.markFeedUnhealthy(feed.id, breaker.failures);

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[${feed.id}] Fetch failed (${breaker.failures} failures, ${breaker.currentState}): ${errorMessage}`
    );
  }
}

// Poll all feeds in parallel
async function pollAllFeeds(): Promise<void> {
  console.log("Polling all MTA feeds...");

  // Fetch all feeds in parallel
  await Promise.all(MTA_FEEDS.map((feed) => fetchFeed(feed)));

  // Check if data changed and trigger callback
  if (trainCache.hasChangedSinceLastBroadcast() && onDataChanged) {
    onDataChanged();
  }
}

// Polling interval handle
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Start polling
export function startPolling(): void {
  if (pollInterval) {
    console.warn("Polling already started");
    return;
  }

  console.log(`Starting MTA feed polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Initial poll
  pollAllFeeds();

  // Set up interval
  pollInterval = setInterval(pollAllFeeds, POLL_INTERVAL_MS);
}

// Stop polling
export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("Stopped MTA feed polling");
  }
}

// Get circuit breaker status for all feeds
export function getCircuitBreakerStatus(): Record<
  string,
  { state: string; failures: number }
> {
  const status: Record<string, { state: string; failures: number }> = {};
  for (const [feedId, breaker] of circuitBreakers) {
    status[feedId] = {
      state: breaker.currentState,
      failures: breaker.failures,
    };
  }
  return status;
}
