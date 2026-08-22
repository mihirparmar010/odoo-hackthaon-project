
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