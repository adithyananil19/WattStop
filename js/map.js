/* =========================================================
   map.js — Leaflet Map, Overpass API, Markers, Station Panel
   ========================================================= */

/* ── Module state ─────────────────────────────────────────── */
let _map           = null;
let _markersLayer  = null;
let _userMarker    = null;
let _allStations   = new Map(); // keyed by id — deduplicates across fetches
let _userLat       = null;
let _userLng       = null;
let _searchBtnVisible = false;

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const DEFAULT_LAT  = 12.9716;  // Bangalore fallback
const DEFAULT_LNG  = 77.5946;

/* ── Leaflet custom icon factory ─────────────────────────── */
function _makeMarkerIcon(isFast) {
  const color = isFast ? 'hsl(200,82%,54%)' : 'hsl(155,68%,44%)';
  const glow  = isFast ? 'hsla(200,82%,54%,0.45)' : 'hsla(155,68%,44%,0.45)';

  const html = `
    <div style="
      width:36px;height:36px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid ${color};
      background:hsl(222,22%,12%);
      box-shadow:0 3px 14px ${glow};
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);font-size:15px;">⚡</span>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize:  [36, 36],
    iconAnchor:[18, 36],
    popupAnchor:[0, -38]
  });
}

function _makeUserIcon() {
  const html = `
    <div style="
      width:16px;height:16px;
      border-radius:50%;
      background:hsl(155,68%,44%);
      border:3px solid hsl(222,22%,7%);
      box-shadow:0 0 0 4px hsla(155,68%,44%,0.35);
    "></div>`;
  return L.divIcon({ html, className: '', iconSize:[16,16], iconAnchor:[8,8] });
}

/* ── Overpass fetch by bounding box ──────────────────────── */
async function _fetchStationsByBbox(south, west, north, east) {
  const query = `
[out:json][timeout:30];
(
  node["amenity"="charging_station"](${south},${west},${north},${east});
  way["amenity"="charging_station"](${south},${west},${north},${east});
);
out center body;
`.trim();

  const resp = await fetch(OVERPASS_API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'data=' + encodeURIComponent(query)
  });

  if (!resp.ok) throw new Error('Overpass request failed: ' + resp.status);
  const json = await resp.json();
  return json.elements || [];
}

