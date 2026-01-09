import { useEffect, useState, useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { CircleLayerSpecification } from "maplibre-gl";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ParentStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Convert parent stations to GeoJSON FeatureCollection
function stationsToGeoJSON(
  stations: ParentStation[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = stations.map((station) => ({
    type: "Feature",
    id: station.id,
    geometry: {
      type: "Point",
      coordinates: [station.longitude, station.latitude],
    },
    properties: {
      id: station.id,
      name: station.name,
    },
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

// Circle layer for stop markers - returns spec based on mobile state
function getStopCircleLayer(isMobile: boolean): CircleLayerSpecification {
  // 20% larger on mobile for better touch targets
  const sizeMultiplier = isMobile ? 1.2 : 1.0;

  return {
    id: "stops-circle",
    type: "circle",
    source: "stops",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1 * sizeMultiplier,
        13,
        3 * sizeMultiplier,
        16,
        6 * sizeMultiplier,
        18,
        8 * sizeMultiplier,
      ],
      "circle-color": "#ffffff",
      "circle-opacity": 0.6,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
      "circle-blur": 0.5,
    },
  };
}

export function StopLayer() {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const isMobile = useIsMobile();

  const stopCircleLayer = useMemo(() => getStopCircleLayer(isMobile), [isMobile]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch("/data/parent-stations.json");
        const stationData: ParentStation[] = await response.json();
        setGeojson(stationsToGeoJSON(stationData));
      } catch (error) {
        console.error("Failed to load parent stations:", error);
      }
    };

    loadStations();
  }, []);

  return (
    <Source id="stops" type="geojson" data={geojson}>
      <Layer {...stopCircleLayer} />
    </Source>
  );
}
