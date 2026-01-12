import { Link } from "react-router-dom";
import { LEDSimulator } from "@/components/LEDSimulator";

export function SimulatorPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-white text-2xl font-bold mb-2">
          ESP32 LED Display Simulator
        </h1>
        <p className="text-gray-400 text-sm">
          64x32 HUB75 LED Matrix Preview
        </p>
        <Link
          to="/"
          className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
        >
          ← Back to Map
        </Link>
      </div>

      {/* Simulator */}
      <LEDSimulator />

      {/* Legend */}
      <div className="mt-8 text-gray-500 text-xs max-w-md text-center">
        <p className="mb-2">
          <span className="text-white">White</span> = Normal countdown (offset by 30s)
          {" | "}
          <span className="text-amber-400">Amber</span> = LEAVE NOW (30-5s)
          {" | "}
          <span className="text-red-500">Red</span> = RUN! (5s to -10s)
        </p>
        <p>
          Fetches from /api/esp32/departures every 10 seconds.
        </p>
      </div>
    </div>
  );
}
