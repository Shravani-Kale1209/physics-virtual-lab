# Physics Virtual Lab

## Overview
The **Physics Virtual Lab** is a web‑based collection of interactive simulations that demonstrate fundamental physics experiments. Each experiment is implemented as a self‑contained HTML page with supporting CSS and JavaScript, allowing users to explore concepts such as the photoelectric effect, Heisenberg uncertainty principle, and more.

## Features
- Clean, responsive UI built with Bootstrap 5 and a custom dark theme (`vlabs-theme.css`).
- Consistent styling across all experiments, including custom range sliders and button controls.
- Real‑time data visualization using Chart.js.
- Exportable results as PDF reports via jsPDF.
- Modular structure: each experiment resides in its own folder under `experiments/`.

## Project Structure
```
physics-virtual-lab/
├─ css/
│   └─ vlabs-theme.css          # Global theme and component styles
├─ experiments/
│   ├─ exp1/   index.html       # Photoelectric effect simulation
│   ├─ exp2/   index.html       # Heisenberg uncertainty principle
│   └─ …
├─ js/
│   └─ simulation.js           # Shared simulation utilities
├─ index.html                  # Landing page linking to all experiments
└─ README.md                   # Project documentation (this file)
```

## Prerequisites
- A modern web browser (Chrome, Edge, Firefox, Safari).
- No server is required; the project can be opened directly from the file system.

## Getting Started
1. Clone or download the repository.
2. Open `index.html` in a web browser.
3. Use the navigation links on the landing page to select an experiment.
4. Interact with the controls to explore the physics concepts. Results can be saved as PDF using the "Download Report" button.

## Adding a New Experiment
1. Create a new folder under `experiments/` (e.g., `exp7`).
2. Add an `index.html` file that follows the existing structure: include the common CSS (`../../css/vlabs-theme.css`) and JavaScript (`../../js/simulation.js`).
3. Define the UI controls and simulation logic specific to the new experiment.
4. Update `index.html` (the landing page) to include a link to the new experiment.

## Development Guidelines
- Follow the existing naming conventions for CSS classes (`custom-dark-slider`, `btn-slider-ctrl`, etc.).
- Keep JavaScript modular; place shared utilities in `js/simulation.js`.
- Write clear comments where complex physics calculations are performed.
- Ensure all new pages remain responsive and accessible.

## Contributing
Contributions are welcome. To contribute:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Make your changes, ensuring the UI matches the established theme.
4. Test the experiments in multiple browsers.
5. Submit a pull request with a concise description of the changes.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements
- Bootstrap – for responsive layout components.
- Chart.js – for charting and data visualization.
- jsPDF – for PDF generation capabilities.
- MathJax – for rendering mathematical expressions.
- The open‑source community for the many utilities leveraged in this project.
