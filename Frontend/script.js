
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

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}