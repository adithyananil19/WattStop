/* =========================================================
   waiting.js — Smart Waiting Dashboard
   Countdown timer, activity recommendations, charging progress
   ========================================================= */

/* ── Module state ─────────────────────────────────────────── */
let _timerInterval   = null;
let _totalSeconds    = 0;
let _remainingSeconds = 0;
let _arrivalSoc      = 20;
let _departureSoc    = 80;

/* ── Entry point called by planner.js "Smart Waiting" button ─ */
window.startWaiting = function(stationId, durationMin, arrivalSoc, departureSoc) {
  // Store context in sessionStorage so it survives hash navigation
  sessionStorage.setItem('ws_stationId',    stationId);
  sessionStorage.setItem('ws_durationMin',  durationMin);
  sessionStorage.setItem('ws_arrivalSoc',   arrivalSoc);
  sessionStorage.setItem('ws_departureSoc', departureSoc);

  window.location.hash = '#waiting';
};

/* ── Initialise dashboard from stored context ───────────────── */
window.initWaitingDashboard = function() {
  const stationId    = sessionStorage.getItem('ws_stationId');
  const durationMin  = parseInt(sessionStorage.getItem('ws_durationMin'))  || 25;
  const arrivalSoc   = parseFloat(sessionStorage.getItem('ws_arrivalSoc')) || 20;
  const departureSoc = parseFloat(sessionStorage.getItem('ws_departureSoc')) || 80;

  _arrivalSoc    = arrivalSoc;
  _departureSoc  = departureSoc;
  _totalSeconds  = durationMin * 60;
  _remainingSeconds = _totalSeconds;

  // Find station object
  const stations = window.getAllStations ? window.getAllStations() : [];
  const station  = stations.find(s => String(s.id) === String(stationId));
  const amenities = station
    ? station.amenities
    : window.simulateAmenities(stationId || '12345');

  // Station name
  const nameEl = document.getElementById('waiting-station-name');
  if (nameEl) {
    nameEl.textContent = station
      ? `Charging at ${station.name}`
      : 'Smart Waiting Dashboard';
  }

  // SOC labels
  const arrEl = document.getElementById('arrival-soc');
  const depEl = document.getElementById('departure-soc');
  if (arrEl) arrEl.textContent = `Arrival: ${arrivalSoc.toFixed(0)}%`;
  if (depEl) depEl.textContent = `Target: ${departureSoc.toFixed(0)}%`;

  // Initial progress fill
  _updateProgressBar(0);

  // Render activities
  const activities = window.getActivitiesForDuration(durationMin, amenities);
  _renderActivities(activities, durationMin);

  // Start countdown
  _stopTimer();
  _startTimer();
};

/* ── Timer ───────────────────────────────────────────────── */
function _startTimer() {
  _tick();
  _timerInterval = setInterval(_tick, 1000);
}

function _stopTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

function _tick() {
  if (_remainingSeconds <= 0) {
    _stopTimer();
    _onChargeComplete();
    return;
  }

  const elapsed  = _totalSeconds - _remainingSeconds;
  const progress = _totalSeconds > 0 ? elapsed / _totalSeconds : 0;

  // Update clock display
  const mins = Math.floor(_remainingSeconds / 60);
  const secs = _remainingSeconds % 60;
  const mEl  = document.getElementById('timer-minutes');
  const sEl  = document.getElementById('timer-seconds');
  if (mEl) mEl.textContent = String(mins).padStart(2, '0');
  if (sEl) sEl.textContent = String(secs).padStart(2, '0');

  // Update progress bar
  _updateProgressBar(progress);

  _remainingSeconds--;
}

function _updateProgressBar(progress) {
  const fill = document.getElementById('charge-fill');
  if (!fill) return;
  // Progress bar shows charging progress (0 = arrival SoC, 1 = departure SoC)
  const currentSoc = _arrivalSoc + (_departureSoc - _arrivalSoc) * progress;
  const barWidth   = ((currentSoc - _arrivalSoc) / (_departureSoc - _arrivalSoc)) * 100;
  fill.style.width = Math.min(100, Math.max(0, barWidth)) + '%';
}

function _onChargeComplete() {
  const mEl = document.getElementById('timer-minutes');
  const sEl = document.getElementById('timer-seconds');
  if (mEl) mEl.textContent = '00';
  if (sEl) sEl.textContent = '00';

  const fill = document.getElementById('charge-fill');
  if (fill) fill.style.width = '100%';

  const chargingText = document.querySelector('.charging-text');
  if (chargingText) {
    chargingText.textContent = '✅ Charging complete! Ready to roll.';
    chargingText.style.color = 'var(--clr-primary-light)';
  }

  window.showToast('Charging complete! Time to hit the road. ⚡', 'success');
}

/* ── Activity cards renderer ─────────────────────────────── */
function _renderActivities(activities, durationMin) {
  const container = document.getElementById('activities-container');
  if (!container) return;

  if (!activities.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">Sit back and relax</div>
        <div class="empty-state-desc">Your vehicle will be charged and ready soon.</div>
      </div>`;
    return;
  }

  container.innerHTML = activities.map(item => {
    const linkHTML = item.url
      ? `<a href="${_esc(item.url)}" target="_blank" rel="noopener noreferrer"
            class="activity-card-link">
            ${_esc(item.linkLabel)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>`
      : '';

    return `
      <div class="activity-card">
        <div class="activity-card-icon">${item.icon}</div>
        <div>
          <div class="activity-card-category">${_esc(item.category)}</div>
          <div class="activity-card-title">${_esc(item.title)}</div>
        </div>
        <div class="activity-card-desc">${_esc(item.desc)}</div>
        ${linkHTML}
      </div>`;
  }).join('');
}

/* ── HTML escape ──────────────────────────────────────────── */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Stop timer when leaving view ────────────────────────── */
window.stopWaitingTimer = _stopTimer;
