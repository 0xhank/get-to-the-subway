import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { useUIStore } from "@/store/ui-store";
import { useStopStore } from "@/store/stop-store";

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export function SearchDialog() {
  const { isSearchOpen, setSearchOpen, setMapTarget } = useUIStore();
  const selectStop = useStopStore((state) => state.selectStop);
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");

  // Load stations on mount
  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch("/data/parent-stations.json");
        const data: Station[] = await response.json();
        setStations(data);
      } catch (error) {
        console.error("Failed to load stations:", error);
      }
    };
    loadStations();
  }, []);

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(stations, {
      keys: ["name"],
      threshold: 0.3,
    });
  }, [stations]);

  // Filter stations based on search
  const filteredStations = search
    ? fuse.search(search).slice(0, 20).map((result) => result.item)
    : stations.slice(0, 20);

  const handleSelect = (station: Station) => {
    selectStop(station.id);
    setMapTarget({ latitude: station.latitude, longitude: station.longitude });
    setSearchOpen(false);
    setSearch("");
  };

  return (
    <CommandDialog
      open={isSearchOpen}
      onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) setSearch("");
      }}
      title="Search"
      description="Search for stations"
    >
      <CommandInput
        placeholder="Search stations..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No stations found.</CommandEmpty>
        {filteredStations.length > 0 && (
          <CommandGroup heading="Stations">
            {filteredStations.map((station) => (
              <CommandItem
                key={station.id}
                value={station.name}
                onSelect={() => handleSelect(station)}
              >
                {station.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
