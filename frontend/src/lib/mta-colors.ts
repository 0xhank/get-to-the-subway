export const MTA_COLORS: Record<string, string> = {
  A: "#0039a6",
  C: "#0039a6",
  E: "#0039a6",
  B: "#ff6319",
  D: "#ff6319",
  F: "#ff6319",
  M: "#ff6319",
  G: "#6cbe45",
  J: "#996633",
  Z: "#996633",
  L: "#a7a9ac",
  N: "#fccc0a",
  Q: "#fccc0a",
  R: "#fccc0a",
  W: "#fccc0a",
  "1": "#ee352e",
  "2": "#ee352e",
  "3": "#ee352e",
  "4": "#00933c",
  "5": "#00933c",
  "6": "#00933c",
  "7": "#b933ad",
  S: "#808183",
  SIR: "#0039a6",
};

export function getLineColor(line: string): string {
  return MTA_COLORS[line.toUpperCase()] ?? "#808183";
}
