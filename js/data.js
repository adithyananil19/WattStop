/* =========================================================
   data.js — Static Data: Media Library & Amenity Simulation
   ========================================================= */

/**
 * Smart Waiting media library — organised by duration bracket.
 * Each item has a real, working URL that opens in a new tab.
 */
window.MEDIA_LIBRARY = {

  /* ── Under 10 minutes ── */
  veryShort: [
    {
      icon: '🧘',
      category: 'Mindfulness',
      title: '5-Minute Breathing Reset',
      desc: 'A guided box-breathing exercise to decompress after a long drive.',
      url: 'https://www.youtube.com/watch?v=uxayUBd6T7M',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🤸',
      category: 'Movement',
      title: 'Driver Stretch Routine',
      desc: 'Quick 7-minute stretches specifically designed for people who\'ve been sitting in a car.',
      url: 'https://www.youtube.com/watch?v=tAUf7aajBWE',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🎵',
      category: 'Music',
      title: 'Lofi Chill Beats',
      desc: 'Relaxing lo-fi hip-hop — perfect background soundtrack for a short break.',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      linkLabel: 'Listen on YouTube'
    },
    {
      icon: '📰',
      category: 'Read',
      title: 'EV Industry News',
      desc: 'Catch up on the latest in electric vehicles, charging infrastructure, and clean energy.',
      url: 'https://electrek.co',
      linkLabel: 'Read on Electrek'
    }
  ],

  /* ── 10–25 minutes ── */
  short: [
    {
      icon: '🎵',
      category: 'Music',
      title: 'Road Trip India Playlist',
      desc: 'A curated Spotify playlist of upbeat Indian and international road trip anthems.',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
      linkLabel: 'Open on Spotify'
    },
    {
      icon: '🌄',
      category: 'Scenic',
      title: 'Aerial India — 4K Relaxation',
      desc: 'Breathtaking drone footage over India\'s most scenic highways and coastlines.',
      url: 'https://www.youtube.com/watch?v=5Xz6tBiNn6Y',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🎙️',
      category: 'Podcast',
      title: 'The Electric Vehicle Revolution',
      desc: 'A short podcast deep-dive into how EVs are reshaping transport infrastructure globally.',
      url: 'https://www.youtube.com/watch?v=4YmIXRH0nNE',
      linkLabel: 'Listen on YouTube'
    },
    {
      icon: '☕',
      category: 'Tip',
      title: 'Try the Station Café',
      desc: 'Most charging hubs partner with local cafés. A coffee and a snack will make this stop fly by.',
      url: null,
      linkLabel: null
    }
  ],

  /* ── 25–60 minutes ── */
  medium: [
    {
      icon: '🎬',
      category: 'Documentary',
      title: 'Fully Charged: The EV Revolution',
      desc: 'Robert Llewellyn takes a deep dive into the world\'s best electric vehicles and why they\'re changing everything.',
      url: 'https://www.youtube.com/watch?v=_8OlBCGGEoU',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🎵',
      category: 'Music',
      title: 'Long Drive Essentials',
      desc: 'A Spotify playlist to keep the road trip vibes alive even while you charge.',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
      linkLabel: 'Open on Spotify'
    },
    {
      icon: '🧠',
      category: 'Learn',
      title: 'How Lithium-Ion Batteries Work',
      desc: 'A fascinating explainer on the science powering your EV — from cathode chemistry to charging cycles.',
      url: 'https://www.youtube.com/watch?v=4-1psMHSpKs',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🛋️',
      category: 'Relax',
      title: 'Ambient Nature Soundscape',
      desc: 'Kerala monsoon rains and birdsong — 30 minutes of immersive ambient audio to fully unwind.',
      url: 'https://www.youtube.com/watch?v=q76bMs-NwRk',
      linkLabel: 'Listen on YouTube'
    },
    {
      icon: '📖',
      category: 'Read',
      title: 'India\'s EV Policy Deep Dive',
      desc: 'Understand FAME II subsidies, state incentives, and what drives EV adoption across Indian cities.',
      url: 'https://evreporter.com/india-ev-policy',
      linkLabel: 'Read Article'
    }
  ],

  /* ── Over 60 minutes ── */
  long: [
    {
      icon: '🎬',
      category: 'Documentary',
      title: 'Kiss the Ground',
      desc: 'Award-winning Netflix documentary about regenerative farming and environmental sustainability.',
      url: 'https://www.youtube.com/watch?v=K_-ux9GeuTk',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🎵',
      category: 'Music',
      title: 'Morning Drive Favourites',
      desc: 'A high-energy Spotify playlist to recharge your mind while your car charges up.',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS',
      linkLabel: 'Open on Spotify'
    },
    {
      icon: '🎙️',
      category: 'Podcast',
      title: 'Lex Fridman: Tesla & the Future of Energy',
      desc: 'An in-depth conversation exploring autonomous vehicles, renewable energy, and the long road to full electrification.',
      url: 'https://www.youtube.com/watch?v=ycPr5-27vSI',
      linkLabel: 'Watch on YouTube'
    },
    {
      icon: '🗺️',
      category: 'Explore',
      title: 'Discover Local Attractions',
      desc: 'Check Google Maps for local restaurants, viewpoints, or quick tourist spots within walking distance.',
      url: 'https://maps.google.com',
      linkLabel: 'Open Google Maps'
    },
    {
      icon: '🎬',
      category: 'Film',
      title: 'Kurzgesagt: Unlimited Energy',
      desc: 'An animated deep-dive into how humanity could realistically achieve unlimited clean energy.',
      url: 'https://www.youtube.com/watch?v=rhsGYMFVfZI',
      linkLabel: 'Watch on YouTube'
    }
  ]
};

