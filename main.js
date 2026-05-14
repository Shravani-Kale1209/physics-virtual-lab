function searchExperiments() {
    // Get the search input value and convert to uppercase for case-insensitive comparison
    let input = document.getElementById('searchBox');
    let filter = input.value.toUpperCase();
    
    // Get the grid container and all the flip cards
    let grid = document.querySelector('.experiment-grid');
    let cards = grid.getElementsByClassName('flip-card');
    
    // Loop through all cards, and hide those who don't match the search query
    for (let i = 0; i < cards.length; i++) {
        // Look for the title inside the front of the card
        let title = cards[i].querySelector('.flip-card-front h3');
        if (title) {
            let txtValue = title.textContent || title.innerText;
            // If the title contains the search string, display it, otherwise hide it
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                cards[i].style.display = "";
            } else {
                cards[i].style.display = "none";
            }
        }
    }
}
