import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { CircleLayerSpecification } from "maplibre-gl";

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

// Circle layer for stop markers
const stopCircleLayer: CircleLayerSpecification = {
  id: "stops-circle",
  type: "circle",
  source: "stops",
  minzoom: 13,
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      13,
      3,
      16,
      6,
      18,
      8,
    ],
    "circle-color": "#ffffff",
    "circle-opacity": 0.6,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#ffffff",
    "circle-blur": 0.5,
  },
};

export function StopLayer() {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch("/data/parent-stations.json");
        const stations: ParentStation[] = await response.json();
        setGeojson(stationsToGeoJSON(stations));
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
