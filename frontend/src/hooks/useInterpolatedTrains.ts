import { useEffect, useRef, useState, useCallback } from "react";
import { useTrainStore } from "@/store/train-store";
import type { Train } from "@live-subway/shared";

// Animation duration for smooth transitions when data changes
const TRANSITION_DURATION_MS = 800;

// Linear interpolation
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Clamp value between 0 and 1
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Ease-out cubic for smoother transitions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface TrainAnimationState {
  // Position we're transitioning FROM (when data changes)
  fromLat: number;
  fromLon: number;
  // When the transition started
  transitionStart: number;
  // The segment we're tracking (to detect changes)
  prevStopId?: string;
  nextStopId?: string;
}

/**
 * Calculates real-time train positions with smooth transitions.
 * - Uses timing data for continuous movement between stations
 * - Smoothly animates when trains jump to new segments
 */
export function useInterpolatedTrains(): Train[] {
  const trains = useTrainStore((state) => state.trains);
  const [interpolatedTrains, setInterpolatedTrains] = useState<Train[]>([]);

  // Track animation state for each train
  const animationStates = useRef<Map<string, TrainAnimationState>>(new Map());

  // Calculate target position based on timing data
  const getTargetPosition = useCallback((train: Train): { lat: number; lon: number } => {
    if (!train.prevStop || !train.nextStop) {
      return { lat: train.latitude, lon: train.longitude };
    }

    const { prevStop, nextStop } = train;
    const totalTime = nextStop.time - prevStop.time;

    if (totalTime <= 0) {
      return { lat: train.latitude, lon: train.longitude };
    }

    const now = Date.now() / 1000;
    const elapsed = now - prevStop.time;
    const progress = clamp01(elapsed / totalTime);

    return {
      lat: lerp(prevStop.latitude, nextStop.latitude, progress),
      lon: lerp(prevStop.longitude, nextStop.longitude, progress),
    };
  }, []);

  // Calculate positions with smooth transitions
  const calculatePositions = useCallback(() => {
    const now = Date.now();

    return trains.map((train) => {
      const target = getTargetPosition(train);
      let state = animationStates.current.get(train.id);

      // Check if segment changed (train jumped to new prev/next stops)
      const segmentChanged = state && (
        state.prevStopId !== train.prevStop?.stopId ||
        state.nextStopId !== train.nextStop?.stopId
      );

      // Initialize or update animation state
      if (!state) {
        // First time seeing this train - no transition needed
        state = {
          fromLat: target.lat,
          fromLon: target.lon,
          transitionStart: 0, // No transition
          prevStopId: train.prevStop?.stopId,
          nextStopId: train.nextStop?.stopId,
        };
        animationStates.current.set(train.id, state);
      } else if (segmentChanged) {
        // Segment changed - start smooth transition from current rendered position
        state.fromLat = state.lastRenderedLat ?? target.lat;
        state.fromLon = state.lastRenderedLon ?? target.lon;
        state.transitionStart = now;
        state.prevStopId = train.prevStop?.stopId;
        state.nextStopId = train.nextStop?.stopId;
      }

      // Calculate final position
      let finalLat = target.lat;
      let finalLon = target.lon;

      // If in transition, blend from old position to new target
      if (state.transitionStart > 0) {
        const transitionElapsed = now - state.transitionStart;
        const transitionProgress = clamp01(transitionElapsed / TRANSITION_DURATION_MS);

        if (transitionProgress < 1) {
          const easedProgress = easeOutCubic(transitionProgress);
          finalLat = lerp(state.fromLat, target.lat, easedProgress);
          finalLon = lerp(state.fromLon, target.lon, easedProgress);
        } else {
          // Transition complete
          state.transitionStart = 0;
        }
      }

      // Store last rendered position for next transition
      (state as TrainAnimationState & { lastRenderedLat?: number; lastRenderedLon?: number }).lastRenderedLat = finalLat;
      (state as TrainAnimationState & { lastRenderedLat?: number; lastRenderedLon?: number }).lastRenderedLon = finalLon;

      return {
        ...train,
        latitude: finalLat,
        longitude: finalLon,
      };
    });
  }, [trains, getTargetPosition]);

  // Clean up stale animation states
  useEffect(() => {
    const currentIds = new Set(trains.map((t) => t.id));
    for (const id of animationStates.current.keys()) {
      if (!currentIds.has(id)) {
        animationStates.current.delete(id);
      }
    }
  }, [trains]);

  // Animation loop
  useEffect(() => {
    if (trains.length === 0) {
      setInterpolatedTrains([]);
      return;
    }

    let animationId: number;

    function animate() {
      setInterpolatedTrains(calculatePositions());
      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [trains, calculatePositions]);

  return interpolatedTrains;
}
