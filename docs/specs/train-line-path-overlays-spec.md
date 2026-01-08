# Train Line Path Overlays - Technical Specification

## Overview

Add subway line path overlays to the map with dynamic brightening that responds to real-time train movement. Lines will render with low opacity by default and brighten when trains pass nearby, creating a "living control room" visualization of the NYC subway network.

## Requirements

### Functional
- Display all NYC subway line paths on the map
- Separate geometries for northbound and southbound directions
- Lines brighten (increase opacity) when trains are within 400m proximity
- Progressive visibility: fade in at z11+, full opacity at z13+
- Use MTA line colors (desaturated from existing palette)

### Non-Functional
- Maintain 30+ FPS performance with 500+ active trains
- Initial load time < 2 seconds for route data
- GeoJSON bundle size < 5MB (compressed)
- Proximity calculations < 10ms per update cycle

## Data Pipeline

### 1. Source Data
- **Input:** MTA GTFS Static Feed - `shapes.txt`
- **Format:** CSV with columns: `shape_id`, `shape_pt_lat`, `shape_pt_lon`, `shape_pt_sequence`
- **Source URL:** http://web.mta.info/developers/data/nyct/subway/google_transit.zip

### 2. Preprocessing Script

**Location:** `scripts/generate-route-paths.ts`

**Process:**
1. Download and extract MTA GTFS static feed
2. Parse `shapes.txt` and `trips.txt` to map shape_id → route_id + direction
3. Group shape points by route-direction (e.g., "A-N", "A-S")
4. Convert to GeoJSON LineString features
5. Simplify geometry using Turf.js with tolerance = 0.0005° (~50m)
6. Assign properties: `line`, `direction`, `routeId`, `color`
7. Generate unique feature IDs for each line segment (for feature-state API)
8. Output to `data/routes.geojson`

**Dependencies:**
- `@turf/turf` - geometry operations
- `papaparse` - CSV parsing
- `node-fetch` - download GTFS

**Output Schema:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "A-N",
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      },
      "properties": {
        "line": "A",
        "direction": "N",
        "routeId": "A-N",
        "color": "#5c7ba8"
      }
    }
  ]
}
```

### 3. Color Transformation

**Function:** `getDesaturatedLineColor(line: string): string`

**Location:** `frontend/src/lib/mta-colors.ts`

**Logic:**
1. Get base color from `MTA_COLORS[line]`
2. Convert hex to HSL
3. Reduce saturation by 40%
4. Reduce lightness by 30%
5. Convert back to hex

**Example:**
- A train base: `#7ba3d4` (soft periwinkle)
- A train path: `#5c7ba8` (darker, muted blue)

## Frontend Implementation

### 1. Component Structure

**New Component:** `frontend/src/components/Map/RoutePathsLayer.tsx`

**Responsibilities:**
- Load route GeoJSON from `/data/routes.geojson`
- Calculate proximity between trains and line segments
- Update MapLibre feature-states for brightening
- Render layers with appropriate styling

**Hooks:**
- `useRoutePaths()` - fetch and parse GeoJSON, build spatial index
- `useProximityUpdater()` - throttled proximity calculations (10Hz)

### 2. Spatial Indexing

**Library:** `rbush` (R-tree spatial index)

**Setup:**
```typescript
interface LineSegmentItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  featureId: string;
  coordinates: [number, number][];
}

const segmentIndex = new RBush<LineSegmentItem>();
```

**Build Process:**
1. On GeoJSON load, extract each LineString
2. Break into individual segments (point pairs)
3. Calculate bounding box for each segment
4. Insert into R-tree with reference to feature ID + segment index

**Query:**
```typescript
// For each train position
const bbox = {
  minX: lon - 0.0036, // ~400m at NYC latitude
  minY: lat - 0.0036,
  maxX: lon + 0.0036,
  maxY: lat + 0.0036
};
const candidates = segmentIndex.search(bbox);

// Precise distance check on candidates
const activeSegments = candidates.filter(seg =>
  pointToLineDistance(train, seg.coordinates) <= 400
);
```

