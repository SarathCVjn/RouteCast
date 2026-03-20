<div align="center">

<img height="120" src="https://api.iconify.design/material-symbols:route.svg?color=%234285F4" />
<img height="120" src="https://api.iconify.design/material-symbols:thunderstorm.svg?color=%23FFC107" />

# RouteCast

**See the rain before you drive through it.**

An intelligent navigation app that overlays real-time, time-accurate weather forecasts<br/>
directly onto your driving route — colour-coded by rain probability at the exact time you'd pass through.

[![Angular][angular-shield]][angular-url]
[![Ionic][ionic-shield]][ionic-url]
[![Mapbox][mapbox-shield]][mapbox-url]
[![License][license-shield]][license-url]
[![Node][node-shield]][node-url]

</div>

---

<details>
<summary><kbd>Table of Contents</kbd></summary>

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Feature Overview](#feature-overview)
  - [1. Time-Accurate Weather Forecasts](#1-time-accurate-weather-forecasts)
  - [2. Multi-Route Comparison](#2-multi-route-comparison)
  - [3. Colour-Coded Route Overlay](#3-colour-coded-route-overlay)
  - [4. 10-Point Weather Labels](#4-10-point-weather-labels)
  - [5. Departure Time Picker](#5-departure-time-picker)
  - [6. Hover Detail Tooltip](#6-hover-detail-tooltip)
  - [7. Live Geocoding Search](#7-live-geocoding-search)
  - [8. GPS Auto-Centre](#8-gps-auto-centre)
- [Weather Colour Scale](#weather-colour-scale)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [External APIs](#external-apis)
- [Roadmap](#roadmap)

</details>

## The Problem

You're planning a 3-hour drive. It's sunny now, but will it be raining when you're halfway there?

- **Google Maps** shows traffic — not weather.
- **Weather apps** show forecasts for cities — not for roads.
- **You're left guessing.**

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## The Solution

RouteCast fetches weather data **for each point along your route, at the time you'd actually be there**.

> Departing at **2:00 PM** on a 20 km route, arriving at **4:00 PM**?
> The weather at the 10 km midpoint is fetched for **3:00 PM** — not your departure time.

The route lights up in colour: **green** where it's clear, **amber** where it might rain, **red** where it will.

```
                                    42% - 3:15 PM
                                        |
  [Origin]===GREEN===GREEN===AMBER===AMBER===GREEN===RED===GREEN===[Destination]
     2:00 PM                                                          4:00 PM

  Route 1  Fastest    21.7 km  ·  41 min    Avg rain: 28%
  Route 2  Shortest   19.3 km  ·  47 min    Avg rain: 12%  <-- less rain!
  Route 3  Alternative 24.1 km ·  39 min    Avg rain: 45%
```

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Feature Overview

### `1` Time-Accurate Weather Forecasts

Weather at each waypoint is fetched for the **exact time you'd arrive there** — not your departure time. The system calculates cumulative driving duration from Mapbox step data and offsets each forecast accordingly.

> **How it works:** A 2-hour route departing at 2 PM → the midpoint gets weather for 3 PM, the endpoint for 4 PM. Each of the 12 sampled waypoints gets its own time-shifted forecast from Open-Meteo.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `2` Multi-Route Comparison

Up to **3 driving alternatives** are fetched from Mapbox Directions, each with **independent weather data**. The selected route is colour-coded; alternatives appear as grey clickable lines.

> **Tip:** Click any grey route on the map to switch to it and see its weather overlay instantly.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `3` Colour-Coded Route Overlay

Each step of the selected route is individually coloured based on its nearest weather segment's rain probability. Uses Mapbox's data-driven `['get', 'color']` expression for per-feature styling.

> **Visual:** Like Google Maps traffic view — but for weather. Green means clear, red means bring an umbrella.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `4` 10-Point Weather Labels

The route is divided into **10 equal time segments** (at 5%, 15%, 25% … 95% of total duration). Each label shows:

- Rain probability (%) in the segment's colour
- ETA at that point

Labels are persistent HTML markers that stay visible at all zoom levels — no hover required.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `5` Departure Time Picker

Change the departure **date and time** and the entire weather overlay recalculates. Planning a morning vs. evening drive? See how the rain shifts across your route.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `6` Hover Detail Tooltip

Mouse over **any segment** of the selected route to see a floating popup with:

- Exact rain probability (%)
- Colour-coded dot
- Arrival time at that point

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `7` Live Geocoding Search

Type-ahead address search powered by **Mapbox Geocoding API v5**. Debounced at 350ms with `distinctUntilChanged` for efficient API usage. Supports places, addresses, and POIs.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

### `8` GPS Auto-Centre

On load, the map requests your browser's geolocation and **flies to your position** at a comfortable zoom level. No more staring at a world map.

> **Note:** Requires Location Services enabled in your OS settings and browser permission granted.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Weather Colour Scale

| Colour | Hex | Range | Meaning |
|:---:|:---:|:---:|:---|
| 🟢 | `#4CAF50` | 0–10% | Clear skies |
| 🟢 | `#8BC34A` | 10–25% | Mostly dry |
| 🟡 | `#FFC107` | 25–45% | Chance of rain |
| 🟠 | `#FF9800` | 45–65% | Rain likely |
| 🔴 | `#F44336` | 65–80% | Heavy rain expected |
| 🔵 | `#1565C0` | 80%+ | Downpour |

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Tech Stack

| Technology | Purpose |
|:---|:---|
| **Angular 21** | Framework — standalone components, signals |
| **Ionic 8** | UI components (`@ionic/angular/standalone`) |
| **Mapbox GL JS v3** | Map rendering (dark-v11 style) |
| **Mapbox Directions v5** | Routing with alternatives |
| **Mapbox Geocoding v5** | Address search autocomplete |
| **Open-Meteo** | Weather forecasts (free, no key, CORS-friendly) |
| **RxJS** | Async data flow + reactive geocoding |
| **SCSS** | Styling with Ionic CSS variables |

<details>
<summary><kbd>Why Open-Meteo over Tomorrow.io?</kbd></summary>

<br/>

Tomorrow.io doesn't support browser CORS. Since this is a **frontend-only prototype** (no backend proxy), Open-Meteo is the perfect fit:

- Free, no API key required
- CORS-enabled for browser requests
- Provides hourly `precipitation_probability`

A Tomorrow.io key is stored in the environment file for future backend integration.

</details>

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## How It Works

```
  User input: origin, destination, departure time
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  Mapbox Directions API (alternatives=true)  │
  │  Returns up to 3 routes with step geometry  │
  └─────────────────────┬───────────────────────┘
                        │
            ┌───────────┼───────────┐
            │           │           │
         Route 1     Route 2     Route 3
            │           │           │
            ▼           ▼           ▼
  ┌─────────────────────────────────────────────┐
  │  Extract 12 waypoints per route             │
  │  Each waypoint = coordinate + ETA           │
  │  (departure + cumulative step duration)     │
  └─────────────────────┬───────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  Open-Meteo API (parallel, 1 call/waypoint) │
  │  Returns precipitation_probability / hour   │
  │  Matched to closest hour of waypoint's ETA  │
  └─────────────────────┬───────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  Map renders:                               │
  │   • Selected route → colour-coded segments  │
  │   • Other routes → grey clickable lines     │
  │   • 10 weather labels with rain % + ETA     │
  │   • Origin / destination markers            │
  │   • Hover tooltips with rain % + time       │
  └─────────────────────────────────────────────┘
```

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Getting Started

> **Prerequisites:** Node.js 18+ and a browser with Geolocation API support.

```bash
# Clone the repository
git clone <repo-url>
cd routecast

# Install dependencies
npm install

# Start the dev server
npx ng serve --port 4300
```

Open **http://localhost:4300** — allow location access when prompted.

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Project Structure

```
routecast/src/app/
├── app.ts                          Root component — full-screen map with overlay panels
├── app.config.ts                   Providers: Router, HttpClient, Ionic
├── app.routes.ts                   Single-page app (no routes)
│
├── components/
│   ├── search-panel/
│   │   ├── search-panel.ts         Search inputs, departure picker, route cards, orchestration
│   │   ├── search-panel.html       Ionic card with geocoding autocomplete + route cards
│   │   └── search-panel.scss       Dark glassmorphism panel styles
│   │
│   └── weather-legend/
│       ├── weather-legend.ts       Static colour legend component
│       ├── weather-legend.html
│       └── weather-legend.scss
│
├── models/
│   └── route.model.ts              Interfaces: RawRoute, RouteOption, WeatherSegment, MapboxStep
│
├── services/
│   ├── map.service.ts              Mapbox: map, geocoding, directions, rendering, labels, hover
│   └── weather.service.ts          Open-Meteo: rain probability per waypoint at ETA
│
└── environments/
    └── environment.ts              Mapbox token + Tomorrow.io key (dev only)
```

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## External APIs

| API | Purpose | Auth | CORS |
|:---|:---|:---:|:---:|
| Mapbox GL JS + Tiles | Map rendering | Public token | ✅ |
| Mapbox Geocoding v5 | Address autocomplete | Public token | ✅ |
| Mapbox Directions v5 | Driving routes + step geometry | Public token | ✅ |
| Open-Meteo Forecast | Hourly precipitation probability | None | ✅ |

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

## Roadmap

| Phase | Status | Description |
|:---|:---:|:---|
| Frontend prototype | ✅ Current | Browser-only app with all weather + routing features |
| NestJS backend | 🔜 Next | Secure API keys, caching, Tomorrow.io integration |
| Capacitor packaging | ⏳ Planned | iOS + Android native apps |
| Additional layers | 💡 Future | Temperature, wind, snow overlays |
| Turn-by-turn nav | 💡 Future | Live navigation with weather updates |
| User accounts | 💡 Future | Saved routes, preferences, history |

### Future Architecture

```
Angular App  ──►  NestJS BFF  ──►  Mapbox APIs
                      │
                      ├──►  Tomorrow.io (richer weather data)
                      └──►  Firebase / Supabase (user data)

Angular App  ──►  Capacitor  ──►  iOS / Android
```

<div align="right">

[![Back to Top][back-to-top]](#routecast)

</div>

---

<div align="center">

**Current Status:** Frontend-only prototype. All API calls are made directly from the browser.<br/>
API keys are embedded in the source for development convenience.

---

MIT License · Copyright © 2025

</div>

<!-- Shield Links -->
[angular-shield]: https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white
[angular-url]: https://angular.dev
[ionic-shield]: https://img.shields.io/badge/Ionic-8-3880FF?style=flat-square&logo=ionic&logoColor=white
[ionic-url]: https://ionicframework.com
[mapbox-shield]: https://img.shields.io/badge/Mapbox_GL-v3-000000?style=flat-square&logo=mapbox&logoColor=white
[mapbox-url]: https://docs.mapbox.com/mapbox-gl-js/
[license-shield]: https://img.shields.io/badge/License-MIT-yellow?style=flat-square
[license-url]: #
[node-shield]: https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white
[node-url]: https://nodejs.org
[back-to-top]: https://img.shields.io/badge/-Back_to_Top-151515?style=flat-square
