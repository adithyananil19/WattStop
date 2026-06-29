/* =========================================================
   auth.js — User Authentication & Session Management
   LocalStorage-based auth (demo app — no hashing)
   ========================================================= */

const AUTH_USERS_KEY    = 'wattstop_users';
const AUTH_SESSION_KEY  = 'wattstop_session';

/* ── Storage helpers ──────────────────────────────────────── */

function _getUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || [];
  } catch { return []; }
}

function _saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function _setSession(user) {
  // Store a session token (sans password)
  const session = { id: user.id, name: user.name, email: user.email };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Returns the currently logged-in user object (from users array), or null.
 */
window.getCurrentUser = function() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
    if (!session) return null;
    const users = _getUsers();
    return users.find(u => u.id === session.id) || null;
  } catch { return null; }
};

/**
 * Register a new user.
 * @param {{ name, email, password, vehicle: { name, batteryCapacity, portTypes } }} data
 * @returns {{ success: boolean, error?: string, user?: object }}
 */
window.registerUser = function(data) {
  const { name, email, password, vehicle } = data;

  if (!name || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  if (!vehicle.portTypes || vehicle.portTypes.length === 0) {
    return { success: false, error: 'Select at least one supported port type.' };
  }
  if (!vehicle.batteryCapacity || vehicle.batteryCapacity <= 0) {
    return { success: false, error: 'Enter a valid battery capacity.' };
  }

  const users = _getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const newUser = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password, // plain text — demo only
    vehicle: {
      name:            vehicle.name || 'My EV',
      batteryCapacity: Number(vehicle.batteryCapacity),
      portTypes:       vehicle.portTypes
    },
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  _saveUsers(users);
  _setSession(newUser);

  return { success: true, user: newUser };
};

/**
 * Log in an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, error?: string, user?: object }}
 */
window.loginUser = function(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const users = _getUsers();
  const user  = users.find(u => u.email === email.trim().toLowerCase());

  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid email or password.' };
  }

  _setSession(user);
  return { success: true, user };
};

/**
 * Log out the current user.
 */
window.logoutUser = function() {
  localStorage.removeItem(AUTH_SESSION_KEY);
};

/**
 * Update the current user's vehicle profile.
 * @param {{ vehicleName, batteryCapacity, portTypes }} updates
 * @returns {{ success: boolean, error?: string }}
 */
window.updateUserProfile = function(updates) {
  const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
  if (!session) return { success: false, error: 'Not logged in.' };

  const users = _getUsers();
  const idx   = users.findIndex(u => u.id === session.id);
  if (idx === -1) return { success: false, error: 'User not found.' };

  if (!updates.portTypes || updates.portTypes.length === 0) {
    return { success: false, error: 'Select at least one port type.' };
  }

  users[idx].vehicle = {
    name:            updates.vehicleName || users[idx].vehicle.name,
    batteryCapacity: Number(updates.batteryCapacity),
    portTypes:       updates.portTypes
  };

  _saveUsers(users);
  return { success: true, user: users[idx] };
};
