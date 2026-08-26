# Samparka Lead Engine

International lead intelligence and outreach platform. Discovers real businesses worldwide via OpenStreetMap, enriches them with AI-powered company intelligence, and manages your entire lead pipeline.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and configure
cp .env.example .env

# 3. Start the dev server (auto-restarts on changes)
npm run dev
```

Open **http://localhost:3001** in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `npm start` | Start with plain Node.js (production) |

## Configuration

Copy `.env.example` to `.env` and set your values:

```env
PORT=3001
TAVILY_API_KEY=your-key-here    # Required for AI enrichment
DB_PATH=./db/samparka.db
OVERPASS_URL=https://overpass-api.de/api/interpreter
```

### API Authentication

All `/api/*` endpoints (except `/api/health`) require an `x-api-key` header matching the `API_SECRET` env var. If `API_SECRET` is not set, a random token is generated on startup and printed in the console.

The frontend served from `http://localhost:3001` works without auth (same-origin). For external API access:

```bash
curl -H "x-api-key: YOUR_SECRET" http://localhost:3001/api/leads
```

## Architecture

**Single server process** serves both the frontend and API:

- `http://localhost:3001/` — Frontend (vanilla HTML/CSS/JS SPA)
- `http://localhost:3001/api/*` — Backend API (Express + SQLite)

### Backend Stack

- **Express** — HTTP server + routing
- **better-sqlite3** — SQLite with WAL mode (12 tables)
- **OpenStreetMap Overpass API** — Real business discovery worldwide
- **Tavily AI** — Company intelligence enrichment

### Frontend Stack

- Vanilla HTML / CSS / JavaScript (no build tools)
- Centralized event-emitter state management
- CSS custom properties for light/dark theming

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/discover` | POST | Run Overpass search |
| `/api/discover` | GET | Search history |
| `/api/prospects/process` | POST | Deduplicate + prequalify |
| `/api/prospects/:id/enrich` | POST | AI enrichment + contacts |
| `/api/prospects/:id/add-to-lead` | POST | Add to pipeline |
| `/api/leads` | GET/POST | List or create leads |
| `/api/leads/:id` | GET/PUT/DELETE | Lead CRUD |
| `/api/leads/metrics` | GET | Pipeline metrics |
| `/api/activities` | GET | Activity feed |
| `/api/settings` | GET/PUT | Settings |
| `/api/data` | DELETE | Delete all data |

### Pipeline Flow

```
Discover (Overpass) → Normalize → Deduplicate → Prequalify → Enrich (Tavily) → Fit Score → Add to Leads
```

## Project Structure

```
project 1/
├── server.js              # Express server (entry point)
├── package.json
├── .env.example
├── index.html             # SPA entry point
├── css/styles.css
├── js/
│   ├── api.js             # API client
│   ├── app.js             # Router + init
│   ├── store.js           # State management
│   ├── ui.js              # UI helpers
│   ├── icons.js           # SVG icon library
│   ├── data/mock-data.js  # Mock data + constants
│   └── views/             # View renderers
├── routes/                # Express API routes
├── services/              # Business logic
│   ├── discovery/         # Overpass search
│   └── enrichment/        # Tavily enrichment
├── db/                    # SQLite connection + schema
└── nodemon.json           # Dev server config
```

## Phase History

- **Phase 1** — Static SPA prototype with mock data
- **Phase 2** — Real backend with OpenStreetMap discovery, Tavily enrichment, deduplication, prequalification, fit scoring, and persistent SQLite pipeline
- **Phase 3** — Planned: email campaigns, LinkedIn/Twitter integration, export, settings persistence
