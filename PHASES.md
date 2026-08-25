# Samparka Lead Engine — Phase History

## Phase 1 — Static SPA Prototype (Vanilla JS)

Built a fully functional lead intelligence UI with mock data. No build tools, no frameworks, no backend.

### Tech Stack
- Vanilla HTML / CSS / JavaScript
- Single `index.html` entry point
- CSS custom properties for theming (light + dark)
- Google Fonts (Inter)
- No dependencies

### Views
| View | Description |
|------|-------------|
| Dashboard | Pipeline overview, recent leads, top performers, activity feed, metrics cards |
| Leads | Table with search, filters (status/priority/industry/source), lead detail, score rings, tags, notes, activity timeline, edit/add/delete modals |
| Discover | Search form (country/city/industry/business type), results table |
| Campaigns | Email campaign list with open/reply rates (mock) |
| Replies | Inbox view (mock) |
| Analytics | Pipeline conversion, industry/source/status breakdowns, campaign performance |
| Settings | Profile, email domain, API key, preferences (auto-enrich, notifications, dark mode), integrations, danger zone |

### Architecture
- **Store** — Centralized event-emitter state management (`js/store.js`)
- **UI** — DOM helpers, modal/toast system, delegate pattern, sidebar/topbar builders (`js/ui.js`)
- **Icons** — SVG icon library (`js/icons.js`)
- **Mock Data** — Leads, campaigns, activities, replies, discover results (`js/data/mock-data.js`)
- **Views** — Each view is a render function that builds HTML and binds events

### Key Files
```
index.html
css/styles.css
js/app.js          — Router + DOMContentLoaded init
js/store.js        — State management
js/ui.js           — UI helpers
js/icons.js        — SVG icons
js/data/mock-data.js
js/views/dashboard.js
js/views/leads.js
js/views/discover.js
js/views/campaigns.js
js/views/replies.js
js/views/analytics.js
js/views/settings.js
```

---

## Phase 2 — Real Backend + Lead Intelligence Engine

Converted the mock SPA into a working international lead discovery and management system.

### Tech Stack (added)
- Node.js + Express
- better-sqlite3 (SQLite with WAL mode)
- dotenv
- node-fetch v2
- Tavily AI API (enrichment)
- OpenStreetMap Overpass API (discovery)

### What Was Built

#### Backend (`server.js` on port 3001)

**Database** — 12 tables with indexes:
- `companies` — Discovered businesses with all metadata
- `contacts` — Decision-makers found via Tavily
- `leads` — Your pipeline leads
- `lead_scores` — Fit score breakdown per company
- `lead_tags` — Tags per lead
- `discovery_searches` — Search history
- `discovery_results` — Raw search results
- `enrichments` — Tavily enrichment data (versioned)
- `evidence` — Research sources with URLs and confidence
- `activities` — Activity timeline per lead/company
- `notes` — Notes per lead
- `settings` — Key-value settings store

**Services:**
- `services/helpers.js` — genId, now, normalizeCompanyName, extractDomain
- `services/normalization.js` — Clean names, URLs, phones, coordinates
- `services/deduplication.js` — Match by domain/phone/name/sourceId, create companies
- `services/prequalification.js` — 8 scoring checks (name, website, phone, address, coordinates, brand, email, not-duplicate)
- `services/fit-scoring.js` — 7 weighted dimensions:
  - Industry fit (20) — Hospitality/F&B = high, retail = good, fitness = moderate
  - Repeat-customer potential (20) — Based on industry type
  - Multiple locations (15) — Chain value
  - Digital presence (10) — From Tavily data
  - Decision-maker found (15) — From Tavily contact research
  - Contact info available (10) — Email, phone availability
  - No loyalty program (10) — Opportunity for Samparka
- `services/lead-service.js` — CRUD, search, filter, metrics, activity tracking
- `services/activity-service.js` — Activity log queries
- `services/contact-intelligence.js` — Tavily decision-maker research, contact parsing
- `services/discovery/overpass-provider.js` — OpenStreetMap Overpass API queries
- `services/discovery/discovery-service.js` — Search orchestration, result storage
- `services/enrichment/tavily-provider.js` — Tavily search, company research, decision-maker research
- `services/enrichment/enrichment-service.js` — Enrichment orchestration, evidence storage

