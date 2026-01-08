# Train Marker Styling Specification

> Visual design specification for directional arrow train markers

**Version:** 1.0
**Created:** January 7, 2026
**Depends On:** ui-design-spec.md

---

## Table of Contents

1. [Overview](#overview)
2. [Visual Design](#visual-design)
3. [Arrow Icon Specification](#arrow-icon-specification)
4. [Bearing Calculation](#bearing-calculation)
5. [Animation Behaviors](#animation-behaviors)
6. [MapLibre Implementation](#maplibre-implementation)
7. [Icon Loading](#icon-loading)
8. [Edge Cases](#edge-cases)

---

## Overview

### Design Goals

Transform the current simple circle train markers into directional arrow markers that:

- Indicate travel direction via rotation
- Maintain the "control room" aesthetic with glowing effects
- Animate smoothly as trains move between stations
- Pulse gently when stopped at stations
- Perform efficiently with 500+ simultaneous trains

### Visual Metaphor

**Filled chevron/dart arrows** pointing in the direction of travel, evoking radar tracking displays and flight monitoring systems. The arrows convey motion and intent while the circular glow maintains the luminous control room feel.

---

## Visual Design

### Marker Components (Layered)

```
         ┌─────────────┐
         │  Arrow Icon │  ← Foreground: Filled chevron, MTA line color
         │   (symbol)  │     Rotated to bearing, white 1px halo
         └─────────────┘
               │
         ┌─────────────┐
         │ Circular    │  ← Background: Soft circular blur
         │   Glow      │     Same line color, 30% opacity
         │  (circle)   │     Provides luminous halo effect
         └─────────────┘
```

### Color Scheme

| Element | Color Source | Opacity |
|---------|--------------|---------|
| Arrow fill | MTA line color (`getLineColor()`) | 100% |
| Arrow halo/stroke | White `#ffffff` | 100% |
| Glow circle | MTA line color | 30% |

### Size Scaling (Zoom-Responsive)

| Zoom Level | Arrow Size | Glow Radius |
|------------|------------|-------------|
| 10 | 8px | 12px |
| 14 | 12px | 18px |
| 18 | 16px | 24px |

Sizes interpolate linearly between these breakpoints.

---

## Arrow Icon Specification

### Shape: Filled Chevron/Dart

A filled triangular arrow with a notched tail, creating a dart-like appearance that clearly indicates direction.

### Dimensions

- **Viewbox:** 16 x 20 (width x height)
- **Aspect ratio:** 0.8:1
- **Anchor point:** Center of visual mass (for rotation pivot)

### SVG Definition

```svg
<svg width="16" height="20" viewBox="0 0 16 20" xmlns="http://www.w3.org/2000/svg">
  <!--
    Filled dart/chevron arrow pointing UP (0 degrees)
    Rotation pivot should be at center (8, 10)
  -->
  <path
    d="M8 0 L16 14 L8 10 L0 14 Z"
    fill="currentColor"
  />
</svg>
```

### Path Breakdown

```
M8 0      → Start at top center (arrow tip)
L16 14    → Line to bottom-right corner
L8 10     → Line to center notch (creates the V cutout)
L0 14     → Line to bottom-left corner
Z         → Close path back to start
```

### Visual Representation

```
        ▲ (8, 0)
       ╱ ╲
      ╱   ╲
     ╱     ╲
    ╱       ╲
   ╱    ●    ╲     ● = rotation anchor (8, 10)
  ╱   (8,10)  ╲
 ╱      ╲      ╲
▼────────▼──────▼
(0,14)  (8,10)  (16,14)
```

### Icon as Data URI (for inline loading)

```typescript
const ARROW_SVG_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent('<svg width="16" height="20" viewBox="0 0 16 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 0 L16 14 L8 10 L0 14 Z" fill="white"/></svg>');
```

**Note:** The SVG uses `fill="white"` and MapLibre's `icon-color` property tints it to the appropriate MTA line color.

---

## Bearing Calculation

### Primary Method: Heading to Next Stop

Calculate the bearing from the train's current position toward its scheduled next stop.

```typescript
interface TrainWithBearing extends Train {
  bearing: number | null;  // Degrees, 0 = North, 90 = East, null = unknown
}

function calculateBearingToNextStop(
  currentLat: number,
  currentLng: number,
  nextStopLat: number,
  nextStopLng: number
): number {
  const lat1 = currentLat * Math.PI / 180;
  const lat2 = nextStopLat * Math.PI / 180;
  const dLng = (nextStopLng - currentLng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;  // Normalize to 0-360
}
```

### Data Requirements

The bearing calculation requires:
- Current train position (latitude, longitude)
- Next stop position (latitude, longitude)

This data should be enriched in the backend when polling Transiter, using the station coordinates lookup.

### Bearing Updates

- Recalculate bearing when train's `nextStop` changes
- Interpolate bearing transitions over 500ms (see Animation section)

---

## Animation Behaviors

### 1. Bearing Rotation Transition

When a train's bearing changes (e.g., turning a corner), smoothly interpolate the rotation.

**Parameters:**
- Duration: 500ms
- Easing: ease-out cubic
- Direction: Always take the shortest rotational path (handle 350° → 10° correctly)

```typescript
function interpolateBearing(
  fromBearing: number,
  toBearing: number,
  progress: number  // 0 to 1
): number {
  // Calculate shortest rotation direction
  let diff = toBearing - fromBearing;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Apply easing
  const easedProgress = 1 - Math.pow(1 - progress, 3);  // ease-out cubic

  return (fromBearing + diff * easedProgress + 360) % 360;
}
```

### 2. Stopped Train Pulse Animation

Trains with status `STOPPED_AT` display a gentle pulsing animation to indicate they are dwelling at a station.

**Parameters:**
- Scale range: 1.0 → 1.15 → 1.0
- Period: 1.5 seconds (full cycle)
- Easing: ease-in-out (sinusoidal)

```typescript
function calculatePulseScale(
  timestamp: number,
  trainStoppedAt: number  // When the train stopped
): number {
  const elapsed = timestamp - trainStoppedAt;
  const period = 1500;  // 1.5 seconds in ms
  const phase = (elapsed % period) / period;  // 0 to 1

  // Sinusoidal ease-in-out: 0→1→0 over the period
  const pulse = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;  // 0 to 1

  // Scale from 1.0 to 1.15
  return 1.0 + (pulse * 0.15);
}
```

### 3. Implementation via GeoJSON Properties

Both animations are driven by updating GeoJSON feature properties each frame:

```typescript
interface TrainFeatureProperties {
  id: string;
  line: string;
  color: string;
  bearing: number;         // Current interpolated bearing
  scale: number;           // Current scale (1.0 for moving, animated for stopped)
  hasBearing: boolean;     // Whether bearing is valid (for fallback rendering)
}
```

The `useInterpolatedTrains` hook should be extended to compute these animated values.

---

## MapLibre Implementation

### Layer Structure

Replace the current three-layer setup with:

1. **Glow Layer** (circle) - unchanged, provides background halo
2. **Arrow Layer** (symbol) - new, renders directional arrows
3. ~~Label Layer~~ - removed (no labels on arrows per spec)

### Source Definition

```typescript
function trainsToGeoJSON(trains: TrainWithBearing[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trains.map((train) => ({
      type: "Feature",
      id: train.id,
      geometry: {
        type: "Point",
        coordinates: [train.longitude, train.latitude],
      },
      properties: {
        id: train.id,
        line: train.line,
        color: getLineColor(train.line),
        bearing: train.bearing ?? 0,
        scale: train.scale ?? 1.0,
        hasBearing: train.bearing !== null,
      },
    })),
  };
}
```

### Glow Layer Specification

```typescript
const glowLayer: CircleLayerSpecification = {
  id: "trains-glow",
  type: "circle",
  source: "trains",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 12, ["get", "scale"]],
      14, ["*", 18, ["get", "scale"]],
      18, ["*", 24, ["get", "scale"]],
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 0.3,
    "circle-blur": 1,
  },
};
```

### Arrow Layer Specification

```typescript
const arrowLayer: SymbolLayerSpecification = {
  id: "trains-arrow",
  type: "symbol",
  source: "trains",
  filter: ["==", ["get", "hasBearing"], true],  // Only render arrows for trains with valid bearing
  layout: {
    "icon-image": "train-arrow",
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 0.5, ["get", "scale"]],   // 8px at zoom 10
      14, ["*", 0.75, ["get", "scale"]],  // 12px at zoom 14
      18, ["*", 1.0, ["get", "scale"]],   // 16px at zoom 18
    ],
    "icon-rotate": ["get", "bearing"],
    "icon-rotation-alignment": "map",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-halo-color": "#ffffff",
    "icon-halo-width": 1,
    "icon-opacity": 1,
  },
};
```

### Fallback Circle Layer (for trains without bearing)

```typescript
const fallbackCircleLayer: CircleLayerSpecification = {
  id: "trains-circle-fallback",
  type: "circle",
  source: "trains",
  filter: ["==", ["get", "hasBearing"], false],  // Only trains without valid bearing
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, ["*", 4, ["get", "scale"]],
      14, ["*", 8, ["get", "scale"]],
      18, ["*", 12, ["get", "scale"]],
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 1,
    "circle-stroke-width": 1,
    "circle-stroke-color": "rgba(255, 255, 255, 0.5)",
  },
};
```

---

## Icon Loading

### Loading Strategy

Load the arrow icon into MapLibre on the map's `load` event, before the TrainLayer component renders.

### Implementation

```typescript
// In Map component or a dedicated hook

function useArrowIcon(map: MapLibreMap | null) {
  useEffect(() => {
    if (!map) return;

    const loadIcon = () => {
      // Check if already loaded
      if (map.hasImage("train-arrow")) return;

      // Create image from SVG
      const img = new Image(16, 20);
      img.onload = () => {
        if (!map.hasImage("train-arrow")) {
          map.addImage("train-arrow", img, { sdf: true });
        }
      };
      img.src = ARROW_SVG_DATA_URI;
    };

    if (map.loaded()) {
      loadIcon();
    } else {
      map.on("load", loadIcon);
    }

    return () => {
      map.off("load", loadIcon);
    };
  }, [map]);
}
```

### SDF Mode

The icon is loaded with `sdf: true` (Signed Distance Field) which enables:
- Runtime color tinting via `icon-color`
- Halo/stroke effects via `icon-halo-color` and `icon-halo-width`
- Crisp rendering at all zoom levels

---

## Edge Cases

### No Bearing Data Available

**Cause:** Train has no `nextStop` data, or station coordinates are missing.

**Behavior:**
- Set `hasBearing: false` in feature properties
- Train renders as a simple circle (fallback layer) instead of arrow
- Maintains visual consistency without misleading directional information

### Train at Terminus

**Cause:** Train is at end of line with no next stop.

**Behavior:**
- If train has arrived at terminus: no next stop → falls back to circle
- If train is departing terminus: bearing points toward first stop on return journey

### Overlapping Trains

**Cause:** Multiple trains at same station (express/local, cross-platform transfer).

**Behavior:**
- All trains render at their exact positions
- `icon-allow-overlap: true` ensures no trains are hidden
- Natural stacking order determined by render sequence
- Glow layers blend additively, creating brighter halos where trains cluster

### Rapid Bearing Changes

**Cause:** Train data updates faster than bearing interpolation completes.

**Behavior:**
- Each new bearing target cancels previous interpolation
- New interpolation starts from current interpolated value (not original)
- Prevents jarring snaps while remaining responsive

### Performance Considerations

**Target:** Maintain 60fps with 500+ trains

**Optimizations:**
- Single GeoJSON source update per frame (batched)
- Property-driven animations (no layer recreation)
- Scale/bearing calculations in `requestAnimationFrame` loop
- Memoize bearing calculations until nextStop changes

---

## Out of Scope

The following features were explicitly excluded from this specification:

- **Line labels on arrows:** Rely on color coding for line identification
- **Delay indicators:** Requires additional data integration
- **Click/selection interactions:** Markers are display-only
- **Accessibility patterns for colorblind users:** Uses standard MTA color system
- **Random train highlighting:** Random feature excluded from project

---

## Summary of Changes from Current Implementation

| Aspect | Current | New |
|--------|---------|-----|
| Shape | Circle | Directional arrow (chevron/dart) |
| Rotation | None | Bearing to next stop |
| Stopped state | Same as moving | Pulsing animation (1.0→1.15 scale, 1.5s) |
| Labels | Line letter at z13+ | Removed |
| Layers | 3 (glow, circle, label) | 3 (glow, arrow, fallback circle) |
| Icon source | N/A | Single white SVG, SDF-tinted |
| Bearing smoothing | N/A | 500ms ease-out interpolation |

---

*This specification was created on January 7, 2026 based on stakeholder interview.*
