import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { CircleLayerSpecification, SymbolLayerSpecification } from "maplibre-gl";
import { useInterpolatedTrains } from "@/hooks/useInterpolatedTrains";
import { getLineColor } from "@/lib/mta-colors";
import type { Train } from "@live-subway/shared";

// Convert trains to GeoJSON FeatureCollection
function trainsToGeoJSON(trains: Train[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trains.map((train) => ({
      type: "Feature",
      id: train.id,
      geometry: {
        type: "Point",
        coordinates: [train.longitude, train.latitude],
      },
      properties: {
        id: train.id,
        line: train.line,
        direction: train.direction,
        status: train.status,
        color: getLineColor(train.line),
      },
    })),
  };
}

// Glow layer (behind main circles)
const glowLayer: CircleLayerSpecification = {
  id: "trains-glow",
  type: "circle",
  source: "trains",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 8,
      14, 16,
      18, 24,
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 0.3,
    "circle-blur": 1,
  },
};

// Main train circle layer
const circleLayer: CircleLayerSpecification = {
  id: "trains-circle",
  type: "circle",
  source: "trains",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 4,
      14, 8,
      18, 12,
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 1,
    "circle-stroke-width": 1,
    "circle-stroke-color": "rgba(255, 255, 255, 0.5)",
  },
};

// Label layer (shows line letter at high zoom)
const labelLayer: SymbolLayerSpecification = {
  id: "trains-label",
  type: "symbol",
  source: "trains",
  minzoom: 13,
  layout: {
    "text-field": ["get", "line"],
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      13, 8,
      16, 12,
    ],
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": ["get", "color"],
    "text-halo-width": 2,
  },
};

export function TrainLayer() {
  const trains = useInterpolatedTrains();

  const geojson = useMemo(() => trainsToGeoJSON(trains), [trains]);

  return (
    <Source id="trains" type="geojson" data={geojson}>
      <Layer {...glowLayer} />
      <Layer {...circleLayer} />
      <Layer {...labelLayer} />
    </Source>
  );
}
