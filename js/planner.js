/* =========================================================
   planner.js — Journey Planning: Geocoding, OSRM Routing,
                Stop Calculation (one-way + round-trip),
                Planner Map Rendering
   ========================================================= */

/* ── Module state ─────────────────────────────────────────── */
let _plannerMap     = null;
let _routeLayer     = null;
let _plannerMarkers = null;
let _journeyStops   = [];

const NOMINATIM     = 'https://nominatim.openstreetmap.org/search';
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

/* ── Energy model ─────────────────────────────────────────── */
const KM_PER_KWH     = 5.5;   // Conservative estimate for Indian conditions
const RESERVE_SOC    = 0.15;  // Always keep 15% — never plan to arrive below this
const TARGET_SOC_DEP = 0.80;  // Depart from each charging stop at 80%

/* ── Geocoder ─────────────────────────────────────────────── */
async function geocode(query) {
  // Direct lat,lng coordinates
  const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), name: query };
  }
  const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(query)}&limit=3&countrycodes=in,lk,np,bd`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'WattStop/1.0' }
  });
  if (!resp.ok) throw new Error('Geocoding failed — check your internet connection.');
  const results = await resp.json();
  if (!results.length) throw new Error(`Could not find "${query}". Try adding a state or country.`);
  const r = results[0];
  return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: r.display_name.split(',').slice(0, 2).join(',').trim() };
}

/* ── OSRM route fetcher ──────────────────────────────────── */
async function getRoute(startLat, startLng, endLat, endLng) {
  const url = `${OSRM_ENDPOINT}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Routing service unavailable — try again.');
  const data = await resp.json();
  if (!data.routes?.length) throw new Error('No route found between those two points.');
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  };
}

/* ── Project station onto route polyline ─────────────────── */
function _pointToSegmentDist(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  if (dx===0 && dy===0) return Math.hypot(p[0]-a[0], p[1]-a[1]);
  const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx+dy*dy)));
  return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
}

function _getStationRouteDistance(station, routeCoords) {
  let minDist = Infinity, bestIdx = 0;
  for (let i = 0; i < routeCoords.length-1; i++) {
    const d = _pointToSegmentDist([station.lat, station.lng], routeCoords[i], routeCoords[i+1]);
    if (d < minDist) { minDist = d; bestIdx = i; }
  }
  let dist = 0;
  for (let i = 0; i < bestIdx; i++) {
    dist += Math.hypot(
      routeCoords[i+1][0]-routeCoords[i][0],
      routeCoords[i+1][1]-routeCoords[i][1]
    ) * 111;
  }
  return { routeDist: dist, perpDist: minDist };
}

/* ── Charging time calculator ────────────────────────────── */
function calcChargeTime(arrivalSoc, targetSoc, batteryKwh, chargerKw) {
  const needed = (targetSoc - arrivalSoc) * batteryKwh;
  return needed <= 0 ? 0 : (needed / chargerKw) * 60;
}

/* ── Core single-leg planner ─────────────────────────────── */
/**
 * Plans one direction of a journey.
 * @param {object} startPt     { lat, lng, name }
 * @param {object} destPt      { lat, lng, name }
 * @param {number} startSocPct starting battery %
 * @param {Set}    userPorts   user's compatible port labels
 * @param {number} batteryKwh  vehicle battery capacity
 * @param {string} legLabel    "Outbound" or "Return" — used in stop labels
 * @returns {object} { route, stops, finalSoc }
 */
