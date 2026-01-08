import { useMemo, useEffect, useState } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { CircleLayerSpecification, SymbolLayerSpecification } from "maplibre-gl";
import { useInterpolatedTrains, type InterpolatedTrain } from "@/hooks/useInterpolatedTrains";
import { getLineColor } from "@/lib/mta-colors";

/**
 * Hook to load the arrow icon into MapLibre.
 * Returns true when the icon is ready to use.
 */
function useArrowIcon(): boolean {
  const { current: map } = useMap();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!map) return;

    const loadIcon = () => {
      if (map.hasImage("train-arrow")) {
        setIsLoaded(true);
        return;
      }

      try {
        // Draw triangle using canvas - more reliable than data URI Image loading
        const canvas = document.createElement("canvas");
        canvas.width = 14;
        canvas.height = 18;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          console.error("Failed to get canvas context");
          return;
        }

        // Draw white triangle (point up)
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.moveTo(7, 0);      // Top point
        ctx.lineTo(14, 18);    // Bottom right
        ctx.lineTo(0, 18);     // Bottom left
        ctx.closePath();
        ctx.fill();

        // Add the canvas as an image to the map
        const imageData = ctx.getImageData(0, 0, 14, 18);
        map.addImage("train-arrow", imageData, { sdf: true });
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load train arrow icon:", error);
      }
    };

    if (map.loaded()) {
      loadIcon();
    } else {
      map.on("load", loadIcon);
      return () => {
        map.off("load", loadIcon);
      };
    }
  }, [map]);

  return isLoaded;
}

// Calculate position offset behind a train based on bearing
function getTrailPosition(
  lat: number,
  lon: number,
  bearing: number,
  distance: number
): [number, number] {
  // Convert bearing to radians and calculate offset (moving backward)
  const bearingRad = ((bearing + 180) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // Approximate offset in degrees (distance is in degrees, roughly)
  const dLat = distance * Math.cos(bearingRad);
  const dLon = distance * Math.sin(bearingRad) / Math.cos(latRad);

  return [lon + dLon, lat + dLat];
}

// Trail configuration
const TRAIL_SEGMENTS = [
  { distance: 0.00015, opacity: 0.5 },
  { distance: 0.00030, opacity: 0.25 },
  { distance: 0.00045, opacity: 0.1 },
];

// Convert trains to GeoJSON FeatureCollection (includes trail points)
function trainsToGeoJSON(trains: InterpolatedTrain[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const train of trains) {
    const color = getLineColor(train.line);
    const bearing = train.bearing ?? 0;

    // Add trail segments (rendered first, so they appear behind)
    if (train.hasBearing) {
      for (const segment of TRAIL_SEGMENTS) {
        const [trailLon, trailLat] = getTrailPosition(
          train.latitude,
          train.longitude,
          bearing,
          segment.distance
        );
        features.push({
          type: "Feature",
          id: `${train.id}-trail-${segment.distance}`,
          geometry: {
            type: "Point",
            coordinates: [trailLon, trailLat],
          },
          properties: {
            id: train.id,
            color,
            bearing,
            opacity: segment.opacity,
            isTrail: true,
            scale: train.scale,
          },
        });
      }
    }

    // Add main train marker
    features.push({
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
        color,
        bearing,
        scale: train.scale,
        hasBearing: train.hasBearing,
        isTrail: false,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Trail layer (fading triangles behind moving trains)
const trailLayer: SymbolLayerSpecification = {
  id: "trains-trail",
  type: "symbol",
  source: "trains",
  filter: ["==", ["get", "isTrail"], true],
  layout: {
    "icon-image": "train-arrow",
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 0.35, ["get", "scale"]],
      14, ["*", 0.5, ["get", "scale"]],
      18, ["*", 0.7, ["get", "scale"]],
    ],
    "icon-rotate": ["get", "bearing"],
    "icon-rotation-alignment": "map",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-opacity": ["get", "opacity"],
  },
};

// Arrow layer (for trains with valid bearing)
const arrowLayer: SymbolLayerSpecification = {
  id: "trains-arrow",
  type: "symbol",
  source: "trains",
  filter: ["all", ["==", ["get", "hasBearing"], true], ["==", ["get", "isTrail"], false]],
  layout: {
    "icon-image": "train-arrow",
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 0.4, ["get", "scale"]],
      14, ["*", 0.6, ["get", "scale"]],
      18, ["*", 0.85, ["get", "scale"]],
    ],
    "icon-rotate": ["get", "bearing"],
    "icon-rotation-alignment": "map",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-halo-color": "#1a1a1a",
    "icon-halo-width": 1,
    "icon-opacity": 1,
  },
};

// Fallback circle layer (for trains without bearing)
const fallbackCircleLayer: CircleLayerSpecification = {
  id: "trains-circle-fallback",
  type: "circle",
  source: "trains",
  filter: ["all", ["!=", ["get", "hasBearing"], true], ["!=", ["get", "isTrail"], true]],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 3, ["get", "scale"]],
      14, ["*", 5, ["get", "scale"]],
      18, ["*", 8, ["get", "scale"]],
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 1,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#1a1a1a",
  },
};

export function TrainLayer() {
  const trains = useInterpolatedTrains();
  useArrowIcon(); // Load icon but don't block rendering

  const geojson = useMemo(() => trainsToGeoJSON(trains), [trains]);

  // Always render all layers - fallback circle layer will only show for trains without bearing
  return (
    <Source id="trains" type="geojson" data={geojson}>
      <Layer {...trailLayer} />
      <Layer {...arrowLayer} />
      <Layer {...fallbackCircleLayer} />
    </Source>
  );
}
