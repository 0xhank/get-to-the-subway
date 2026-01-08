import { Card } from "@/components/ui/card";
import { useCurrentTime } from "@/hooks/useCurrentTime";

export function TimestampDisplay() {
  const time = useCurrentTime();

  const formattedDate = time.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Card className="bg-black/60 backdrop-blur-sm border-0 px-5 py-3 pointer-events-auto">
      <div className="text-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {formattedDate}
        </div>
        <div className="text-2xl font-mono font-semibold text-white">
          {formattedTime}
        </div>
      </div>
    </Card>
  );
}
