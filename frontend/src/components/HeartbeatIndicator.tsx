import { useEffect, useState } from "react";
import { useTrainStore } from "@/store/train-store";

// Data is considered stale after 30 seconds without update
const STALE_THRESHOLD_MS = 30_000;

export function HeartbeatIndicator() {
  const isConnected = useTrainStore((state) => state.isConnected);
  const isConnecting = useTrainStore((state) => state.isConnecting);
  const lastUpdate = useTrainStore((state) => state.lastUpdate);
  const trainCount = useTrainStore((state) => state.trains.length);

  const [isPulsing, setIsPulsing] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // Pulse animation when data updates
  useEffect(() => {
    if (lastUpdate > 0) {
      setIsPulsing(true);
      setIsStale(false);
      const timeout = setTimeout(() => setIsPulsing(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [lastUpdate]);

  // Check for stale data
  useEffect(() => {
    if (!isConnected || lastUpdate === 0) return;

    const checkStale = () => {
      const elapsed = Date.now() - lastUpdate;
      setIsStale(elapsed > STALE_THRESHOLD_MS);
    };

    checkStale();
    const interval = setInterval(checkStale, 5000);
    return () => clearInterval(interval);
  }, [isConnected, lastUpdate]);

  // Determine status color
  let statusColor = "bg-gray-500"; // Disconnected
  let glowColor = "none";

  if (isConnecting) {
    statusColor = "bg-yellow-500";
    glowColor = "0 0 8px #eab308";
  } else if (isConnected && isStale) {
    statusColor = "bg-orange-500";
    glowColor = "0 0 8px #f97316";
  } else if (isConnected) {
    statusColor = "bg-[#00d4ff]";
    glowColor = "0 0 8px #00d4ff";
  }

  // Status text
  let statusText = "Disconnected";
  if (isConnecting) {
    statusText = "Connecting...";
  } else if (isConnected && isStale) {
    statusText = `${trainCount} trains (stale)`;
  } else if (isConnected) {
    statusText = `${trainCount} trains`;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-white/60">
      {/* Status dot */}
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full ${statusColor} ${
            isPulsing ? "animate-ping" : ""
          }`}
          style={{ boxShadow: glowColor }}
        />
        {isPulsing && (
          <div
            className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${statusColor}`}
          />
        )}
      </div>

      {/* Status text */}
      <span>{statusText}</span>
    </div>
  );
}
