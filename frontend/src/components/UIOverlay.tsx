import { ControlPanel } from './ControlPanel';
import { TimestampDisplay } from './TimestampDisplay';
import { HeartbeatIndicator } from './HeartbeatIndicator';
import { Legend } from './Legend';

export function UIOverlay() {
    return (
        <div className="pointer-events-none absolute inset-0 p-4 z-10">
            {/* Top row */}
            <div className="flex items-start justify-between">
                <ControlPanel />
                <TimestampDisplay />
            </div>

            {/* Bottom row */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                {/* Legend - bottom left */}
                <div className="pointer-events-auto">
                    <Legend />
                </div>

                {/* Heartbeat - bottom right */}
                <div className="pointer-events-auto bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
                    <HeartbeatIndicator />
                </div>
            </div>
        </div>
    );
}
