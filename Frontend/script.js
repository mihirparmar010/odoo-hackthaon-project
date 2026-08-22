
/**
 * GlobeTrotter — Frontend Application Engine
 * Connects directly to the FastAPI Backend for Auth, Discovery, Trips, Stops & Budgets
 */

// ============================================================================
// State & Configuration
// ============================================================================
const state = {
    apiUrl: localStorage.getItem('gt_api_url') || 'http://127.0.0.1:8000',
    token: localStorage.getItem('gt_token') || null,
    user: JSON.parse(localStorage.getItem('gt_user') || 'null'),
    activeTab: 'dashboard',
    currentTrip: null,
    cities: [],
    filterTimeout: null,
};

// Default cover photos for trips
const DEFAULT_COVERS = [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800', // Paris
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800', // Tokyo
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', // Bali
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800', // Dubai
    'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800', // Rome
];

// ============================================================================
// API Helper & Communication Layer
// ============================================================================

/**
 * Universal fetch wrapper for GlobeTrotter API
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${state.apiUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        // If 401 Unauthorized, token is expired or invalid
        if (response.status === 401 && state.token) {
            handleLogout(false);
            showToast('Session expired. Please log in again.', 'error');
            throw new Error('Unauthorized');
        }

        if (response.status === 204) {
            return null; // No content
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const errorMsg = data?.detail || `API Request failed (${response.status})`;
            throw new Error(errorMsg);
        }

        return data;
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            console.error(`API Error [${endpoint}]:`, err);
        }
        throw err;
    }
}

/**
 * Check backend connection status and update UI pill
 */
async function checkBackendStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusLabel = document.getElementById('status-label');
    const diagStatus = document.getElementById('diag-status-text');

    if (!statusDot || !statusLabel) return false;

    statusLabel.textContent = 'Connecting...';
    try {
        const res = await fetch(`${state.apiUrl.replace(/\/$/, '')}/`, { method: 'GET' });
        if (res.ok) {
            statusDot.className = 'status-dot online';
            statusLabel.textContent = 'Backend Online';
            if (diagStatus) {
                diagStatus.textContent = 'Connected (HTTP 200 OK)';
                diagStatus.style.color = 'var(--accent-emerald)';
            }
            return true;
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        statusDot.className = 'status-dot offline';
        statusLabel.textContent = 'Backend Offline';
        if (diagStatus) {
            diagStatus.textContent = 'Disconnected / Unreachable';
            diagStatus.style.color = 'var(--accent-rose)';
        }
        return false;
    }
}

// ============================================================================
// Toast Notification System
// ============================================================================
function showToast(message, type = 'info', durationMs = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <div class="toast-text">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}

// ============================================================================
// Authentication & User State Handlers
// ============================================================================

/**
 * Handle user login
 */
