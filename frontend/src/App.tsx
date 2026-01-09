import { useState, useEffect, useRef } from "react";
import Map from "react-map-gl/maplibre";
import type { MapLayerMouseEvent, MapGeoJSONFeature } from "react-map-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";

import { UIOverlay } from "@/components/UIOverlay";
import { SearchDialog } from "@/components/SearchDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { Toaster } from "@/components/ui/sonner";
import { RouteLineLayer } from "@/components/Map/RouteLineLayer";
import { TrainLayer } from "@/components/Map/TrainLayer";
import { StopLayer } from "@/components/Map/StopLayer";
import { UserLocationLayer } from "@/components/Map/UserLocationLayer";
import { StopPanel } from "@/components/StopPanel";
import { ZoomControls } from "@/components/ZoomControls";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFps } from "@/hooks/useFps";
import { useTrainStream } from "@/hooks/useTrainStream";
import { useStopArrivals } from "@/hooks/useStopArrivals";
import { useStopRouting } from "@/hooks/useStopRouting";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useStopStore } from "@/store/stop-store";
import { useUIStore } from "@/store/ui-store";
import { useIsMobile } from "@/hooks/useIsMobile";

const INITIAL_VIEW = {
  longitude: -73.985,
  latitude: 40.758,
  zoom: 12,
};

// NYC bounds to constrain panning (expanded by 25%)
const NYC_BOUNDS = {
  minLongitude: -74.36,
  maxLongitude: -73.63,
  minLatitude: 40.53,
  maxLatitude: 40.96,
};

interface HoverState {
  stationId: string | null;
  stationName: string;
  trains: string[];
  x: number;
  y: number;
}

