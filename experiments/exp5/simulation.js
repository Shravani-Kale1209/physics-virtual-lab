const currentSlider = document.getElementById('current-slider');
const magneticSlider = document.getElementById('magnetic-slider');
const bMeter = document.getElementById('b-meter');
const vMeter = document.getElementById('v-meter');
const currentLabel = document.getElementById('current-label');
const magneticLabel = document.getElementById('magnetic-label');
const obsBody = document.getElementById('obs-body');
const addBtn = document.getElementById('add-reading');
const clearBtn = document.getElementById('clear-data');
const canvas = document.getElementById('hall-canvas');
const ctx = canvas.getContext('2d');

let observations = [];
let particles = [];

// Physical Constants for n-type Germanium
const elementalCharge = 1.602e-19; // Elemental charge in Coulombs
const sampleThickness = 1e-3; // Thickness in meters (1 millimeter)
const carrierConcentration = 5e20; // Number of charge carriers per cubic meter

/* Hall Effect Chart (VH vs I*B) */
const chartCtx = document.getElementById('hallChart').getContext('2d');
const hallChart = new Chart(chartCtx, {
    data: {
        datasets: [
            {
                type: 'scatter',
                label: 'Recorded Readings',
                data: [],
                backgroundColor: 'rgba(220, 53, 69, 0.85)',
                pointRadius: 7,
                pointHoverRadius: 9,
                order: 2
            },
            {
                type: 'line',
                label: 'Linear Fit (Trend)',
                data: [],
                borderColor: 'rgba(13, 110, 253, 0.75)',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0,
                order: 1
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } },
            tooltip: {
                callbacks: {
                    label: ctx => ctx.dataset.label === 'Recorded Readings'
                        ? `V_H = ${ctx.parsed.y.toFixed(2)} mV @ I*B = ${ctx.parsed.x.toFixed(2)} mA·T`
                        : null
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'I × B (mA·T)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            },
            y: {
                title: { display: true, text: 'Hall Voltage V_H (mV)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

function updateChart() {
    if (observations.length === 0) {
        hallChart.data.datasets[0].data = [];
        hallChart.data.datasets[1].data = [];
        hallChart.update();
        return;
    }

    // Scatter points
    hallChart.data.datasets[0].data = observations.map(o => ({
        x: parseFloat(o.i) * parseFloat(o.b),
        y: parseFloat(o.vh)
    }));

    // Linear regression for trendline
    const n = observations.length;
    if (n >= 2) {
        const xs = observations.map(o => parseFloat(o.i) * parseFloat(o.b));
        const ys = observations.map(o => parseFloat(o.vh));
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
        const sumX2 = xs.reduce((s, x) => s + x * x, 0);
        const den = n * sumX2 - sumX * sumX;
        
        if (den !== 0) {
            const slope = (n * sumXY - sumX * sumY) / den;
            const intercept = (sumY - slope * sumX) / n;
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            hallChart.data.datasets[1].data = [
                { x: minX, y: slope * minX + intercept },
                { x: maxX, y: slope * maxX + intercept }
            ];
        }
    } else {
        hallChart.data.datasets[1].data = [];
    }
    
    hallChart.update();
}



// Animation Loop for Fluid Electron Flow
function animateElectrons() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const current_Milliamperes = parseFloat(currentSlider.value);
    const magneticField_Tesla = parseFloat(magneticSlider.value);

    // Draw Germanium Slab
    ctx.fillStyle = '#e9ecef';
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 2;
    ctx.fillRect(40, 40, 270, 100);
    ctx.strokeRect(40, 40, 270, 100);

    // Draw Magnetic Field Indicators
    if (magneticField_Tesla > 0) {
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1;
        const spacing = 40;
        for (let x = 60; x <= 290; x += spacing) {
            for (let y = 60; y <= 120; y += spacing) {
                const size = 5 * (magneticField_Tesla / 0.5);
                ctx.beginPath();
                ctx.moveTo(x - size, y - size);
                ctx.lineTo(x + size, y + size);
                ctx.moveTo(x + size, y - size);
                ctx.lineTo(x - size, y + size);
                ctx.stroke();
            }
        }
    }

    // Particle Generator
    if (current_Milliamperes > 0 && Math.random() < (current_Milliamperes * 0.05)) {
        particles.push({
            x: 40, 
            y: 90 + (Math.random() * 60 - 30), 
            vx: Math.max(1, current_Milliamperes * 0.2), 
            vy: 0
        });
    }

    // Particle Physics and Rendering
    ctx.fillStyle = '#212529';
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx;
        
        // Lorentz Force simulation
        p.vy = magneticField_Tesla * current_Milliamperes * 0.015;
        p.y += p.vy;

        // Boundary collision
        if (p.y > 135) p.y = 135; 
        if (p.y < 45) p.y = 45;

        // Render particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cleanup particles
    particles = particles.filter(p => p.x < 310);

    requestAnimationFrame(animateElectrons);
}

// Interface Update Logic
function updateSimulation() {
    const current_Milliamperes = parseFloat(currentSlider.value);
    const magneticField_Tesla = parseFloat(magneticSlider.value);

    currentLabel.innerText = `${current_Milliamperes.toFixed(1)} Milliamperes`;
    magneticLabel.innerText = `${magneticField_Tesla.toFixed(2)} Tesla`;
    bMeter.innerText = magneticField_Tesla.toFixed(2);

    const current_Amperes = current_Milliamperes * 1e-3; 

    // Theoretical Hall Voltage
    let theoretical_VH_Volts = 0;
    if (current_Amperes > 0 && magneticField_Tesla > 0) {
        theoretical_VH_Volts = (current_Amperes * magneticField_Tesla) / (carrierConcentration * elementalCharge * sampleThickness);
    }

    let vh_millivolts = theoretical_VH_Volts * 1000;
    
    if (vh_millivolts > 0) {
        const structuralNoise = (Math.random() - 0.5) * 0.4; 
        vh_millivolts += structuralNoise;
    }

    vh_millivolts = Math.max(vh_millivolts, 0); 
    vMeter.innerText = vh_millivolts.toFixed(2);
}

function addRow() {
    observations.push({ 
        i: parseFloat(currentSlider.value).toFixed(1), 
        b: parseFloat(magneticSlider.value).toFixed(2),
        vh: vMeter.innerText 
    });
    renderTable();
}

function renderTable() {
    obsBody.innerHTML = observations.map((obs, index) => `
        <tr><td>${index + 1}</td><td>${obs.i}</td><td>${obs.b}</td><td>${obs.vh}</td></tr>
    `).join('');
    const hint = document.getElementById("empty-hint");
    if (hint) hint.style.display = observations.length ? "none" : "block";
    updateChart();
}

function formatScientificNotation(value, unit) {
    const exp = value.toExponential(4);
    const [mantissa, exponent] = exp.split('e');
    const power = exponent.replace('+', '');
    return `${mantissa} \\times 10^{${power}} \\text{ ${unit}}`;
}

function calculateHallEffect() {
    if (observations.length < 3) {
        alert("Please record a minimum of 3 observations to calculate an accurate statistical average.");
        return;
    }

    let totalHallCoefficient = 0;
    let validReadings = 0;

    observations.forEach(obs => {
        const I_Amperes = parseFloat(obs.i) * 1e-3;
        const B_Tesla = parseFloat(obs.b);
        const VH_Volts = parseFloat(obs.vh) * 1e-3;

        if (I_Amperes > 0 && B_Tesla > 0) {
            const currentCoefficient = (VH_Volts * sampleThickness) / (I_Amperes * B_Tesla);
            totalHallCoefficient += currentCoefficient;
            validReadings++;
        }
    });

    if (validReadings === 0) {
        alert("Please ensure current and magnetic field values are strictly greater than zero.");
        return;
    }

    const averageCoefficient = totalHallCoefficient / validReadings;
    const experimental_Concentration = 1 / (averageCoefficient * elementalCharge);
    
    const formattedCoefficient = formatScientificNotation(averageCoefficient, "m^3/C");
    const formattedConcentration = formatScientificNotation(experimental_Concentration, "m^{-3}");

    document.getElementById('calculation-output').innerHTML = `
        <hr class="my-5 border-dark">
        <div class="card border-dark rounded-0 p-4 bg-white">
            <h3 class="text-uppercase fw-bold border-bottom pb-2 mb-4">Final Laboratory Report</h3>
            <div class="row">
                <div class="col-md-6 border-end">
                    <h5 class="fw-bold">Governing Formulas</h5>
                    <p class="fs-5 mt-3">$$R_H = \\frac{V_H \\cdot t}{I \\cdot B}$$</p>
                    <p class="fs-5">$$n = \\frac{1}{R_H \\cdot e}$$</p>
                    <ul class="text-muted small mt-4">
                        <li>$t = 1.0 \\times 10^{-3} \\text{ Meters}$ (Sample Thickness)</li>
                        <li>$e = 1.602 \\times 10^{-19} \\text{ Coulombs}$</li>
                    </ul>
                </div>
                <div class="col-md-6 ps-4">
                    <div class="bg-light border border-dark p-4 text-center">
                        <h5 class="text-uppercase fw-bold mb-4">Experimental Results</h5>
                        <p class="fs-4 mb-3 fw-bold">$R_H = ${formattedCoefficient}$</p>
                        <p class="fs-4 mb-0 fw-bold">$n = ${formattedConcentration}$</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 p-4 border border-secondary bg-light">
                <h6 class="text-uppercase fw-bold mb-2">Conclusion</h6>
                <p class="mb-0">Based on the recorded parameters and the measured Hall Voltage, the average Hall Coefficient ($R_H$) of the semiconductor sample was determined to be $${formattedCoefficient}$. Using this coefficient, the charge carrier concentration ($n$) is evaluated at $${formattedConcentration}$, which aligns with the theoretical expectations for the provided n-type Germanium sample.</p>
            </div>
        </div>
    `;

    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

// Event Listeners for Slider Elements
currentSlider.addEventListener('input', updateSimulation);
magneticSlider.addEventListener('input', updateSimulation);

// Logic for Increment and Decrement Buttons
document.getElementById('current-decrease').addEventListener('click', () => {
    let currentValue = parseFloat(currentSlider.value);
    const stepValue = parseFloat(currentSlider.step);
    if (currentValue > parseFloat(currentSlider.min)) {
        currentSlider.value = (currentValue - stepValue).toFixed(1);
        updateSimulation();
    }
});

document.getElementById('current-increase').addEventListener('click', () => {
    let currentValue = parseFloat(currentSlider.value);
    const stepValue = parseFloat(currentSlider.step);
    if (currentValue < parseFloat(currentSlider.max)) {
        currentSlider.value = (currentValue + stepValue).toFixed(1);
        updateSimulation();
    }
});

document.getElementById('magnetic-decrease').addEventListener('click', () => {
    let currentValue = parseFloat(magneticSlider.value);
    const stepValue = parseFloat(magneticSlider.step);
    if (currentValue > parseFloat(magneticSlider.min)) {
        magneticSlider.value = (currentValue - stepValue).toFixed(2);
        updateSimulation();
    }
});

document.getElementById('magnetic-increase').addEventListener('click', () => {
    let currentValue = parseFloat(magneticSlider.value);
    const stepValue = parseFloat(magneticSlider.step);
    if (currentValue < parseFloat(magneticSlider.max)) {
        magneticSlider.value = (currentValue + stepValue).toFixed(2);
        updateSimulation();
    }
});

// User Interface Action Buttons
addBtn.addEventListener('click', addRow);
clearBtn.addEventListener('click', () => {
    observations = [];
    renderTable();
    document.getElementById('calculation-output').innerHTML = "";
});

// Portable Document Format Generation
document.getElementById('download-pdf').addEventListener('click', async function () {
    const { jsPDF } = window.jspdf;
    const documentInstance = new jsPDF('p', 'mm', 'a4');
    const pageWidth = documentInstance.internal.pageSize.getWidth();

    documentInstance.setFont("helvetica", "bold").setFontSize(16);
    documentInstance.text("PICT Quantum Physics Virtual Lab", pageWidth / 2, 15, { align: 'center' });
    documentInstance.setFontSize(14).setFont("helvetica", "normal");
    documentInstance.text("Measurement of Hall Effect - Laboratory Report", pageWidth / 2, 22, { align: 'center' });
    documentInstance.line(20, 25, pageWidth - 20, 25);

    documentInstance.setFont("helvetica", "normal").setFontSize(11);
    documentInstance.text("Student Name: ____________________________________", 20, 35);
    documentInstance.text("Registration Number: __________________", 120, 35);
    documentInstance.text("Date of Experiment: ____________________", 20, 45);

    documentInstance.setFont("helvetica", "bold").text("1. Experimental Setup Schematic:", 20, 60);
    const circuitArea = document.querySelector('.circuit-container');
    const circuitCanvas = await html2canvas(circuitArea, { scale: 2 });
    documentInstance.addImage(circuitCanvas.toDataURL('image/png'), 'PNG', 40, 65, 130, 55);

    documentInstance.text("2. Recorded Observations:", 20, 135);
    documentInstance.autoTable({
        html: '#obs-table',
        startY: 140,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] },
        styles: { halign: 'center', font: 'helvetica' },
        margin: { left: 20, right: 20 }
    });

    let currentY = documentInstance.lastAutoTable.finalY + 15;
    documentInstance.setFont("helvetica", "bold").text("3. Analytical Calculations:", 20, currentY);
    documentInstance.setFont("helvetica", "normal");
    documentInstance.text("Hall Coefficient Formula: R_H = (V_H * t) / (I * B)", 20, currentY + 10);
    documentInstance.text("Carrier Concentration Formula: n = 1 / (R_H * e)", 20, currentY + 18);

    currentY += 35;
    documentInstance.text("Calculation Space:", 20, currentY);
    documentInstance.text("_________________________________________________________________________________", 20, currentY + 10);
    documentInstance.text("_________________________________________________________________________________", 20, currentY + 20);

    currentY += 40;
    documentInstance.setFont("helvetica", "bold").text("4. Final Deductions:", 20, currentY);
    documentInstance.setFont("helvetica", "normal");
    documentInstance.text("Determined Hall Coefficient (R_H): ____________________ Cubic Meters per Coulomb", 20, currentY + 10);
    documentInstance.text("Determined Carrier Concentration (n): ____________________ per Cubic Meter", 20, currentY + 20);

    documentInstance.save("Hall_Effect_Laboratory_Report.pdf");
});

// Initialization
updateSimulation();
requestAnimationFrame(animateElectrons);