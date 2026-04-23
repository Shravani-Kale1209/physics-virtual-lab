/* =====================================================
   Exp 3: Determination of Energy Band Gap
   Method: Resistance vs. Temperature (Ge semiconductor)
   ln(R) = Eg/(2kT) + C   →  slope = Eg/(2k)
   k (Boltzmann) = 8.617 × 10⁻⁵ eV/K
   ===================================================== */

const k_eV = 8.617e-5;   // Boltzmann constant [eV/K]
const Eg_true = 0.67;     // Ge band gap [eV] (used for simulation)

/* DOM Elements */
const tempSlider  = document.getElementById('temp-slider');
const tempBadge   = document.getElementById('temp-badge');
const tempDisplay = document.getElementById('temp-display');
const rMeter      = document.getElementById('r-meter');
const thermFill   = document.getElementById('therm-fill');
const heatPlate   = document.getElementById('heat-plate');
const chipBody    = document.getElementById('chip-body');
const obsBody     = document.getElementById('obs-body');
const addBtn      = document.getElementById('add-reading');
const clearBtn    = document.getElementById('clear-data');

let observations = [];

/* ── Physics ─────────────────────────────────────── */
/**
 * Simulates resistance of Ge semiconductor at temperature T (K).
 * R ∝ exp(Eg / 2kT)  →  R = R0 * exp(Eg / 2kT)
 * R0 is chosen so R ≈ 100 kΩ at 300 K.
 */
function calcResistance(T) {
    const R0 = 100 * Math.exp(-Eg_true / (2 * k_eV * 300)); // normalise to 100 kΩ at 300 K
    let R = R0 * Math.exp(Eg_true / (2 * k_eV * T));
    // Add small realistic noise ±0.5%
    R *= 1 + (Math.random() - 0.5) * 0.01;
    return R; // kΩ
}

/* ── Update Simulation Visuals ───────────────────── */
function updateSimulation() {
    const T = parseInt(tempSlider.value);

    // Labels
    tempBadge.innerText   = T;
    tempDisplay.innerText = `T = ${T} K  (${T - 273}°C)`;

    // Thermometer fill (300 K → 0%, 500 K → 100%)
    const fillPct = ((T - 300) / 200) * 100;
    thermFill.style.height = fillPct + '%';

    // Resistance
    const R = calcResistance(T);
    rMeter.innerText = R.toFixed(2);

    // Heat plate glow
    const intensity = (T - 300) / 200;          // 0..1
    const r = Math.round(100 + intensity * 155); // 100–255
    const g = Math.round(80  - intensity * 70);  // 80–10
    const b = 20;
    heatPlate.style.background = `rgb(${r},${g},${b})`;
    heatPlate.style.boxShadow  = `0 0 ${8 + intensity * 18}px rgba(${r},${g},${b},0.65)`;

    // Chip color tint
    const chipR = Math.round(45 + intensity * 80);
    chipBody.style.background = `linear-gradient(135deg, rgb(${chipR+10},${54-intensity*30},${54-intensity*30}), rgb(99,110,114))`;
}

/* ── Table Rendering ─────────────────────────────── */
function renderTable() {
    obsBody.innerHTML = observations.map((obs, i) => `
        <tr>
            <td class="fw-bold text-muted">${i + 1}</td>
            <td>${obs.T}</td>
            <td>${obs.R.toFixed(2)}</td>
            <td>${(1 / obs.T).toExponential(3)}</td>
            <td>${Math.log(obs.R).toFixed(4)}</td>
        </tr>
    `).join('');
}

function addRow() {
    const T = parseInt(tempSlider.value);
    const R = calcResistance(T);

    // Prevent duplicate temperatures
    if (observations.some(o => o.T === T)) {
        alert(`A reading at ${T} K already exists. Please select a different temperature.`);
        return;
    }
    if (observations.length >= 10) {
        alert("Maximum 10 readings allowed. Clear the table to restart.");
        return;
    }

    observations.push({ T, R });
    observations.sort((a, b) => a.T - b.T); // keep sorted by T
    renderTable();
    updateChart();
}

