# PICT Quantum Physics Virtual Lab

![PICT Quantum Physics Virtual Lab](https://img.shields.io/badge/Platform-Web-blue)
![Institution](https://img.shields.io/badge/Institution-PICT-green)

## Overview
The **PICT Quantum Physics Virtual Lab** is an interactive, web-based platform developed for the Department of Engineering Physics at the **Pune Institute of Computer Technology (PICT)**. This platform allows students to explore fundamental quantum mechanics and physics experiments through engaging simulations and dynamic visualizations.

## Experiments Included

The virtual lab currently features the following six experiments:

1. **Determination of Planck's Constant (`exp1`)**
   - Simulate the photoelectric effect and determine Planck's constant by analyzing stopping potential versus incident light frequency.
2. **Heisenberg Uncertainty Principle (`exp2`)**
   - Visualize the fundamental quantum limitation between the position and momentum of a particle.
3. **Determination of Energy Band Gap (`exp3`)**
   - Study semiconductor conductivity variation with temperature to determine the energy band gap of the material.
4. **Laser Beam Divergence (`exp4`)**
   - Observe how a laser beam spreads as it travels. Measure beam diameter at different distances and calculate the divergence angle.
5. **Measurement of the Hall Effect (`exp5`)**
   - Determine the Hall coefficient and charge carrier concentration in n-type Germanium by measuring the Hall voltage under varying current and magnetic field.
6. **Hair Thickness via Diffraction (`exp6`)**
   - Determine the thickness of a human hair using the diffraction pattern produced by a laser beam.

## Key Features
- **Interactive Simulations**: Manipulate variables using sliders and observe real-time changes in the simulation environment.
- **Data Visualization**: Integrated **Chart.js** for dynamic graphing, including linear regression trendlines for data analysis.
- **Automated Lab Reports**: Generate and download comprehensive PDF laboratory reports (via **jsPDF**) with embedded interactive charts and observation tables.
- **Consistent UI/UX**: Built with a standardized `vlabs-theme` to ensure a cohesive and modern experience across all experiments.
- **Responsive Design**: Accessible on various screen sizes for flexible learning.

## Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) (for interactive data visualization)
  - [jsPDF](https://parall.ax/products/jspdf) (for PDF report generation)

## Getting Started

Since this is a vanilla web application, no complex build tools or backend servers are required to run the virtual lab locally.

### Prerequisites
- A modern web browser (Google Chrome, Mozilla Firefox, Safari, or Edge).

### Installation & Usage
1. Clone the repository:
   ```bash
   git clone https://github.com/Shravani-Kale1209/physics-virtual-lab.git
   ```
2. Navigate into the project directory:
   ```bash
   cd physics-virtual-lab
   ```
3. Open `index.html` directly in your web browser:
   - Double-click the `index.html` file in your file explorer.
   - Or, serve the project using a simple local server (e.g., using Python or VS Code Live Server extension) for the best experience.

## About
Developed for Educational Demonstration for the **Department of Engineering Physics**, Pune Institute of Computer Technology (PICT).
