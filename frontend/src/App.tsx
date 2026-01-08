import { useState } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { UIOverlay } from "@/components/UIOverlay";
import { SearchDialog } from "@/components/SearchDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { Toaster } from "@/components/ui/sonner";
import { TrainLayer } from "@/components/Map/TrainLayer";
import { StopLayer } from "@/components/Map/StopLayer";
import { StopPanel } from "@/components/StopPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFps } from "@/hooks/useFps";
import { useTrainStream } from "@/hooks/useTrainStream";
import { useStopArrivals } from "@/hooks/useStopArrivals";
import { useStopRouting } from "@/hooks/useStopRouting";
import { useStopStore } from "@/store/stop-store";

const INITIAL_VIEW = {
  longitude: -73.985,
  latitude: 40.758,
  zoom: 12,
};

export default function App() {
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  // Initialize hooks
  useKeyboardShortcuts();
  useFps();
  useTrainStream();
  useStopArrivals();
  useStopRouting();

  const selectStop = useStopStore((state) => state.selectStop);
  const clearSelection = useStopStore((state) => state.clearSelection);

  const handleMapClick = (e: any) => {
    // Check if a stop marker was clicked
    const features = e.features || [];
    const stopFeature = features.find((f: any) => f.layer.id === "stops-circle");

    if (stopFeature) {
      // Stop marker clicked
      selectStop(stopFeature.properties.id);
    } else if (e.target === e.currentTarget || features.length === 0) {
      // Map background clicked, close panel
      clearSelection();
    }
  };

  return (
    <div className="relative w-full h-full">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        interactiveLayerIds={["stops-circle"]}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
      >
        <TrainLayer />
        <StopLayer />
      </Map>

      <UIOverlay />
      <SearchDialog />
      <AboutDialog />
      <StopPanel />
      <Toaster />
    </div>
  );
}
