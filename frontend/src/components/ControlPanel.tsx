import { Info, Train, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';

export function ControlPanel() {
    const { setAboutOpen, setLinesOpen, setSearchOpen } = useUIStore();

    return (
        <div className="flex flex-col gap-1 pointer-events-auto">
            <Button
                variant="ghost"
                className="justify-between gap-4 px-3 py-1 h-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/30 bg-black/50"
                onClick={() => setSearchOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span className="text-xs">Search</span>
                </span>
                <kbd className="text-xs text-muted-foreground font-mono bg-white/15 px-1 py-0.5 rounded-full">
                    /
                </kbd>
            </Button>
            <Button
                variant="ghost"
                className="justify-between gap-4 px-3 py-1 h-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/30 bg-black/50"
                onClick={() => setLinesOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <Train className="h-4 w-4" />
                    <span className="text-xs">Lines</span>
                </span>
                <kbd className="text-xs text-muted-foreground font-mono bg-white/15 px-1 py-0.5 rounded-full">
                    L
                </kbd>
            </Button>
            <Button
                variant="ghost"
                className="justify-between gap-4 px-3 py-1 h-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/30 bg-black/50"
                onClick={() => setAboutOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span className="text-xs">About</span>
                </span>
                <kbd className="text-xs text-muted-foreground font-mono bg-white/15 px-1 py-0.5 rounded-full">
                    A
                </kbd>
            </Button>
        </div>
    );
}
