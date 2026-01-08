import { useState } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { UIOverlay } from "@/components/UIOverlay";
import { SearchDialog } from "@/components/SearchDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { Toaster } from "@/components/ui/sonner";
import { TrainLayer } from "@/components/Map/TrainLayer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFps } from "@/hooks/useFps";
import { useTrainStream } from "@/hooks/useTrainStream";

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

  return (
    <div className="relative w-full h-full">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
      >
        <TrainLayer />
      </Map>

      <UIOverlay />
      <SearchDialog />
      <AboutDialog />
      <Toaster />
    </div>
  );
}
