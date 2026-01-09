import { useEffect, useState, useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { LineLayerSpecification } from "maplibre-gl";
import { getDesaturatedLineColor } from "@/lib/mta-colors";
import { useIsMobile } from "@/hooks/useIsMobile";

// Transform GeoJSON to add desaturated colors based on line property
function addDesaturatedColors(
  geojson: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        desaturatedColor: getDesaturatedLineColor(
          feature.properties?.line || ""
        ),
      },
    })),
  };
}

// Line layer for route geometry - returns spec based on mobile state
function getRouteLineLayer(isMobile: boolean): LineLayerSpecification {
  // Thicker lines on mobile for better visibility
  const widthMultiplier = isMobile ? 1.5 : 1.0;

  return {
    id: "route-lines",
    type: "line",
    source: "routes",
    paint: {
      "line-color": ["get", "desaturatedColor"],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        1 * widthMultiplier,
        14,
        2 * widthMultiplier,
        18,
        4 * widthMultiplier,
      ],
      "line-opacity": 1,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  };
}

export function RouteLineLayer() {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const isMobile = useIsMobile();

  const routeLineLayer = useMemo(() => getRouteLineLayer(isMobile), [isMobile]);

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/routes`
        );
        const data = await response.json();
        setGeojson(addDesaturatedColors(data));
      } catch (error) {
        console.error("Failed to load routes:", error);
      }
    };

    loadRoutes();
  }, []);

  return (
    <Source id="routes" type="geojson" data={geojson}>
      <Layer {...routeLineLayer} beforeId="trains-arrow" />
    </Source>
  );
}
