import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { useUIStore } from "@/store/ui-store";

export function SearchDialog() {
  const { isSearchOpen, setSearchOpen } = useUIStore();

  return (
    <CommandDialog
      open={isSearchOpen}
      onOpenChange={setSearchOpen}
      title="Search"
      description="Search for stations or lines"
    >
      <CommandInput placeholder="Search stations or lines..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Lines">
          <CommandItem>A/C/E - 8th Avenue</CommandItem>
          <CommandItem>1/2/3 - 7th Avenue</CommandItem>
          <CommandItem>B/D/F/M - 6th Avenue</CommandItem>
          <CommandItem>N/Q/R/W - Broadway</CommandItem>
          <CommandItem>4/5/6 - Lexington Avenue</CommandItem>
          <CommandItem>7 - Flushing</CommandItem>
          <CommandItem>G - Crosstown</CommandItem>
          <CommandItem>J/Z - Nassau Street</CommandItem>
          <CommandItem>L - 14th Street-Canarsie</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Stations">
          <CommandItem>Times Square - 42nd St</CommandItem>
          <CommandItem>Grand Central - 42nd St</CommandItem>
          <CommandItem>Penn Station - 34th St</CommandItem>
          <CommandItem>Union Square - 14th St</CommandItem>
          <CommandItem>Atlantic Ave - Barclays Ctr</CommandItem>
          <CommandItem>Fulton St</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
