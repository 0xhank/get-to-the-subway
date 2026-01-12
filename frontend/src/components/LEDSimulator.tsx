import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// MTA line colors
const LINE_COLORS: Record<string, string> = {
  L: "#A7A9AC", // Gray
  G: "#6CBE45", // Lime green
  M: "#FF6319", // Orange
  J: "#996633", // Brown
};

// Display states
const STATE_COLORS = {
  normal: "#FFFFFF",
  leave_now: "#FFBF00", // Amber
  run: "#FF0000", // Red
  none: "#333333",
};

interface StationData {
  line: string;
  arrivalTime: number | null;
  leaveByTime: number | null;
  status: "normal" | "leave_now" | "run" | "none";
}

interface APIResponse {
  timestamp: number;
  stations: StationData[];
}

// Simple 5x7 pixel font for digits and letters
const FONT: Record<string, number[][]> = {
  "0": [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  "1": [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  "2": [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
  ],
  "3": [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  "4": [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  "5": [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  "6": [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  "7": [
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  "8": [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  "9": [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  ":": [
    [0],
    [1],
    [0],
    [1],
    [0],
  ],
  "-": [
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
    [0, 0, 0],
  ],
  L: [
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  E: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  A: [
    [0, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  V: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [0, 1, 0],
    [0, 1, 0],
  ],
  N: [
    [1, 0, 0, 1],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
  ],
  O: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  W: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
  ],
  R: [
    [1, 1, 0],
    [1, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [1, 0, 1],
  ],
  U: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  "!": [
    [1],
    [1],
    [1],
    [0],
    [1],
  ],
  F: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 0, 0],
  ],
  "°": [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  I: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  G: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  M: [
    [1, 0, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  J: [
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  T: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  S: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  " ": [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
};

const DISPLAY_WIDTH = 64;
const DISPLAY_HEIGHT = 32;
const PIXEL_SIZE = 10;
const PIXEL_GAP = 1;

// Lock threshold: don't update times when less than 90 seconds remain
const LOCK_THRESHOLD_SECONDS = 90;

export function LEDSimulator() {
  const [stations, setStations] = useState<StationData[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  // Track locked arrival times per station (when < 90s remaining)
  const lockedTimesRef = useRef<Record<string, { arrivalTime: number; leaveByTime: number } | null>>({});

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/esp32/departures`
      );
      if (response.ok) {
        const data: APIResponse = await response.json();
        const now = Math.floor(Date.now() / 1000);

        // Process stations, preserving locked times
        const processedStations = data.stations.map((station) => {
          const locked = lockedTimesRef.current[station.line];
          const secondsUntilLeave = (station.leaveByTime || 0) - now;

          // If we have a locked time for this station
          if (locked) {
            const lockedSecondsUntilLeave = locked.leaveByTime - now;
            // If locked time has expired (train departed), unlock
            if (lockedSecondsUntilLeave <= -10) {
              lockedTimesRef.current[station.line] = null;
            } else {
              // Keep using locked time
              return {
                ...station,
                arrivalTime: locked.arrivalTime,
                leaveByTime: locked.leaveByTime,
              };
            }
          }

          // Lock this time if under threshold
          if (secondsUntilLeave > 0 && secondsUntilLeave < LOCK_THRESHOLD_SECONDS && station.leaveByTime) {
            lockedTimesRef.current[station.line] = {
              arrivalTime: station.arrivalTime || 0,
              leaveByTime: station.leaveByTime,
            };
          }

          return station;
        });

        setStations(processedStations);
        setLastFetchTime(Date.now());
        setIsStale(false);
      }
    } catch (error) {
      console.error("Failed to fetch ESP32 data:", error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Check for stale data
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastFetchTime > 60000) {
        setIsStale(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastFetchTime]);

  // Update current time every second for countdown
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Create pixel buffer
  const pixels = useMemo(() => {
    const buffer: string[][] = Array(DISPLAY_HEIGHT)
      .fill(null)
      .map(() => Array(DISPLAY_WIDTH).fill("#000000"));

    // Helper to draw text
    const drawText = (
      text: string,
      startX: number,
      startY: number,
      color: string
    ) => {
      let x = startX;
      for (const char of text.toUpperCase()) {
        const glyph = FONT[char];
        if (glyph) {
          for (let row = 0; row < glyph.length; row++) {
            for (let col = 0; col < glyph[row].length; col++) {
              if (glyph[row][col] && x + col < DISPLAY_WIDTH && startY + row < DISPLAY_HEIGHT) {
                buffer[startY + row][x + col] = color;
              }
            }
          }
          x += glyph[0].length + 1; // character width + spacing
        }
      }
    };

    // Helper to dim a color by a factor (0-1)
    const dimColor = (hex: string, factor: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const newR = Math.round(r * factor);
      const newG = Math.round(g * factor);
      const newB = Math.round(b * factor);
      return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    };

    // Helper to draw filled circle with anti-aliasing
    const drawCircle = (
      centerX: number,
      centerY: number,
      radius: number,
      color: string
    ) => {
      const outerRadius = radius + 0.5; // Extend slightly for anti-aliasing
      for (let y = -radius - 1; y <= radius + 1; y++) {
        for (let x = -radius - 1; x <= radius + 1; x++) {
          const distance = Math.sqrt(x * x + y * y);
          const px = centerX + x;
          const py = centerY + y;

          if (px >= 0 && px < DISPLAY_WIDTH && py >= 0 && py < DISPLAY_HEIGHT) {
            if (distance <= radius - 0.5) {
              // Fully inside - full brightness
              buffer[py][px] = color;
            } else if (distance <= outerRadius) {
              // Edge pixels - dim based on how close to edge
              const edgeFactor = 1 - (distance - (radius - 0.5)) / 1.0;
              const dimmed = dimColor(color, Math.max(0.3, edgeFactor));
              buffer[py][px] = dimmed;
            }
          }
        }
      }
    };

    // Draw header "LEAVE IN" (dimmed white)
    drawText("LEAVE IN", 2, 1, "#888888");

    // Draw stale/error indicator if needed
    const showError = isStale || simulateError;
    if (showError) {
      drawText("!", 60, 1, "#FF0000");
    }

    // 2x2 grid layout for all 4 stations
    // Row 1: L (left), G (right) - starting at y=8
    // Row 2: M (left), J (right) - starting at y=20
    const gridPositions = [
      { line: "L", x: 0, y: 8 },
      { line: "G", x: 32, y: 8 },
      { line: "M", x: 0, y: 20 },
      { line: "J", x: 32, y: 20 },
    ];

    gridPositions.forEach(({ line, x, y }) => {
      const station = stations.find((s) => s.line === line);
      if (!station) return;

      // Draw line badge circle
      const lineColor = LINE_COLORS[station.line] || "#FFFFFF";
      drawCircle(x + 5, y + 3, 4, lineColor);

      // Draw line letter in circle (black on colored background)
      const letterGlyph = FONT[station.line];
      if (letterGlyph) {
        const letterX = x + 4;
        const letterY = y + 1;
        for (let row = 0; row < letterGlyph.length; row++) {
          for (let col = 0; col < letterGlyph[row].length; col++) {
            if (letterGlyph[row][col]) {
              buffer[letterY + row][letterX + col] = "#000000";
            }
          }
        }
      }

      // Calculate countdown
      const leaveByTime = station.leaveByTime || 0;
      const secondsUntilLeave = leaveByTime - now;

      let displayText = "";
      let textColor = STATE_COLORS.normal;

      if (station.status === "none" || leaveByTime === 0) {
        displayText = "---";
        textColor = STATE_COLORS.none;
      } else if (secondsUntilLeave <= -10) {
        displayText = "---";
        textColor = STATE_COLORS.none;
      } else if (secondsUntilLeave <= 5) {
        displayText = "RUN!";
        textColor = STATE_COLORS.run;
      } else if (secondsUntilLeave <= 30) {
        displayText = "NOW";
        textColor = STATE_COLORS.leave_now;
      } else {
        // Show countdown offset by 30 seconds
        const displaySeconds = secondsUntilLeave - 30;
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        displayText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        textColor = STATE_COLORS.normal;
      }

      // Draw countdown text (to the right of the badge)
      drawText(displayText, x + 12, y + 1, textColor);
    });

    return buffer;
  }, [stations, now, isStale, simulateError]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Display bezel */}
      <div
        className="bg-gray-900 p-4 rounded-lg shadow-2xl"
        style={{
          boxShadow: "0 0 40px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Pixel grid */}
        <div
          className="grid bg-black"
          style={{
            gridTemplateColumns: `repeat(${DISPLAY_WIDTH}, ${PIXEL_SIZE}px)`,
            gap: `${PIXEL_GAP}px`,
            padding: "4px",
          }}
        >
          {pixels.map((row, y) =>
            row.map((color, x) => (
              <div
                key={`${x}-${y}`}
                className="rounded-sm"
                style={{
                  width: PIXEL_SIZE,
                  height: PIXEL_SIZE,
                  backgroundColor: color,
                  boxShadow:
                    color !== "#000000"
                      ? `0 0 ${PIXEL_SIZE / 2}px ${color}, 0 0 ${PIXEL_SIZE}px ${color}40`
                      : "none",
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <button
          onClick={() => setSimulateError(!simulateError)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            simulateError
              ? "bg-red-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {simulateError ? "Network Error: ON" : "Network Error: OFF"}
        </button>
      </div>

      {/* Debug info */}
      <div className="text-gray-500 text-xs font-mono grid grid-cols-2 gap-x-8 gap-y-1">
        {stations.map((s) => {
          const secondsUntilLeave = (s.leaveByTime || 0) - now;
          const arrivalDate = s.arrivalTime ? new Date(s.arrivalTime * 1000) : null;
          const arrivalFormatted = arrivalDate
            ? arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            : '---';
          return (
            <div key={s.line}>
              {s.line}: leave {secondsUntilLeave}s | arrives {arrivalFormatted}
            </div>
          );
        })}
      </div>
    </div>
  );
}
