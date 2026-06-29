/* =========================================================
   app.js — SPA Router, Route Guards, View Controller,
            Nav Sync, Toast System, Profile Form
   ========================================================= */

/* ── Protected routes (require login) ───────────────────── */
const PROTECTED_VIEWS = new Set(['planner', 'profile', 'waiting']);

/* ── View → DOM id mapping ───────────────────────────────── */
const VIEW_IDS = ['login', 'map', 'planner', 'waiting', 'profile'];

/* ── Active view tracker ─────────────────────────────────── */
let _currentView = null;

/* ── Show a specific view by name ────────────────────────── */
function showView(name) {
  if (!VIEW_IDS.includes(name)) name = 'map';

  // Route guard
  if (PROTECTED_VIEWS.has(name) && !window.getCurrentUser()) {
    sessionStorage.setItem('ws_redirect', name); // remember intended route
    setHash('login');
    return;
  }

  // Tear down previous view
  if (_currentView === 'waiting' && name !== 'waiting') {
    window.stopWaitingTimer && window.stopWaitingTimer();
  }

  // Hide all views
  VIEW_IDS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.remove('active');
  });

  // Show target view
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  _currentView = name;

  // Per-view hooks
  if (name === 'map') {
    window.initMap && window.initMap();
    window.refreshMapFilter && window.refreshMapFilter();
    setTimeout(() => {
      const m = window.getMapInstance && window.getMapInstance();
      if (m) m.invalidateSize();
    }, 100);
  }

  if (name === 'planner') {
    window.initPlannerMap && window.initPlannerMap();
  }

  if (name === 'waiting') {
    window.initWaitingDashboard && window.initWaitingDashboard();
  }

  if (name === 'profile') {
    _populateProfileForm();
  }

  // Update nav active state
  _syncNav(name);
}

/* ── Hash-based router ───────────────────────────────────── */
function _getViewFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  return hash || 'map';
}

function setHash(view) {
  window.location.hash = '#' + view;
}

window.addEventListener('hashchange', () => {
  showView(_getViewFromHash());
});

/* ── Nav active sync ─────────────────────────────────────── */
function _syncNav(view) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkView = link.getAttribute('data-view');
    link.classList.toggle('active', linkView === view);
  });

  // Show/hide auth buttons
  const user      = window.getCurrentUser();
  const loggedOut = document.getElementById('nav-logged-out');
  const loggedIn  = document.getElementById('nav-logged-in');
  const userName  = document.getElementById('nav-user-name');

  if (user) {
    loggedOut.classList.add('hidden');
    loggedIn.classList.remove('hidden');
    if (userName) userName.textContent = user.name.split(' ')[0];
  } else {
    loggedOut.classList.remove('hidden');
    loggedIn.classList.add('hidden');
  }
}

/* ── Auth forms ──────────────────────────────────────────── */
function _wireAuthForms() {
  // Tab switching
  const tabLogin    = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin   = document.getElementById('form-login');
  const formReg     = document.getElementById('form-register');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  });

  // Login submit
  formLogin?.addEventListener('submit', e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    const result = window.loginUser(email, password);
    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    window.showToast(`Welcome back, ${result.user.name.split(' ')[0]}! 👋`, 'success');
    window.refreshMapFilter && window.refreshMapFilter();

    // Redirect to originally intended route or map
    const redirect = sessionStorage.getItem('ws_redirect') || 'map';
    sessionStorage.removeItem('ws_redirect');
    setHash(redirect);
  });

  // Register submit
  formReg?.addEventListener('submit', e => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');

    const portInputs = document.querySelectorAll('#form-register input[name="port"]:checked');
    const portTypes  = Array.from(portInputs).map(i => i.value);

    const result = window.registerUser({
      name:     document.getElementById('reg-name').value.trim(),
      email:    document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      vehicle:  {
        name:            document.getElementById('reg-vehicle').value.trim(),
        batteryCapacity: parseFloat(document.getElementById('reg-battery').value),
        portTypes
      }
    });

    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    errEl.classList.add('hidden');
    window.showToast(`Account created! Welcome, ${result.user.name.split(' ')[0]}! ⚡`, 'success');
    window.refreshMapFilter && window.refreshMapFilter();
    setHash('map');
  });
}

/* ── Logout wiring ───────────────────────────────────────── */
function _wireLogout() {
  document.getElementById('nav-logout')?.addEventListener('click', _doLogout);
  document.getElementById('profile-logout')?.addEventListener('click', _doLogout);
}

function _doLogout() {
  window.logoutUser();
  window.refreshMapFilter && window.refreshMapFilter();
  window.showToast('You have been logged out.', 'info');
  setHash('map');
  _syncNav('map');
}

/* ── Profile form ─────────────────────────────────────────── */
function _populateProfileForm() {
  const user = window.getCurrentUser();
  if (!user) return;

  const nameEl    = document.getElementById('profile-name');
  const emailEl   = document.getElementById('profile-email');
  const vehicleEl = document.getElementById('prof-vehicle');
  const batteryEl = document.getElementById('prof-battery');

  if (nameEl)    nameEl.textContent   = user.name;
  if (emailEl)   emailEl.textContent  = user.email;
  if (vehicleEl) vehicleEl.value      = user.vehicle.name;
  if (batteryEl) batteryEl.value      = user.vehicle.batteryCapacity;

  // Check port checkboxes
  document.querySelectorAll('input[name="prof-port"]').forEach(cb => {
    cb.checked = user.vehicle.portTypes.includes(cb.value);
  });
}

function _wireProfileForm() {
  const form = document.getElementById('form-profile');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const errEl  = document.getElementById('profile-error');
    const succEl = document.getElementById('profile-success');
    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    const portInputs = document.querySelectorAll('input[name="prof-port"]:checked');
    const portTypes  = Array.from(portInputs).map(i => i.value);

    const result = window.updateUserProfile({
      vehicleName:     document.getElementById('prof-vehicle').value.trim(),
      batteryCapacity: parseFloat(document.getElementById('prof-battery').value),
      portTypes
    });

    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    succEl.classList.remove('hidden');
    window.showToast('Profile updated!', 'success');
    window.refreshMapFilter && window.refreshMapFilter();

    // Update nav
    const userName = document.getElementById('nav-user-name');
    if (userName && result.user) userName.textContent = result.user.name.split(' ')[0];
  });
}

/* ── Toast notification system ───────────────────────────── */
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
};

/* ── Nav link click handling ─────────────────────────────── */
function _wireNavLinks() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      if (view) setHash(view);
    });
  });
}

/* ── Boot sequence ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  _wireAuthForms();
  _wireLogout();
  _wireProfileForm();
  _wireNavLinks();

  // Boot into correct view based on hash
  const initial = _getViewFromHash();
  showView(initial);
});
