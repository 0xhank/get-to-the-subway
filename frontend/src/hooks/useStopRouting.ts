import { useEffect } from "react";
import { useStopStore } from "@/store/stop-store";

export function useStopRouting(): void {
  const selectedStopId = useStopStore((state) => state.selectedStopId);
  const selectStop = useStopStore((state) => state.selectStop);
  const clearSelection = useStopStore((state) => state.clearSelection);

  // Effect for URL management
  useEffect(() => {
    if (selectedStopId) {
      // Update URL when stop is selected
      const newUrl = `/stop/${selectedStopId}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState({ stopId: selectedStopId }, "", newUrl);
      }
    } else {
      // Reset URL when selection is cleared
      if (window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
      }
    }
  }, [selectedStopId]);

  // Effect for initial URL parsing and popstate listener
  useEffect(() => {
    // Parse initial URL on mount
    const path = window.location.pathname;
    if (path.startsWith("/stop/")) {
      const stopId = path.substring(6); // Remove "/stop/" prefix
      if (stopId) {
        selectStop(stopId);
      }
    }

    // Listen for browser back/forward button
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { stopId?: string } | null;
      if (state?.stopId) {
        selectStop(state.stopId);
      } else {
        clearSelection();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectStop, clearSelection]);
}
