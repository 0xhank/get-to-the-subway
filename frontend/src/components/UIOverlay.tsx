import { useEffect } from 'react';
import { MapPin, Search } from 'lucide-react';
import { ControlPanel } from './ControlPanel';
import { TimestampDisplay } from './TimestampDisplay';
import { HeartbeatIndicator } from './HeartbeatIndicator';
import { LinesDialog } from './Legend';
import { NearbyPanel } from './NearbyPanel';
import { MobileMenu } from './MobileMenu';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';
import { useIsMobile } from '@/hooks/useIsMobile';

export function UIOverlay() {
    const { nearbyPanelOpen, setNearbyPanelOpen, setLinesOpen, setSearchOpen } = useUIStore();
    const isMobile = useIsMobile();

    // Keyboard shortcuts (desktop only)
    useEffect(() => {
        if (isMobile) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.key === 'n' || e.key === 'N') {
                setNearbyPanelOpen(!nearbyPanelOpen);
            } else if (e.key === 'l' || e.key === 'L') {
                setLinesOpen(true);
            } else if (e.key === '/') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nearbyPanelOpen, setNearbyPanelOpen, setLinesOpen, setSearchOpen, isMobile]);

    return (
        <div className="pointer-events-none absolute inset-0 p-2 sm:p-4 z-10">
            {/* Top left - Mobile menu or desktop controls */}
            <div className="flex flex-col gap-2 items-start">
                {isMobile ? <MobileMenu /> : <ControlPanel />}
            </div>

            {/* Top right - Search button (mobile) or Timestamp (desktop) */}
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex items-center gap-2">
                {isMobile ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchOpen(true)}
                        className="h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-lg border border-white/30 bg-black/50 pointer-events-auto"
                        aria-label="Search stations"
                    >
                        <Search className="h-5 w-5" />
                    </Button>
                ) : (
                    <TimestampDisplay />
                )}
            </div>

            {/* Bottom right - Heartbeat */}
            <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 pointer-events-auto">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
                    <HeartbeatIndicator />
                </div>
            </div>

            {/* Bottom left - Nearby button + panel */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 flex flex-col items-start gap-2 pointer-events-auto">
                {!nearbyPanelOpen && (
                    <Button
                        variant="ghost"
                        className="justify-between gap-4 px-3 py-1 h-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/30 bg-black/50"
                        onClick={() => setNearbyPanelOpen(true)}
                    >
                        <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs">Nearby</span>
                        </span>
                        {!isMobile && (
                            <kbd className="text-xs text-muted-foreground font-mono bg-white/15 px-1 py-0.5 rounded-full">
                                N
                            </kbd>
                        )}
                    </Button>
                )}
                <NearbyPanel />
            </div>

            {/* Dialogs */}
            <LinesDialog />
        </div>
    );
}