async function handleLogin(email, password) {
    const errorAlert = document.getElementById('login-error-alert');
    const submitBtn = document.getElementById('login-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    errorAlert.classList.add('hidden');
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        state.token = data.access_token;
        state.user = data.user;
        localStorage.setItem('gt_token', data.access_token);
        localStorage.setItem('gt_user', JSON.stringify(data.user));

        updateAuthUI();
        closeModal('modal-login');
        document.getElementById('login-form').reset();
        showToast(`Welcome back, ${state.user.name}! 👋`, 'success');

        // Reload data for the active view
        loadActiveViewData();
    } catch (err) {
        errorAlert.textContent = err.message || 'Login failed. Please check your credentials.';
        errorAlert.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

/**
 * Handle user registration
 */
async function handleSignup(name, email, password) {
    const errorAlert = document.getElementById('signup-error-alert');
    const submitBtn = document.getElementById('signup-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    errorAlert.classList.add('hidden');
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        const data = await apiFetch('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });

        state.token = data.access_token;
        state.user = data.user;
        localStorage.setItem('gt_token', data.access_token);
        localStorage.setItem('gt_user', JSON.stringify(data.user));

        updateAuthUI();
        closeModal('modal-signup');
        document.getElementById('signup-form').reset();
        showToast(`Account created! Welcome to GlobeTrotter, ${state.user.name}! 🌍`, 'success');

        loadActiveViewData();
    } catch (err) {
        errorAlert.textContent = err.message || 'Signup failed. Please try again.';
        errorAlert.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

/**
 * Log out user
 */
function handleLogout(notify = true) {
    state.token = null;
    state.user = null;
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');

    updateAuthUI();
    if (notify) {
        showToast('You have been logged out.', 'info');
    }
    switchTab('dashboard');
}

/**
 * Synchronize UI elements with current auth state
 */
function updateAuthUI() {
    const guestControls = document.getElementById('auth-guest-controls');
    const userControls = document.getElementById('auth-user-controls');
    const navUserName = document.getElementById('nav-user-name');
    const userAvatar = document.getElementById('user-avatar-initials');
    const heroHeading = document.getElementById('dashboard-welcome-heading');

    if (state.token && state.user) {
        guestControls.classList.add('hidden');
        userControls.classList.remove('hidden');
        if (navUserName) navUserName.textContent = state.user.name.split(' ')[0];
        if (userAvatar) userAvatar.textContent = state.user.name.charAt(0).toUpperCase();
        if (heroHeading) heroHeading.textContent = `Welcome, ${state.user.name}! Ready to explore?`;
    } else {
        guestControls.classList.remove('hidden');
        userControls.classList.add('hidden');
        if (heroHeading) heroHeading.textContent = 'Plan Your Next Great Adventure';
    }
}

// ============================================================================
// Navigation & View Routing
// ============================================================================
function switchTab(tabId) {
    state.activeTab = tabId;

    // Update nav link styles
    document.querySelectorAll('.nav-link').forEach((link) => {
        if (link.dataset.tab === tabId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update view visibility
    document.querySelectorAll('.app-view').forEach((view) => {
        if (view.id === `view-${tabId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    loadActiveViewData();
}

function loadActiveViewData() {
    switch (state.activeTab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'explore':
            loadCitiesCatalog();
            break;
        case 'trips':
            loadMyTrips();
            break;
        case 'trip-detail':
            if (state.currentTrip) loadTripDetail(state.currentTrip.id);
            break;
        case 'budget':
            if (state.currentTrip) loadBudgetBreakdown(state.currentTrip.id);
            break;
        case 'public-trips':
            break;
    }
}

// ============================================================================
// View 1: Dashboard
// ============================================================================
async function loadDashboard() {
    const tripsGrid = document.getElementById('dashboard-trips-grid');
    const citiesGrid = document.getElementById('dashboard-cities-grid');
    const statTotalTrips = document.getElementById('stat-total-trips');
    const statDestinations = document.getElementById('stat-destinations-count');

    // 1. Fetch cities for trending destinations
    try {
        const cities = await apiFetch('/cities');
        state.cities = cities;
        if (statDestinations) statDestinations.textContent = `${cities.length}`;

        // Populate top 3 cities in dashboard
        if (citiesGrid) {
            citiesGrid.innerHTML = cities.slice(0, 3).map((city) => renderCityCard(city)).join('');
        }
    } catch (err) {
        if (citiesGrid) {
            citiesGrid.innerHTML = `<div class="empty-state-box"><p>Unable to load trending cities. Please ensure backend is running.</p></div>`;
        }
    }

    // 2. Fetch User Dashboard or Trips if logged in
    if (state.token && state.user) {
        try {
            const dashData = await apiFetch('/dashboard');
            if (statTotalTrips) statTotalTrips.textContent = `${dashData.total_trips || 0}`;

            const trips = await apiFetch('/trips');
            if (tripsGrid) {
                if (trips.length === 0) {
                    tripsGrid.innerHTML = `
                        <div class="empty-state-box">
                            <div class="empty-icon"><i class="fa-solid fa-map-location-dot"></i></div>
                            <h3>No upcoming trips yet</h3>
                            <p>Create your first custom itinerary to start planning stops and budgeting activities.</p>
                            <button class="btn btn-primary" onclick="openModal('modal-create-trip')">
                                <i class="fa-solid fa-plus"></i> Create Itinerary
                            </button>
                        </div>
                    `;
                } else {
                    tripsGrid.innerHTML = trips.slice(0, 3).map((trip) => renderTripCard(trip)).join('');
                }
            }
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    } else {
        if (statTotalTrips) statTotalTrips.textContent = '0';
        if (tripsGrid) {
            tripsGrid.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon"><i class="fa-solid fa-lock"></i></div>
                    <h3>Sign in to manage your journeys</h3>
                    <p>Track multi-city stops, schedule daily activities, and monitor your travel budget.</p>
                    <button class="btn btn-primary" onclick="openModal('modal-login')">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i> Log In to GlobeTrotter
                    </button>
                </div>
            `;
        }
    }
}

// ============================================================================
// View 2: Explore Cities & Activities Catalog
// ============================================================================
async function loadCitiesCatalog() {
    const grid = document.getElementById('explore-cities-grid');
    const countrySelect = document.getElementById('filter-country');
    const searchInput = document.getElementById('city-search-input');
    const regionSelect = document.getElementById('filter-region');
    const costRange = document.getElementById('filter-cost');

    if (!grid) return;
    grid.innerHTML = `<div class="empty-state-box"><p><i class="fa-solid fa-spinner fa-spin"></i> Loading destinations...</p></div>`;

    try {
        let endpoint = '/cities?';
        const params = new URLSearchParams();
        if (searchInput && searchInput.value.trim()) params.append('q', searchInput.value.trim());
        if (countrySelect && countrySelect.value) params.append('country', countrySelect.value);
        if (regionSelect && regionSelect.value) params.append('region', regionSelect.value);
        if (costRange && costRange.value < 100) params.append('max_cost_index', costRange.value);

        const cities = await apiFetch(`/cities?${params.toString()}`);
        state.cities = cities;

        // Populate country dropdown if empty
        if (countrySelect && countrySelect.options.length <= 1) {
            const allCities = await apiFetch('/cities');
            const countries = [...new Set(allCities.map((c) => c.country))].sort();
            countries.forEach((country) => {
                const opt = document.createElement('option');
                opt.value = country;
                opt.textContent = country;
                countrySelect.appendChild(opt);
            });
        }

        if (cities.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
                    <h3>No destinations matched your criteria</h3>
                    <p>Try adjusting your search query, country filter, or cost index threshold.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = cities.map((city) => renderCityCard(city)).join('');
    } catch (err) {
        grid.innerHTML = `<div class="empty-state-box"><p>Failed to load destinations: ${err.message}</p></div>`;
    }
}

function renderCityCard(city) {
    return `
        <div class="city-card" data-city-id="${city.id}">
            <div class="city-card-header">
                <div>
                    <h3 class="city-name">${escapeHtml(city.name)}</h3>
                    <span class="city-country">${escapeHtml(city.country)} • ${escapeHtml(city.region || 'World')}</span>
                </div>
                <div class="city-popularity" title="Popularity score: ${city.popularity}/100">
                    <i class="fa-solid fa-star"></i>
                    <span>${city.popularity}</span>
                </div>
            </div>
            <div class="city-metrics">
                <div class="metric-item">
                    <span>Cost Index</span>
                    <strong>${city.cost_index}/100</strong>
                </div>
                <div class="metric-item">
                    <span>Budget Level</span>
                    <strong>${city.cost_index > 70 ? 'Luxury' : city.cost_index > 40 ? 'Moderate' : 'Budget'}</strong>
                </div>
            </div>
            <div class="city-actions">
                <button class="btn btn-secondary btn-block btn-sm" onclick="viewCityActivities(${city.id}, '${escapeHtml(city.name)}')">
                    <i class="fa-solid fa-ticket"></i> View Experiences
                </button>
            </div>
        </div>
    `;
}

/**
 * Open Modal to view activities for a specific city
 */
async function viewCityActivities(cityId, cityName) {
    const modalTitle = document.getElementById('city-modal-title');
    const modalSubtitle = document.getElementById('city-modal-subtitle');
    const listContainer = document.getElementById('city-modal-activities-list');

    if (modalTitle) modalTitle.textContent = `${cityName} Experiences`;
    if (modalSubtitle) modalSubtitle.textContent = 'Curated activities, sightseeing, and dining spots';
    if (listContainer) listContainer.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Loading experiences...</p>';

    openModal('modal-city-activities');

    try {
        const activities = await apiFetch(`/cities/${cityId}/activities`);
        if (activities.length === 0) {
            listContainer.innerHTML = '<p class="text-secondary">No seeded activities found for this destination yet.</p>';
            return;
        }

        listContainer.innerHTML = activities
            .map(
                (act) => `
            <div class="activity-item-row" style="padding: 1rem; margin-bottom: 0.75rem;">
                <div>
                    <div style="font-weight: 700; font-size: 1rem; color: #fff;">${escapeHtml(act.name)}</div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin: 0.2rem 0;">${escapeHtml(act.description || '')}</div>
                    <div style="display: flex; gap: 0.6rem; font-size: 0.75rem; margin-top: 0.4rem;">
                        <span class="badge badge-sky"><i class="fa-solid fa-tag"></i> ${escapeHtml(act.category)}</span>
                        <span class="badge badge-indigo"><i class="fa-regular fa-clock"></i> ${act.duration_hours}h</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="activity-cost-badge" style="font-size: 1.1rem;">$${act.cost}</div>
                </div>
            </div>
        `
            )
            .join('');
    } catch (err) {
        listContainer.innerHTML = `<p class="form-alert">Failed to load experiences: ${err.message}</p>`;
    }
}

// ============================================================================
// View 3: My Trips
// ============================================================================
async function loadMyTrips() {
    const grid = document.getElementById('my-trips-grid');
    const authGate = document.getElementById('trips-auth-gate');
    const createBtn = document.getElementById('btn-create-trip-main');

    if (!state.token || !state.user) {
        if (grid) grid.innerHTML = '';
        if (authGate) authGate.classList.remove('hidden');
        if (createBtn) createBtn.classList.add('hidden');
        return;
    }

    if (authGate) authGate.classList.add('hidden');
    if (createBtn) createBtn.classList.remove('hidden');
    if (grid) grid.innerHTML = `<div class="empty-state-box"><p><i class="fa-solid fa-spinner fa-spin"></i> Loading your itineraries...</p></div>`;

    try {
        const trips = await apiFetch('/trips');
        if (trips.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon"><i class="fa-solid fa-suitcase-rolling"></i></div>
                    <h3>No trips planned yet</h3>
                    <p>Create your custom itinerary, assign destination cities, schedule activities, and track your travel budget.</p>
                    <button class="btn btn-primary" onclick="openModal('modal-create-trip')">
                        <i class="fa-solid fa-plus"></i> Create First Trip
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = trips.map((trip) => renderTripCard(trip)).join('');
    } catch (err) {
        if (grid) grid.innerHTML = `<div class="empty-state-box"><p>Failed to load trips: ${err.message}</p></div>`;
    }
}

function renderTripCard(trip) {
    const coverUrl = trip.cover_photo || DEFAULT_COVERS[trip.id % DEFAULT_COVERS.length];
    const dateText = trip.start_date && trip.end_date ? `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}` : 'Dates Flexible';

    return `
        <div class="trip-card" data-trip-id="${trip.id}">
            <div class="trip-card-image-wrap">
                <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(trip.name)}" class="trip-card-img" onerror="this.src='${DEFAULT_COVERS[0]}'">
                <div class="trip-card-badges">
                    <span class="badge ${trip.is_public ? 'badge-emerald' : 'badge-sky'}">
                        <i class="fa-solid ${trip.is_public ? 'fa-globe' : 'fa-lock'}"></i>
                        ${trip.is_public ? 'Public' : 'Private'}
                    </span>
                </div>
            </div>
            <div class="trip-card-body">
                <h3 class="trip-card-title">${escapeHtml(trip.name)}</h3>
                <p class="trip-card-desc">${escapeHtml(trip.description || 'No description provided.')}</p>
                <div class="trip-card-meta">
                    <span><i class="fa-regular fa-calendar"></i> ${dateText}</span>
                </div>
            </div>
            <div class="trip-card-actions">
                <button class="btn btn-primary btn-sm btn-block" onclick="openTripDetail(${trip.id})">
                    <i class="fa-solid fa-route"></i> Itinerary
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openTripBudget(${trip.id})" title="Budget Breakdown">
                    <i class="fa-solid fa-chart-pie"></i>
                </button>
                <button class="btn btn-danger-ghost btn-sm" onclick="handleDeleteTrip(${trip.id}, '${escapeHtml(trip.name)}')" title="Delete Trip">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Handle Trip Creation Form Submit
 */
async function handleCreateTrip(event) {
    event.preventDefault();
    const name = document.getElementById('trip-name').value.trim();
    const description = document.getElementById('trip-description').value.trim();
    const start_date = document.getElementById('trip-start-date').value || null;
    const end_date = document.getElementById('trip-end-date').value || null;
    const cover_photo = document.getElementById('trip-cover-photo').value.trim();

    try {
        const newTrip = await apiFetch('/trips', {
            method: 'POST',
            body: JSON.stringify({
                name,
                description,
                start_date,
                end_date,
                cover_photo,
            }),
        });

        closeModal('modal-create-trip');
        document.getElementById('create-trip-form').reset();
        showToast(`Trip "${newTrip.name}" created! ✨`, 'success');

        openTripDetail(newTrip.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/**
 * Handle Trip Deletion
 */
async function handleDeleteTrip(tripId, tripName) {
    if (!confirm(`Are you sure you want to delete the trip "${tripName}"? This cannot be undone.`)) {
        return;
    }

    try {
        await apiFetch(`/trips/${tripId}`, { method: 'DELETE' });
        showToast(`Trip deleted.`, 'info');
        loadMyTrips();
        loadDashboard();
    } catch (err) {
        showToast(`Failed to delete trip: ${err.message}`, 'error');
    }
}

// ============================================================================
// View 4: Trip Detail & Itinerary Builder
// ============================================================================
async function openTripDetail(tripId) {
    switchTab('trip-detail');
    await loadTripDetail(tripId);
}

async function loadTripDetail(tripId) {
    const heroTitle = document.getElementById('trip-hero-title');
    const heroDesc = document.getElementById('trip-hero-desc');
    const heroDates = document.getElementById('trip-hero-dates');
    const heroVisibility = document.getElementById('trip-hero-visibility');
    const heroStopsCount = document.getElementById('trip-hero-stops-count');
    const heroTotalBudget = document.getElementById('trip-hero-total-budget');
    const stopsTimeline = document.getElementById('stops-timeline');
    const shareBtnText = document.getElementById('share-trip-btn-text');

    if (stopsTimeline) {
        stopsTimeline.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Loading itinerary details...</p>';
    }

    try {
        const trip = await apiFetch(`/trips/${tripId}`);
        state.currentTrip = trip;

        if (heroTitle) heroTitle.textContent = trip.name;
        if (heroDesc) heroDesc.textContent = trip.description || 'No notes added.';
        if (heroDates) {
            heroDates.textContent = trip.start_date && trip.end_date ? `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}` : 'Dates Flexible';
        }
        if (heroVisibility) {
            heroVisibility.className = `badge ${trip.is_public ? 'badge-emerald' : 'badge-sky'}`;
            heroVisibility.innerHTML = `<i class="fa-solid ${trip.is_public ? 'fa-globe' : 'fa-lock'}"></i> ${trip.is_public ? 'Public' : 'Private'}`;
        }
        if (heroStopsCount) {
            heroStopsCount.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${trip.stops.length} Stops`;
        }
        if (shareBtnText) {
            shareBtnText.textContent = trip.is_public ? 'Copy Share Link' : 'Make Public & Share';
        }

        // Calculate total budget on client side for quick view
        let totalCost = 0;
        trip.stops.forEach((stop) => {
            totalCost += (stop.transport_cost || 0) + (stop.stay_cost || 0) + (stop.meals_cost || 0);
            (stop.activities || []).forEach((act) => {
                totalCost += act.cost || 0;
            });
        });
        if (heroTotalBudget) heroTotalBudget.textContent = `$${totalCost.toLocaleString()}`;

        // Render Stops
        if (trip.stops.length === 0) {
            stopsTimeline.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon"><i class="fa-solid fa-map-pin"></i></div>
                    <h3>No stops added yet</h3>
                    <p>Start building your itinerary by adding your first destination stop.</p>
                    <button class="btn btn-primary" onclick="openAddStopModal()">
                        <i class="fa-solid fa-plus"></i> Add First Stop
                    </button>
                </div>
            `;
            return;
        }

        stopsTimeline.innerHTML = trip.stops
            .map(
                (stop, index) => `
            <div class="stop-card" data-stop-id="${stop.id}">
                <div class="stop-card-header">
                    <div class="stop-destination">
                        <div class="stop-order-badge">${index + 1}</div>
                        <div>
                            <h4 class="stop-city-heading">${escapeHtml(stop.city.name)}, ${escapeHtml(stop.city.country)}</h4>
                            <span class="stop-dates-tag">
                                <i class="fa-regular fa-calendar"></i>
                                ${stop.start_date && stop.end_date ? `${formatDate(stop.start_date)} — ${formatDate(stop.end_date)}` : 'Flexible Dates'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-danger-ghost btn-sm" onclick="handleDeleteStop(${stop.id})" title="Delete stop">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <div class="stop-costs-row">
                    <div class="stop-cost-item"><i class="fa-solid fa-plane"></i> Transport: <strong>$${stop.transport_cost}</strong></div>
                    <div class="stop-cost-item"><i class="fa-solid fa-hotel"></i> Stay: <strong>$${stop.stay_cost}</strong></div>
                    <div class="stop-cost-item"><i class="fa-solid fa-utensils"></i> Meals: <strong>$${stop.meals_cost}</strong></div>
                </div>

                <div class="stop-activities-section">
                    <div class="stop-activities-header">
                        <span><i class="fa-solid fa-ticket"></i> Scheduled Experiences & Activities (${stop.activities.length})</span>
                        <button class="btn btn-secondary btn-sm" onclick="openAddActivityModal(${stop.id}, ${stop.city.id}, '${escapeHtml(stop.city.name)}')">
                            <i class="fa-solid fa-plus"></i> Add Experience
                        </button>
                    </div>
                    <div class="stop-activities-list">
                        ${
                            stop.activities.length === 0
                                ? '<p style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">No activities scheduled for this stop yet.</p>'
                                : stop.activities
                                      .map(
                                          (act) => `
                            <div class="activity-item-row">
                                <div class="activity-name-meta">
                                    <span style="font-weight: 600; color: #fff;">${escapeHtml(act.name)}</span>
                                    ${act.time_of_day ? `<span class="badge badge-indigo"><i class="fa-regular fa-clock"></i> ${escapeHtml(act.time_of_day)}</span>` : ''}
                                    ${act.notes ? `<span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(act.notes)}</span>` : ''}
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.85rem;">
                                    <span class="activity-cost-badge">$${act.cost}</span>
                                    <button class="btn-clear" onclick="handleDeleteActivity(${act.id})" title="Remove activity" style="color: var(--text-muted);">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                        `
                                      )
                                      .join('')
                        }
                    </div>
                </div>
            </div>
        `
            )
            .join('');
    } catch (err) {
        showToast(`Failed to load itinerary: ${err.message}`, 'error');
    }
}

/**
 * Open Modal to Add a Destination Stop to current trip
 */
async function openAddStopModal() {
    const select = document.getElementById('stop-city-select');
    if (select) {
        select.innerHTML = '<option value="">Loading cities...</option>';
        try {
            const cities = await apiFetch('/cities');
            select.innerHTML = '<option value="">-- Choose a Destination City --</option>';
            cities.forEach((city) => {
                const opt = document.createElement('option');
                opt.value = city.id;
                opt.textContent = `${city.name}, ${city.country} (${city.region || 'World'})`;
                select.appendChild(opt);
            });
        } catch (err) {
            select.innerHTML = '<option value="">Error loading cities</option>';
        }
    }
    openModal('modal-add-stop');
}

/**
 * Handle Add Stop Form Submit
 */
async function handleAddStop(event) {
    event.preventDefault();
    if (!state.currentTrip) return;

    const city_id = parseInt(document.getElementById('stop-city-select').value, 10);
    const start_date = document.getElementById('stop-start-date').value || null;
    const end_date = document.getElementById('stop-end-date').value || null;
    const transport_cost = parseFloat(document.getElementById('stop-transport-cost').value) || 0;
    const stay_cost = parseFloat(document.getElementById('stop-stay-cost').value) || 0;
    const meals_cost = parseFloat(document.getElementById('stop-meals-cost').value) || 0;

    try {
        await apiFetch(`/trips/${state.currentTrip.id}/stops`, {
            method: 'POST',
            body: JSON.stringify({
                city_id,
                start_date,
                end_date,
                transport_cost,
                stay_cost,
                meals_cost,
            }),
        });

        closeModal('modal-add-stop');
        document.getElementById('add-stop-form').reset();
        showToast('Stop added to itinerary! 📍', 'success');
        loadTripDetail(state.currentTrip.id);
    } catch (err) {
        showToast(`Failed to add stop: ${err.message}`, 'error');
    }
}

/**
 * Handle Delete Stop
 */
async function handleDeleteStop(stopId) {
    if (!confirm('Remove this destination stop and all its activities?')) return;
    try {
        await apiFetch(`/trips/stops/${stopId}`, { method: 'DELETE' });
        showToast('Stop removed.', 'info');
        loadTripDetail(state.currentTrip.id);
    } catch (err) {
        showToast(`Failed to delete stop: ${err.message}`, 'error');
    }
}

/**
 * Open Modal to Add Activity to a stop
 */
async function openAddActivityModal(stopId, cityId, cityName) {
    document.getElementById('activity-stop-id').value = stopId;
    document.getElementById('add-activity-stop-subtitle').textContent = `Schedule an experience in ${cityName}`;

    const catalogSelect = document.getElementById('activity-catalog-select');
    catalogSelect.innerHTML = '<option value="">-- Custom Activity / Manual Entry --</option>';

    try {
        const activities = await apiFetch(`/cities/${cityId}/activities`);
        activities.forEach((act) => {
            const opt = document.createElement('option');
            opt.value = act.id;
            opt.textContent = `${act.name} ($${act.cost}) [${act.category}]`;
            opt.dataset.name = act.name;
            opt.dataset.cost = act.cost;
            catalogSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load city activity catalog:', err);
    }

    openModal('modal-add-activity');
}

/**
 * Handle Add Activity Form Submit
 */
async function handleAddActivity(event) {
    event.preventDefault();
    const stopId = document.getElementById('activity-stop-id').value;
    const catalogSelect = document.getElementById('activity-catalog-select');
    const catalogId = catalogSelect.value ? parseInt(catalogSelect.value, 10) : null;
    const name = document.getElementById('activity-name').value.trim();
    const cost = parseFloat(document.getElementById('activity-cost').value) || 0;
    const day_date = document.getElementById('activity-date').value || null;
    const time_of_day = document.getElementById('activity-time').value.trim();
    const notes = document.getElementById('activity-notes').value.trim();

    try {
        await apiFetch(`/trips/stops/${stopId}/activities`, {
            method: 'POST',
            body: JSON.stringify({
                activity_catalog_id: catalogId,
                name: name || undefined,
                cost,
                day_date,
                time_of_day,
                notes,
            }),
        });

        closeModal('modal-add-activity');
        document.getElementById('add-activity-form').reset();
        showToast('Activity scheduled! 🎟️', 'success');
        loadTripDetail(state.currentTrip.id);
    } catch (err) {
        showToast(`Failed to add activity: ${err.message}`, 'error');
    }
}

/**
 * Handle Delete Activity
 */
async function handleDeleteActivity(activityId) {
    try {
        await apiFetch(`/trips/activities/${activityId}`, { method: 'DELETE' });
        showToast('Activity removed.', 'info');
        loadTripDetail(state.currentTrip.id);
    } catch (err) {
        showToast(`Failed to delete activity: ${err.message}`, 'error');
    }
}

/**
 * Toggle Trip Public Visibility & Share Link
 */
async function handleToggleShare() {
    if (!state.currentTrip) return;

    if (!state.currentTrip.is_public) {
        try {
            const updated = await apiFetch(`/trips/${state.currentTrip.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_public: true }),
            });
            state.currentTrip.is_public = true;
            state.currentTrip.share_token = updated.share_token;
            showToast('Trip is now Public! Share token copied to clipboard. 🌐', 'success');
        } catch (err) {
            showToast(`Failed to update visibility: ${err.message}`, 'error');
            return;
        }
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${state.currentTrip.share_token}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        showToast(`Public link copied: ${shareUrl}`, 'success');
    } else {
        prompt('Copy this public itinerary link:', shareUrl);
    }
    loadTripDetail(state.currentTrip.id);
}

// ============================================================================
// View 5: Budget & Expense Breakdown
// ============================================================================
async function openTripBudget(tripId) {
    if (!state.currentTrip || state.currentTrip.id !== tripId) {
        state.currentTrip = await apiFetch(`/trips/${tripId}`);
    }
    switchTab('budget');
    loadBudgetBreakdown(tripId);
}

async function loadBudgetBreakdown(tripId, dailyLimit = 0) {
    const subtitle = document.getElementById('budget-trip-subtitle');
    const totalEl = document.getElementById('budget-total-cost');
    const daysEl = document.getElementById('budget-days-count');
    const transportEl = document.getElementById('budget-transport-cost');
    const stayEl = document.getElementById('budget-stay-cost');
    const mealsEl = document.getElementById('budget-meals-cost');
    const activitiesEl = document.getElementById('budget-activities-cost');
    const dailyAvgEl = document.getElementById('budget-daily-avg');
    const reportBox = document.getElementById('over-budget-report');

    if (state.currentTrip && subtitle) {
        subtitle.textContent = `Cost analysis for "${state.currentTrip.name}"`;
    }

    try {
        const budget = await apiFetch(`/trips/${tripId}/budget?daily_limit=${dailyLimit}`);

        if (totalEl) totalEl.textContent = `$${budget.total.toLocaleString()}`;
        if (daysEl) daysEl.textContent = `${budget.days} Trip Day${budget.days > 1 ? 's' : ''}`;
        if (transportEl) transportEl.textContent = `$${budget.transport.toLocaleString()}`;
        if (stayEl) stayEl.textContent = `$${budget.stay.toLocaleString()}`;
        if (mealsEl) mealsEl.textContent = `$${budget.meals.toLocaleString()}`;
        if (activitiesEl) activitiesEl.textContent = `$${budget.activities.toLocaleString()}`;
        if (dailyAvgEl) dailyAvgEl.textContent = `$${budget.per_day_average.toLocaleString()} / day`;

        if (dailyLimit > 0 && reportBox) {
            reportBox.classList.remove('hidden');
            if (budget.over_budget_days.length > 0) {
                reportBox.innerHTML = `
                    <div style="color: #fecdd3; font-weight: 700; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Budget Warning: ${budget.over_budget_days.length} day(s) exceed your $${dailyLimit}/day limit!
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${budget.over_budget_days.map((d) => `<span class="badge badge-amber">${formatDate(d)}</span>`).join('')}
                    </div>
                `;
            } else {
                reportBox.className = 'over-budget-report';
                reportBox.style.background = 'var(--accent-emerald-bg)';
                reportBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                reportBox.innerHTML = `
                    <div style="color: var(--accent-emerald); font-weight: 700;">
                        <i class="fa-solid fa-circle-check"></i> Great job! Every day of this trip is within your $${dailyLimit}/day budget limit.
                    </div>
                `;
            }
        }
    } catch (err) {
        showToast(`Failed to load budget breakdown: ${err.message}`, 'error');
    }
}

// ============================================================================
// View 6: Public Shared Trips
// ============================================================================
async function lookupPublicTrip(token) {
    const previewContainer = document.getElementById('public-trip-preview');
    if (!previewContainer) return;

    previewContainer.classList.remove('hidden');
    previewContainer.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Fetching public itinerary...</p>';

    try {
        const trip = await apiFetch(`/public/trips/${token}`);
        const coverUrl = trip.cover_photo || DEFAULT_COVERS[0];

        previewContainer.innerHTML = `
            <div class="trip-detail-hero" style="margin-top: 1.5rem;">
                <div class="trip-hero-content">
                    <span class="badge badge-emerald"><i class="fa-solid fa-globe"></i> Public Itinerary</span>
                    <h2 class="trip-hero-title" style="margin-top: 0.5rem;">${escapeHtml(trip.name)}</h2>
                    <p class="trip-hero-desc">${escapeHtml(trip.description || '')}</p>
                    <div class="trip-hero-meta" style="margin-bottom: 1.5rem;">
                        <span><i class="fa-solid fa-location-dot"></i> ${trip.stops.length} Stops</span>
                        <span><i class="fa-regular fa-calendar"></i> ${trip.start_date ? formatDate(trip.start_date) : 'Flexible'}</span>
                    </div>
                    ${
                        state.token && state.user
                            ? `
                        <button class="btn btn-accent btn-lg" onclick="handleCopyPublicTrip('${trip.share_token}')">
                            <i class="fa-solid fa-clone"></i> Clone Itinerary to My Account
                        </button>
                    `
                            : `
                        <button class="btn btn-primary btn-lg" onclick="openModal('modal-login')">
                            <i class="fa-solid fa-arrow-right-to-bracket"></i> Log In to Clone this Trip
                        </button>
                    `
                    }
                </div>
            </div>

            <div class="itinerary-workspace" style="margin-top: 1.5rem;">
                <h3>Trip Stops & Activities</h3>
                <div class="stops-timeline" style="margin-top: 1rem;">
                    ${trip.stops
                        .map(
                            (s, idx) => `
                        <div class="stop-card">
                            <div class="stop-destination">
                                <div class="stop-order-badge">${idx + 1}</div>
                                <div>
                                    <h4 class="stop-city-heading">${escapeHtml(s.city.name)}, ${escapeHtml(s.city.country)}</h4>
                                </div>
                            </div>
                            <div class="stop-activities-list" style="margin-top: 0.75rem;">
                                ${s.activities.map((a) => `<div class="activity-item-row"><span>${escapeHtml(a.name)}</span><strong class="activity-cost-badge">$${a.cost}</strong></div>`).join('')}
                            </div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
            </div>
        `;
    } catch (err) {
        previewContainer.innerHTML = `<div class="empty-state-box"><p class="form-alert">Trip not found or not marked as public.</p></div>`;
    }
}

async function handleCopyPublicTrip(token) {
    if (!state.token || !state.user) {
        openModal('modal-login');
        return;
    }

    try {
        const copied = await apiFetch(`/public/trips/${token}/copy?new_owner_id=${state.user.id}`, {
            method: 'POST',
        });
        showToast(`Trip cloned to your account! 🎉`, 'success');
        openTripDetail(copied.id);
    } catch (err) {
        showToast(`Failed to copy trip: ${err.message}`, 'error');
    }
}

// ============================================================================
// Modal Utilities
// ============================================================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) firstInput.focus();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============================================================================
// Helper Utilities
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ============================================================================
// Event Listeners & Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Auth & UI Sync
    updateAuthUI();

    // 2. Check Backend Health
    await checkBackendStatus();

    // 3. Setup Navigation tabs
    document.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            switchTab(link.dataset.tab);
        });
    });

    // 4. Brand click -> return to dashboard
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
        brandLogo.addEventListener('click', () => switchTab('dashboard'));
    }

    // 5. Auth Modal Buttons
    const loginOpenBtn = document.getElementById('login-modal-open-btn');
    if (loginOpenBtn) loginOpenBtn.addEventListener('click', () => openModal('modal-login'));

    const signupOpenBtn = document.getElementById('signup-modal-open-btn');
    if (signupOpenBtn) signupOpenBtn.addEventListener('click', () => openModal('modal-signup'));

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => handleLogout());

    // Switch between login & signup
    const switchToSignup = document.getElementById('switch-to-signup');
    if (switchToSignup) {
        switchToSignup.addEventListener('click', () => {
            closeModal('modal-login');
            openModal('modal-signup');
        });
    }

    const switchToLogin = document.getElementById('switch-to-login');
    if (switchToLogin) {
        switchToLogin.addEventListener('click', () => {
            closeModal('modal-signup');
            openModal('modal-login');
        });
    }

    // 6. Login Form Submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            handleLogin(email, password);
        });
    }

    // Quick Demo Login Button
    const demoLoginBtn = document.getElementById('quick-demo-login-btn');
    if (demoLoginBtn) {
        demoLoginBtn.addEventListener('click', () => {
            document.getElementById('login-email').value = 'traveler@example.com';
            document.getElementById('login-password').value = 'password123';
            handleLogin('traveler@example.com', 'password123');
        });
    }

    // 7. Signup Form Submission
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            handleSignup(name, email, password);
        });
    }

    // 8. Password Toggle buttons
    document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                btn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
            }
        });
    });

    // 9. Modal Close Listeners (Buttons & Backdrop)
    document.querySelectorAll('.modal-close-btn, [data-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.close || btn.closest('.modal-backdrop').id;
            closeModal(modalId);
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal(backdrop.id);
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });

    // 10. Dashboard Actions & Navigation Shortcuts
    const heroCreateTripBtn = document.getElementById('hero-create-trip-btn');
    if (heroCreateTripBtn) {
        heroCreateTripBtn.addEventListener('click', () => {
            if (!state.token) openModal('modal-login');
            else openModal('modal-create-trip');
        });
    }

    const heroExploreBtn = document.getElementById('hero-explore-btn');
    if (heroExploreBtn) heroExploreBtn.addEventListener('click', () => switchTab('explore'));

    const createTripNavBtn = document.getElementById('create-trip-nav-btn');
    if (createTripNavBtn) createTripNavBtn.addEventListener('click', () => openModal('modal-create-trip'));

    const createTripMainBtn = document.getElementById('btn-create-trip-main');
    if (createTripMainBtn) createTripMainBtn.addEventListener('click', () => openModal('modal-create-trip'));

    const viewAllTripsBtn = document.getElementById('view-all-trips-btn');
    if (viewAllTripsBtn) viewAllTripsBtn.addEventListener('click', () => switchTab('trips'));

    const viewAllCitiesBtn = document.getElementById('view-all-cities-btn');
    if (viewAllCitiesBtn) viewAllCitiesBtn.addEventListener('click', () => switchTab('explore'));

    const gateLoginBtn = document.getElementById('gate-login-btn');
    if (gateLoginBtn) gateLoginBtn.addEventListener('click', () => openModal('modal-login'));

    const gateSignupBtn = document.getElementById('gate-signup-btn');
    if (gateSignupBtn) gateSignupBtn.addEventListener('click', () => openModal('modal-signup'));

    // 11. Create Trip Form & Presets
    const createTripForm = document.getElementById('create-trip-form');
    if (createTripForm) createTripForm.addEventListener('submit', handleCreateTrip);

    document.querySelectorAll('.preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const input = document.getElementById('trip-cover-photo');
            if (input) input.value = chip.dataset.img;
        });
    });

    // 12. Itinerary & Stops Form Handlers
    const addStopBtn = document.getElementById('btn-add-stop');
    if (addStopBtn) addStopBtn.addEventListener('click', openAddStopModal);

    const addStopForm = document.getElementById('add-stop-form');
    if (addStopForm) addStopForm.addEventListener('submit', handleAddStop);

    const addActivityForm = document.getElementById('add-activity-form');
    if (addActivityForm) addActivityForm.addEventListener('submit', handleAddActivity);

    // Catalog selection auto-fill activity name and cost
    const activityCatalogSelect = document.getElementById('activity-catalog-select');
    if (activityCatalogSelect) {
        activityCatalogSelect.addEventListener('change', () => {
            const selectedOpt = activityCatalogSelect.selectedOptions[0];
            if (selectedOpt && selectedOpt.dataset.name) {
                document.getElementById('activity-name').value = selectedOpt.dataset.name;
                document.getElementById('activity-cost').value = selectedOpt.dataset.cost || 0;
            }
        });
    }

    // 13. Trip Header Actions
    const backToTripsBtn = document.getElementById('back-to-trips-btn');
    if (backToTripsBtn) backToTripsBtn.addEventListener('click', () => switchTab('trips'));

    const viewBudgetBtn = document.getElementById('btn-view-budget');
    if (viewBudgetBtn) {
        viewBudgetBtn.addEventListener('click', () => {
            if (state.currentTrip) openTripBudget(state.currentTrip.id);
        });
    }

    const backToTripFromBudget = document.getElementById('back-to-trip-from-budget');
    if (backToTripFromBudget) {
        backToTripFromBudget.addEventListener('click', () => {
            if (state.currentTrip) openTripDetail(state.currentTrip.id);
            else switchTab('trips');
        });
    }

    const shareTripBtn = document.getElementById('btn-share-trip');
    if (shareTripBtn) shareTripBtn.addEventListener('click', handleToggleShare);

    const deleteCurrentTripBtn = document.getElementById('btn-delete-current-trip');
    if (deleteCurrentTripBtn) {
        deleteCurrentTripBtn.addEventListener('click', () => {
            if (state.currentTrip) handleDeleteTrip(state.currentTrip.id, state.currentTrip.name);
        });
    }

    // 14. Budget Limit Calculator
    const checkBudgetLimitBtn = document.getElementById('check-budget-limit-btn');
    if (checkBudgetLimitBtn) {
        checkBudgetLimitBtn.addEventListener('click', () => {
            const limit = parseFloat(document.getElementById('daily-limit-input').value) || 0;
            if (state.currentTrip) loadBudgetBreakdown(state.currentTrip.id, limit);
        });
    }

    // 15. Explore Filters Live Listeners
    const searchInput = document.getElementById('city-search-input');
    const clearSearchBtn = document.getElementById('city-search-clear');
    const countryFilter = document.getElementById('filter-country');
    const regionFilter = document.getElementById('filter-region');
    const costFilter = document.getElementById('filter-cost');
    const costLabel = document.getElementById('cost-val-label');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    if (costFilter && costLabel) {
        costFilter.addEventListener('input', () => {
            costLabel.textContent = costFilter.value;
        });
    }

    const triggerSearchDebounced = () => {
        clearTimeout(state.filterTimeout);
        state.filterTimeout = setTimeout(() => {
            if (state.activeTab === 'explore') loadCitiesCatalog();
        }, 300);
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (clearSearchBtn) {
                if (searchInput.value) clearSearchBtn.classList.remove('hidden');
                else clearSearchBtn.classList.add('hidden');
            }
            triggerSearchDebounced();
        });
    }

    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            loadCitiesCatalog();
        });
    }

    if (countryFilter) countryFilter.addEventListener('change', loadCitiesCatalog);
    if (regionFilter) regionFilter.addEventListener('change', loadCitiesCatalog);
    if (costFilter) costFilter.addEventListener('change', loadCitiesCatalog);

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
            if (countryFilter) countryFilter.value = '';
            if (regionFilter) regionFilter.value = '';
            if (costFilter) {
                costFilter.value = 100;
                if (costLabel) costLabel.textContent = '100';
            }
            loadCitiesCatalog();
        });
    }

    // 16. Shared Trip Lookup
    const lookupShareBtn = document.getElementById('lookup-share-token-btn');
    const shareTokenInput = document.getElementById('share-token-input');
    if (lookupShareBtn && shareTokenInput) {
        lookupShareBtn.addEventListener('click', () => {
            const token = shareTokenInput.value.trim();
            if (token) lookupPublicTrip(token);
        });
    }

    // Check for ?share=TOKEN in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedToken = urlParams.get('share');
    if (sharedToken) {
        switchTab('public-trips');
        if (shareTokenInput) shareTokenInput.value = sharedToken;
        lookupPublicTrip(sharedToken);
    }

    // 17. API Settings Modal
    const apiStatusBtn = document.getElementById('api-status-btn');
    if (apiStatusBtn) {
        apiStatusBtn.addEventListener('click', () => {
            document.getElementById('api-base-url').value = state.apiUrl;
            checkBackendStatus();
            openModal('modal-api-settings');
        });
    }

    const testApiBtn = document.getElementById('btn-test-api');
    if (testApiBtn) {
        testApiBtn.addEventListener('click', async () => {
            state.apiUrl = document.getElementById('api-base-url').value.trim();
            await checkBackendStatus();
        });
    }

    const apiSettingsForm = document.getElementById('api-settings-form');
    if (apiSettingsForm) {
        apiSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            state.apiUrl = document.getElementById('api-base-url').value.trim();
            localStorage.setItem('gt_api_url', state.apiUrl);
            await checkBackendStatus();
            closeModal('modal-api-settings');
            showToast('API Endpoint updated!', 'success');
            loadActiveViewData();
        });
    }

    // 18. Initial View Load
    loadActiveViewData();
});
=======

const titles = {
  dashboard: 'Dashboard',
  create: 'Create New Trip',
  trips: 'My Trips',
  itinerary: 'Itinerary Builder',
  cities: 'Explore Cities',
  budget: 'Trip Budget',
  share: 'Share Trip'
};

// create trip part

function createTrip() {
  const tripName = document.getElementById('tripName').value.trim();

  if (!tripName) {
    toast('Please enter a trip name');
    return;
  }

  document.getElementById('modal').classList.add('open');
}

// darshan's sidebar navigation part

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  document.getElementById('pageTitle').textContent = titles[id];

  document.querySelectorAll('.nav button').forEach(navBtn => navBtn.classList.remove('active'));
  if (btn) btn.classList.add('active');

  window.scrollTo(0, 0);
}
/* Toast notifications, share link, city search/filter created by Kartik */

function toast(msg) {
  const toastEl = document.getElementById('toast');
  toastEl.textContent = msg;
  toastEl.classList.add('show');
setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function copyLink() {
  navigator.clipboard?.writeText(document.getElementById('shareLink').value);
  toast('Public trip link copied!');
}

function filterCities() {
  const query = document.getElementById('citySearch').value.toLowerCase();

  document.querySelectorAll('#cityList .trip').forEach(cityCard => {
    const matches = cityCard.innerText.toLowerCase().includes(query);
    cityCard.style.display = matches ? 'block' : 'none';
  });
}
 main