async function _planLeg(startPt, destPt, startSocPct, userPorts, batteryKwh, legLabel) {
  const route       = await getRoute(startPt.lat, startPt.lng, destPt.lat, destPt.lng);
  const allStations = window.getAllStations();

  // Compatible stations projected onto this leg's route
  const compatible = allStations.filter(s => s.ports.some(p => userPorts.has(p.label)));
  const routeStations = compatible.map(s => {
    const proj = _getStationRouteDistance(s, route.coordinates);
    return { ...s, routeDist: proj.routeDist, perpDist: proj.perpDist };
  })
  .filter(s => s.perpDist < 0.18)  // within ~20km of route
  .sort((a, b) => a.routeDist - b.routeDist);

  // Simulate drive
  let currentSoc  = startSocPct / 100;
  let currentDist = 0;
  const totalDist = route.distanceKm;
  const stops     = [];
  let remaining   = [...routeStations];

  while (currentDist < totalDist) {
    const effectiveRange = (currentSoc - RESERVE_SOC) * batteryKwh * KM_PER_KWH;
    const canReach       = currentDist + effectiveRange;

    if (canReach >= totalDist) break;  // Can make it to dest

    // Stations reachable before battery hits reserve
    let candidates = remaining.filter(s =>
      s.routeDist > currentDist + 5 &&
      s.routeDist <= canReach
    );

    if (!candidates.length) {
      // Nothing in range — grab the closest one ahead anyway
      const next = remaining.find(s => s.routeDist > currentDist + 5);
      if (!next) throw new Error(
        `No compatible ${legLabel.toLowerCase()} charging stations found along this route. ` +
        `Try loading more stations on the map (pan and use "Search this area"), or check your vehicle's port types in Profile.`
      );
      candidates = [next];
    }

    // Pick farthest reachable (fewest stops)
    const chosen = candidates[candidates.length - 1];

    const distToStation = chosen.routeDist - currentDist;
    const energyUsed    = distToStation / KM_PER_KWH;
    const arrivalSoc    = Math.max(0, currentSoc - energyUsed / batteryKwh);

    const bestPort = chosen.ports
      .filter(p => userPorts.has(p.label))
      .sort((a, b) => b.power - a.power)[0];

    const chargeTime = calcChargeTime(arrivalSoc, TARGET_SOC_DEP, batteryKwh, bestPort.power);

    stops.push({
      station:      chosen,
      legLabel,
      distFromStart: chosen.routeDist,
      arrivalSoc:   arrivalSoc * 100,
      departureSoc: TARGET_SOC_DEP * 100,
      chargeTimeMin: Math.round(chargeTime),
      chargerUsed:  bestPort
    });

    currentDist = chosen.routeDist;
    currentSoc  = TARGET_SOC_DEP;
    remaining   = remaining.filter(s => s.id !== chosen.id);
  }

  // Final leg SoC
  const lastDist  = totalDist - currentDist;
  const finalSoc  = Math.max(0, currentSoc - (lastDist / KM_PER_KWH) / batteryKwh);

  return { route, stops, finalSoc: finalSoc * 100 };
}

/* ── Main journey planner (one-way + round-trip) ─────────── */
async function planJourney(startName, destName, batteryPct, isRoundTrip) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Please log in to use the Journey Planner.');

  const batteryKwh = user.vehicle.batteryCapacity;
  const userPorts  = new Set(user.vehicle.portTypes);

  // Geocode endpoints
  const start = await geocode(startName);
  const dest  = await geocode(destName);

  // --- Outbound leg ---
  const outbound = await _planLeg(start, dest, batteryPct, userPorts, batteryKwh, 'Outbound');

  if (!isRoundTrip) {
    return {
      start, dest,
      route:       outbound.route,
      stops:       outbound.stops,
      totalDistKm: outbound.route.distanceKm,
      totalDurMin: outbound.route.durationMin,
      finalSoc:    outbound.finalSoc,
      batteryKwh,
      initialSoc:  batteryPct,
      isRoundTrip: false
    };
  }

  // --- Return leg ---
  // Start the return at the SoC we arrive at the destination
  // If too low, we'd have charged there — use min of final or departure target
  const returnStartSoc = Math.max(outbound.finalSoc, RESERVE_SOC * 100 + 5);
  const returnLeg = await _planLeg(dest, start, returnStartSoc, userPorts, batteryKwh, 'Return');

  const totalDist = outbound.route.distanceKm + returnLeg.route.distanceKm;
  const totalDur  = outbound.route.durationMin + returnLeg.route.durationMin;

  return {
    start, dest,
    route:       outbound.route,
    returnRoute: returnLeg.route,
    stops:       outbound.stops,
    returnStops: returnLeg.stops,
    totalDistKm: totalDist,
    totalDurMin: totalDur,
    finalSoc:    outbound.finalSoc,
    returnFinalSoc: returnLeg.finalSoc,
    batteryKwh,
    initialSoc:  batteryPct,
    returnStartSoc,
    isRoundTrip: true
  };
}

