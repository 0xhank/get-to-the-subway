# Live Subway NYC

Real-time NYC subway train visualization with a "control room" aesthetic.

![Live Subway Screenshot](docs/screenshot.png)

## Features

- Real-time train positions updated every 15 seconds
- Dark "control room" aesthetic with glowing train markers
- Nearby stations panel with walking time estimates
- "When to leave" timing - tells you when to leave to catch each train
- Route filtering and subway line legend
- Smooth train animations between updates

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Run both frontend and backend
pnpm dev
```

The app uses [demo.transiter.dev](https://demo.transiter.dev) by default for MTA data.

## Architecture

```
MTA GTFS-RT Feeds → Transiter → Express Backend → SSE → React Frontend
```

- **Transiter** handles GTFS-RT parsing, caching, and provides REST API
- **Backend** polls Transiter, enriches with coordinates, streams via SSE
- **Frontend** renders trains on MapLibre with smooth interpolation

## Project Structure

```
├── frontend/          # React + Vite + react-map-gl
├── backend/           # Express API server
├── shared/            # TypeScript types
├── data/              # Static track geometry (GeoJSON)
├── scripts/           # Setup scripts
└── docker-compose.yml # Local Transiter + PostgreSQL
```

## Tech Stack

**Frontend:** React 19, Vite, TypeScript, MapLibre GL JS, react-map-gl, Zustand, Tailwind CSS

**Backend:** Express, TypeScript

**Data:** Transiter (PostgreSQL + PostGIS)

## Environment Variables

**Backend** (`backend/.env`):
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
TRANSITER_URL=https://demo.transiter.dev
```

**Frontend** (`frontend/.env`):
```
VITE_API_URL=http://localhost:3001
```

## Development

```bash
# Run everything
pnpm dev

# Frontend only
pnpm --filter frontend dev

# Backend only
pnpm --filter backend dev

# Type checking
pnpm run typecheck

# Run tests
pnpm run test
```

## Local Transiter (Optional)

For local development with your own Transiter instance (x86 only):

```bash
docker compose up -d
./scripts/setup-transiter.sh
```

Then set `TRANSITER_URL=http://localhost:8080` in `backend/.env`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Open About dialog |
| `L` | Open Lines dialog |
| `N` | Toggle Nearby panel |
| `Esc` | Close panels/dialogs |

## Data Limitations

MTA doesn't provide real-time GPS coordinates for trains - only stop IDs and arrival times. Trains appear at station locations and interpolate between them.

## License

MIT
