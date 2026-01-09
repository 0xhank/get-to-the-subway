# Live Subway NYC - Technical Specification

> A real-time NYC subway train visualization with a "control room" aesthetic

**Version:** 1.0  
**Created:** January 7, 2026  
**Timeline:** Weekend project (2-3 days)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Specification](#backend-specification)
4. [Frontend Specification](#frontend-specification)
5. [Data Flow](#data-flow)
6. [Visual Design](#visual-design)
7. [Map Specification](#map-specification)
8. [Error Handling](#error-handling)
9. [Deployment](#deployment)
10. [API Reference](#api-reference)
11. [File Structure](#file-structure)
12. [Implementation Phases](#implementation-phases)

---

## Overview

### Product Vision

A web application displaying live NYC subway train positions on an interactive MapLibre map. The aesthetic is "control room" - a dark, dramatic visualization where trains appear as glowing colored dots moving through a living circuit board of subway lines.

### Core Features (v1)

- Real-time train positions for all NYC subway lines
- Dark "control room" map aesthetic
- Zoom-adaptive train markers with glow effects
- Animated track lines that brighten when trains pass
- Smooth train movement via linear interpolation
- Visual heartbeat indicator for data freshness
- Graceful degradation on feed failures
- Desktop-first with functional mobile support

### Out of Scope (v2+)

- Train/station click interactions
- Station arrivals board
- Line filtering controls
- Track-aware interpolation (following actual rail geometry)
- PWA/offline support

### Target Transit System

**NYC MTA Subway** - All lines across all boroughs

---

## Architecture

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MTA GTFS-RT   │────▶│  Express API    │────▶│  React Frontend │
│   Feeds (x8)    │     │  (Railway)      │ SSE │  (Vercel)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  In-Memory      │
                        │  Train Cache    │
                        └─────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | React 18 + Vite |
| Language | TypeScript (throughout) |
| State Management | Zustand + TanStack Query |
| Styling | Tailwind CSS |
| Map | MapLibre GL JS + react-map-gl |
| Backend | Express.js (Node 20+) |
| GTFS Parsing | gtfs-realtime-bindings |
| Real-time | Server-Sent Events (SSE) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

### Repository Structure

```
live-subway/
├── frontend/           # React + Vite app
├── backend/            # Express API server
├── shared/             # Shared TypeScript types
├── scripts/            # Build/data processing scripts
├── data/               # Static GTFS data (track geometry)
├── docs/               # Documentation
│   └── specs/          # This spec
├── package.json        # Root package.json (workspace)
├── pnpm-workspace.yaml # pnpm workspace config
└── README.md
```

---

## Backend Specification

### MTA Feed Configuration

The MTA provides separate GTFS-Realtime feeds for different subway divisions:

| Feed ID | Lines | Endpoint |
|---------|-------|----------|
| `ace` | A, C, E | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace` |
| `bdfm` | B, D, F, M | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm` |
| `g` | G | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g` |
| `jz` | J, Z | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz` |
| `nqrw` | N, Q, R, W | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw` |
| `l` | L | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l` |
| `1234567` | 1, 2, 3, 4, 5, 6, 7 | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs` |
| `si` | SIR | `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si` |

### Feed Polling Strategy

- **Poll interval:** 15 seconds
- **Parallel fetching:** All 8 feeds fetched simultaneously
- **Independent loops:** Each feed has its own polling loop with circuit breaker
- **Circuit breaker config:**
  - Failure threshold: 3 consecutive failures
  - Recovery timeout: 60 seconds
  - Half-open test: Single request after timeout

### Data Processing Pipeline

```
MTA Feed (protobuf)
       │
       ▼
Parse with gtfs-realtime-bindings
       │
       ▼
Extract VehiclePosition entities
       │
       ▼
Transform to internal Train type
       │
       ▼
Merge into unified train cache
       │
       ▼
Broadcast to SSE clients
```

### Train Data Model

```typescript
interface Train {
  id: string;              // Unique vehicle ID
  line: string;            // Route ID (e.g., "A", "7", "L")
  direction: "N" | "S";    // North/South (uptown/downtown)
  latitude: number;
  longitude: number;
  timestamp: number;       // Unix timestamp of position update
  stopId?: string;         // Current or next stop ID
  status: "INCOMING" | "AT_STOP" | "IN_TRANSIT";
}

interface FeedStatus {
  feedId: string;
  lastUpdate: number;
  isHealthy: boolean;
  errorCount: number;
}

interface TrainCache {
  trains: Map<string, Train>;
  feedStatuses: Map<string, FeedStatus>;
  lastBroadcast: number;
}
```

### SSE Event Format

```typescript
// Event: "trains"
interface TrainsEvent {
  type: "trains";
  data: {
    trains: Train[];
    feedStatuses: FeedStatus[];
    timestamp: number;
  };
}

// Event: "heartbeat"
interface HeartbeatEvent {
  type: "heartbeat";
  data: {
    timestamp: number;
  };
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trains` | Current train positions (REST fallback) |
| `GET` | `/api/trains/stream` | SSE stream of train updates |
| `GET` | `/api/status` | Feed health status |
| `GET` | `/health` | Server health check |

---

## Frontend Specification

### Application State (Zustand)

```typescript
interface AppState {
  // Train data
  trains: Train[];
  feedStatuses: FeedStatus[];
  lastUpdate: number;
  
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // UI state
  isLegendOpen: boolean;
  
  // Actions
  setTrains: (trains: Train[]) => void;
  setFeedStatuses: (statuses: FeedStatus[]) => void;
  setConnected: (connected: boolean) => void;
  toggleLegend: () => void;
}
```

### TanStack Query Integration

```typescript
// SSE connection managed as a query
const useTrainStream = () => {
  return useQuery({
    queryKey: ['trainStream'],
    queryFn: () => {
      // Establish SSE connection
      // Return cleanup function
    },
    staleTime: Infinity,  // SSE manages freshness
    refetchOnWindowFocus: false,
  });
};
```

### Component Hierarchy

```
<App>
├── <MapContainer>
│   ├── <Map>                    # react-map-gl Map component
│   │   ├── <TrackLayer>         # Subway line geometry
│   │   ├── <TrainLayer>         # Train markers (GeoJSON source + layers)
│   │   └── <TrackGlowLayer>     # Dynamic brightness overlay
│   └── <MapControls>            # Zoom controls (optional)
├── <Legend>                     # Collapsible line color legend
├── <HeartbeatIndicator>         # Pulsing freshness indicator
└── <ConnectionStatus>           # Error banner (when needed)
```

### Performance Considerations

**Train markers:** Use a single GeoJSON `Source` with `circle` and `symbol` layers, NOT individual `<Marker>` components. This allows MapLibre to batch render hundreds of markers efficiently.

```typescript
// Good: Single source, MapLibre handles rendering
<Source id="trains" type="geojson" data={trainGeoJSON}>
  <Layer type="circle" ... />
  <Layer type="symbol" ... />
</Source>

// Bad: Individual markers (React reconciliation overhead)
{trains.map(train => <Marker key={train.id} ... />)}
```

**Interpolation:** Use `map.easeTo()` or update GeoJSON coordinates with MapLibre's built-in interpolation rather than React state updates every frame.

---

## Data Flow

### Initial Load Sequence

```
1. Frontend loads, renders empty map
2. TanStack Query establishes SSE connection to /api/trains/stream
3. Backend sends initial "trains" event with all current positions
4. Frontend renders train markers
5. Backend sends "heartbeat" every 5 seconds
6. Backend sends "trains" event on each poll cycle (~15 sec)
7. Frontend interpolates train positions between updates
```

### Train Position Update Flow

```
Backend poll cycle:
  ├── Fetch all 8 feeds in parallel
  ├── Parse protobuf responses
  ├── Merge into train cache
  ├── Diff against previous state
  └── Broadcast "trains" event to all SSE clients

Frontend receives "trains" event:
  ├── Update Zustand store
  ├── Calculate interpolation targets
  ├── Update GeoJSON source
  └── MapLibre animates markers to new positions
```

### Linear Interpolation Strategy

When a new train position arrives:

1. Store previous position and new position
2. Calculate animation duration (time until next expected update, ~15 sec)
3. Use `requestAnimationFrame` or MapLibre's `easeTo` to smoothly move marker
4. If new data arrives mid-animation, retarget to new position

```typescript
interface InterpolatedTrain extends Train {
  prevLatitude: number;
  prevLongitude: number;
  animationStart: number;
  animationDuration: number;
}
```

---

## Visual Design

### Color Palette

**Background & UI:**
| Element | Color | Hex |
|---------|-------|-----|
| Map background | Near black | `#0a0a0a` |
| Water | Dark navy | `#0d1117` |
| Parks | Dark green | `#0d1a0d` |
| Streets | Charcoal | `#1a1a1a` |
| UI background | Dark gray | `#121212` |
| UI text | Off-white | `#e0e0e0` |
| UI accent | Electric blue | `#00d4ff` |

**MTA Official Line Colors:**
| Line(s) | Color | Hex |
|---------|-------|-----|
| A, C, E | Blue | `#0039a6` |
| B, D, F, M | Orange | `#ff6319` |
| G | Lime green | `#6cbe45` |
| J, Z | Brown | `#996633` |
| L | Gray | `#a7a9ac` |
| N, Q, R, W | Yellow | `#fccc0a` |
| 1, 2, 3 | Red | `#ee352e` |
| 4, 5, 6 | Green | `#00933c` |
| 7 | Purple | `#b933ad` |
| S (Shuttle) | Dark gray | `#808183` |
| SIR | Blue | `#0039a6` |

### Train Marker Design

**Default state (zoomed out):**
- Shape: Circle
- Size: 8px diameter
- Fill: Line color at 100% opacity
- Glow: `circle-blur: 0.5`, creates soft halo effect
- No label

**Zoomed in (zoom > 13):**
- Shape: Circle with label
- Size: 12px diameter
- Fill: Line color
- Label: Line letter (e.g., "A") in white, 10px font
- Glow: Slightly larger blur radius

**Marker glow implementation:**
```javascript
// MapLibre layer paint properties
{
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 8],
  'circle-color': ['get', 'color'],
  'circle-blur': 0.4,
  'circle-opacity': 0.9
}

// Outer glow layer (rendered behind)
{
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 16],
  'circle-color': ['get', 'color'],
  'circle-blur': 1,
  'circle-opacity': 0.3
}
```

### Track Line Design

**Base state:**
- Width: 2px
- Color: Line color at 25% opacity
- Smooth curves following actual track geometry

**Active state (train passing):**
- Width: 2px (same)
- Color: Line color at 80% opacity
- Transition: 0.5s ease-out fade back to base

**Implementation approach:**
Track segments are pre-divided into ~500m sections. When a train's position falls within a segment, that segment's opacity increases. Segments fade back to base opacity over 2 seconds after train passes.

```typescript
interface TrackSegment {
  id: string;
  line: string;
  coordinates: [number, number][];
  isActive: boolean;
  lastActiveTime: number;
}
```

### Heartbeat Indicator

- Position: Bottom-right corner, 20px from edges
- Shape: Circle, 12px diameter
- Color: Electric blue (`#00d4ff`)
- Animation: CSS pulse animation, 1 beat per successful data update
- Stale state: Stops pulsing, fades to 50% opacity after 30 seconds without update

```css
@keyframes heartbeat {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.heartbeat {
  animation: heartbeat 0.3s ease-out;
}

.heartbeat--stale {
  opacity: 0.5;
  animation: none;
}
```

### Legend Design

- Position: Bottom-left corner
- Default state: Collapsed, shows only toggle button
- Expanded state: Shows all line colors with labels
- Style: Semi-transparent dark background, rounded corners
- Animation: Slide up/fade in on expand

```
┌─────────────────────┐
│  NYC Subway Lines   │
├─────────────────────┤
│  ● A C E            │
│  ● B D F M          │
│  ● G                │
│  ● J Z              │
│  ● L                │
│  ● N Q R W          │
│  ● 1 2 3            │
│  ● 4 5 6            │
│  ● 7                │
│  ● S                │
│  ● SIR              │
└─────────────────────┘
```

---

## Map Specification

### Base Map Style

Use CartoCDN's Dark Matter style as the base:

```javascript
const mapStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// For custom styling, you can load and modify the style JSON:
// - Override background color
// - Dim all labels
// - Remove POIs
// - Simplify roads to just major streets
// - Keep water and parks as subtle context
```

### Initial Viewport

```javascript
const INITIAL_VIEW = {
  longitude: -73.985,  // Centered on Midtown Manhattan
  latitude: 40.758,
  zoom: 12,
  pitch: 0,
  bearing: 0
};
```

### Map Bounds (soft constraint)

Allow panning beyond NYC but provide a "reset view" if user gets lost:

```javascript
const NYC_BOUNDS = {
  north: 40.92,   // Bronx
  south: 40.49,   // Staten Island
  east: -73.70,   // Eastern Queens
  west: -74.26    // Western Staten Island
};
```

### Layer Order (bottom to top)

1. Base map (dark style)
2. Track lines (dim, colored)
3. Track glow layer (active segments)
4. Train glow layer (outer halo)
5. Train markers (circles)
6. Train labels (line letters, zoom-dependent)

---

## Error Handling

### Feed Failure Behavior

When a specific MTA feed fails:

1. **Backend:** Circuit breaker opens after 3 failures, stops polling that feed
2. **Backend:** `FeedStatus` for that feed shows `isHealthy: false`
3. **Frontend:** Receives unhealthy feed status in SSE event
4. **Frontend:** Dims track lines for affected routes to 10% opacity
5. **Frontend:** Fades out train markers for affected routes (opacity 0.3)
6. **Recovery:** Circuit breaker attempts recovery after 60 seconds

### Connection Loss Behavior

If SSE connection drops:

1. TanStack Query detects disconnect
2. `isConnected` state set to false
3. Heartbeat indicator stops pulsing, shows stale state
4. Automatic reconnection attempts with exponential backoff
5. On reconnect, full train state is re-sent

### Visual Error States

| Condition | Visual Effect |
|-----------|---------------|
| Single feed down | Affected lines dim, trains fade |
| All feeds down | All tracks dim, heartbeat stops |
| SSE disconnected | Heartbeat shows stale, trains freeze |
| Reconnecting | Subtle "reconnecting" text near heartbeat |

---

## Deployment

### Environment Variables

**Backend (Railway):**
```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

**Frontend (Vercel):**
```env
VITE_API_URL=https://your-backend.railway.app
```

### Railway Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 5
restartPolicyType = "on_failure"
```

### Vercel Configuration

```json
// vercel.json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### CORS Configuration

Backend must allow requests from Vercel frontend domain:

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
```

---

## API Reference

### GET /api/trains

Returns current train positions.

**Response:**
```json
{
  "trains": [
    {
      "id": "1A_20260107_123456",
      "line": "A",
      "direction": "N",
      "latitude": 40.7580,
      "longitude": -73.9855,
      "timestamp": 1736280000,
      "stopId": "A24N",
      "status": "IN_TRANSIT"
    }
  ],
  "feedStatuses": [
    {
      "feedId": "ace",
      "lastUpdate": 1736280000,
      "isHealthy": true,
      "errorCount": 0
    }
  ],
  "timestamp": 1736280005
}
```

### GET /api/trains/stream

SSE stream of train updates.

**Events:**

```
event: trains
data: {"type":"trains","data":{...}}

event: heartbeat
data: {"type":"heartbeat","data":{"timestamp":1736280010}}
```

### GET /api/status

Returns feed health status.

**Response:**
```json
{
  "feeds": [
    { "feedId": "ace", "isHealthy": true, "lastUpdate": 1736280000 },
    { "feedId": "bdfm", "isHealthy": true, "lastUpdate": 1736279985 },
    { "feedId": "g", "isHealthy": false, "lastUpdate": 1736279000 }
  ],
  "overallHealth": "degraded",
  "timestamp": 1736280005
}
```

### GET /health

Simple health check for Railway.

**Response:**
```json
{ "status": "ok", "timestamp": 1736280005 }
```

---

## File Structure

### Backend (`/backend`)

```
backend/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── config.ts             # Environment config
│   ├── feeds/
│   │   ├── mta-feeds.ts      # Feed URLs and config
│   │   ├── feed-poller.ts    # Polling loop logic
│   │   ├── feed-parser.ts    # GTFS-RT protobuf parsing
│   │   └── circuit-breaker.ts
│   ├── cache/
│   │   └── train-cache.ts    # In-memory train storage
│   ├── routes/
│   │   ├── trains.ts         # /api/trains endpoints
│   │   ├── stream.ts         # SSE endpoint
│   │   └── status.ts         # Health endpoints
│   └── types/
│       └── index.ts          # Shared types
├── package.json
├── tsconfig.json
└── .env.example
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapContainer.tsx
│   │   │   ├── TrackLayer.tsx
│   │   │   ├── TrainLayer.tsx
│   │   │   └── TrackGlowLayer.tsx
│   │   ├── Legend/
│   │   │   └── Legend.tsx
│   │   ├── HeartbeatIndicator/
│   │   │   └── HeartbeatIndicator.tsx
│   │   └── ConnectionStatus/
│   │       └── ConnectionStatus.tsx
│   ├── hooks/
│   │   ├── useTrainStream.ts # SSE connection hook
│   │   └── useInterpolation.ts
│   ├── store/
│   │   └── useAppStore.ts    # Zustand store
│   ├── utils/
│   │   ├── colors.ts         # MTA line colors
│   │   ├── geo.ts            # GeoJSON helpers
│   │   └── interpolation.ts  # Position interpolation
│   ├── types/
│   │   └── index.ts
│   └── styles/
│       └── index.css         # Tailwind + custom CSS
├── public/
│   └── tracks.geojson        # Pre-processed track geometry
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── .env.example
```

### Shared Types (`/shared`)

```
shared/
├── src/
│   └── types.ts              # Train, FeedStatus, etc.
├── package.json
└── tsconfig.json
```

### Scripts (`/scripts`)

```
scripts/
├── process-gtfs-shapes.ts    # Convert GTFS shapes.txt to GeoJSON
└── download-gtfs-static.sh   # Download MTA GTFS static data
```

---

## Implementation Phases

### Phase 1: Project Setup (2-3 hours)

- [ ] Initialize pnpm workspace
- [ ] Set up frontend with Vite + React + TypeScript
- [ ] Set up backend with Express + TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up shared types package
- [ ] Create .env files with placeholder values

### Phase 2: Backend Core (3-4 hours)

- [ ] Implement MTA feed fetching with gtfs-realtime-bindings
- [ ] Build feed polling loop for all 8 feeds
- [ ] Implement train cache with merge logic
- [ ] Add circuit breaker for feed failures
- [ ] Create REST endpoint `/api/trains`
- [ ] Implement SSE endpoint `/api/trains/stream`
- [ ] Add health check endpoints

### Phase 3: Frontend Map (3-4 hours)

- [ ] Set up react-map-gl with dark base style
- [ ] Create custom dark map style overrides
- [ ] Add track geometry layer (static GeoJSON)
- [ ] Implement train markers as GeoJSON source + circle layer
- [ ] Add glow effect layers
- [ ] Configure initial viewport (Manhattan-centric)

### Phase 4: Real-time Connection (2-3 hours)

- [ ] Implement SSE hook with TanStack Query
- [ ] Connect Zustand store to SSE events
- [ ] Wire train data to map layers
- [ ] Implement linear interpolation for smooth movement
- [ ] Add heartbeat indicator component

### Phase 5: Visual Polish (3-4 hours)

- [ ] Implement zoom-adaptive marker sizing
- [ ] Add line letter labels at high zoom
- [ ] Build track brightening effect
- [ ] Style and animate legend component
- [ ] Add error state visuals (dimming, fading)
- [ ] Fine-tune colors and glow effects

### Phase 6: Deployment (1-2 hours)

- [ ] Process GTFS static data for track geometry
- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] Configure environment variables
- [ ] Test production SSE connection
- [ ] Verify CORS configuration

### Phase 7: Testing & Fixes (2-3 hours)

- [ ] Test all feed failure scenarios
- [ ] Verify mobile responsiveness
- [ ] Performance testing with full train load
- [ ] Fix any visual bugs
- [ ] Browser compatibility check

---

## Success Criteria

The project is complete when:

1. ✅ All 8 MTA feeds are being polled and merged
2. ✅ Train positions update in real-time via SSE
3. ✅ Trains animate smoothly between position updates
4. ✅ Map displays dark "control room" aesthetic
5. ✅ Train markers show correct MTA line colors with glow
6. ✅ Track lines brighten when trains pass
7. ✅ Legend is visible and collapsible
8. ✅ Heartbeat indicator pulses on data updates
9. ✅ Failed feeds cause visual dimming of affected lines
10. ✅ App is deployed and accessible via public URL

---

## Future Enhancements (v2)

- Click train → tooltip with trip details
- Click station → arrivals board
- Line filtering controls
- Track-aware interpolation (trains follow curves)
- Historical playback mode
- Train crowding indicators (if MTA provides data)
- Push notifications for service alerts
- PWA with offline support
- Accessibility improvements (screen reader support)

---

*This specification was generated through a collaborative interview process on January 7, 2026.*


