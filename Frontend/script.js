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