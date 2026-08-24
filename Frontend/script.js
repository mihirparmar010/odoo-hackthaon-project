/* ============ CONFIG ============ */
const API_BASE = "http://localhost:8000";
let currentTripId = localStorage.getItem("gt_currentTripId") || null;

/* ============ AUTH HELPERS ============ */
function getToken() {
  return localStorage.getItem("gt_token");
}
function setToken(token) {
  localStorage.setItem("gt_token", token);
}
function clearToken() {
  localStorage.removeItem("gt_token");
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    showAuthOverlay("Session expired. Please log in again.");
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let detail = "Something went wrong";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    toast(detail);
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

/* ============ LOGIN / SIGNUP OVERLAY ============ */
let authResolve = null;

function buildAuthOverlay() {
  if (document.getElementById('authOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.className = 'modal open';
  overlay.innerHTML = `
    <div class="modal-box">
      <h2 id="authTitle">Log in to GlobeTrotter</h2>
      <p id="authMsg" style="color:var(--muted);margin-top:-10px"></p>

      <div class="field full" id="authNameField" style="display:none;margin-bottom:12px">
        <label>Name</label>
        <input id="authName" placeholder="Your name">
      </div>
      <div class="field full" style="margin-bottom:12px">
        <label>Email</label>
        <input id="authEmail" type="email" placeholder="you@example.com">
      </div>
      <div class="field full" style="margin-bottom:16px">
        <label>Password</label>
        <input id="authPassword" type="password" placeholder="••••••••">
      </div>

      <button class="btn primary" style="width:100%" id="authSubmitBtn">Log In</button>
      <p style="text-align:center;margin-top:14px;font-size:13px">
        <span id="authToggleText">New here?</span>
        <a href="#" id="authToggleLink" style="color:var(--primary);font-weight:700;text-decoration:none">Sign up</a>
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  let mode = 'login'; // or 'signup'

  const nameField = overlay.querySelector('#authNameField');
  const title = overlay.querySelector('#authTitle');
  const submitBtn = overlay.querySelector('#authSubmitBtn');
  const toggleText = overlay.querySelector('#authToggleText');
  const toggleLink = overlay.querySelector('#authToggleLink');
  const msg = overlay.querySelector('#authMsg');

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    mode = mode === 'login' ? 'signup' : 'login';
    nameField.style.display = mode === 'signup' ? 'block' : 'none';
    title.textContent = mode === 'signup' ? 'Create your account' : 'Log in to GlobeTrotter';
    submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Log In';
    toggleText.textContent = mode === 'signup' ? 'Already have an account?' : 'New here?';
    toggleLink.textContent = mode === 'signup' ? 'Log in' : 'Sign up';
    msg.textContent = '';
  });

  submitBtn.addEventListener('click', async () => {
    const email = overlay.querySelector('#authEmail').value.trim();
    const password = overlay.querySelector('#authPassword').value;
    const name = overlay.querySelector('#authName').value.trim();

    if (!email || !password) {
      msg.textContent = 'Please fill in email and password.';
      return;
    }
    if (mode === 'signup' && !name) {
      msg.textContent = 'Please enter your name.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait…';

    try {
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const body = mode === 'signup' ? { name, email, password } : { email, password };

      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        msg.textContent = err.detail || 'Something went wrong. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Log In';
        return;
      }

      const data = await res.json();
      setToken(data.access_token);
      overlay.remove();
      toast(`Welcome, ${data.user.name}!`);
      updateUserBadge(data.user);
      if (authResolve) { authResolve(); authResolve = null; }
    } catch (_) {
      msg.textContent = 'Could not reach the server. Is the backend running?';
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'signup' ? 'Sign Up' : 'Log In';
    }
  });
}

function showAuthOverlay(message = '') {
  buildAuthOverlay();
  const overlay = document.getElementById('authOverlay');
  overlay.classList.add('open');
  if (message) overlay.querySelector('#authMsg').textContent = message;
  return new Promise((resolve) => { authResolve = resolve; });
}

async function ensureAuth() {
  if (getToken()) {
    // Token already exists from a previous session — fetch the user's
    // own info so the topbar shows their real name, not a stale one.
    try {
      const me = await apiFetch('/auth/me');
      updateUserBadge(me);
    } catch (_) { /* apiFetch handles re-auth on 401 */ }
    return;
  }
  await showAuthOverlay();
}

/* ============ USER BADGE (topbar) ============ */
function updateUserBadge(user) {
  const greeting = document.getElementById('userGreeting');
  const avatar = document.getElementById('userAvatar');
  const menuName = document.getElementById('userMenuName');
  const menuEmail = document.getElementById('userMenuEmail');

  if (greeting) greeting.textContent = `Hi, ${user.name} 👋`;
  if (avatar) avatar.textContent = (user.name || '?').charAt(0).toUpperCase();
  if (menuName) menuName.textContent = user.name;
  if (menuEmail) menuEmail.textContent = user.email;
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  const avatar = document.getElementById('userAvatar');
  if (!menu || menu.style.display !== 'block') return;
  if (!menu.contains(e.target) && e.target !== avatar) {
    menu.style.display = 'none';
  }
});

function logout() {
  clearToken();
  localStorage.removeItem('gt_currentTripId');
  currentTripId = null;
  toast('Logged out');
  const menu = document.getElementById('userMenu');
  if (menu) menu.style.display = 'none';
  showAuthOverlay().then(async () => {
    try {
      const me = await apiFetch('/auth/me');
      updateUserBadge(me);
    } catch (_) {}
    loadDashboard();
  });
}


/* ============ PAGE NAVIGATION ============ */
const titles = {
  dashboard: 'Dashboard',
  create: 'Create New Trip',
  trips: 'My Trips',
  itinerary: 'Itinerary Builder',
  cities: 'Explore Cities',
  budget: 'Trip Budget',
  share: 'Share Trip'
};

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  document.getElementById('pageTitle').textContent = titles[id];

  document.querySelectorAll('.nav button').forEach(navBtn => navBtn.classList.remove('active'));
  if (btn) btn.classList.add('active');

  window.scrollTo(0, 0);
  loadPageData(id);
}

function loadPageData(id) {
  if (id === 'dashboard') loadDashboard();
  if (id === 'trips') loadTrips();
  if (id === 'itinerary') loadItinerary();
  if (id === 'cities') loadCities();
  if (id === 'budget') loadBudget();
  if (id === 'share') loadShare();
}

/* ============ DASHBOARD ============ */
async function loadDashboard() {
  try {
    const data = await apiFetch("/dashboard");

    const statTrips = document.getElementById('statTrips');
    if (statTrips) statTrips.textContent = data.total_trips;

    const tripGrid = document.getElementById('recentTripsGrid');
    if (tripGrid) {
      tripGrid.innerHTML = data.upcoming_trips.map(t => `
        <div class="trip">
          ${cityImgHtml(t.name, 'trip-img')}
          <div class="trip-body">
            <b>${t.name}</b>
            <small>${t.start_date || 'TBD'} – ${t.end_date || 'TBD'}</small>
          </div>
        </div>
      `).join('') || '<p style="color:var(--muted)">No trips yet. Plan your first one!</p>';
    }

    const destGrid = document.getElementById('popularDestinations');
    if (destGrid) {
      destGrid.innerHTML = data.recommended_destinations.map(c => `
        <div class="destination">
          ${cityImgHtml(c.name, 'dest-img')}
          <div><b>${c.name}, ${c.country}</b></div>
        </div>
      `).join('');
    }

    // Cities planned + Total estimate: need full trip details (not in /dashboard)
    loadDashboardTotals();
  } catch (_) { /* apiFetch already toasts the error */ }
}

async function loadDashboardTotals() {
  const statCities = document.getElementById('statCities');
  const statBudget = document.getElementById('statBudget');
  if (!statCities && !statBudget) return;

  try {
    const trips = await apiFetch("/trips");
    if (!trips.length) {
      if (statCities) statCities.textContent = '0';
      if (statBudget) statBudget.textContent = '₹0';
      return;
    }

    const details = await Promise.all(
      trips.map(t => apiFetch(`/trips/${t.id}`).catch(() => null))
    );

    const uniqueCityIds = new Set();
    let totalBudget = 0;

    for (const trip of details) {
      if (!trip) continue;
      for (const stop of trip.stops) {
        uniqueCityIds.add(stop.city.id);
      }
    }

    const budgets = await Promise.all(
      trips.map(t => apiFetch(`/trips/${t.id}/budget`).catch(() => null))
    );
    totalBudget = budgets.reduce((sum, b) => sum + (b ? b.total : 0), 0);

    if (statCities) statCities.textContent = uniqueCityIds.size;
    if (statBudget) statBudget.textContent = `₹${totalBudget >= 1000 ? (totalBudget / 1000).toFixed(1) + 'K' : totalBudget}`;
  } catch (_) { /* silent: these two stats are best-effort */ }
}

/* ============ CREATE TRIP ============ */
async function createTrip() {
  const tripName = document.getElementById('tripName').value.trim();
  const startDate = document.getElementById('startDate').value || null;
  const endDate = document.getElementById('endDate').value || null;
  const description = document.getElementById('tripDesc')?.value.trim() || "";
  const budgetLimit = parseFloat(document.getElementById('budgetInput')?.value) || 0;

  if (!tripName) {
    toast('Please enter a trip name');
    return;
  }

  try {
    const trip = await apiFetch("/trips", {
      method: "POST",
      body: JSON.stringify({
        name: tripName,
        description,
        start_date: startDate,
        end_date: endDate,
        budget_limit: budgetLimit,
      }),
    });
    currentTripId = trip.id;
    localStorage.setItem("gt_currentTripId", currentTripId);
    document.getElementById('modal').classList.add('open');
  } catch (_) { /* apiFetch already toasts the error */ }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

/* ============ MY TRIPS ============ */
async function loadTrips() {
  const tbody = document.getElementById('tripsTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5">Loading trips…</td></tr>`;

  try {
    const trips = await apiFetch("/trips");
    if (!tbody) return;

    if (!trips.length) {
      tbody.innerHTML = `<tr><td colspan="5">No trips yet.</td></tr>`;
      return;
    }

    // Fetch cities count + budget per trip in parallel
    const [details, budgets] = await Promise.all([
      Promise.all(trips.map(t => apiFetch(`/trips/${t.id}`).catch(() => null))),
      Promise.all(trips.map(t => apiFetch(`/trips/${t.id}/budget`).catch(() => null))),
    ]);

    tbody.innerHTML = trips.map((t, i) => {
      const cityCount = details[i] ? details[i].stops.length : '—';
      const bd = budgets[i];
      let budget = '—';
      if (bd) {
        budget = `₹${bd.total.toLocaleString()}`;
        if (bd.is_over_budget) budget += ' <span style="color:#e85e42;font-weight:700">⚠ over</span>';
        else if (bd.budget_limit > 0) budget += ` / ₹${bd.budget_limit.toLocaleString()}`;
      }
      return `
        <tr style="cursor:pointer" onclick="selectTrip(${t.id})">
          <td><b>${t.name}</b></td>
          <td>${t.start_date || '—'} – ${t.end_date || '—'}</td>
          <td>${cityCount}</td>
          <td>${budget}</td>
          <td><span class="chip">${t.is_public ? 'Public' : 'Planning'}</span></td>
        </tr>
      `;
    }).join('');
  } catch (_) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Failed to load trips.</td></tr>`;
  }
}

function selectTrip(tripId) {
  currentTripId = tripId;
  localStorage.setItem("gt_currentTripId", currentTripId);
  toast("Trip selected");
  showPage('itinerary');
}

/* ============ ITINERARY BUILDER ============ */
async function loadItinerary() {
  const timeline = document.getElementById('itineraryTimeline');
  if (!currentTripId) {
    if (timeline) timeline.innerHTML = '<p style="color:var(--muted)">Select a trip from "My Trips" first.</p>';
    return;
  }

  try {
    const trip = await apiFetch(`/trips/${currentTripId}`);

    const titleEl = document.getElementById('itineraryTitle');
    const subEl = document.getElementById('itinerarySubtitle');
    if (titleEl) titleEl.textContent = trip.name;
    if (subEl) subEl.textContent = `${trip.stops.length} stop(s) · ${trip.start_date || 'TBD'} – ${trip.end_date || 'TBD'}`;

    if (timeline) {
      timeline.innerHTML = trip.stops.map(stop => `
        <div class="day">
          <div class="day-date">${stop.city.name}<small>${stop.start_date || ''} – ${stop.end_date || ''}</small></div>
          ${stop.activities.map(act => `
            <div class="event">
              <div><b>${act.name}</b><small>${act.time_of_day || ''}</small></div>
              <span class="cost">₹${act.cost}</span>
            </div>
          `).join('') || '<div class="event"><div><i>No activities added yet</i></div></div>'}
          <button class="btn light" style="margin-top:10px;padding:8px 14px;font-size:13px" onclick="openActivityPicker(${stop.id}, ${stop.city.id}, '${stop.city.name.replace(/'/g, "\\'")}')">+ Add Activity</button>
        </div>
      `).join('') || '<p style="color:var(--muted)">No stops yet. Add one from Explore Cities.</p>';
    }
  } catch (_) { /* apiFetch already toasts the error */ }
}

async function addStopToTrip(cityId) {
  if (!currentTripId) {
    toast("Create or select a trip first");
    return;
  }
  try {
    await apiFetch(`/trips/${currentTripId}/stops`, {
      method: "POST",
      body: JSON.stringify({ city_id: cityId }),
    });
    toast("City added to your trip!");
  } catch (_) { /* apiFetch already toasts the error */ }
}

/* ============ ACTIVITY PICKER ============ */
async function openActivityPicker(stopId, cityId, cityName) {
  let overlay = document.getElementById('activityOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'activityOverlay';
  overlay.className = 'modal open';
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="close" onclick="document.getElementById('activityOverlay').remove()">×</button>
      <h2>Add Activity · ${cityName}</h2>
      <div id="activityCatalogList" style="max-height:260px;overflow-y:auto;margin:14px 0">Loading…</div>

      <h3 style="margin-top:18px">Or add a custom activity</h3>
      <div class="field full" style="margin:10px 0">
        <label>Name</label>
        <input id="customActName" placeholder="e.g. Sunset boat ride">
      </div>
      <div class="field full" style="margin-bottom:12px">
        <label>Cost (₹)</label>
        <input id="customActCost" type="number" placeholder="0">
      </div>
      <button class="btn primary" style="width:100%" onclick="addActivityToStop(${stopId}, null, document.getElementById('customActName').value, document.getElementById('customActCost').value)">Add Custom Activity</button>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const activities = await apiFetch(`/cities/${cityId}/activities`);
    const list = document.getElementById('activityCatalogList');
    if (!list) return;

    list.innerHTML = activities.map(a => `
      <div class="event" style="cursor:pointer" onclick="addActivityToStop(${stopId}, ${a.id})">
        <div><b>${a.name}</b><small>${a.category} · ${a.duration_hours}h</small></div>
        <span class="cost">₹${a.cost}</span>
      </div>
    `).join('') || '<p style="color:var(--muted)">No catalog activities for this city yet — add a custom one below.</p>';
  } catch (_) {
    const list = document.getElementById('activityCatalogList');
    if (list) list.innerHTML = '<p style="color:var(--muted)">Could not load activities.</p>';
  }
}

async function addActivityToStop(stopId, catalogId, customName, customCost) {
  const body = catalogId
    ? { activity_catalog_id: catalogId }
    : { name: customName, cost: customCost ? parseFloat(customCost) : 0 };

  if (!catalogId && !customName) {
    toast("Enter an activity name");
    return;
  }

  try {
    await apiFetch(`/trips/stops/${stopId}/activities`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast("Activity added!");
    document.getElementById('activityOverlay')?.remove();
    loadItinerary();
  } catch (_) { /* apiFetch already toasts the error */ }
}

/* ============ EXPLORE CITIES ============ */
let citySearchTimer = null;

function filterCities() {
  clearTimeout(citySearchTimer);
  citySearchTimer = setTimeout(() => {
    const q = document.getElementById('citySearch').value.trim();
    loadCities(q);
  }, 300);
}

async function loadCities(q = "") {
  try {
    const cities = await apiFetch(`/cities${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const cityList = document.getElementById('cityList');
    if (!cityList) return;

    cityList.innerHTML = cities.map(c => `
      <div class="trip">
        ${cityImgHtml(c.name, 'trip-img')}
        <div class="trip-body">
          <b>${c.name}</b>
          <small>${c.country} · Cost index ${c.cost_index}</small>
          <button class="btn primary" style="margin-top:10px;padding:8px 12px" onclick="addStopToTrip(${c.id})">Add to Trip</button>
        </div>
      </div>
    `).join('') || '<p style="color:var(--muted)">No cities found.</p>';
  } catch (_) { /* apiFetch already toasts the error */ }
}

/* ============ BUDGET ============ */
async function loadBudget() {
  if (!currentTripId) {
    toast("Select a trip first");
    return;
  }
  try {
    const b = await apiFetch(`/trips/${currentTripId}/budget`);

    const bigNum = document.getElementById('budgetTotal');
    if (bigNum) bigNum.textContent = `₹${b.total.toLocaleString()}`;

    const subtitle = document.getElementById('budgetSubtitle');
    if (subtitle) subtitle.textContent = `Estimated total · ${b.days} day(s)`;

    const setBar = (legendId, barId, value) => {
      const legend = document.getElementById(legendId);
      const bar = document.getElementById(barId);
      if (legend) legend.textContent = `₹${value.toLocaleString()}`;
      if (bar) bar.style.width = b.total ? `${Math.min((value / b.total) * 100, 100)}%` : '0%';
    };
    setBar('legendTransport', 'barTransport', b.transport);
    setBar('legendStay', 'barStay', b.stay);
    setBar('legendActivities', 'barActivities', b.activities);
    setBar('legendMeals', 'barMeals', b.meals);

    const avgEl = document.getElementById('avgDailySpend');
    if (avgEl) avgEl.textContent = `₹${b.per_day_average.toLocaleString()}`;

    const limitEl = document.getElementById('budgetLimitDisplay');
    if (limitEl) limitEl.textContent = b.budget_limit > 0 ? `₹${b.budget_limit.toLocaleString()}` : 'Not set';

    const remainingLine = document.getElementById('budgetRemainingLine');
    const emoji = document.getElementById('budgetHealthEmoji');
    const title = document.getElementById('budgetHealthTitle');

    if (b.budget_limit > 0) {
      if (b.is_over_budget) {
        const overBy = Math.abs(b.remaining);
        if (remainingLine) remainingLine.innerHTML = `<span style="color:#e85e42;font-weight:700">Over budget by ₹${overBy.toLocaleString()}</span>`;
        if (emoji) emoji.textContent = '🔴';
        if (title) { title.textContent = "You're over budget!"; title.style.color = '#e85e42'; }
      } else {
        if (remainingLine) remainingLine.textContent = `Remaining: ₹${b.remaining.toLocaleString()}`;
        if (emoji) emoji.textContent = '🟢';
        if (title) { title.textContent = "You're on track!"; title.style.color = ''; }
      }
    } else {
      if (remainingLine) remainingLine.textContent = 'Set a budget limit when creating your trip to track this.';
      if (emoji) emoji.textContent = '⚪';
      if (title) { title.textContent = 'No budget limit set'; title.style.color = ''; }
    }
  } catch (_) { /* apiFetch already toasts the error */ }
}

/* ============ SHARE TRIP ============ */
async function loadShare() {
  if (!currentTripId) return;
  try {
    const trip = await apiFetch(`/trips/${currentTripId}`);
    if (!trip.is_public) {
      await apiFetch(`/trips/${currentTripId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: true }),
      });
    }
    const link = `${window.location.origin}/public/${trip.share_token}`;
    const input = document.getElementById('shareLink');
    if (input) input.value = link;
  } catch (_) { /* apiFetch already toasts the error */ }
}

function copyLink() {
  const link = document.getElementById('shareLink').value;
  navigator.clipboard?.writeText(link);
  toast('Public trip link copied!');
}

/* ============ TOAST ============ */
function toast(msg) {
  const toastEl = document.getElementById('toast');
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ============ IMAGE PLACEHOLDER ============ */
/* Backend doesn't store city photos, so use a free deterministic photo
   service (Picsum) keyed on the city/trip name — same name always gets
   the same photo, and it always loads (no broken-image risk). */
function cityImgHtml(name, extraClass = 'trip-img') {
  const seed = encodeURIComponent((name || 'travel').toLowerCase().replace(/\s+/g, '-'));
  const url = `https://picsum.photos/seed/${seed}/500/350`;
  return `<div class="${extraClass}" style="background-image:url('${url}');background-size:cover;background-position:center"></div>`;
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', async () => {
  await ensureAuth();
  loadDashboard();
});
