import { useEffect, useState, useRef } from "react";
import { X, RotateCcw, AlertCircle, Clock } from "lucide-react";
import { useNearbyArrivals, ProcessedTrain, NearbyStation } from "@/hooks/useNearbyArrivals";
import { useStopStore } from "@/store/stop-store";
import { useUIStore } from "@/store/ui-store";
import { getLineColor } from "@/lib/mta-colors";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/**
 * Live countdown timer for a train departure
 */
function TrainCountdown({ leaveAtMinutes }: { leaveAtMinutes: number }) {
  const [displayTime, setDisplayTime] = useState(leaveAtMinutes);

  useEffect(() => {
    // Update countdown every second
    const interval = setInterval(() => {
      setDisplayTime((prev) => {
        const newTime = prev - 1 / 60; // Decrease by 1 second
        return Math.max(0, newTime);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset when leaveAtMinutes changes
  useEffect(() => {
    setDisplayTime(leaveAtMinutes);
  }, [leaveAtMinutes]);

  const minutes = Math.floor(displayTime);
  const seconds = Math.round((displayTime - minutes) * 60);

  return (
    <span className="font-mono text-cyan-300 whitespace-nowrap">
      Leave in {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

/**
 * Route badge component
 */
function RouteBadge({ routeId }: { routeId: string }) {
  const bgColor = getLineColor(routeId);
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: bgColor }}
      title={`Route ${routeId}`}
    >
      {routeId}
    </span>
  );
}

/**
 * Train row with timing and severity indication
 */
function TrainRow({
  train,
  isAlternative,
  severity,
}: {
  train: ProcessedTrain;
  isAlternative: boolean;
  severity?: "ideal" | "too-soon" | "long-wait";
}) {
  const opacity = isAlternative || severity !== "ideal" ? "opacity-50" : "opacity-100";

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 text-sm border-t border-cyan-500/10 ${opacity}`}
    >
      <div className="flex items-center gap-2">
        <RouteBadge routeId={train.routeId} />
        <span className="text-gray-300 text-xs">{train.headsign}</span>
        {severity === "long-wait" && (
          <span className="flex items-center gap-1 text-amber-400 text-xs">
            <Clock className="w-3 h-3" /> long wait
          </span>
        )}
      </div>
      <TrainCountdown leaveAtMinutes={train.leaveAtMinutes} />
    </div>
  );
}

/**
 * Station card showing walking time and upcoming trains
 */
function StationCard({
  station,
  onSelectStation,
  onRetry,
  isHighlighted,
}: {
  station: NearbyStation;
  onSelectStation: (stopId: string) => void;
  onRetry: (stopId: string) => void;
  isHighlighted: boolean;
}) {
  const northbound = station.northbound.filter((t) => t.severity !== "too-soon");
  const southbound = station.southbound.filter((t) => t.severity !== "too-soon");
  const allTrains = [...northbound, ...southbound];

  return (
    <div
      className={`border-b border-cyan-500/10 cursor-pointer transition-all ${
        isHighlighted ? "bg-yellow-500/20" : ""
      } hover:bg-cyan-500/10`}
      onClick={() => onSelectStation(station.id)}
    >
      {/* Station header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <h3 className="font-semibold text-cyan-300 text-sm truncate">{station.name}</h3>
        {station.routes.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {station.routes.map((route) => (
              <RouteBadge key={route} routeId={route} />
            ))}
          </div>
        )}
        <p className="text-gray-500 text-xs ml-auto flex-shrink-0">{station.walkTimeFormatted}</p>
      </div>

      {/* Error state */}
      {station.error && (
        <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              {station.error}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(station.id);
              }}
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Trains */}
      {!station.error && (
        <>
          {/* Northbound trains */}
          {northbound.length > 0 && (
            <>
              <div className="px-3 py-1 bg-black/40 border-t border-cyan-500/10 text-xs text-gray-500">
                ↑ Northbound
              </div>
              {northbound.map((train, idx) => (
                <TrainRow
                  key={`nb-${idx}`}
                  train={train}
                  isAlternative={train.isAlternative}
                  severity={train.severity}
                />
              ))}
            </>
          )}

          {/* Southbound trains */}
          {southbound.length > 0 && (
            <>
              <div className="px-3 py-1 bg-black/40 border-t border-cyan-500/10 text-xs text-gray-500">
                ↓ Southbound
              </div>
              {southbound.map((train, idx) => (
                <TrainRow
                  key={`sb-${idx}`}
                  train={train}
                  isAlternative={train.isAlternative}
                  severity={train.severity}
                />
              ))}
            </>
          )}

          {/* No trains message */}
          {allTrains.length === 0 && (
            <div className="px-3 py-2 text-center text-gray-500 text-xs border-t border-cyan-500/10">
              No upcoming trains
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Panel content shared between mobile drawer and desktop fixed panel
 */
function NearbyPanelContent({
  stations,
  isLoading,
  error,
  highlightedId,
  onSelectStation,
  onRetry,
}: {
  stations: NearbyStation[];
  isLoading: boolean;
  error: string | null;
  highlightedId: string | null;
  onSelectStation: (stopId: string) => void;
  onRetry: (stopId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Error state */}
      {error && (
        <div className="px-4 py-3 text-red-400 text-xs border-b border-red-500/20 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && stations.length === 0 && (
        <div className="px-4 py-4 text-center text-gray-500 text-sm">
          <div className="inline-block animate-spin mb-2">⟳</div>
          <p>Loading nearby stations...</p>
        </div>
      )}

      {/* No nearby stations */}
      {!isLoading && stations.length === 0 && !error && (
        <div className="px-4 py-4 text-center text-gray-500 text-sm">
          No stations within 0.5 miles
        </div>
      )}

      {/* Station list */}
      {stations.map((station) => (
        <StationCard
          key={station.id}
          station={station}
          onSelectStation={onSelectStation}
          onRetry={onRetry}
          isHighlighted={station.id === highlightedId}
        />
      ))}
    </div>
  );
}

/**
 * Nearby Stations Panel - shows stations within 0.5 miles with departure timing
 */
export function NearbyPanel() {
  const { stations, isLoading, error, retryStation } = useNearbyArrivals();
  const { nearbyPanelOpen, setNearbyPanelOpen } = useUIStore();
  const { selectStop } = useStopStore();
  const isMobile = useIsMobile();

  // Track which station was previously first for highlight animation
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const prevStationsRef = useRef<NearbyStation[]>([]);

  // Detect if stations reordered and highlight the changed one
  useEffect(() => {
    if (stations.length > 0 && prevStationsRef.current.length > 0) {
      const prevFirstId = prevStationsRef.current[0]?.id;
      const currFirstId = stations[0]?.id;

      if (prevFirstId !== currFirstId) {
        setHighlightedId(currFirstId || null);

        // Remove highlight after 1 second
        const timeout = setTimeout(() => {
          setHighlightedId(null);
        }, 1000);

        return () => clearTimeout(timeout);
      }
    }

    prevStationsRef.current = stations;
  }, [stations]);

  // Handle keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && nearbyPanelOpen) {
        setNearbyPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nearbyPanelOpen, setNearbyPanelOpen, isMobile]);

  const handleSelectStation = (stopId: string) => {
    selectStop(stopId);
  };

  // Mobile drawer layout
  if (isMobile) {
    return (
      <Drawer
        open={nearbyPanelOpen}
        onOpenChange={setNearbyPanelOpen}
        snapPoints={[0.4, 0.9]}
        activeSnapPoint={nearbyPanelOpen ? 0.4 : undefined}
      >
        <DrawerContent className="max-h-[90vh] bg-black/95 border-cyan-500/20">
          <DrawerHeader className="border-b border-cyan-500/20">
            <DrawerTitle className="text-cyan-300">
              Nearby Stations
              {stations.length > 0 && (
                <span className="ml-2 text-gray-500 font-normal">({stations.length})</span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <NearbyPanelContent
            stations={stations}
            isLoading={isLoading}
            error={error}
            highlightedId={highlightedId}
            onSelectStation={handleSelectStation}
            onRetry={retryStation}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: don't render if closed
  if (!nearbyPanelOpen) return null;

  // Desktop fixed panel layout
  return (
    <div className="fixed bottom-4 left-4 w-96 max-h-[60vh] rounded-lg overflow-hidden border border-cyan-500/20 bg-black/60 backdrop-blur-sm flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 flex-shrink-0">
        <h2 className="text-sm font-semibold text-cyan-300">
          Nearby Stations
          {stations.length > 0 && <span className="ml-2 text-gray-500">({stations.length})</span>}
        </h2>
        <button
          onClick={() => setNearbyPanelOpen(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Close nearby stations panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <NearbyPanelContent
        stations={stations}
        isLoading={isLoading}
        error={error}
        highlightedId={highlightedId}
        onSelectStation={handleSelectStation}
        onRetry={retryStation}
      />
    </div>
  );
}