/**
 * Port type definitions with display labels and OSM tag keys.
 * Used to map between user-facing labels and Overpass API response tags.
 */
window.PORT_DEFINITIONS = [
  { label: 'Type 2',  osmKeys: ['socket:type2', 'socket:type2_cable'],   defaultPower: 22 },
  { label: 'CCS2',    osmKeys: ['socket:type2_combo', 'socket:ccs2', 'socket:ccs'], defaultPower: 50 },
  { label: 'CHAdeMO', osmKeys: ['socket:chademo'],                        defaultPower: 50 },
  { label: 'CCS1',    osmKeys: ['socket:type1_combo', 'socket:ccs1', 'socket:type1'], defaultPower: 50 },
  { label: 'Tesla',   osmKeys: ['socket:tesla_supercharger', 'socket:tesla_destination'], defaultPower: 120 },
  { label: 'GB/T',    osmKeys: ['socket:gb_t', 'socket:gbt'],              defaultPower: 60 }
];

/**
 * Deterministically simulate station amenities from OSM node ID.
 * Returns an object with boolean flags for each amenity type.
 * Uses bitmasking so same station always gets same amenities.
 */
window.simulateAmenities = function(nodeId) {
  const seed = Math.abs(parseInt(String(nodeId).slice(-6)) || 0) % 64;
  return {
    cafe:     !!(seed & 1),
    restroom: !!(seed & 2),
    wifi:     !!(seed & 4),
    lounge:   !!(seed & 8),
    shop:     !!(seed & 16),
    parking:  !!(seed & 32)
  };
};

/**
 * Realistic port combinations seen at Indian EV charging stations.
 * Used deterministically when a station has no detailed OSM socket tags.
 * Covers ChargeZone, TATA Power, Statiq, EESL, Ather, BPCL, HPCL, etc.
 */
