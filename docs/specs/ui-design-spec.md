# Live Subway NYC - UI Design Specification

> Design specification for the control room-style user interface

**Version:** 1.0
**Created:** January 7, 2026
**UI Framework:** shadcn/ui + Tailwind CSS

---

## Table of Contents

1. [Overview](#overview)
2. [Layout Structure](#layout-structure)
3. [Component Specifications](#component-specifications)
4. [Color System](#color-system)
5. [Typography](#typography)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Responsive Behavior](#responsive-behavior)
8. [Component Hierarchy](#component-hierarchy)

---

## Overview

### Design Philosophy

The UI follows a "control room" aesthetic - minimal, functional overlays on a dark map canvas. All UI elements are semi-transparent, non-intrusive, and positioned at screen edges to maximize map visibility.

### Key UI Regions

```
┌─────────────────────────────────────────────────────────────────┐
│ [Control Panel]          [Timestamp]              [Stats Panel] │
│  Top-left                 Top-center               Top-right    │
│                                                                 │
│                                                                 │
│                                                                 │
│                        [MAP CANVAS]                             │
│                                                                 │
│                                                                 │
│                                                                 │
│ [Mapbox Logo]                                   [Attribution]   │
│  Bottom-left                                     Bottom-right   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layout Structure

### Overlay Container

All UI elements are positioned absolutely over the map canvas using a fixed overlay system.

```tsx
<div className="relative h-screen w-screen">
  {/* Map fills entire viewport */}
  <Map className="absolute inset-0" />

  {/* UI Overlay Layer */}
  <div className="pointer-events-none absolute inset-0 p-4">
    {/* Top row */}
    <div className="flex items-start justify-between">
      <ControlPanel />
      <TimestampDisplay />
      <StatsPanel />
    </div>
  </div>
</div>
```

### Spacing System

- **Edge padding:** 16px (p-4)
- **Component gap:** 16px between adjacent components
- **Internal padding:** 12px for cards, 8px for compact elements

---

## Component Specifications

### 1. Control Panel (Top-Left)

A vertical stack of action buttons with keyboard shortcut hints.

**Visual Design:**
- Background: `rgba(0, 0, 0, 0.6)` with backdrop blur
- Border radius: 8px
- Padding: 8px

**Button Specifications:**

| Button | Icon | Label | Shortcut | Action |
|--------|------|-------|----------|--------|
| Search | Magnifying glass | "Search" | ⌘K | Open search modal |
| Pause | Pause icon | "Pause" | Space | Toggle train animation |
| Random | Shuffle/dice icon | "Random" | R | Jump to random train |
| About | Info circle | "About" | A | Open about modal |

**Button Layout:**
```
┌─────────────────────┐
│ 🔍 Search      ⌘K   │
├─────────────────────┤
│ ⏸  Pause     Space  │
├─────────────────────┤
│ 🎲 Random       R   │
├─────────────────────┤
│ ℹ  About        A   │
└─────────────────────┘
```

**Component Structure (shadcn):**
```tsx
<Card className="bg-black/60 backdrop-blur-sm border-0 w-auto">
  <div className="flex flex-col gap-1 p-2">
    <Button variant="ghost" className="justify-between gap-4 px-3 h-9">
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <span>Search</span>
      </span>
      <kbd className="text-xs text-muted-foreground">⌘K</kbd>
    </Button>
    {/* ... more buttons */}
  </div>
</Card>
```

**Interaction States:**
- Default: Text at 80% opacity
- Hover: Background lightens, text at 100%
- Active: Slight scale down (0.98)
- Keyboard shortcut badge: Always 50% opacity

---

### 2. Timestamp Display (Top-Center)

Displays current date and time in a monospace font for a "control room" feel.

**Visual Design:**
- Background: `rgba(0, 0, 0, 0.6)` with backdrop blur
- Border radius: 8px
- Padding: 12px 20px
- Horizontal centering with `margin: 0 auto`

**Content Layout:**
```
┌─────────────────────────┐
│   Wed, Jan 1, 2025      │  ← Date (smaller, muted)
│     10:43:10 AM         │  ← Time (larger, prominent)
└─────────────────────────┘
```

**Typography:**
- Date: 12px, `text-muted-foreground`, uppercase tracking
- Time: 24px, `font-mono`, `font-semibold`, white

**Component Structure:**
```tsx
<Card className="bg-black/60 backdrop-blur-sm border-0 px-5 py-3">
  <div className="text-center">
    <div className="text-xs text-muted-foreground uppercase tracking-wider">
      {formattedDate}
    </div>
    <div className="text-2xl font-mono font-semibold text-white">
      {formattedTime}
    </div>
  </div>
</Card>
```

**Update Behavior:**
- Time updates every second
- Uses `requestAnimationFrame` or `setInterval(1000)`
- Smooth digit transitions (optional: animate number changes)

---

### 3. Stats Panel (Top-Right)

Displays ride count, performance metrics, and an activity sparkline.

**Visual Design:**
- Background: `rgba(0, 0, 0, 0.6)` with backdrop blur
- Border radius: 8px
- Width: ~160px
- Padding: 12px

**Content Layout:**
```
┌───────────────────────┐
│  542  RIDES      [●]  │  ← Count + label + live indicator
│  120 FPS              │  ← Performance metric
│  ┌─────────────────┐  │
│  │  ╱╲  ╱╲_╱╲     │  │  ← Sparkline graph
│  │ ╱  ╲╱        ╲  │  │
│  └─────────────────┘  │
│  -3h  -2h  -1h   Now  │  ← Time axis labels
└───────────────────────┘
```

**Metrics Display:**
- Ride count: Large number (28px), "RIDES" label small caps
- FPS: Smaller text (14px), updates every second
- Live indicator: Small pulsing dot (electric blue)

**Sparkline Specifications:**
- Width: 100% of container
- Height: 32px
- Color: Electric blue (`#00d4ff`) with gradient fill
- Stroke width: 1.5px
- Fill: Gradient from line color (20% opacity) to transparent
- Data points: Last 3 hours, sampled every 5 minutes (36 points)
- Animation: New points slide in from right

**Component Structure:**
```tsx
<Card className="bg-black/60 backdrop-blur-sm border-0 p-3 min-w-[160px]">
  {/* Header row */}
  <div className="flex items-center justify-between">
    <div>
      <span className="text-2xl font-bold text-white">542</span>
      <span className="text-xs text-muted-foreground ml-1 uppercase">Rides</span>
    </div>
    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
  </div>

  {/* FPS */}
  <div className="text-sm text-muted-foreground">
    120 FPS
  </div>

  {/* Sparkline */}
  <div className="mt-2">
    <Sparkline data={rideHistory} />
    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
      <span>-3h</span>
      <span>-2h</span>
      <span>-1h</span>
      <span>Now</span>
    </div>
  </div>
</Card>
```

---

### 4. Train Markers (Map Layer)

Trains are rendered as directional arrow markers indicating travel direction.

**Visual Design:**
- Shape: Arrow/chevron pointing in direction of travel
- Size: 12-16px length, scales with zoom
- Color: MTA line color with glow effect
- Glow: Soft blur (4-8px) in line color at 40% opacity

**Arrow Marker Design:**
```
    ▲         Direction of travel
   ╱ ╲
  ╱   ╲       Filled arrow shape
 ╱     ╲      Color: Line color (e.g., cyan for A/C/E)
╱───────╲     Glow: Soft halo behind
```

**MapLibre Implementation:**

Using a symbol layer with rotation based on bearing:

```javascript
// Train arrow layer
{
  id: 'trains',
  type: 'symbol',
  source: 'trains',
  layout: {
    'icon-image': 'train-arrow',
    'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 1],
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
  },
  paint: {
    'icon-color': ['get', 'color'],
    'icon-opacity': 0.9,
  }
}

// Glow layer (rendered behind)
{
  id: 'trains-glow',
  type: 'circle',
  source: 'trains',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 16],
    'circle-color': ['get', 'color'],
    'circle-blur': 1,
    'circle-opacity': 0.3,
  }
}
```

**Custom Arrow Icon:**

Generate SVG arrow icon dynamically or use a sprite:

```svg
<svg width="16" height="20" viewBox="0 0 16 20">
  <path d="M8 0L16 16L8 12L0 16L8 0Z" fill="currentColor"/>
</svg>
```

**Bearing Calculation:**

Calculate bearing from previous position to current position:

```typescript
function calculateBearing(prev: [number, number], curr: [number, number]): number {
  const [lng1, lat1] = prev;
  const [lng2, lat2] = curr;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
```

---

### 5. Search Modal

Full-screen search overlay for finding stations or lines.

**Visual Design:**
- Overlay: Full screen with `rgba(0, 0, 0, 0.8)` backdrop
- Modal: Centered, max-width 500px
- Search input: Large, auto-focused
- Results: Scrollable list below input

**shadcn Command Component:**
```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search stations or lines..." />
  <CommandList>
    <CommandGroup heading="Lines">
      <CommandItem>A/C/E - 8th Avenue</CommandItem>
      <CommandItem>1/2/3 - 7th Avenue</CommandItem>
    </CommandGroup>
    <CommandGroup heading="Stations">
      <CommandItem>Times Square - 42nd St</CommandItem>
      <CommandItem>Grand Central - 42nd St</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

---

### 6. About Modal

Information modal with project details.

**Visual Design:**
- Overlay: Same as search modal
- Modal: Centered, max-width 400px
- Content: Project name, description, credits, links

**shadcn Dialog Component:**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
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
        <a href="https://github.com/..." target="_blank">GitHub</a>
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Color System

### Base Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0a0a` | Map background |
| `--foreground` | `#fafafa` | Primary text |
| `--muted` | `#171717` | Card backgrounds |
| `--muted-foreground` | `#a1a1aa` | Secondary text |
| `--accent` | `#00d4ff` | Electric blue accents |
| `--destructive` | `#ef4444` | Error states |

### UI Surface Colors

```css
/* Card/Panel backgrounds */
.surface-overlay {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
}

/* Hover states */
.surface-hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Active/pressed states */
.surface-active {
  background: rgba(255, 255, 255, 0.1);
}
```

### MTA Line Colors

| Line(s) | Hex | Tailwind |
|---------|-----|----------|
| A, C, E | `#0039a6` | `blue-700` (custom) |
| B, D, F, M | `#ff6319` | `orange-500` |
| G | `#6cbe45` | `lime-500` |
| J, Z | `#996633` | `amber-700` (custom) |
| L | `#a7a9ac` | `zinc-400` |
| N, Q, R, W | `#fccc0a` | `yellow-400` |
| 1, 2, 3 | `#ee352e` | `red-500` |
| 4, 5, 6 | `#00933c` | `green-600` |
| 7 | `#b933ad` | `fuchsia-600` |
| S | `#808183` | `zinc-500` |
| SIR | `#0039a6` | `blue-700` (custom) |

---

## Typography

### Font Stack

```css
:root {
  /* UI text */
  --font-sans: 'Inter', system-ui, sans-serif;

  /* Monospace (timestamps, stats) */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

### Type Scale

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Stat number | 28px | 700 | Sans |
| Timestamp time | 24px | 600 | Mono |
| Button label | 14px | 500 | Sans |
| Timestamp date | 12px | 400 | Sans |
| Stat label | 11px | 500 | Sans |
| Axis labels | 10px | 400 | Sans |
| Keyboard hint | 12px | 400 | Mono |

---

## Keyboard Shortcuts

### Global Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `⌘K` / `Ctrl+K` | Open search | Always |
| `Space` | Toggle pause | Map focused |
| `R` | Jump to random train | Map focused |
| `A` | Open about modal | Always |
| `Escape` | Close modal/deselect | Modal open |
| `+` / `=` | Zoom in | Map focused |
| `-` | Zoom out | Map focused |

### Implementation

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Meta+K or Ctrl+K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }

    // Space for pause (only if not in input)
    if (e.key === ' ' && !isInputFocused()) {
      e.preventDefault();
      togglePause();
    }

    // R for random train
    if (e.key === 'r' && !isInputFocused()) {
      flyToRandomTrain();
    }

    // A for about
    if (e.key === 'a' && !isInputFocused()) {
      setAboutOpen(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | Stack controls, hide some elements |
| Tablet | 640-1024px | Compact layout |
| Desktop | > 1024px | Full layout as designed |

### Mobile Adaptations

**Control Panel:**
- Collapse to icon-only buttons
- Move to bottom-left corner
- Horizontal layout

**Timestamp:**
- Hide date, show time only
- Reduce font size to 18px

**Stats Panel:**
- Hide sparkline
- Show only ride count
- Reduce to compact pill shape

**Mobile Layout:**
```
┌──────────────────────────────┐
│            [Time]            │ ← Top center, compact
│                              │
│                              │
│         [MAP CANVAS]         │
│                              │
│                              │
│                              │
│ [🔍][⏸][🎲][ℹ]     [542 🚇] │ ← Bottom row
└──────────────────────────────┘
```

---

## Component Hierarchy

### React Component Tree

```
<App>
├── <MapProvider>                    # react-map-gl context
│   └── <Map>                        # MapLibre instance
│       ├── <Source id="tracks">     # Track geometry
│       │   └── <Layer type="line">
│       ├── <Source id="trains">     # Train positions
│       │   ├── <Layer id="trains-glow" type="circle">
│       │   └── <Layer id="trains" type="symbol">
│       └── <NavigationControl>      # Zoom buttons (optional)
│
├── <UIOverlay>                      # Absolute positioned container
│   ├── <ControlPanel>               # Top-left
│   │   ├── <SearchButton>
│   │   ├── <PauseButton>
│   │   ├── <RandomButton>
│   │   └── <AboutButton>
│   │
│   ├── <TimestampDisplay>           # Top-center
│   │
│   └── <StatsPanel>                 # Top-right
│       ├── <RideCounter>
│       ├── <FPSCounter>
│       └── <ActivitySparkline>
│
├── <SearchDialog>                   # Modal (shadcn Command)
├── <AboutDialog>                    # Modal (shadcn Dialog)
└── <Toaster>                        # Toast notifications (shadcn)
```

### State Management

```typescript
// Zustand store
interface UIStore {
  // Modal state
  isSearchOpen: boolean;
  isAboutOpen: boolean;

  // Playback state
  isPaused: boolean;

  // Stats
  rideCount: number;
  fps: number;
  rideHistory: number[];  // Last 3 hours, 5-min intervals

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  togglePause: () => void;
  flyToRandomTrain: () => void;
  updateStats: (count: number) => void;
}
```

---

## shadcn/ui Components Used

| Component | Usage |
|-----------|-------|
| `Button` | Control panel buttons |
| `Card` | Panel containers |
| `Dialog` | About modal |
| `Command` | Search modal |
| `Tooltip` | Button hints on hover |

### Installation

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog command tooltip
```

### Theme Configuration

```typescript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#00d4ff',
        mta: {
          blue: '#0039a6',
          orange: '#ff6319',
          lime: '#6cbe45',
          brown: '#996633',
          gray: '#a7a9ac',
          yellow: '#fccc0a',
          red: '#ee352e',
          green: '#00933c',
          purple: '#b933ad',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
}
```

---

## Implementation Notes

### Sparkline Library Options

1. **Custom SVG** (recommended for simplicity)
2. **recharts** - Full-featured, larger bundle
3. **@visx/sparkline** - Lightweight, composable
4. **react-sparklines** - Simple, small bundle

### FPS Counter Implementation

```typescript
const useFPS = () => {
  const [fps, setFPS] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const tick = () => {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        setFPS(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return fps;
};
```

### Ride Counter

The ride count represents total active trains currently tracked. Update on each SSE message:

```typescript
// In train store
updateTrains: (trains: Train[]) => {
  set({
    trains,
    rideCount: trains.length,
    rideHistory: [...get().rideHistory.slice(1), trains.length]
  });
}
```

---

*This UI specification was created on January 7, 2026 based on the reference design mockup.*
