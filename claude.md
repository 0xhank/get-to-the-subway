# Live Subway NYC

Real-time NYC subway train visualization with a "control room" aesthetic.

# Development Workflow

**Always use `pnpm`, not `npm`.**

```sh
# 1. Make changes

# 2. Typecheck (fast)
pnpm run typecheck

# 3. Run tests
pnpm run test -- -t "test name"       # Single suite
pnpm run test:file -- "glob"          # Specific files
```
## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Run both frontend and backend (uses demo.transiter.dev by default)
pnpm dev
```

For local Transiter (x86 only):
```bash
docker compose up -d
./scripts/setup-transiter.sh
# Then set TRANSITER_URL=http://localhost:8080 in backend/.env
```

## Architecture

```
MTA GTFS-RT Feeds → Transiter (Docker) → Express Backend → SSE → React Frontend
```

- **Transiter** handles GTFS-RT parsing, caching, and provides REST API
- **Backend** polls Transiter, enriches with coordinates, streams via SSE
- **Frontend** renders trains on MapLibre with smooth interpolation

## Project Structure

```
├── frontend/          # React + Vite + react-map-gl
├── backend/           # Express thin proxy over Transiter
├── shared/            # TypeScript types
├── data/              # Static track geometry (GeoJSON)
├── scripts/           # Setup scripts
└── docker-compose.yml # Transiter + PostgreSQL
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/transiter/client.ts` | Transiter API client |
| `backend/src/transiter/poller.ts` | Polls Transiter, enriches with coordinates |
| `backend/src/routes/stream.ts` | SSE endpoint for real-time updates |
| `frontend/src/hooks/useTrainStream.ts` | SSE connection hook |
| `frontend/src/components/Map/TrainLayer.tsx` | Train markers (GeoJSON source) |

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, MapLibre GL JS + react-map-gl, Zustand, Tailwind
- **Backend:** Express, TypeScript
- **Data:** Transiter (PostgreSQL + PostGIS)
- **Hosting:** Vercel (frontend), Railway (backend + Transiter)

## Environment Variables

**Backend:**
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
TRANSITER_URL=http://localhost:8080
```

**Frontend:**
```
VITE_API_URL=http://localhost:3001
```

## Important Patterns

### Train Markers (Performance)
Use a single GeoJSON source with circle layers, NOT individual `<Marker>` components:

```tsx
// Good - MapLibre batches rendering
<Source id="trains" type="geojson" data={trainGeoJSON}>
  <Layer type="circle" paint={{...}} />
</Source>

// Bad - React reconciliation overhead
{trains.map(t => <Marker key={t.id} />)}
```

### SSE Connection
Custom hook manages EventSource, pushes updates to Zustand store.

### Interpolation
Trains animate between known positions over ~15 seconds using `requestAnimationFrame`.

### Data Limitation
MTA doesn't provide GPS coordinates - only stop IDs. Trains appear at station locations.

## Visual Design

- **Aesthetic:** Dark "control room" - near-black map, glowing colored trains
- **Train markers:** Colored circles with blur/glow, zoom-adaptive
- **Track lines:** MTA colors at 25% opacity, brighten when train passes
- **Heartbeat:** Pulsing dot indicates data freshness

## Useful Commands

```bash
# Development
pnpm dev                     # Run frontend + backend
pnpm --filter frontend dev   # Frontend only
pnpm --filter backend dev    # Backend only

# Docker
docker compose up -d         # Start Transiter
docker compose down          # Stop Transiter
docker compose logs -f       # View logs

# Build
pnpm build                   # Build all packages
```

## Deployment

- **Frontend:** Push to main → Vercel auto-deploys
- **Backend + Transiter:** Deploy to Railway with docker-compose
- Set env vars in each platform's dashboard

## Full Spec

See `docs/specs/live-subway-spec.md` for complete technical specification.

## Gotchas
- Always install/update packages through the CLI, not by editing package.json
- Transiter needs a few minutes to initially sync all MTA data
- Train positions are station-based (MTA limitation), not true GPS
