import { useState, useCallback } from 'react';

export interface UseGeolocationReturn {
  getCurrentPosition: () => Promise<void>;
  position: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
  isSupported: boolean;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.geolocation;

  const getCurrentPosition = useCallback(async () => {
    if (!isSupported) {
      return;
    }

    setIsLoading(true);
    setError(null);

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition(pos);
          setIsLoading(false);
          resolve();
        },
        (err) => {
          setError(err);
          setPosition(null);
          setIsLoading(false);
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 10000, // 10 seconds
          maximumAge: 300000, // 5 minutes cache
        }
      );
    });
  }, [isSupported]);

  return {
    getCurrentPosition,
    position,
    error,
    isLoading,
    isSupported,
  };
}
