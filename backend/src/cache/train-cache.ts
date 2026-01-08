// In-memory train cache with merge logic
// Merges trains from all 8 MTA feeds into a unified view

import type { Train, FeedStatus } from "@live-subway/shared";
import { STALE_THRESHOLD_MS } from "../feeds/mta-feeds.js";

export class TrainCache {
  // Map from train ID to Train object
  private trains = new Map<string, Train>();

  // Map from feed ID to FeedStatus
  private feedStatuses = new Map<string, FeedStatus>();

  // Timestamp of last broadcast (for change detection)
  private lastBroadcastHash = "";

  // Update trains from a specific feed
  updateFromFeed(feedId: string, trains: Train[], timestamp: number): void {
    // Remove stale trains from this feed (those not in the new update)
    const newTrainIds = new Set(trains.map((t) => t.id));

    // Find trains from this feed that are no longer present
    for (const [id, train] of this.trains) {
      // Heuristic: if train's line belongs to this feed and it's not in new data, remove it
      // This is imperfect but works for most cases
      if (!newTrainIds.has(id) && this.trainBelongsToFeed(train, feedId)) {
        this.trains.delete(id);
      }
    }

    // Add/update trains from this feed
    for (const train of trains) {
      this.trains.set(train.id, train);
    }

    // Update feed status
    this.feedStatuses.set(feedId, {
      feedId,
      lastUpdate: timestamp,
      isHealthy: true,
      errorCount: 0,
    });
  }

  // Mark a feed as unhealthy
  markFeedUnhealthy(feedId: string, errorCount: number): void {
    const existing = this.feedStatuses.get(feedId);
    this.feedStatuses.set(feedId, {
      feedId,
      lastUpdate: existing?.lastUpdate ?? 0,
      isHealthy: false,
      errorCount,
    });
  }

  // Get all trains, filtering out stale ones (>5 min old)
  getTrains(): Train[] {
    const now = Date.now();
    const freshTrains: Train[] = [];

    for (const train of this.trains.values()) {
      if (now - train.timestamp <= STALE_THRESHOLD_MS) {
        freshTrains.push(train);
      }
    }

    return freshTrains;
  }

  // Get all feed statuses
  getFeedStatuses(): FeedStatus[] {
    return Array.from(this.feedStatuses.values());
  }

  // Check if data has changed since last broadcast
  // Returns true if we should broadcast (data changed)
  hasChangedSinceLastBroadcast(): boolean {
    const currentHash = this.computeHash();
    if (currentHash !== this.lastBroadcastHash) {
      this.lastBroadcastHash = currentHash;
      return true;
    }
    return false;
  }

  // Compute a simple hash of current state for change detection
  private computeHash(): string {
    const trains = this.getTrains();
    // Sort by ID for consistent ordering
    trains.sort((a, b) => a.id.localeCompare(b.id));

    // Create hash from train positions (what actually matters for display)
    const parts = trains.map(
      (t) => `${t.id}:${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`
    );
    return parts.join("|");
  }

  // Heuristic to check if a train belongs to a feed based on line
  private trainBelongsToFeed(train: Train, feedId: string): boolean {
    const feedLines: Record<string, string[]> = {
      ace: ["A", "C", "E"],
      bdfm: ["B", "D", "F", "M"],
      g: ["G"],
      jz: ["J", "Z"],
      nqrw: ["N", "Q", "R", "W"],
      l: ["L"],
      "1234567": ["1", "2", "3", "4", "5", "6", "7", "S"],
      si: ["SIR"],
    };
    return feedLines[feedId]?.includes(train.line) ?? false;
  }

  // Clear all data
  clear(): void {
    this.trains.clear();
    this.feedStatuses.clear();
    this.lastBroadcastHash = "";
  }
}

// Singleton instance
export const trainCache = new TrainCache();
