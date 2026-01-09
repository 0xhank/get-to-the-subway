import { create } from "zustand";

interface UIState {
  // Modal state
  isSearchOpen: boolean;
  isAboutOpen: boolean;
  isLinesOpen: boolean;

  // Panel state
  nearbyPanelOpen: boolean;

  // Playback state
  isPaused: boolean;

  // Stats
  rideCount: number;
  fps: number;
  rideHistory: number[];

  // User location
  userLocation: { latitude: number; longitude: number } | null;

  // Map target for centering (e.g., from search)
  mapTarget: { latitude: number; longitude: number } | null;

  // Actions
  setSearchOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setLinesOpen: (open: boolean) => void;
  setNearbyPanelOpen: (open: boolean) => void;
  togglePause: () => void;
  updateRideCount: (count: number) => void;
  setFps: (fps: number) => void;
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
  setMapTarget: (target: { latitude: number; longitude: number } | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isSearchOpen: false,
  isAboutOpen: false,
  isLinesOpen: false,
  nearbyPanelOpen: true,
  isPaused: false,
  rideCount: 0,
  fps: 0,
  rideHistory: new Array(36).fill(0), // 3 hours at 5-min intervals
  userLocation: null,
  mapTarget: null,

  // Actions
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setAboutOpen: (open) => set({ isAboutOpen: open }),
  setLinesOpen: (open) => set({ isLinesOpen: open }),
  setNearbyPanelOpen: (open) => set({ nearbyPanelOpen: open }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  updateRideCount: (count) =>
    set((state) => ({
      rideCount: count,
      rideHistory: [...state.rideHistory.slice(1), count],
    })),
  setFps: (fps) => set({ fps }),
  setUserLocation: (location) => set({ userLocation: location }),
  setMapTarget: (target) => set({ mapTarget: target }),
}));