const _PORT_COMBOS = [
  // 0 — ChargeZone / Tata Power style: CCS2 + CHAdeMO + Type 2
  [{ label: 'CCS2', power: 50 }, { label: 'CHAdeMO', power: 50 }, { label: 'Type 2', power: 22 }],
  // 1 — Statiq fast charger: CCS2 + Type 2
  [{ label: 'CCS2', power: 60 }, { label: 'Type 2', power: 22 }],
  // 2 — EESL DC: CCS2 + CHAdeMO
  [{ label: 'CCS2', power: 50 }, { label: 'CHAdeMO', power: 50 }],
  // 3 — AC-only hub: multiple Type 2 sockets
  [{ label: 'Type 2', power: 22 }, { label: 'Type 2', power: 7.4 }],
  // 4 — High-power DC: CCS2 150kW + AC Type 2
  [{ label: 'CCS2', power: 150 }, { label: 'Type 2', power: 22 }],
  // 5 — BPCL / HPCL highway: CCS2 + CHAdeMO + AC
  [{ label: 'CCS2', power: 30 }, { label: 'CHAdeMO', power: 30 }, { label: 'Type 2', power: 7.4 }],
  // 6 — Ather Grid / AC-focused: Type 2 only
  [{ label: 'Type 2', power: 7.4 }],
  // 7 — Medium DC: CCS2 25kW + Type 2
  [{ label: 'CCS2', power: 25 }, { label: 'Type 2', power: 7.4 }],
  // 8 — Tesla-compatible hub: Tesla + CCS2 + Type 2
  [{ label: 'Tesla', power: 120 }, { label: 'CCS2', power: 50 }, { label: 'Type 2', power: 22 }],
  // 9 — Full combo: CCS2 + CHAdeMO + Type 2 + GB/T
  [{ label: 'CCS2', power: 50 }, { label: 'CHAdeMO', power: 50 }, { label: 'Type 2', power: 22 }, { label: 'GB/T', power: 60 }],
  // 10 — Fast CCS2 only
  [{ label: 'CCS2', power: 100 }],
  // 11 — Slow AC + fast DC combination
  [{ label: 'CCS2', power: 50 }, { label: 'Type 2', power: 7.4 }, { label: 'Type 2', power: 7.4 }]
];

/**
 * Deterministically simulate realistic port combos when a station has no OSM socket tags.
 * Uses last 8 digits of node ID as seed so the same station always gets the same ports.
 * @param {string|number} nodeId
 */
window.simulateMissingPorts = function(nodeId) {
  const seed = Math.abs(parseInt(String(nodeId).slice(-8)) || 0);
  // Clone to avoid accidental mutation across stations
  return _PORT_COMBOS[seed % _PORT_COMBOS.length].map(p => ({ ...p }));
};

/**
 * Parse Overpass API tags to determine which port types a station supports.
 * Returns array of { label, power } objects.
 * NOTE: Only call this when you know socket:* tags exist;
 * otherwise call simulateMissingPorts() for realistic fallback data.
 */
window.parseStationPorts = function(tags) {
  const ports = [];
  for (const portDef of window.PORT_DEFINITIONS) {
    for (const osmKey of portDef.osmKeys) {
      const val = tags[osmKey];
      if (val && val !== 'no' && val !== '0') {
        let power = portDef.defaultPower;
        // Try per-socket output tag first: socket:type2:output = "22 kW"
        const outputKey = osmKey + ':output';
        if (tags[outputKey]) {
          const m = tags[outputKey].match(/[\d.]+/);
          if (m) power = parseFloat(m[0]);
        }
        // Fallback to station-level maxpower
        if (tags['maxpower']) {
          const m = tags['maxpower'].match(/[\d.]+/);
          if (m) power = parseFloat(m[0]);
        }
        ports.push({ label: portDef.label, power });
        break; // only add each type once
      }
    }
  }
  return ports; // caller handles empty array
};

/**
 * Pick activities from the media library based on charge duration.
 * @param {number} durationMinutes
 * @param {object} amenities - from simulateAmenities()
 * @returns {Array} activity items to display
 */
window.getActivitiesForDuration = function(durationMinutes, amenities) {
  let pool = [];

  if (durationMinutes < 10) {
    pool = [...window.MEDIA_LIBRARY.veryShort];
  } else if (durationMinutes < 25) {
    pool = [...window.MEDIA_LIBRARY.veryShort, ...window.MEDIA_LIBRARY.short];
  } else if (durationMinutes < 60) {
    pool = [...window.MEDIA_LIBRARY.short, ...window.MEDIA_LIBRARY.medium];
  } else {
    pool = [...window.MEDIA_LIBRARY.medium, ...window.MEDIA_LIBRARY.long];
  }

  // Filter out on-site amenity suggestions if that amenity isn't present
  pool = pool.filter(item => {
    if (item.category === 'Tip' && item.title.includes('Café') && !amenities.cafe) return false;
    if (item.category === 'Explore' && !amenities.lounge) return true; // always show explore
    return true;
  });

  // Deduplicate and limit
  const seen = new Set();
  const result = [];
  for (const item of pool) {
    const key = item.title;
    if (!seen.has(key)) { seen.add(key); result.push(item); }
    if (result.length >= 6) break;
  }
  return result;
};
