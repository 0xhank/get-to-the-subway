# Stop Arrivals Feature Specification

**Status:** Planning Complete
**Feature:** Clickable Stop Markers with Real-Time Arrival Information
**Date:** January 2026

## Overview

Transform Live Subway NYC from a passive train visualization into an interactive arrival board system. Users can click subway stop markers on the map to view real-time train arrivals at that station, including route information, destination headsigns, and countdown timers.

## User Experience

### Map Interaction

**Stop Markers**
- Appear at zoom level 13 and higher (neighborhood level)
- Subtle white/gray circles with soft glow effect
- One marker per parent station (178 total, not per-platform)
- Click to open arrival panel
- Click map background to close panel

**Visual Feedback**
- Trains bound for selected stop highlight: 20% larger, brighter glow
- Non-highlighted trains remain visible at 85% opacity
- No overlaid labels on map (keep clean aesthetic)

### Side Panel UI

**Layout**
- Slides in from right edge (300ms ease-out transition)
- Fixed width: 384px on desktop, full-width on mobile
- Spans from top to bottom of viewport
- Positioned above map, below dialogs

**Content Structure**
```
┌─ Header ────────────────────────────────────────┐
│ Station Name                        [X] Close    │
│ [Route Badge] [Route Badge] ...                 │
├─ Divider ───────────────────────────────────────┤
│ Northbound                                      │
│ ├─ [1] Manhattan - Times Sq 42 St        3 min │
│ ├─ [2] Flatbush Av - Brooklyn            8 min │
│ └─ [3] Uptown & The Bronx               15 min │
│                                                  │
│ Southbound                                      │
│ ├─ [1] South Ferry                       2 min │
│ ├─ [2] Atlantic Av - Barclays           10 min │
│ └─ (No upcoming trains)                        │
└──────────────────────────────────────────────────┘
```

**Arrival Entry Format**
- Route badge (colored circle with line ID)
- Destination headsign (truncated if needed)
- Minutes until arrival (right-aligned)
- Hover state: slightly brightened background

**States**
1. **Loading**: Spinner with "Loading arrivals..." message
2. **Success**: Arrival list with northbound/southbound sections
3. **Empty**: "No upcoming trains" message (per direction)
4. **Error**: Error message with retry button
5. **Closed**: Not visible (translate-x-full)

### Interaction Patterns

**Opening Panel**
1. Click stop marker
2. Panel slides in (300ms)
3. Loading spinner appears
4. API fetches arrivals (~2s max)
5. Panel populated with data

**Closing Panel**
- Press ESC key
- Click map background
- Click X button in panel header
- Panel slides out (300ms), URL resets to `/`

**Live Updates**
- API polled every 15 seconds while panel open
- Arrival times update in real-time
- Minutes countdown live (client-side decrement)
- Poll stops when panel closes

**Deep Linking**
- Click stop → URL becomes `/stop/101` (example)
- Share URL, open in new tab → Panel opens automatically
- Browser back button → Panel closes, URL becomes `/`
- Browser forward button → Panel reopens

**Race Conditions**
- Rapid clicks cancel previous requests
- Only latest clicked stop shows data
- AbortController prevents stale responses

## Architecture

### Data Flow

```
┌─ Frontend ─────────────────┐
│ StopPanel Component        │
│ ├─ useStopArrivals hook    │
│ ├─ useStopRouting hook     │
│ └─ useStopStore (Zustand)  │
└──────────┬──────────────────┘
           │ HTTP GET
           ↓
┌─ Backend ──────────────────┐
│ /api/stops/:stopId/arrivals│
│ └─ fetchStopArrivals()     │
│    └─ Transiter API call   │
└──────────┬──────────────────┘
           │ /systems/us-ny-subway/stops/{stopId}
           ↓
┌─ Transiter ────────────────┐
│ Stop Times API             │
│ └─ StopTime[] with arrivals│
└────────────────────────────┘
```

### API Contract

**Endpoint:** `GET /api/stops/:stopId/arrivals`

**Request**
```
GET /api/stops/101/arrivals
```