/* ── Chart.js Setup ──────────────────────────────── */
const ctx = document.getElementById('bandGapChart').getContext('2d');
const bandGapChart = new Chart(ctx, {
    type: 'scatter',
    data: {
        datasets: [
            {
                label: 'Observed: ln(R) vs 1/T',
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13,110,253,0.8)',
                pointRadius: 6,
                pointHoverRadius: 8,
                data: []
            },
            {
                label: 'Best Fit Line',
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                type: 'line',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0,
                data: []
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
            x: {
                title: { display: true, text: '1/T  (K⁻¹)', font: { size: 13 } },
                ticks: { callback: v => v.toExponential(1) }
            },
            y: {
                title: { display: true, text: 'ln(R)', font: { size: 13 } }
            }
        },
        plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 14 } },
            tooltip: {
                callbacks: {
                    label: item => `1/T = ${item.parsed.x.toExponential(3)}, ln(R) = ${item.parsed.y.toFixed(4)}`
                }
            }
        }
    }
});

function updateChart() {
    if (observations.length === 0) {
        bandGapChart.data.datasets[0].data = [];
        bandGapChart.data.datasets[1].data = [];
        bandGapChart.update();
        return;
    }

    const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
    bandGapChart.data.datasets[0].data = pts;

    // Draw best-fit line if ≥2 points
    if (observations.length >= 2) {
        const { slope, intercept } = linearRegression(pts);
        const xs = pts.map(p => p.x);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        bandGapChart.data.datasets[1].data = [
            { x: xMin, y: slope * xMin + intercept },
            { x: xMax, y: slope * xMax + intercept }
        ];
    }

    bandGapChart.update();
}