/* ── Parse raw Overpass element → station object ─────────── */
function _parseStation(el) {
  const tags = el.tags || {};
  const lat  = el.lat  ?? el.center?.lat;
  const lng  = el.lon  ?? el.center?.lon;
  if (!lat || !lng) return null;

  // Only use real OSM socket tags if any exist; otherwise simulate realistic ports.
  // Most Indian stations on OSM only have amenity=charging_station with no socket detail.
  const hasSocketTags = Object.keys(tags).some(k => k.startsWith('socket:'));
  const parsedPorts   = hasSocketTags ? window.parseStationPorts(tags) : [];
  const ports         = parsedPorts.length > 0
    ? parsedPorts
    : window.simulateMissingPorts(el.id);

  const amenities = window.simulateAmenities(el.id);
  const isFast    = ports.some(p => p.power >= 50);

  return {
    id:       el.id,
    lat, lng,
    name:     tags.name || tags.operator || 'EV Charging Station',
    address:  [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not listed',
    operator: tags.operator || 'Unknown operator',
    ports, amenities, isFast, tags
  };
}

/* ── Merge new elements into the station map (dedup) ─────── */
function _mergeStations(elements) {
  let added = 0;
  for (const el of elements) {
    if (!_allStations.has(el.id)) {
      const parsed = _parseStation(el);
      if (parsed) { _allStations.set(el.id, parsed); added++; }
    }
  }
  return added;
}

/* ── Get flat array of all stations ─────────────────────── */
function _getStationsArray() { return Array.from(_allStations.values()); }

/* ── Station panel rendering ─────────────────────────────── */
function _renderStationPanel(station) {
  const panel   = document.getElementById('station-panel');
  const content = document.getElementById('station-panel-content');

  const portBadges = station.ports.map(p =>
    `<span class="badge ${p.power >= 50 ? 'badge-accent' : 'badge-primary'}">${p.label} · ${p.power}kW</span>`
  ).join('');

  const amenityList = [
    station.amenities.cafe     ? { icon:'☕', label:'Café' }     : null,
    station.amenities.restroom ? { icon:'🚻', label:'Restroom' } : null,
    station.amenities.wifi     ? { icon:'📶', label:'Wi-Fi' }    : null,
    station.amenities.lounge   ? { icon:'🛋️', label:'Lounge' }   : null,
    station.amenities.shop     ? { icon:'🛍️', label:'Shop' }     : null,
    station.amenities.parking  ? { icon:'🅿️', label:'Parking' }  : null
  ].filter(Boolean);

  const amenityHTML = amenityList.length
    ? `<div class="amenities-row">${amenityList.map(a =>
        `<span class="amenity-chip">${a.icon} ${a.label}</span>`
      ).join('')}</div>`
    : '<p style="font-size:var(--fs-sm);color:var(--clr-text-faint);">No listed amenities</p>';

  const portListHTML = station.ports.map(p => `
    <div class="sp-port-item">
      <span class="sp-port-name">${_esc(p.label)}</span>
      <span class="sp-port-speed">${p.power} kW</span>
    </div>`
  ).join('');

  content.innerHTML = `
    <div style="padding-top:var(--sp-4);">
      <div class="sp-badge-row">
        <span class="badge ${station.isFast ? 'badge-accent' : 'badge-muted'}">
          ${station.isFast ? '⚡ Fast Charge' : '🔌 AC Charge'}
        </span>
      </div>
      <h3 class="sp-station-name">${_esc(station.name)}</h3>
      <p class="sp-station-address">📍 ${_esc(station.address)}</p>

      <p class="sp-section-label">Available Ports</p>
      <div class="sp-port-list">${portListHTML}</div>

      <p class="sp-section-label">On-Site Amenities</p>
      ${amenityHTML}

      <hr class="divider" style="margin:var(--sp-4) 0;">
      <button
        class="btn btn-primary btn-full"
        onclick="window.planFromStation(${station.id})">
        Plan Journey From Here
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
    </div>`;

  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('open'));
}

function _closeStationPanel() {
  const panel = document.getElementById('station-panel');
  panel.classList.remove('open');
  setTimeout(() => panel.classList.add('hidden'), 400);
}

/* ── Marker rendering ─────────────────────────────────────── */
function _renderMarkers(stations) {
  if (_markersLayer) _markersLayer.clearLayers();
  else _markersLayer = L.layerGroup().addTo(_map);

  document.getElementById('station-count-text').textContent = stations.length;

  stations.forEach(station => {
    const marker = L.marker([station.lat, station.lng], { icon: _makeMarkerIcon(station.isFast) })
      .addTo(_markersLayer);
    marker.on('click', () => {
      window._selectedStation = station;
      _renderStationPanel(station);
    });
  });
}

/* ── Filtering ────────────────────────────────────────────── */
function _filterStationsForUser(stations) {
  const user = window.getCurrentUser();
  if (!user) return stations;
  const userPorts = new Set(user.vehicle.portTypes);
  return stations.filter(s => s.ports.some(p => userPorts.has(p.label)));
}

