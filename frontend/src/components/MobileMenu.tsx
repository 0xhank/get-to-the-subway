import { useState, useRef, useEffect } from "react";
import { Menu, X, Info, Filter, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useTrainStore } from "@/store/train-store";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setAboutOpen, setLinesOpen } = useUIStore();
  const lastUpdate = useTrainStore((state) => state.lastUpdate);

  // Format last update time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleAbout = () => {
    setIsOpen(false);
    setAboutOpen(true);
  };

  const handleLines = () => {
    setIsOpen(false);
    setLinesOpen(true);
  };

  return (
    <div ref={menuRef} className="relative pointer-events-auto">
      {/* Hamburger button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-lg border border-white/30 bg-black/50"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-12 left-0 min-w-48 bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl overflow-hidden">
          {/* About */}
          <button
            onClick={handleAbout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Info className="h-4 w-4" />
            About
          </button>

          {/* Lines Filter */}
          <button
            onClick={handleLines}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors border-t border-white/10"
          >
            <Filter className="h-4 w-4" />
            Filter Lines
          </button>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Last updated */}
          <div className="flex items-center gap-3 px-4 py-3 text-xs text-white/50">
            <Clock className="h-3 w-3" />
            Updated: {lastUpdate ? formatTime(lastUpdate) : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
