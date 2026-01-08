import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

export function Legend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
      >
        <span className="font-medium">Lines</span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {LINE_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-2">
              {/* Line circles */}
              <div className="flex gap-0.5">
                {group.lines.map((line) => (
                  <div
                    key={line}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {line.length <= 2 ? line : ""}
                  </div>
                ))}
              </div>
              {/* Label */}
              <span className="text-[10px] text-white/50 truncate">
                {group.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
