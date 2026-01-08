import { create } from "zustand";
import type { Train, FeedStatus } from "@live-subway/shared";

interface TrainState {
  // Train data
  trains: Train[];
  feedStatuses: FeedStatus[];
  lastUpdate: number;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;

  // Actions
  setTrains: (trains: Train[], feedStatuses: FeedStatus[]) => void;
  setConnectionState: (connected: boolean, connecting?: boolean) => void;
}

export const useTrainStore = create<TrainState>((set) => ({
  // Initial state
  trains: [],
  feedStatuses: [],
  lastUpdate: 0,
  isConnected: false,
  isConnecting: false,

  // Actions
  setTrains: (trains, feedStatuses) =>
    set({
      trains,
      feedStatuses,
      lastUpdate: Date.now(),
    }),

  setConnectionState: (connected, connecting = false) =>
    set({
      isConnected: connected,
      isConnecting: connecting,
    }),
}));
