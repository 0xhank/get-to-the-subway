import { create } from "zustand";
import type { StopArrivalsResponse } from "@live-subway/shared";

interface StopState {
  // Selection state
  selectedStopId: string | null;
  stopData: StopArrivalsResponse | null;
  isLoading: boolean;
  error: string | null;

  // Polling state
  pollingInterval: NodeJS.Timeout | null;

  // Actions
  selectStop: (stopId: string) => void;
  clearSelection: () => void;
  setStopData: (data: StopArrivalsResponse) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPollingInterval: (interval: NodeJS.Timeout | null) => void;
}

export const useStopStore = create<StopState>((set) => ({
  // Initial state
  selectedStopId: null,
  stopData: null,
  isLoading: false,
  error: null,
  pollingInterval: null,

  // Actions
  selectStop: (stopId) =>
    set({
      selectedStopId: stopId,
      error: null,
    }),

  clearSelection: () =>
    set({
      selectedStopId: null,
      stopData: null,
      error: null,
      isLoading: false,
    }),

  setStopData: (data) =>
    set({
      stopData: data,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  setPollingInterval: (interval) =>
    set({
      pollingInterval: interval,
    }),
}));