/* ── Filter badge ─────────────────────────────────────────── */
function _updateFilterBadge() {
  const badge = document.getElementById('map-filter-badge');
  const text  = document.getElementById('filter-badge-text');
  const user  = window.getCurrentUser();
  if (user) {
    text.textContent = `${user.vehicle.name} · ${user.vehicle.portTypes.join(', ')}`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ── "Search this area" button ────────────────────────────── */
function _showSearchBtn() {
  const btn = document.getElementById('search-area-btn');
  if (btn && !_searchBtnVisible) {
    btn.classList.remove('hidden');
    _searchBtnVisible = true;
  }
}

function _hideSearchBtn() {
  const btn = document.getElementById('search-area-btn');
  if (btn) { btn.classList.add('hidden'); _searchBtnVisible = false; }
}

/* ── Fetch for current visible bbox ─────────────────────── */
async function _fetchForCurrentView(label) {
  const locLabel = document.getElementById('location-label');
  const countEl  = document.getElementById('station-count-text');

  if (locLabel) locLabel.textContent = label || 'Loading stations…';
  countEl.textContent = '…';

  try {
    const bounds  = _map.getBounds();
    // Add 10% padding to catch stations just outside view
    const latPad  = (bounds.getNorth() - bounds.getSouth()) * 0.1;
    const lngPad  = (bounds.getEast()  - bounds.getWest())  * 0.1;

    const elements = await _fetchStationsByBbox(
      bounds.getSouth() - latPad,
      bounds.getWest()  - lngPad,
      bounds.getNorth() + latPad,
      bounds.getEast()  + lngPad
    );

    const added    = _mergeStations(elements);
    const all      = _getStationsArray();
    const filtered = _filterStationsForUser(all);
    _renderMarkers(filtered);
    _updateFilterBadge();
    if (locLabel) locLabel.textContent = 'Showing this area';

    const total = all.length;
    if (added > 0) {
      window.showToast(`Found ${added} new station${added !== 1 ? 's' : ''} (${total} total)`, 'info');
    } else {
      window.showToast(`No new stations in this area (${total} total)`, 'info');
    }
  } catch (err) {
    console.error('Overpass error:', err);
    if (locLabel) locLabel.textContent = 'Station fetch failed';
    window.showToast('Could not load stations — try again shortly.', 'error');
  }
}

/* ── Public: refresh filter without re-fetching ─────────── */
window.refreshMapFilter = function() {
  _updateFilterBadge();
  const filtered = _filterStationsForUser(_getStationsArray());
  _renderMarkers(filtered);
};

/* ── Public: plan journey from a station ─────────────────── */
window.planFromStation = function(stationId) {
  const station = _allStations.get(stationId);
  if (!station) return;
  window.location.hash = '#planner';
  setTimeout(() => {
    const el = document.getElementById('plan-start');
    if (el) el.value = `${station.lat.toFixed(5)}, ${station.lng.toFixed(5)}`;
  }, 300);
};

/* ── Expose station array for planner.js ─────────────────── */
window.getAllStations  = () => _getStationsArray();
window.getMapInstance = () => _map;
window.closeStationPanel = _closeStationPanel;

/* ── Main map init ────────────────────────────────────────── */
window.initMap = function() {
  if (_map) return;

  _map = L.map('map', { zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'bottomright' }).addTo(_map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(_map);

  const locDot   = document.getElementById('location-dot');
  const locLabel = document.getElementById('location-label');

  // Wire "Search this area" button
  const searchBtn = document.getElementById('search-area-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      _hideSearchBtn();
      await _fetchForCurrentView('Searching this area…');
    });
  }

  // Show search button when user pans (debounced)
  let panDebounce = null;
  _map.on('moveend', () => {
    clearTimeout(panDebounce);
    panDebounce = setTimeout(_showSearchBtn, 400);
  });

  // Initial load from GPS or fallback
  const startFromCoords = async (lat, lng) => {
    _userLat = lat;
    _userLng = lng;
    _map.setView([lat, lng], 13);

    if (_userMarker) _userMarker.remove();
    _userMarker = L.marker([lat, lng], { icon: _makeUserIcon(), zIndexOffset: 1000 }).addTo(_map);

    locDot.classList.add('located');
    await _fetchForCurrentView('Loading stations…');
    if (locLabel) locLabel.textContent = 'Near you';
  };

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => startFromCoords(pos.coords.latitude, pos.coords.longitude),
      _err => {
        locDot.classList.add('error');
        if (locLabel) locLabel.textContent = 'Location denied — using Bangalore';
        startFromCoords(DEFAULT_LAT, DEFAULT_LNG);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    if (locLabel) locLabel.textContent = 'GPS unavailable — using Bangalore';
    startFromCoords(DEFAULT_LAT, DEFAULT_LNG);
  }
};

/* ── Utility ──────────────────────────────────────────────── */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('panel-close')?.addEventListener('click', _closeStationPanel);
});
