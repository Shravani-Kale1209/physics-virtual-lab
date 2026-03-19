// Function to load components like Navbar/Footer
function loadNavbar() {
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (!navPlaceholder) return;

    // Detect if we are in a subfolder or root to adjust fetch path
    const pathPrefix = window.location.pathname.includes('/experiments/') ? '../../' : '';

    fetch(pathPrefix + 'components/navbar.html')
        .then(response => response.text())
        .then(data => {
            navPlaceholder.innerHTML = data;
        });
}

window.onload = loadNavbar;