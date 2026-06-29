# ⚡ WattStop — Smart EV Journey Planner

> A backend-free Single-Page Application that simplifies electric vehicle road trips with real-time charging station maps, vehicle profile filtering, intelligent multi-stop route planning, and a Smart Waiting dashboard.

![WattStop Banner](https://img.shields.io/badge/WattStop-EV%20Journey%20Planner-4A8FEF?style=for-the-badge&logo=leaflet&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet.js-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white)
![No Backend](https://img.shields.io/badge/No%20Backend-100%25%20Client--Side-34A853?style=for-the-badge)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [External APIs](#external-apis)

---

## Overview

WattStop is a **100% client-side** EV companion app — no backend, no database, no build step. Open `index.html` in a browser and it works. All user data (accounts, vehicle profiles, sessions) is persisted in `localStorage`. Real-world charging station data is fetched live from OpenStreetMap via the Overpass API.

The core idea: a logged-in user registers their vehicle's battery capacity and supported port types (CCS2, CHAdeMO, Type 2, etc.), and the app intelligently filters the map to show only compatible stations, plans multi-stop routes that respect the battery's range, and generates a per-stop "Smart Waiting" dashboard to help pass the time during charging.

---

## Features

### 🗺️ Smart Map
- Interactive map powered by **Leaflet.js** with **CartoDB Voyager** tiles (Google Maps-like appearance)
- Live charging station data fetched from the **Overpass API** using **bounding-box queries** — loads exactly what's visible in the viewport
- Stations **accumulate** as you pan (no re-fetch wipe); a floating **"Search this area"** button triggers fetches for new regions
- **Port-type smart filtering**: when logged in, only stations compatible with your vehicle's connectors are shown
- Tap any marker to open a detailed panel: port types, charging speeds, on-site amenities (café, Wi-Fi, restroom, lounge, parking)

### 🛣️ Journey Planner
- Type any two locations (geocoded via **Nominatim**) and set your current battery %
- The app fetches the real driving route via the **OSRM API** and projects all compatible charging stations onto the route polyline
- A **battery SoC simulation** walks the route, determining exactly where you'll need to stop and for how long
- **Round-trip mode** — toggle to plan the return leg as well; outbound shown in blue, return in green
- Full timeline view: start → charging stops (with arrival SoC, charger used, charge time) → destination

### ⏳ Smart Waiting Dashboard
- Per-stop countdown timer with live progress tracking
- Activity recommendations tailored to the charge window:
  - **< 10 min**: Quick tips and short reads
  - **10–25 min**: YouTube shorts, podcasts snippets
  - **25–60 min**: Full YouTube videos, Spotify playlists
  - **60+ min**: Long documentaries, deep-dive content
- All media links are real, working URLs (YouTube, Spotify)

### 👤 Auth & Vehicle Profile
- Client-side register / login / logout backed by `localStorage`
- Vehicle profile: name, battery capacity (kWh), supported port types
- Profile updates instantly re-filter the map

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Language** | Vanilla JavaScript (ES2020+), HTML5, CSS3 |
| **Map Rendering** | [Leaflet.js](https://leafletjs.com/) v1.9.4 |
| **Map Tiles** | [CartoDB Voyager](https://carto.com/basemaps/) (free, no API key) |
| **Charging Station Data** | [Overpass API](https://overpass-api.de/) (OpenStreetMap live data) |
| **Route Geometry** | [OSRM](http://project-osrm.org/) (public endpoint) |
| **Geocoding** | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) |
| **Auth & Persistence** | Browser `localStorage` / `sessionStorage` |
| **Styling** | Vanilla CSS with CSS Custom Properties (design tokens) |
| **Fonts** | Google Fonts — Inter |
| **Build Tool** | None — zero build step |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐    │
│  │  app.js  │  │  auth.js │  │   data.js      │    │
│  │  Router  │  │  Auth &  │  │  Media Library │    │
│  │  Guards  │  │  Profile │  │  Port Defs     │    │
│  └────┬─────┘  └────┬─────┘  └───────┬────────┘    │
│       │             │                │             │
│  ┌────▼─────────────▼────────────────▼────────┐    │
│  │               State Layer                  │    │
│  │         localStorage / sessionStorage      │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐    │
│  │  map.js  │  │planner.js│  │  waiting.js    │    │
│  │ Leaflet  │  │  OSRM +  │  │  Countdown +   │    │
│  │ Overpass │  │  SoC Sim │  │  Activities    │    │
│  └────┬─────┘  └────┬─────┘  └────────────────┘    │
└───────┼─────────────┼──────────────────────────────┘
        │             │
        ▼             ▼
┌──────────────┐  ┌────────────────────────┐
│ Overpass API │  │  OSRM (routing)        │
│ (OSM live    │  │  Nominatim (geocoding) │
│  stations)   │  │  CartoDB (tiles)       │
└──────────────┘  └────────────────────────┘
```

### SPA Routing
Hash-based routing (`#map`, `#planner`, `#profile`, `#waiting`, `#login`). Protected routes (`planner`, `profile`, `waiting`) redirect unauthenticated users to `#login` with the intended route stored in `sessionStorage` for post-login redirect.

### Battery SoC Simulation
```
currentSoC  = initialBattery%
effectiveRange = (currentSoC - 15% reserve) × batteryKwh × 5.5 km/kWh

while cannotReachDestination:
    candidates = stationsOnRoute.filter(withinRange)
    chosen     = farthestReachableStation  // minimises stops
    chargeTime = (targetSoC - arrivalSoC) × batteryKwh / chargerKw × 60 min
    currentSoC = 80%  // depart at 80%
```

---

## Getting Started

No installation or build step needed.

```bash
# Clone the repo
git clone https://github.com/adithyananil19/WattStop.git
cd WattStop

# Serve locally (any static server works)
python3 -m http.server 3000
# → Open http://localhost:3000
```

Or just open `index.html` directly in a browser (note: geolocation requires a served origin, not `file://`).

### First Run
1. Click **Sign Up** and register with your vehicle details
2. Select your supported port types (e.g. CCS2, Type 2)
3. The map will automatically filter stations to only show compatible ones
4. Use the **Planner** to plan a route — it'll calculate exact charging stops for your battery

---

## How It Works

### Charging Station Fetch
Stations are fetched from the Overpass API using the **current map bounding box**, not a fixed radius. This means:
- You get exactly what's on screen
- Panning triggers a "Search this area" button for lazy loading
- All fetched stations are deduplicated by OSM node ID and accumulated in a `Map`

```javascript
// Bounding box query
`[out:json][timeout:30];
(
  node["amenity"="charging_station"](${south},${west},${north},${east});
  way["amenity"="charging_station"](${south},${west},${north},${east});
);
out center body;`
```

### Port Type Detection
Stations that have `socket:*` tags in OSM use real data. The majority of Indian charging stations on OSM have no socket detail — for these, a **deterministic port simulation** seeds off the OSM node ID to assign realistic port combinations (CCS2+CHAdeMO+Type2, Statiq-style, EESL-style, etc.) consistently.

### Route Planning
1. **Geocode** start + destination via Nominatim
2. **Fetch route geometry** from OSRM (full GeoJSON polyline)
3. **Project stations** onto the polyline using perpendicular distance (< ~20 km off-route)
4. **Simulate drive**: walk the route segment by segment, pick the farthest reachable compatible station at each stop
5. **Calculate charge time** per stop: `(targetSoC - arrivalSoC) × kWh / chargerKw × 60`

---

## Project Structure

```
WattStop/
├── index.html          # SPA shell — all 5 view containers + nav
├── css/
│   ├── tokens.css      # Design tokens (colors, spacing, radii, shadows)
│   ├── reset.css       # CSS reset + base styles
│   ├── components.css  # Reusable component styles (buttons, forms, cards)
│   └── app.css         # Layout, view transitions, map-specific styles
└── js/
    ├── app.js          # SPA hash router, route guards, nav sync, toasts
    ├── auth.js         # Register, login, logout, profile update (localStorage)
    ├── data.js         # Media library, port definitions, port simulation
    ├── map.js          # Leaflet init, Overpass fetch, markers, station panel
    ├── planner.js      # Geocoding, OSRM routing, SoC simulation, result render
    └── waiting.js      # Countdown timer, Smart Waiting activity engine
```

---

## External APIs

All APIs used are **free with no API key required**.

| API | Usage | Endpoint |
|---|---|---|
| [Overpass API](https://overpass-api.de/) | Fetch live charging stations from OSM | `https://overpass-api.de/api/interpreter` |
| [OSRM](http://router.project-osrm.org/) | Real-world driving route geometry | `https://router.project-osrm.org/route/v1/driving/` |
| [Nominatim](https://nominatim.openstreetmap.org/) | Forward geocoding (place → coordinates) | `https://nominatim.openstreetmap.org/search` |
| [CartoDB Voyager](https://carto.com/basemaps/) | Map tiles (Google Maps-like appearance) | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/` |

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">
  Built with ⚡ by <a href="https://github.com/adithyananil19">P A Adithyan</a>
</div>