/* ── Linear Regression (slope, intercept) ─────── */
function linearRegression(pts) {
    const n = pts.length;
    const sumX  = pts.reduce((s, p) => s + p.x, 0);
    const sumY  = pts.reduce((s, p) => s + p.y, 0);
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

/* ── Calculate Band Gap ─────────────────────────── */
function calculateBandGap() {
    if (observations.length < 3) {
        alert("Please record at least 3 readings at different temperatures!");
        return;
    }

    const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
    const { slope } = linearRegression(pts);

    // Eg = 2 × k × slope  (k in eV/K, slope in K units)
    const Eg_calc = 2 * k_eV * slope;
    const error = Math.abs((Eg_calc - Eg_true) / Eg_true * 100);

    const outputDiv = document.getElementById('calculation-output');
    outputDiv.innerHTML = `
        <hr class="my-4">
        <div class="card shadow p-4 bg-white rounded">
            <h3 class="text-primary border-bottom pb-2 mb-4">Final Lab Report</h3>
            <div class="row">
                <div class="col-md-6">
                    <h5>Governing Formula</h5>
                    <p class="fs-5">$$ E_g = 2k \\times \\text{slope of } \\ln(R) \\text{ vs } \\frac{1}{T} $$</p>
                    <ul class="text-muted small">
                        <li>$k = 8.617 \\times 10^{-5}$ eV/K (Boltzmann constant)</li>
                        <li>Slope is obtained from linear regression of the graph</li>
                    </ul>
                    <h5 class="mt-3">Regression Results</h5>
                    <p class="small text-muted mb-1">Number of readings: <strong>${observations.length}</strong></p>
                    <p class="small text-muted mb-1">Slope = <strong>${slope.toFixed(1)} K</strong></p>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-info py-4 text-center">
                        <h5 class="alert-heading">Calculated Energy Band Gap</h5>
                        <p class="fs-2 mb-0 fw-bold">$E_g = ${Eg_calc.toFixed(3)}$ eV</p>
                    </div>
                    <div class="alert alert-secondary text-center py-2 mt-2">
                        <small>Standard value (Ge): <strong>0.67 eV</strong></small><br>
                        <small>Percentage Error: <strong>${error.toFixed(1)}%</strong></small>
                    </div>
                </div>
            </div>
            <div class="mt-4 p-3 bg-light rounded">
                <h5>Conclusion</h5>
                <p>
                    From the graph of $\\ln(R)$ vs $\\dfrac{1}{T}$, the slope was found to be
                    <strong>${slope.toFixed(1)} K</strong>. Using the relation $E_g = 2k \\times \\text{slope}$,
                    the energy band gap of the Germanium semiconductor was calculated to be
                    <strong>${Eg_calc.toFixed(3)} eV</strong>. The standard value for Ge is
                    <strong>0.67 eV</strong>, giving a percentage error of <strong>${error.toFixed(1)}%</strong>.
                    This confirms that resistance of a semiconductor decreases with increase in temperature,
                    consistent with the exponential conductivity model.
                </p>
            </div>
        </div>
    `;

    if (window.MathJax) MathJax.typesetPromise();
    outputDiv.scrollIntoView({ behavior: 'smooth' });
}

/* ── PDF Generation ──────────────────────────────── */
function downloadPDF() {
    if (observations.length === 0) {
        alert("No data to download. Please record some observations first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text("PICT Physics Virtual Lab", pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont("helvetica", "normal");
    doc.text("Determination of Energy Band Gap - Lab Report", pageWidth / 2, 22, { align: 'center' });
    doc.line(20, 25, pageWidth - 20, 25);

    // Student info
    doc.setFontSize(11);
    doc.text("Name: ____________________________________", 20, 35);
    doc.text("Roll No: __________________", 130, 35);
    doc.text("Date: ____________________", 20, 43);

    // Theory note
    doc.setFontSize(10).setTextColor(100);
    doc.text("Formula: Eg = 2 x k x slope of ln(R) vs 1/T   (k = 8.617 x 10^-5 eV/K)", 20, 55);
    doc.setTextColor(0);

    // Table
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Observations:", 20, 65);

    const tableColumn = ["#", "T (K)", "R (kΩ)", "1/T (K⁻¹)", "ln(R)"];
    const tableRows = observations.map((obs, i) => [
        i + 1,
        obs.T,
        obs.R.toFixed(2),
        (1 / obs.T).toExponential(3),
        Math.log(obs.R).toFixed(4)
    ]);

    doc.autoTable({
        startY: 70,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    let y = doc.lastAutoTable.finalY + 12;

    // Calculation section
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(0);
    doc.text("Formula & Calculations:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text("Eg = 2 x k x slope", 20, y + 8);
    doc.text("___________________________________________", 20, y + 18);

    y += 30;
    doc.setFont("helvetica", "bold");
    doc.text("Result:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text("Calculated Energy Band Gap (Eg): _____________ eV", 20, y + 8);
    doc.text("Standard Value of Eg (Ge): 0.67 eV", 20, y + 16);

    y += 30;
    doc.setFont("helvetica", "bold");
    doc.text("Conclusion: _______________________________________________", 20, y);

    // If we have enough data, compute and print result
    if (observations.length >= 3) {
        const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
        const { slope } = linearRegression(pts);
        const Eg_calc = 2 * k_eV * slope;
        doc.setTextColor(30, 80, 160);
        doc.text(`[Auto-calculated] Slope = ${slope.toFixed(1)} K,  Eg = ${Eg_calc.toFixed(3)} eV`, 20, y + 10);
    }

    doc.save("Energy_BandGap_Lab_Report.pdf");
}

/* ── Event Listeners ──────────────────────────────── */
tempSlider.addEventListener('input', updateSimulation);
addBtn.addEventListener('click', addRow);
clearBtn.addEventListener('click', () => {
    observations = [];
    renderTable();
    updateChart();
    document.getElementById('calculation-output').innerHTML = '';
});
document.getElementById('download-pdf').addEventListener('click', downloadPDF);

/* ── Init ─────────────────────────────────────────── */
updateSimulation();
