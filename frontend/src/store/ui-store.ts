import { create } from "zustand";

interface UIState {
  // Modal state
  isSearchOpen: boolean;
  isAboutOpen: boolean;

  // Playback state
  isPaused: boolean;

  // Stats
  rideCount: number;
  fps: number;
  rideHistory: number[];

  // Actions
  setSearchOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  togglePause: () => void;
  updateRideCount: (count: number) => void;
  setFps: (fps: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isSearchOpen: false,
  isAboutOpen: false,
  isPaused: false,
  rideCount: 0,
  fps: 0,
  rideHistory: new Array(36).fill(0), // 3 hours at 5-min intervals

  // Actions
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setAboutOpen: (open) => set({ isAboutOpen: open }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  updateRideCount: (count) =>
    set((state) => ({
      rideCount: count,
      rideHistory: [...state.rideHistory.slice(1), count],
    })),
  setFps: (fps) => set({ fps }),
}));
