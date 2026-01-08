import { useEffect, useRef, useState, useCallback } from "react";
import { useTrainStore } from "@/store/train-store";
import type { Train } from "@live-subway/shared";

// Animation durations
const POSITION_TRANSITION_DURATION_MS = 300;
const BEARING_TRANSITION_DURATION_MS = 300;

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

/**
 * Interpolate bearing taking the shortest rotational path.
 * Handles wraparound (e.g., 350 -> 10 goes through 0, not 180).
 */
function interpolateBearing(
  fromBearing: number,
  toBearing: number,
  progress: number
): number {
  let diff = toBearing - fromBearing;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const easedProgress = easeOutCubic(progress);
  return (fromBearing + diff * easedProgress + 360) % 360;
}

/**
 * Calculate pulse scale for stopped trains.
 * Returns scale factor between 1.0 and 1.15.
 */
function calculatePulseScale(now: number, stoppedSince: number): number {
  const elapsed = now - stoppedSince;
  const period = 1500; // 1.5 seconds
  const phase = (elapsed % period) / period;

  // Sinusoidal: smooth 0 -> 1 -> 0 over the period
  const pulse = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

  return 1.0 + pulse * 0.15;
}

export interface InterpolatedTrain extends Omit<Train, 'bearing'> {
  bearing: number | null;
  scale: number;
  hasBearing: boolean;
}

interface TrainAnimationState {
  // Position we're transitioning FROM (when data changes)
  fromLat: number;
  fromLon: number;
  // When the position transition started
  transitionStart: number;
  // The segment we're tracking (to detect changes)
  prevStopId?: string;
  nextStopId?: string;
  // Last rendered position (for next transition)
  lastRenderedLat?: number;
  lastRenderedLon?: number;
  // Bearing animation state
  fromBearing?: number;
  bearingTransitionStart: number;
  lastRenderedBearing?: number;
  // Pulse animation (for stopped trains)
  stoppedSince?: number;
}

/**
 * Calculates real-time train positions with smooth transitions.
 * - Uses timing data for continuous movement between stations
 * - Smoothly animates when trains jump to new segments
 * - Interpolates bearing changes over 500ms
 * - Pulses stopped trains with gentle scale animation
 */
export function useInterpolatedTrains(): InterpolatedTrain[] {
  const trains = useTrainStore((state) => state.trains);
  const [interpolatedTrains, setInterpolatedTrains] = useState<InterpolatedTrain[]>([]);

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

    return trains.map((train): InterpolatedTrain => {
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
          transitionStart: 0,
          prevStopId: train.prevStop?.stopId,
          nextStopId: train.nextStop?.stopId,
          bearingTransitionStart: 0,
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

      // If in position transition, blend from old position to new target
      if (state.transitionStart > 0) {
        const transitionElapsed = now - state.transitionStart;
        const transitionProgress = clamp01(transitionElapsed / POSITION_TRANSITION_DURATION_MS);

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
      state.lastRenderedLat = finalLat;
      state.lastRenderedLon = finalLon;

      // Handle bearing interpolation
      let finalBearing: number | null = train.bearing ?? null;
      if (finalBearing !== null) {
        // Check if bearing changed significantly (threshold to avoid micro-transitions)
        const bearingChanged =
          state.lastRenderedBearing !== undefined &&
          Math.abs(state.lastRenderedBearing - finalBearing) > 1;

        if (bearingChanged && state.bearingTransitionStart === 0) {
          // Start new bearing transition
          state.fromBearing = state.lastRenderedBearing;
          state.bearingTransitionStart = now;
        }

        // Interpolate if in transition
        if (state.bearingTransitionStart > 0 && state.fromBearing !== undefined) {
          const bearingElapsed = now - state.bearingTransitionStart;
          const bearingProgress = clamp01(bearingElapsed / BEARING_TRANSITION_DURATION_MS);

          if (bearingProgress < 1) {
            finalBearing = interpolateBearing(state.fromBearing, finalBearing, bearingProgress);
          } else {
            // Transition complete
            state.bearingTransitionStart = 0;
          }
        }

        state.lastRenderedBearing = finalBearing;
      }

      // Handle pulse scale for stopped trains
      let scale = 1.0;
      if (train.status === "AT_STOP") {
        if (!state.stoppedSince) {
          state.stoppedSince = now;
        }
        scale = calculatePulseScale(now, state.stoppedSince);
      } else {
        state.stoppedSince = undefined;
      }

      return {
        ...train,
        latitude: finalLat,
        longitude: finalLon,
        bearing: finalBearing,
        scale,
        hasBearing: finalBearing !== null,
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

    // Calculate immediately for initial render (critical for cached trains)
    setInterpolatedTrains(calculatePositions());

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
