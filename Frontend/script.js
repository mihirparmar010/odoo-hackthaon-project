/* DARSHAN'S FILE — Sidebar navigation / page switching */

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  document.getElementById('pageTitle').textContent = titles[id];

  document.querySelectorAll('.nav button').forEach(navBtn => navBtn.classList.remove('active'));
  if (btn) btn.classList.add('active');

  window.scrollTo(0, 0);
}