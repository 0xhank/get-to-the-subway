import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/ui-store";
import { MTA_COLORS } from "@/lib/mta-colors";

// Group lines by color/trunk
const LINE_GROUPS = [
  { lines: ["1", "2", "3"], color: MTA_COLORS["1"], label: "Broadway-7th Ave" },
  { lines: ["4", "5", "6"], color: MTA_COLORS["4"], label: "Lexington Ave" },
  { lines: ["7"], color: MTA_COLORS["7"], label: "Flushing" },
  { lines: ["A", "C", "E"], color: MTA_COLORS["A"], label: "8th Ave" },
  { lines: ["B", "D", "F", "M"], color: MTA_COLORS["B"], label: "6th Ave" },
  { lines: ["G"], color: MTA_COLORS["G"], label: "Brooklyn-Queens" },
  { lines: ["J", "Z"], color: MTA_COLORS["J"], label: "Nassau St" },
  { lines: ["L"], color: MTA_COLORS["L"], label: "14th St-Canarsie" },
  { lines: ["N", "Q", "R", "W"], color: MTA_COLORS["N"], label: "Broadway" },
  { lines: ["S"], color: MTA_COLORS["S"], label: "Shuttles" },
  { lines: ["SIR"], color: MTA_COLORS["SIR"], label: "Staten Island" },
];

export function LinesDialog() {
  const { isLinesOpen, setLinesOpen } = useUIStore();

  return (
    <Dialog open={isLinesOpen} onOpenChange={setLinesOpen}>
      <DialogContent className="bg-black/90 border-zinc-800 max-w-xs">
        <DialogHeader>
          <DialogTitle>Subway Lines</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {LINE_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-3">
              <div className="flex gap-1">
                {group.lines.map((line) => (
                  <div
                    key={line}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {line.length <= 2 ? line : ""}
                  </div>
                ))}
              </div>
              <span className="text-xs text-white/60">{group.label}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
