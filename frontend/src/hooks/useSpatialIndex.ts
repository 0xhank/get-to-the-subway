import { useEffect, useRef } from "react";
import RBush from "rbush";

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface RBushItem extends Station {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const RADIUS_KM = 0.8047; // 0.5 miles in km

/**
 * Haversine distance calculation between two points in km
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hook that builds and maintains a spatial index of subway stations
 * Returns a function to query nearby stations within a 0.5 mile radius
 */
export function useSpatialIndex() {
  const indexRef = useRef<RBush<RBushItem> | null>(null);
  const stationsRef = useRef<Map<string, Station>>(new Map());

  useEffect(() => {
    // Load parent-stations.json and build spatial index
    const loadStations = async () => {
      try {
        const response = await fetch("/data/parent-stations.json");
        const stationsData: Station[] = await response.json();

        // Store stations for later reference
        const stationsMap = new Map<string, Station>();
        stationsData.forEach((station) => {
          stationsMap.set(station.id, station);
        });
        stationsRef.current = stationsMap;

        // Build RBush index
        const index = new RBush<RBushItem>(9);
        const items: RBushItem[] = stationsData.map((station) => ({
          ...station,
          minX: station.longitude,
          minY: station.latitude,
          maxX: station.longitude,
          maxY: station.latitude,
        }));
        index.load(items);
        indexRef.current = index;
      } catch (error) {
        console.error("Failed to load spatial index:", error);
      }
    };

    loadStations();
  }, []);

  /**
   * Get nearby stations within 0.5 miles, sorted by distance
   */
  const getNearbyStations = (
    latitude: number,
    longitude: number,
    radiusKm: number = RADIUS_KM
  ): Station[] => {
    if (!indexRef.current) {
      console.warn("Spatial index not loaded yet");
      return [];
    }

    // Estimate bounding box for the radius
    // 1 degree latitude ≈ 111 km, 1 degree longitude ≈ 111 km * cos(latitude)
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    // Query bounding box from RBush
    const candidates = indexRef.current.search({
      minX: longitude - lonDelta,
      minY: latitude - latDelta,
      maxX: longitude + lonDelta,
      maxY: latitude + latDelta,
    });


    // Filter by actual haversine distance and sort
    const nearbyStations = candidates
      .filter((station) => {
        const distance = haversineDistance(
          latitude,
          longitude,
          station.latitude,
          station.longitude
        );
        return distance <= radiusKm;
      })
      .map((station) => ({
        station: {
          id: station.id,
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
        },
        distance: haversineDistance(
          latitude,
          longitude,
          station.latitude,
          station.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.station);

    return nearbyStations;
  };

  return { getNearbyStations };
}
