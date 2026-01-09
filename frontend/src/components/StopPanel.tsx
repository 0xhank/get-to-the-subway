import { useEffect } from "react";
import { useStopStore } from "@/store/stop-store";
import { getLineColor } from "@/lib/mta-colors";
import { X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

/**
 * Format arrival time (show countdown and absolute time)
 */
function formatArrivalTime(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const secondsUntil = unixTimestamp - now;
  const minutesUntil = Math.round(secondsUntil / 60);

  // Show absolute time
  const date = new Date(unixTimestamp * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  // Show time in format: "HH:MM:SS (in X min)"
  let countdown = "";
  if (minutesUntil <= 0) {
    countdown = "(now)";
  } else if (minutesUntil === 1) {
    countdown = "(in 1 min)";
  } else {
    countdown = `(in ${minutesUntil} min)`;
  }

  return `${hours}:${minutes}:${seconds} ${countdown}`;
}

/**
 * Route Badge Component
 */
function RouteBadge({ routeId }: { routeId: string }) {
  const color = getLineColor(routeId);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
      style={{ backgroundColor: color }}
      title={`Route ${routeId}`}
    >
      {routeId}
    </div>
  );
}

/**
 * Arrival Item Component
 */
function ArrivalItem({
  routeId,
  headsign,
  arrivalTime,
}: {
  routeId: string;
  headsign: string;
  arrivalTime: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
      <RouteBadge routeId={routeId} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{headsign}</p>
      </div>
      <p className="text-sm text-white/60 whitespace-nowrap">
        {formatArrivalTime(arrivalTime)}
      </p>
    </div>
  );
}

/**
 * Direction Section Component
 */
function DirectionSection({
  title,
  arrivals,
}: {
  title: string;
  arrivals: Array<{ routeId: string; headsign: string; arrivalTime: number }>;
}) {
  return (
    <div>
      <h3 className="px-4 py-2 text-xs font-semibold text-white/60 uppercase tracking-wide">
        {title}
      </h3>
      {arrivals.length === 0 ? (
        <div className="px-4 py-3 text-sm text-white/60">
          No upcoming trains
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {arrivals.map((arrival, idx) => (
            <ArrivalItem key={idx} {...arrival} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Panel content shared between mobile drawer and desktop side panel
 */
function StopPanelContent({
  stopData,
  isLoading,
  error,
  selectedStopId,
  clearSelection,
}: {
  stopData: ReturnType<typeof useStopStore>["stopData"];
  isLoading: boolean;
  error: string | null;
  selectedStopId: string | null;
  clearSelection: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading && !stopData ? (
        <div className="flex flex-col items-center justify-center h-32">
          <Loader2 className="h-6 w-6 text-white/60 animate-spin mb-2" />
          <p className="text-sm text-white/60">Loading arrivals...</p>
        </div>
      ) : error ? (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white mb-3">{error}</p>
              <Button
                size="sm"
                onClick={() => {
                  clearSelection();
                  setTimeout(() => selectedStopId && window.location.reload(), 100);
                }}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : stopData ? (
        <div className="divide-y divide-white/10">
          <DirectionSection
            title="Northbound"
            arrivals={stopData.stop.northArrivals.map((a) => ({
              routeId: a.routeId,
              headsign: a.headsign,
              arrivalTime: a.arrivalTime,
            }))}
          />
          <DirectionSection
            title="Southbound"
            arrivals={stopData.stop.southArrivals.map((a) => ({
              routeId: a.routeId,
              headsign: a.headsign,
              arrivalTime: a.arrivalTime,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

export function StopPanel() {
  const selectedStopId = useStopStore((state) => state.selectedStopId);
  const stopData = useStopStore((state) => state.stopData);
  const isLoading = useStopStore((state) => state.isLoading);
  const error = useStopStore((state) => state.error);
  const clearSelection = useStopStore((state) => state.clearSelection);
  const isMobile = useIsMobile();

  // Close panel on ESC key (desktop only)
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedStopId) {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStopId, clearSelection, isMobile]);

  // Mobile drawer layout
  if (isMobile) {
    return (
      <Drawer
        open={!!selectedStopId}
        onOpenChange={(open) => !open && clearSelection()}
        snapPoints={[0.5, 0.9]}
        activeSnapPoint={selectedStopId ? 0.5 : undefined}
      >
        <DrawerContent className="max-h-[90vh] bg-black/95 border-white/10">
          <DrawerHeader className="border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DrawerTitle className="text-white truncate">
                  {stopData?.stop.name || "Loading..."}
                </DrawerTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stopData?.stop.routes.map((routeId) => (
                    <RouteBadge key={routeId} routeId={routeId} />
                  ))}
                </div>
              </div>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <StopPanelContent
            stopData={stopData}
            isLoading={isLoading}
            error={error}
            selectedStopId={selectedStopId}
            clearSelection={clearSelection}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: don't render if no stop selected
  if (!selectedStopId) {
    return null;
  }

  // Desktop side panel layout
  return (
    <div
      className={`
        fixed right-0 top-0 bottom-0 w-96 bg-gradient-to-b from-white/10 to-white/5
        border-l border-white/10 backdrop-blur-sm z-20
        transform transition-transform duration-300 ease-out
        ${selectedStopId ? "translate-x-0" : "translate-x-full"}
        flex flex-col overflow-hidden
      `}
    >
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {stopData?.stop.name || "Loading..."}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {stopData?.stop.routes.map((routeId) => (
                <RouteBadge key={routeId} routeId={routeId} />
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearSelection}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Content */}
      <StopPanelContent
        stopData={stopData}
        isLoading={isLoading}
        error={error}
        selectedStopId={selectedStopId}
        clearSelection={clearSelection}
      />
    </div>
  );
}