**API Routes:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/discover` | POST | Run Overpass search |
| `/api/discover` | GET | Get search history |
| `/api/discover/:id` | GET | Get search with results |
| `/api/prospects` | GET | List prospects (with searchId filter) |
| `/api/prospects/process` | POST | Deduplicate + prequalify |
| `/api/prospects/:id/enrich` | POST | Tavily enrichment + contacts + fit score |
| `/api/prospects/:id/add-to-lead` | POST | Add prospect to leads pipeline |
| `/api/prospects/bulk-add` | POST | Add multiple prospects to leads |
| `/api/leads` | GET | List leads (search, filter, pagination) |
| `/api/leads` | POST | Create manual lead |
| `/api/leads/metrics` | GET | Pipeline metrics |
| `/api/leads/:id` | GET | Lead detail (with company, contacts, activities, evidence) |
| `/api/leads/:id` | PUT | Update lead |
| `/api/leads/:id` | DELETE | Delete lead |
| `/api/activities` | GET | Activity feed |
| `/api/settings` | GET/PUT | Settings |

#### Frontend Changes

- `js/api.js` — API client with all endpoints
- `js/app.js` — Async `navigateTo()` with error handling
- `js/ui.js` — Phase badge, fixed signout, delegate/on replace handlers
- `js/views/discover.js` — Real search form, results table, process/enrich/add actions, search history, batch processing
- `js/views/leads.js` — Async API fetch, server-side search/filter, lead detail with company intelligence, contacts, fit breakdown, evidence, activity timeline, edit/add/delete/tags/notes
- `js/views/dashboard.js` — Async, real metrics from API, pipeline, recent leads, activity feed
- `js/views/analytics.js` — Async, real industry/source/status breakdowns from API
- `index.html` — Added `js/api.js` script tag

### Pipeline Flow
```
User selects country/city/industry/type
    |
    v
Overpass API searches OpenStreetMap
    |
    v
Results normalized (names, URLs, phones, coordinates)
    |
    v
Results deduplicated (domain/phone/name/sourceId matching)
    |
    v
Pre-qualified (8 scoring checks)
    |
    v
User clicks Enrich (optional — requires Tavily API key)
    |-> Tavily researches company intelligence
    |-> Tavily searches for decision-makers on LinkedIn
    |-> Evidence sources stored with URLs and confidence
    |-> Digital presence / loyalty program / locations detected
    |
    v
Fit Score calculated (7 weighted dimensions, visible breakdown)
    |
    v
User clicks "Add to Leads"
    |
    v
Lead created in SQLite with company data, score, tags, activities
    |
    v
Lead appears in Leads pipeline with full intelligence
```

### Bug Fixes (13 total)

| Bug | File | Fix |
|-----|------|-----|
| `Cannot read properties of null (reading 'companyId')` | deduplication.js | Null-check on findMatch return |
| Process route crashes on null match | prospects.js | Added existingCompanyId guard |
| Tavily crash without API key | enrichment-service.js | Returns partial data instead of throwing |
| `NOT NULL constraint failed: companies.name` | deduplication.js | Fallback names from operator/brand/address |
| Process 1410 results at once (timeout) | discover.js | Batch in chunks of 100 |
| Edit lead ignores name/company changes | lead-service.js | Added to allowed fields |
| Multiple confirm dialogs on delete | ui.js | delegate/on replace handlers instead of stacking |
| Falsy-zero lat/lng | normalization.js, overpass-provider.js | Use != null checks |
| City parameter ignored in Overpass | overpass-provider.js | Added city administrative boundary query |
| Score breakdown bars always 0% | fit-scoring.js | Added max property to all breakdown entries |
| Crash on null title in search | store.js | Null-safe string access |
| Sort broken for string timestamps | store.js | Compare as Date objects |
| Stale debounce corrupts other views | leads.js | Check currentView before DOM update |
| Non-array resultIds crashes | prospects.js | Array.isArray validation |

### Commits
```
b9eab58 Samparka Lead Engine - Phase 1: complete vanilla JS single-page lead intelligence app
a355506 fix: resolve 16 bugs — XSS, search, dark mode, campaigns, NaN, and more
d1423d4 Phase 2: Real backend with OpenStreetMap discovery, Tavily enrichment,
        dedup, prequalification, fit scoring, and persistent SQLite leads pipeline
d83ffa5 fix: 7 bugs — falsy-zero coords, city ignored, breakdown bars, null
        title crash, debounce leak, validation, timestamp sort
```

---

## Phase 3 — Planned (Not Started)

- Email sending and campaign automation
- LinkedIn/Twitter integration
- Settings backend persistence
- Export functionality
- Real email open/reply tracking
