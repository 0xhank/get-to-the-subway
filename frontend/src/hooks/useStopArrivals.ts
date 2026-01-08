import { useEffect, useRef } from "react";
import { useStopStore } from "@/store/stop-store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const POLLING_INTERVAL = 15000; // 15 seconds

export function useStopArrivals(): void {
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedStopId = useStopStore((state) => state.selectedStopId);
  const setStopData = useStopStore((state) => state.setStopData);
  const setLoading = useStopStore((state) => state.setLoading);
  const setError = useStopStore((state) => state.setError);
  const pollingInterval = useStopStore((state) => state.pollingInterval);
  const setPollingInterval = useStopStore((state) => state.setPollingInterval);

  // Fetch arrivals from the API
  const fetchArrivals = async (stopId: string) => {
    // Cancel any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/stops/${stopId}/arrivals`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        const errorMessage = errorData.error || `HTTP ${response.status}`;

        switch (errorMessage) {
          case "STOP_NOT_FOUND":
            setError("Stop not found");
            break;
          case "TIMEOUT":
            setError("Request timed out. Please try again.");
            break;
          case "SERVICE_UNAVAILABLE":
            setError("Service unavailable. Please try again later.");
            break;
          default:
            setError(`Error: ${errorMessage}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setStopData(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Aborted request - don't show error
        return;
      }
      setError("Failed to fetch arrivals");
      setLoading(false);
    }
  };

  // Effect for watching selectedStopId changes
  useEffect(() => {
    if (!selectedStopId) {
      // Clear polling when stop is deselected
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      return;
    }

    // Initial fetch
    fetchArrivals(selectedStopId);

    // Set up polling
    const interval = setInterval(() => {
      // Only poll if stop is still selected
      const currentStopId = useStopStore.getState().selectedStopId;
      if (currentStopId === selectedStopId) {
        fetchArrivals(selectedStopId);
      }
    }, POLLING_INTERVAL);

    setPollingInterval(interval);

    // Cleanup
    return () => {
      clearInterval(interval);
      setPollingInterval(null);
      abortControllerRef.current?.abort();
    };
  }, [selectedStopId]);
}
