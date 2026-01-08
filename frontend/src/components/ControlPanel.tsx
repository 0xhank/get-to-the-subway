import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUIStore } from '@/store/ui-store';

export function ControlPanel() {
    const { setAboutOpen } = useUIStore();

    return (
        <Card className="bg-black/60 backdrop-blur-sm border-0 w-auto pointer-events-auto">
            <div className="flex flex-col gap-1 p-2">
                <Button
                    variant="ghost"
                    className="justify-between gap-4 px-3 py-1 h-9 text-white/80 hover:text-white hover:bg-white/5 rounded-full border border-white/30"
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
        </Card>
    );
}
