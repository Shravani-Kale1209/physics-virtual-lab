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

function searchExperiments() {
    let input = document.getElementById("searchBox").value.toLowerCase();
    let cards = document.querySelectorAll(".flip-card");

    cards.forEach(function(card) {
        let text = card.innerText.toLowerCase();

        if (text.includes(input)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}