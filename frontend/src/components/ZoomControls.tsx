import { Plus, Minus } from "lucide-react";
import { useMap } from "react-map-gl/maplibre";
import { Button } from "@/components/ui/button";

export function ZoomControls() {
  const { current: map } = useMap();

  const handleZoomIn = () => {
    map?.zoomIn();
  };

  const handleZoomOut = () => {
    map?.zoomOut();
  };

  return (
    <div className="flex flex-col gap-1 pointer-events-auto">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomIn}
        className="h-11 w-11 text-white/80 hover:text-white hover:bg-white/10 rounded-lg border border-white/30 bg-black/50"
        aria-label="Zoom in"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomOut}
        className="h-11 w-11 text-white/80 hover:text-white hover:bg-white/10 rounded-lg border border-white/30 bg-black/50"
        aria-label="Zoom out"
      >
        <Minus className="h-5 w-5" />
      </Button>
    </div>
  );
}