**Success Response (200 OK)**
```json
{
  "stop": {
    "id": "101",
    "name": "Van Cortlandt Park-242 St",
    "routes": ["1"],
    "northArrivals": [
      {
        "routeId": "1",
        "headsign": "Van Cortlandt Park-242 St",
        "direction": "N",
        "arrivalTime": 1704567890,
        "vehicleId": "1-2345"
      }
    ],
    "southArrivals": [
      {
        "routeId": "1",
        "headsign": "South Ferry",
        "direction": "S",
        "arrivalTime": 1704567895,
        "vehicleId": "1-2346"
      }
    ]
  },
  "timestamp": 1704567800
}
```

**Error Responses**

404 Not Found (Invalid stop ID)
```json
{ "error": "STOP_NOT_FOUND" }
```

504 Gateway Timeout (Transiter timeout)
```json
{ "error": "TIMEOUT" }
```

503 Service Unavailable (Transiter down)
```json
{ "error": "SERVICE_UNAVAILABLE" }
```

### State Management (Zustand)

**Store: `useStopStore`**
```typescript
{
  selectedStopId: string | null;        // Currently open stop
  stopData: StopArrivalsResponse | null; // Fetched arrival data
  isLoading: boolean;                    // API loading state
  error: string | null;                  // Error message
  pollingInterval: number | null;        // setInterval ID

  // Actions
  selectStop: (stopId: string) => void;
  clearSelection: () => void;
  setStopData: (data: StopArrivalsResponse) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPollingInterval: (id: number | null) => void;
}
```

### Hooks

**`useStopArrivals()`**
- Triggered when `selectedStopId` changes
- Fetches arrivals from `/api/stops/:stopId/arrivals`
- Uses AbortController to cancel in-flight requests
- Polls every 15 seconds while panel open
- Cleans up interval on unmount

**`useStopRouting()`**
- Watches `selectedStopId` changes
- Updates URL to `/stop/{stopId}` or `/`
- Listens to browser back/forward (popstate)
- Parses initial URL on mount
- Manual History API (no React Router)

### Map Layers

**Stop Layer**
- Source: GeoJSON with 178 parent stations
- Layer type: Circle
- Paint properties:
  - `circle-radius`: 3px @ z13, 6px @ z16, 8px @ z18
  - `circle-color`: #ffffff (white)
  - `circle-opacity`: 0.6
  - `circle-stroke-width`: 1px
  - `circle-stroke-color`: #ffffff
  - `circle-blur`: 0.5 (glow effect)
  - `minzoom`: 13 (not visible below)

**Train Layer (Modified)**
- Add `opacity` property to track highlighting
- Highlighted trains: `opacity` = 1.0, `scale` *= 1.2
- Non-highlighted trains: `opacity` = 0.85, `scale` = normal
- Trail opacity boosted for highlighted trains

### Animation Specs

**Panel Slide Transition**
```css
transition-transform duration-300 ease-out
transform: translateX(0) /* open */
transform: translateX(100%) /* closed */
```

**Easing Function**
- `ease-out`: cubic-bezier(0, 0, 0.2, 1)
- Decelerates smoothly toward end
- Natural, polished feel

**Loading Spinner**
```css
animate-spin /* Tailwind built-in */
border-2 border-white/20 border-t-white/60
w-6 h-6 rounded-full
```

**Hover States**
- Panel background: `bg-white/5 → bg-white/10` on hover
- Button: `text-white/60 → text-white` on hover
- Smooth `transition-colors`

## Implementation Plan

### Phase 1: Data Foundation (Backend)

1. **Generate Parent Stations JSON**
   - Parse `data/stops.txt` GTFS file
   - Filter rows where `location_type = "1"` (parent stations only)
   - Extract: id, name, latitude, longitude
   - Output: `backend/data/parent-stations.json` (178 stations)
   - Copy to: `frontend/public/data/parent-stations.json`

2. **Create Stop Arrivals Endpoint**
   - File: `backend/src/routes/stops.ts`
   - Route: `GET /api/stops/:stopId/arrivals`
   - 5-second timeout on Transiter calls
   - Parse stopTimes, group by direction (directionId: false=N, true=S)
   - Filter to future arrivals only
   - Return raw Unix timestamps

