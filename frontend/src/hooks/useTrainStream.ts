import { useEffect, useRef } from "react";
import { useTrainStore } from "@/store/train-store";
import type { Train, FeedStatus } from "@live-subway/shared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SSE_ENDPOINT = `${API_URL}/api/trains/stream`;

// Reconnection config
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

interface SSETrainEvent {
  type: "trains";
  data: {
    trains: Train[];
    feedStatuses: FeedStatus[];
    timestamp: number;
  };
}

export function useTrainStream(): void {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTrains = useTrainStore((state) => state.setTrains);
  const setConnectionState = useTrainStore((state) => state.setConnectionState);

  useEffect(() => {
    function connect() {
      // Clean up any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnectionState(false, true);
      console.log("Connecting to SSE stream...");

      const eventSource = new EventSource(SSE_ENDPOINT);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("SSE connected");
        setConnectionState(true, false);
        retryDelayRef.current = INITIAL_RETRY_DELAY;
      };

      eventSource.addEventListener("trains", (event) => {
        try {
          const parsed = JSON.parse(event.data) as SSETrainEvent;
          setTrains(parsed.data.trains, parsed.data.feedStatuses);
        } catch (error) {
          console.error("Failed to parse train event:", error);
        }
      });

      eventSource.addEventListener("heartbeat", (_event) => {
        // Heartbeat received - connection is alive
        // Could update a "last heartbeat" timestamp if needed
      });

      eventSource.onerror = () => {
        console.error("SSE connection error");
        setConnectionState(false, false);
        eventSource.close();

        // Schedule reconnection with exponential backoff
        const delay = retryDelayRef.current;
        console.log(`Reconnecting in ${delay}ms...`);

        retryTimeoutRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(
            retryDelayRef.current * 2,
            MAX_RETRY_DELAY
          );
          connect();
        }, delay);
      };
    }

    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [setTrains, setConnectionState]);
}