/* ── Planner map ─────────────────────────────────────────── */
function _initPlannerMap() {
  if (_plannerMap) return;
  _plannerMap = L.map('planner-map', {
    zoomControl: false,
    center: [20.5937, 78.9629],
    zoom: 5
  });
  L.control.zoom({ position: 'bottomright' }).addTo(_plannerMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(_plannerMap);
  _routeLayer     = L.layerGroup().addTo(_plannerMap);
  _plannerMarkers = L.layerGroup().addTo(_plannerMap);
}

function _drawRouteOnMap(journey) {
  _routeLayer.clearLayers();
  _plannerMarkers.clearLayers();

  // --- Outbound route (teal) ---
  _drawPolyline(journey.route.coordinates, 'hsl(155,68%,44%)', 'hsla(155,68%,60%,0.3)');

  // --- Return route (blue), if round trip ---
  if (journey.isRoundTrip && journey.returnRoute) {
    _drawPolyline(journey.returnRoute.coordinates, 'hsl(200,82%,54%)', 'hsla(200,82%,54%,0.25)');
  }

  // Start marker
  _addWaypointMarker(journey.start.lat, journey.start.lng, '🟢', journey.start.name);

  // Outbound stops
  journey.stops.forEach((stop, i) => _addStopMarker(stop, i + 1, 'hsl(38,90%,56%)'));

  // Destination
  const destEmoji = journey.isRoundTrip ? '🔄' : '🏁';
  _addWaypointMarker(journey.dest.lat, journey.dest.lng, destEmoji, journey.dest.name);

  // Return stops (if round trip)
  if (journey.isRoundTrip) {
    journey.returnStops.forEach((stop, i) =>
      _addStopMarker(stop, journey.stops.length + i + 1, 'hsl(200,82%,54%)')
    );
    // Final "back home" marker
    _addWaypointMarker(journey.start.lat, journey.start.lng, '🏠', journey.start.name + ' (Return)');
  }

  // Fit to all points
  const allPts = [
    [journey.start.lat, journey.start.lng],
    ...journey.stops.map(s => [s.station.lat, s.station.lng]),
    [journey.dest.lat, journey.dest.lng],
    ...(journey.returnStops || []).map(s => [s.station.lat, s.station.lng])
  ];
  _plannerMap.fitBounds(allPts, { padding: [40, 40] });
}

function _drawPolyline(coords, solid, glow) {
  L.polyline(coords, { color: glow,  weight: 12, opacity: 0.5, lineCap: 'round' }).addTo(_routeLayer);
  L.polyline(coords, { color: solid, weight: 4,  opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(_routeLayer);
}

function _addWaypointMarker(lat, lng, emoji, label) {
  const icon = L.divIcon({
    html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: '', iconSize: [28,28], iconAnchor:[14,14]
  });
  L.marker([lat, lng], { icon })
    .bindTooltip(label, { permanent: false, direction: 'top' })
    .addTo(_plannerMarkers);
}

function _addStopMarker(stop, num, color) {
  const icon = L.divIcon({
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:${color};border:2px solid hsl(222,22%,7%);
      color:hsl(222,22%,7%);font-weight:800;font-size:13px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 12px ${color.replace('hsl', 'hsla').replace(')', ',0.5)')};
    ">${num}</div>`,
    className: '', iconSize:[30,30], iconAnchor:[15,15]
  });
  L.marker([stop.station.lat, stop.station.lng], { icon })
    .bindTooltip(`Stop ${num} (${stop.legLabel}): ${stop.station.name}`, { direction:'top' })
    .addTo(_plannerMarkers);
}

/* ── Result renderer ─────────────────────────────────────── */
function _renderJourneyResult(journey) {
  const container = document.getElementById('journey-result');
  container.classList.remove('hidden');

  const allStops       = journey.isRoundTrip ? [...journey.stops, ...(journey.returnStops||[])] : journey.stops;
  const totalChargeMin = allStops.reduce((s, st) => s + st.chargeTimeMin, 0);
  const totalTravelMin = Math.round(journey.totalDurMin + totalChargeMin);
  const totalH         = Math.floor(totalTravelMin / 60);
  const totalM         = totalTravelMin % 60;

  const tripLabel = journey.isRoundTrip
    ? `${_esc(journey.start.name)} → ${_esc(journey.dest.name)} → ${_esc(journey.start.name)}`
    : `${_esc(journey.start.name)} → ${_esc(journey.dest.name)}`;

  let html = `
    <div class="journey-result-title">Route Summary</div>
    <div class="journey-leg" style="border-color:var(--clr-primary-glass);">
      <div class="journey-leg-type">Overview${journey.isRoundTrip ? ' · Round Trip 🔄' : ''}</div>
      <div class="journey-leg-name" style="font-size:var(--fs-sm)">${tripLabel}</div>
      <div class="journey-leg-meta">
        <span class="journey-leg-meta-item">🛣️ ${journey.totalDistKm.toFixed(0)} km</span>
        <span class="journey-leg-meta-item">🕒 ~${totalH}h ${totalM}m total</span>
        <span class="journey-leg-meta-item">⚡ ${allStops.length} stop${allStops.length!==1?'s':''}</span>
      </div>
    </div>`;

  // ── OUTBOUND ──
  if (journey.isRoundTrip) {
    html += `<div class="journey-leg-section-divider">
      <span>⬆️ Outbound</span>
    </div>`;
  }

  html += `
    <div class="journey-leg">
      <div class="journey-leg-type">🟢 Start</div>
      <div class="journey-leg-name">${_esc(journey.start.name)}</div>
      <div class="journey-leg-meta">
        <span class="journey-leg-meta-item">🔋 ${journey.initialSoc}% battery</span>
        <span class="journey-leg-meta-item">📏 ${journey.route.distanceKm.toFixed(0)} km to destination</span>
      </div>
    </div>`;

  journey.stops.forEach((stop, i) => { html += _stopCardHTML(stop, i + 1); });

  html += `
    <div class="journey-leg" style="border-color:${journey.isRoundTrip ? 'var(--clr-primary-glass)' : 'var(--clr-accent-glass)'};">
      <div class="journey-leg-type">${journey.isRoundTrip ? '🔄' : '🏁'} Destination</div>
      <div class="journey-leg-name">${_esc(journey.dest.name)}</div>
      <div class="journey-leg-meta">
        <span class="journey-leg-meta-item">🔋 Arrive ~${journey.finalSoc.toFixed(0)}%</span>
      </div>
      ${_socBarHTML(journey.finalSoc, journey.isRoundTrip ? '' : 'var(--clr-accent)')}
    </div>`;

  // ── RETURN (if round trip) ──
  if (journey.isRoundTrip) {
    html += `<div class="journey-leg-section-divider" style="border-color:var(--clr-accent-glass);">
      <span style="color:var(--clr-accent)">⬇️ Return</span>
    </div>`;

    html += `
      <div class="journey-leg">
        <div class="journey-leg-type">🔄 Depart</div>
        <div class="journey-leg-name">${_esc(journey.dest.name)}</div>
        <div class="journey-leg-meta">
          <span class="journey-leg-meta-item">🔋 ${journey.returnStartSoc.toFixed(0)}% battery</span>
          <span class="journey-leg-meta-item">📏 ${journey.returnRoute.distanceKm.toFixed(0)} km to start</span>
        </div>
      </div>`;

    (journey.returnStops || []).forEach((stop, i) => {
      html += _stopCardHTML(stop, journey.stops.length + i + 1, 'var(--clr-accent-glass)', 'var(--clr-accent)');
    });

    html += `
      <div class="journey-leg" style="border-color:var(--clr-accent-glass);">
        <div class="journey-leg-type" style="color:var(--clr-accent)">🏠 Back Home</div>
        <div class="journey-leg-name">${_esc(journey.start.name)}</div>
        <div class="journey-leg-meta">
          <span class="journey-leg-meta-item">🔋 Arrive ~${journey.returnFinalSoc.toFixed(0)}%</span>
        </div>
        ${_socBarHTML(journey.returnFinalSoc, 'var(--clr-accent)')}
      </div>`;
  }

  container.innerHTML = html;
}

function _stopCardHTML(stop, num, chargeBg, chargeColor) {
  const soc     = stop.arrivalSoc.toFixed(0);
  const legBadge = stop.legLabel === 'Return'
    ? `<span style="font-size:var(--fs-xs);color:var(--clr-accent);margin-left:var(--sp-2);">Return</span>`
    : '';
  return `
    <div class="journey-leg">
      <div class="journey-leg-type">⚡ Stop ${num}${legBadge}</div>
      <div class="journey-leg-name">${_esc(stop.station.name)}</div>
      <div class="journey-leg-meta">
        <span class="journey-leg-meta-item">📍 ${stop.distFromStart.toFixed(0)} km into leg</span>
        <span class="journey-leg-meta-item">🔌 ${stop.chargerUsed.label} · ${stop.chargerUsed.power}kW</span>
      </div>
      <div class="soc-bar">
        <div class="soc-bar-track"><div class="soc-bar-fill" style="width:${soc}%"></div></div>
        <span class="soc-bar-value">Arrive ${soc}%</span>
      </div>
      <div class="journey-leg-charge" style="${chargeBg ? `background:${chargeBg};color:${chargeColor}` : ''}">
        ⏱ Charge ~${stop.chargeTimeMin} min → depart at ${stop.departureSoc.toFixed(0)}%
      </div>
      <div class="journey-leg-waiting-btn">
        <button class="btn btn-ghost btn-sm"
          onclick="window.startWaiting('${stop.station.id}', ${stop.chargeTimeMin}, ${stop.arrivalSoc.toFixed(0)}, ${stop.departureSoc.toFixed(0)})">
          🎯 Smart Waiting
        </button>
      </div>
    </div>`;
}

function _socBarHTML(soc, color) {
  const fillStyle = color ? `background:linear-gradient(90deg,${color},var(--clr-primary))` : '';
  return `
    <div class="soc-bar">
      <div class="soc-bar-track"><div class="soc-bar-fill" style="width:${soc.toFixed(0)}%;${fillStyle}"></div></div>
      <span class="soc-bar-value" style="${color ? `color:${color}` : ''}">${soc.toFixed(0)}%</span>
    </div>`;
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Form wiring ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Battery slider
  const slider  = document.getElementById('plan-battery');
  const display = document.getElementById('battery-display');
  if (slider) {
    slider.addEventListener('input', () => {
      const pct = parseInt(slider.value);
      display.textContent = pct + '%';
      display.style.color = `hsl(${pct < 20 ? 0 : pct < 50 ? 38 : 155},70%,55%)`;
    });
  }

  // Planner form
  const form = document.getElementById('form-planner');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn        = document.getElementById('plan-btn');
    const errEl      = document.getElementById('planner-error');
    const resultEl   = document.getElementById('journey-result');
    const isRoundTrip = document.getElementById('plan-roundtrip')?.checked || false;

    errEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Planning…';

    try {
      const startVal   = document.getElementById('plan-start').value.trim();
      const destVal    = document.getElementById('plan-dest').value.trim();
      const batteryPct = parseInt(document.getElementById('plan-battery').value);

      _initPlannerMap();
      const journey = await planJourney(startVal, destVal, batteryPct, isRoundTrip);
      _journeyStops = journey.stops;

      _drawRouteOnMap(journey);
      _renderJourneyResult(journey);

      const stopCount = (journey.stops.length + (journey.returnStops?.length || 0));
      const label     = isRoundTrip ? 'Round trip planned' : 'Route planned';
      window.showToast(`${label} — ${stopCount} charging stop${stopCount!==1?'s':''}`, 'success');

    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      window.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Plan Journey</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>`;
    }
  });
});

window.initPlannerMap = function() {
  _initPlannerMap();
  setTimeout(() => _plannerMap && _plannerMap.invalidateSize(), 100);
};