### 3. Proximity Calculation

**Function:** `calculateActiveSegments(trains: InterpolatedTrain[]): Set<string>`

**Update Frequency:** 10Hz (100ms throttle)

**Algorithm:**
1. Initialize empty `Set<string>` for active feature IDs
2. For each train with valid position:
   - Query spatial index with 400m bounding box
   - For each candidate segment:
     - Calculate precise point-to-line distance (Turf.js)
     - If distance ≤ 400m, add feature ID to set
3. Return set of active feature IDs

**Distance Calculation:**
- Use `@turf/point-to-line-distance` with `units: 'meters'`
- Only calculate for candidates from spatial index (not all segments)

### 4. Feature State Management

**MapLibre API:**
```typescript
// On proximity update
activeSegments.forEach(featureId => {
  map.setFeatureState(
    { source: 'route-paths', id: featureId },
    { active: true }
  );
});

// Remove stale active states
previousActive.forEach(featureId => {
  if (!activeSegments.has(featureId)) {
    map.setFeatureState(
      { source: 'route-paths', id: featureId },
      { active: false }
    );
  }
});
```

### 5. Layer Configuration

**Base Layer (dim lines):**
```typescript
const basePathLayer: LineLayerSpecification = {
  id: 'route-paths-base',
  type: 'line',
  source: 'route-paths',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      11, 1.5,
      13, 3,
      16, 5
    ],
    'line-opacity': [
      'interpolate', ['linear'], ['zoom'],
      10, 0,
      11, 0.15,
      13, 0.15
    ],
    'line-cap': 'round',
    'line-join': 'round'
  }
};
```

**Active Layer (bright lines):**
```typescript
const activePathLayer: LineLayerSpecification = {
  id: 'route-paths-active',
  type: 'line',
  source: 'route-paths',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      11, 1.5,
      13, 3,
      16, 5
    ],
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'active'], false],
      [
        'interpolate', ['linear'], ['zoom'],
        10, 0,
        11, 0.6,
        13, 0.6
      ],
      0
    ],
    'line-cap': 'round',
    'line-join': 'round'
  }
};
```

### 6. Layer Order

**Rendering stack (bottom to top):**
1. Basemap (CartoDB Dark Matter)
2. `route-paths-base` (dim lines)
3. `route-paths-active` (bright lines)
4. `trains-trail` (existing)
5. `trains-arrow` (existing)
6. `trains-circle-fallback` (existing)

**Integration in App.tsx:**
```tsx
<Map {...viewState}>
  <RoutePathsLayer />  {/* New */}
  <TrainLayer />        {/* Existing */}
</Map>
```

## Performance Optimizations

### 1. Geometry Simplification
- **Tolerance:** 0.0005° (~50m)
- **Expected reduction:** 70-80% fewer points
- **Tool:** `@turf/simplify` with `highQuality: false`

### 2. Spatial Index
- **Library:** RBush R-tree
- **Build time:** ~50ms (once on load)
- **Query time:** ~1-2ms per train (vs ~100ms brute force)
- **Memory:** ~2-3MB for index structure

### 3. Throttled Updates
- **Rate:** 10Hz (100ms intervals)
- **Implementation:** `requestAnimationFrame` + timestamp check
- **Benefit:** 6x fewer calculations than 60fps
- **Trade-off:** Max 100ms latency for brightening

### 4. Feature State vs Layer Updates
- **Approach:** Use `setFeatureState()` instead of regenerating GeoJSON
- **Benefit:** No object creation, no GC pressure
- **MapLibre optimization:** GPU-side state changes only

### 5. Memoization
- Memoize color transformations (cache `getDesaturatedLineColor()` results)
- Cache spatial index between renders
- Only rebuild proximity set when train positions change

## File Changes

