import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";

export function AboutDialog() {
  const { isAboutOpen, setAboutOpen } = useUIStore();

  return (
    <Dialog open={isAboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="bg-black/90 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Live Subway NYC</DialogTitle>
          <DialogDescription>
            Real-time visualization of NYC subway trains
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>Data sourced from MTA GTFS-RT feeds, updated every 15 seconds.</p>
          <p>Built with React, MapLibre GL, and shadcn/ui.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" asChild>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
