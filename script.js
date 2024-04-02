function toggleNavbar() {
  var navbar = document.getElementById('navbar');
  navbar.classList.toggle('toggled');
}

function toggle() {
  var searchToggle = document.getElementById('search'),
  icon = document.getElementById('icon');
  icon.classList.toggle('popup');
  searchToggle.classList.toggle('popup');
}