### New Files
1. `scripts/generate-route-paths.ts` - GTFS preprocessing script
2. `data/routes.geojson` - Generated route paths (committed to repo)
3. `frontend/src/components/Map/RoutePathsLayer.tsx` - New layer component
4. `frontend/src/hooks/useRoutePaths.ts` - GeoJSON loading + spatial index
5. `frontend/src/hooks/useProximityUpdater.ts` - Train proximity calculations

### Modified Files
1. `frontend/src/lib/mta-colors.ts` - Add `getDesaturatedLineColor()`
2. `frontend/src/App.tsx` - Import and render `<RoutePathsLayer />`
3. `package.json` (root) - Add script: `"generate-routes": "tsx scripts/generate-route-paths.ts"`
4. `frontend/package.json` - Add dependencies: `rbush`, `@turf/point-to-line-distance`, `@turf/helpers`
5. `scripts/package.json` - Add dependencies: `@turf/turf`, `papaparse`, `@types/papaparse`

### Dependencies

**Frontend:**
```json
{
  "rbush": "^4.0.1",
  "@turf/point-to-line-distance": "^7.2.0",
  "@turf/helpers": "^7.2.0"
}
```

**Scripts:**
```json
{
  "@turf/turf": "^7.2.0",
  "papaparse": "^5.4.1",
  "@types/papaparse": "^5.3.15"
}
```

## Implementation Phases

### Phase 1: Data Pipeline
1. Create preprocessing script
2. Download GTFS, parse shapes.txt + trips.txt
3. Generate routes.geojson
4. Verify output structure and file size
5. Commit generated file to repo

### Phase 2: Static Display
1. Create RoutePathsLayer component
2. Load GeoJSON from static file
3. Render base layer (no brightening yet)
4. Verify layer ordering and styling
5. Test zoom-dependent width and opacity

### Phase 3: Spatial Indexing
1. Create useRoutePaths hook
2. Build RBush index from LineStrings
3. Verify index coverage (all segments indexed)
4. Test query performance with sample positions

### Phase 4: Dynamic Brightening
1. Create useProximityUpdater hook
2. Implement throttled update loop (10Hz)
3. Calculate active segments using spatial index
4. Update feature-states in MapLibre
5. Render active layer with conditional opacity

### Phase 5: Color & Polish
1. Implement getDesaturatedLineColor()
2. Apply to route features
3. Fine-tune opacity values
4. Verify visual hierarchy (paths < trains)

## Verification & Testing

### Manual Testing
1. **Static display:**
   - Zoom in/out, verify progressive opacity
   - Check all lines render with correct colors
   - Verify no lines obscure train markers

2. **Dynamic brightening:**
   - Move trains across map, verify paths brighten
   - Check 400m proximity threshold is accurate
   - Verify brightening updates within ~100ms

3. **Performance:**
   - Open DevTools Performance tab
   - Record 30 seconds with 500+ trains
   - Verify FPS stays above 30
   - Check proximity calculations < 10ms

### Edge Cases
- **No trains on a line:** Path remains dim (base opacity)
- **Multiple trains on same segment:** Segment brightens once (idempotent)
- **Train at line terminus:** Only brighten connected segments
- **Parallel tracks:** Verify 400m threshold doesn't activate wrong line

### Performance Benchmarks
- GeoJSON load time: < 500ms
- Spatial index build: < 100ms
- Proximity calc (500 trains): < 10ms
- Total bundle size increase: < 300KB (gzipped)

## Future Enhancements (Out of Scope)

- Click interaction on lines to filter trains by route
- Show line service alerts/disruptions
- Toggle individual lines on/off
- Express vs local line differentiation
- Historical heatmaps of train density over time

## References

- [MTA GTFS Static Feed](http://web.mta.info/developers/data/nyct/subway/google_transit.zip)
- [GTFS Shapes.txt Specification](https://gtfs.org/schedule/reference/#shapestxt)
- [MapLibre Feature State API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setfeaturestate)
- [RBush Spatial Index](https://github.com/mourner/rbush)
- [Turf.js Docs](https://turfjs.org/docs/)