3. **Transiter Integration**
   - File: `backend/src/transiter/stops.ts`
   - Call `/systems/us-ny-subway/stops/{stopId}` API
   - Extract stopTimes array
   - Compute unique routes from arrival data
   - Handle 404, timeout, and service unavailable errors

4. **Add Type Definitions**
   - File: `shared/src/index.ts`
   - Add `StopArrival`, `StopInfo`, `StopArrivalsResponse` types

5. **Register Router**
   - File: `backend/src/index.ts`
   - Import and mount stops router at `/api/stops`

### Phase 2: Frontend State

1. **Stop Store (Zustand)**
   - File: `frontend/src/store/stop-store.ts`
   - Track selected stop, arrival data, loading/error states
   - Polling interval ID management

2. **API Client Hook**
   - File: `frontend/src/hooks/useStopArrivals.ts`
   - Fetch arrivals when stop selected
   - Poll every 15 seconds
   - AbortController for request cancellation
   - Clean up on unmount

3. **URL Routing Hook**
   - File: `frontend/src/hooks/useStopRouting.ts`
   - Manual history.pushState for deep linking
   - popstate listener for browser navigation
   - Initial URL parsing on mount

### Phase 3: Map Layer

1. **Stop Markers Component**
   - File: `frontend/src/components/Map/StopLayer.tsx`
   - Load parent stations from JSON
   - Convert to GeoJSON FeatureCollection
   - Circle layer with zoom-dependent sizing

2. **Map Click Handler**
   - File: `frontend/src/App.tsx` (modify)
   - Add `interactiveLayerIds={["stops-circle"]}`
   - onClick handler: check feature.layer.id
   - Stop click: `selectStop(stopId)`
   - Background click: `clearSelection()`

### Phase 4: UI Panel

1. **StopPanel Component**
   - File: `frontend/src/components/StopPanel.tsx`
   - Header: station name, route badges, close button
   - Content: northbound/southbound arrival lists
   - States: loading, success, empty, error
   - ESC key listener for closing
   - formatMinutes() helper for time display

2. **Route Badge Component**
   - Small colored circles with line ID
   - Use `getLineColor()` from existing MTA colors

3. **Integration**
   - Add to App.tsx after SearchDialog/AboutDialog
   - Position: z-20 (above map, below dialogs)

### Phase 5: Train Highlighting

1. **Modify TrainLayer**
   - File: `frontend/src/components/Map/TrainLayer.tsx`
   - Read stopData from useStopStore
   - Build Set of highlighted vehicleIds
   - Add opacity and scale properties to GeoJSON
   - Update layer paint expressions for opacity

2. **Visual Effect**
   - Highlighted trains: `opacity: 1.0, scale: 1.2x`
   - Normal trains: `opacity: 0.85, scale: 1.0x`
   - Trail segments: opacity boosted by 30% when highlighted

## Testing Strategy

### Unit Tests
- `formatMinutes()`: Correct time calculations
- `stopsToGeoJSON()`: Proper feature transformation
- Zustand store: Action creators and selectors
- API error handling: Proper error parsing

### Integration Tests
- Click stop marker → Panel opens with loading state
- Panel loads data → Rendering with arrivals
- ESC key → Panel closes, URL resets
- Deep link to `/stop/101` → Panel opens automatically
- Rapid clicks → Only latest stop shows (aborts work)

### E2E Tests (Manual)
1. Full user flow: zoom, click stop, view arrivals, close panel
2. Live updates: Watch countdown timers and see refresh at 15s intervals
3. Error recovery: Stop backend, click stop, see error, restart, retry
4. Browser navigation: Forward/back buttons toggle panel state
5. Mobile: Verify responsive layout and touch interactions

### Visual Verification
- Stop markers visible at zoom 13+ only
- Panel slides smoothly (300ms ease-out)
- Train highlighting visible on map
- No layout shift when panel opens
- All text truncates gracefully
- Colors match MTA palette

## Edge Cases

**No Arrivals**
- Show "No upcoming trains" message
- Affects only one direction (N/S can differ)
- Timestamp not shown (keep simple)

**API Errors**
- Timeout (5s): Show error, suggest retry
- Not found: Show "Stop not found" error
- Service down: Show "Service unavailable" error
- All errors show retry button

