import { useMemo, useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { CircleLayerSpecification } from "maplibre-gl";

interface UserLocationLayerProps {
  location: { latitude: number; longitude: number } | null;
}

// Inner dot layer - solid blue circle with white border
const innerDotLayer: CircleLayerSpecification = {
  id: "user-location-inner",
  type: "circle",
  source: "user-location",
  paint: {
    "circle-radius": 8,
    "circle-color": "#3b82f6",
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
};

// Outer ring layer - pulsing blue circle
const outerRingLayer: CircleLayerSpecification = {
  id: "user-location-outer",
  type: "circle",
  source: "user-location",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "pulse"],
      0,
      12,
      1,
      20,
    ],
    "circle-color": "#3b82f6",
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["get", "pulse"],
      0,
      0.4,
      1,
      0,
    ],
  },
};

export function UserLocationLayer({ location }: UserLocationLayerProps) {
  const [pulse, setPulse] = useState(0);

  // Animate the pulse property
  useEffect(() => {
    if (!location) return;

    let animationFrame: number;
    let startTime: number;

    const animate = (time: number) => {
      if (!startTime) startTime = time;

      // Create a 2-second pulse cycle
      const elapsed = (time - startTime) % 2000;
      const newPulse = elapsed / 2000;
      setPulse(newPulse);

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [location]);

  // Convert location to GeoJSON
  const geojson = useMemo(() => {
    if (!location) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [location.longitude, location.latitude],
          },
          properties: {
            pulse,
          },
        },
      ],
    };
  }, [location, pulse]);

  return (
    <Source id="user-location" type="geojson" data={geojson}>
      <Layer {...innerDotLayer} />
      <Layer {...outerRingLayer} />
    </Source>
  );
}