export default function App() {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hover, setHover] = useState<HoverState>({
    stationId: null,
    stationName: "",
    trains: [],
    x: 0,
    y: 0,
  });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize hooks
  useKeyboardShortcuts();
  useFps();
  useTrainStream();
  useStopArrivals();
  useStopRouting();

  const { getCurrentPosition, position, error, isSupported } = useGeolocation();
  const userLocation = useUIStore((state) => state.userLocation);
  const setUserLocation = useUIStore((state) => state.setUserLocation);
  const mapTarget = useUIStore((state) => state.mapTarget);
  const setMapTarget = useUIStore((state) => state.setMapTarget);

  const selectStop = useStopStore((state) => state.selectStop);
  const clearSelection = useStopStore((state) => state.clearSelection);
  const isMobile = useIsMobile();

  // Request geolocation on mount
  useEffect(() => {
    if (isSupported) {
      getCurrentPosition();
    }
  }, [getCurrentPosition, isSupported]);

  // Handle position update - center map on user location
  useEffect(() => {
    if (position) {
      const { latitude, longitude } = position.coords;
      setUserLocation({ latitude, longitude });
      setViewState({
        latitude,
        longitude,
        zoom: 14,
      });
    }
  }, [position, setUserLocation]);

  // Handle geolocation errors
  useEffect(() => {
    if (error) {
      if (error.code === 1) {
        toast.error("Location access denied. Showing default NYC view.");
      } else if (error.code === 2) {
        toast.error("Unable to determine your location. Showing default NYC view.");
      } else if (error.code === 3) {
        toast.error("Location request timed out. Showing default NYC view.");
      }
    }
  }, [error]);

  // Handle map target (e.g., from search)
  useEffect(() => {
    if (mapTarget) {
      setViewState({
        latitude: mapTarget.latitude,
        longitude: mapTarget.longitude,
        zoom: 15,
      });
      setMapTarget(null);
    }
  }, [mapTarget, setMapTarget]);

  const handleMapClick = async (e: MapLayerMouseEvent) => {
    // Check if a stop marker was clicked
    const features = (e.features as MapGeoJSONFeature[]) || [];
    const stopFeature = features.find((f) => f.layer.id === "stops-circle");

    if (stopFeature) {
      const stationId = stopFeature.properties.id;

      if (isMobile) {
        // On mobile: first tap shows tooltip, second tap opens panel
        if (hover.stationId === stationId) {
          // Same station tapped again - open panel
          setHover({ stationId: null, stationName: "", trains: [], x: 0, y: 0 });
          selectStop(stationId);
        } else {
          // New station tapped - show tooltip
          const stationName = stopFeature.properties.name || "";
          try {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/stops/${stationId}/arrivals`
            );
            const data = await response.json();
            const trainSet = new Set<string>();
            if (data.stop?.northArrivals) {
              data.stop.northArrivals.forEach((arrival: { routeId: string }) => {
                trainSet.add(arrival.routeId);
              });
            }
            if (data.stop?.southArrivals) {
              data.stop.southArrivals.forEach((arrival: { routeId: string }) => {
                trainSet.add(arrival.routeId);
              });
            }
            setHover({
              stationId,
              stationName,
              trains: Array.from(trainSet).sort(),
              x: e.originalEvent.clientX,
              y: e.originalEvent.clientY,
            });
          } catch {
            setHover({
              stationId,
              stationName,
              trains: [],
              x: e.originalEvent.clientX,
              y: e.originalEvent.clientY,
            });
          }
        }
      } else {
        // Desktop: click opens panel directly
        selectStop(stationId);
      }
    } else if (e.target === e.currentTarget || features.length === 0) {
      // Map background clicked
      if (isMobile && hover.stationId) {
        // On mobile: dismiss tooltip
        setHover({ stationId: null, stationName: "", trains: [], x: 0, y: 0 });
      } else {
        // Desktop: close panel
        clearSelection();
      }
    }
  };

  const handleMouseMove = async (e: MapLayerMouseEvent) => {
    // Disable hover tooltip on mobile (handled by tap instead)
    if (isMobile) return;

    const features = (e.features as MapGeoJSONFeature[]) || [];
    const stopFeature = features.find((f) => f.layer.id === "stops-circle");

    if (stopFeature && stopFeature.properties) {
      // Clear any pending clear timeout if we're hovering over a station
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

      const stationId = stopFeature.properties.id;
      const stationName = stopFeature.properties.name || "";

      try {
        // Fetch arrivals for this station
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/stops/${stationId}/arrivals`
        );
        const data = await response.json();

        // Extract unique train lines from arrivals
        const trainSet = new Set<string>();
        if (data.stop?.northArrivals) {
          data.stop.northArrivals.forEach((arrival: any) => {
            trainSet.add(arrival.routeId);
          });
        }
        if (data.stop?.southArrivals) {
          data.stop.southArrivals.forEach((arrival: any) => {
            trainSet.add(arrival.routeId);
          });
        }

        setHover({
          stationId,
          stationName,
          trains: Array.from(trainSet).sort(),
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      } catch (error) {
        console.error("Failed to fetch stop arrivals:", error);
        setHover({
          stationId,
          stationName,
          trains: [],
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      }
    } else {
      // Mouse moved off station - schedule clearing with debounce
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
        setHover({ stationId: null, stationName: "", trains: [], x: 0, y: 0 });
        hoverTimeoutRef.current = null;
      }, 100);
    }
  };

  const handleMouseLeave = () => {
    // Debounce clearing the hover to prevent flickering
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHover({ stationId: null, stationName: "", trains: [], x: 0, y: 0 });
      hoverTimeoutRef.current = null;
    }, 100);
  };

  return (
    <div className="relative w-full h-full">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={["stops-circle"]}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{
          width: "100%",
          height: "100%",
          cursor: hover.stationId ? "pointer" : "grab",
        }}
        maxBounds={[
          [NYC_BOUNDS.minLongitude, NYC_BOUNDS.minLatitude],
          [NYC_BOUNDS.maxLongitude, NYC_BOUNDS.maxLatitude],
        ]}
        minZoom={10}
        maxZoom={16}
      >
        <RouteLineLayer />
        <TrainLayer />
        <StopLayer />
        <UserLocationLayer location={userLocation} />
        {/* Zoom controls inside Map for useMap() access */}
        {isMobile && (
          <div className="absolute bottom-16 right-2 z-10">
            <ZoomControls />
          </div>
        )}
      </Map>

      {hover.stationId && (
        <div
          className="absolute bg-black/90 text-white px-3 py-2 rounded-lg text-sm pointer-events-none max-w-xs"
          style={{
            left: `${hover.x + 10}px`,
            top: `${hover.y + 10}px`,
            zIndex: 50,
          }}
        >
          <div className="font-semibold">{hover.stationName}</div>
          {hover.trains.length > 0 && (
            <div className="text-xs text-gray-300 mt-1">
              Lines: {hover.trains.join(", ")}
            </div>
          )}
        </div>
      )}

      <UIOverlay />
      <SearchDialog />
      <AboutDialog />
      <StopPanel />
      <Toaster />
    </div>
  );
}