**Stale Data**
- Panel closed, API still polling (shouldn't happen)
  - Solution: Check selectedStopId before updating
- Very long headsign
  - Solution: CSS `truncate` class
- Stop with no served routes
  - Solution: Render empty route badge list

**Mobile**
- Portrait orientation: Full-width panel
- Landscape: 384px fixed width
- Touch events work on markers
- Swipe-to-dismiss: Not implemented (not required)

**Performance**
- 178 stop features: Negligible load
- Memoized GeoJSON generation
- Zustand shallow equality prevents excess re-renders
- AbortController prevents memory leaks
- 15s polling interval: reasonable backend load

## File Changes Summary

### New Files (9)

**Backend (3)**
- `backend/src/routes/stops.ts` - API endpoint router
- `backend/src/transiter/stops.ts` - Transiter integration
- `backend/data/parent-stations.json` - Station data (generated)

**Frontend (6)**
- `frontend/src/store/stop-store.ts` - Zustand store
- `frontend/src/hooks/useStopArrivals.ts` - API fetch hook
- `frontend/src/hooks/useStopRouting.ts` - URL routing hook
- `frontend/src/components/StopPanel.tsx` - Main panel component
- `frontend/src/components/Map/StopLayer.tsx` - Stop markers layer
- `frontend/public/data/parent-stations.json` - Station data copy

### Modified Files (4)

**Backend (1)**
- `backend/src/index.ts` - Register stops router

**Frontend (2)**
- `frontend/src/App.tsx` - Add click handler, layers, panel
- `frontend/src/components/Map/TrainLayer.tsx` - Train highlighting

**Shared (1)**
- `shared/src/index.ts` - Add type definitions

### Build Scripts
- Add `generate-parent-stations` to `package.json` scripts

## Development Sequence

Recommended order (allows testing at each phase):

1. Generate parent stations JSON + add types
2. Create backend API endpoint
3. Create Zustand store + hooks
4. Create StopLayer component
5. Add click handler to App
6. Create StopPanel component
7. Add URL routing
8. Implement train highlighting
9. Polish and test end-to-end

## Performance Metrics

**Initial Load**
- Stop markers: 178 GeoJSON features (~10-20KB)
- Parent stations JSON: ~5KB gzipped
- No additional bundle overhead

**Runtime**
- API response time: <1s typical, <2s 95th percentile
- Polling interval: 15s (matches train updates)
- Panel animation: 300ms (imperceptible)
- Re-render cost: Minimal (memoized GeoJSON)

**Memory**
- Zustand store: Small fixed size
- Polling interval: Cleaned up on unmount
- AbortController: Prevents request leaks

## Rollback Plan

If issues arise during implementation:

1. **Stop markers problematic**: Disable StopLayer, remove from App
2. **API endpoint broken**: Return empty arrivals, show "Service unavailable"
3. **Panel UI issues**: Hide panel, keep map functional
4. **Train highlighting broken**: Revert TrainLayer changes

All changes are additive; removing StopPanel/StopLayer doesn't affect existing functionality.

## Future Enhancements

Not in scope, but possible:
- Service alerts and disruptions
- Station accessibility info (elevators, etc.)
- Nearby stops carousel
- Save/favorite stops
- Arrival history analytics
- Sound/push notifications for arrivals
- Wheelchair accessible route filtering
- Real-time delay/schedule adherence

## Dependencies

**No new dependencies required.** Uses existing:
- Zustand (state)
- MapLibre GL JS (map)
- react-map-gl (wrapper)
- Tailwind CSS (styling)
- lucide-react (icons)

## Questions & Decisions Recorded

**From User Interview:**
- UI: Side panel, zoom-dependent markers, parent station grouping ✓
- Data: On-demand REST endpoint, raw timestamps, future arrivals only ✓
- Animation: Exact CSS values required (300ms ease-out) ✓
- Error: Error state with retry button ✓
- Deep linking: Full URL support with history API ✓
- Accessibility: Not prioritized (user preference) ✓

---

**Last Updated:** January 8, 2026
**Next Step:** Begin Phase 1 implementation
