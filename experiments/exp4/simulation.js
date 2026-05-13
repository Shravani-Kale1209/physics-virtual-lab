/**
 * LASER BEAM DIVERGENCE SIMULATION
 * Physics Virtual Lab — PICT
 *
 * Physics model:
 *   Linear:  D(x) = D0 + θ·x
 *   Gaussian: w(z) = w0 · sqrt(1 + (z/zR)²)
 *   where zR = π·w0²/λ  (Rayleigh range)
 *
 * Rendering:
 *   Gaussian intensity profile using radial gradients + blur
 *   requestAnimationFrame loop with subtle noise for realism
 */

"use strict";

// ─── CANVAS & CONTEXT ───────────────────────────────────────────────────────
const canvas = document.getElementById("beamCanvas");
const ctx = canvas.getContext("2d");

// ─── CONTROLS ───────────────────────────────────────────────────────────────
const distanceSlider = document.getElementById("distance-slider");
const thetaSlider = document.getElementById("theta-slider");
const waistSlider = document.getElementById("waist-slider");
const lambdaSelect = document.getElementById("lambda-select");

const distanceDisplay = document.getElementById("distance-display");
const diameterDisplay = document.getElementById("diameter-display");
const divergenceDisplay = document.getElementById("divergence-live");

const obsBody = document.getElementById("obs-body");

// ─── STATE ───────────────────────────────────────────────────────────────────
let observations = [];
let animFrameId = null;
let noiseOffset = 0;  // for subtle beam flicker

// ─── DIVERGENCE CHART ────────────────────────────────────────────────────────
const divCtx = document.getElementById('divergenceChart').getContext('2d');
const divergenceChart = new Chart(divCtx, {
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
                        ? `D = ${ctx.parsed.y.toFixed(4)} mm  @ ${ctx.parsed.x} cm`
                        : null
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Distance (cm)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            },
            y: {
                title: { display: true, text: 'Beam Diameter (mm)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

function updateChart() {
    if (observations.length === 0) {
        divergenceChart.data.datasets[0].data = [];
        divergenceChart.data.datasets[1].data = [];
        divergenceChart.update();
        return;
    }

    // Scatter points
    divergenceChart.data.datasets[0].data = observations.map(o => ({ x: parseFloat(o.d), y: parseFloat(o.dia) }));

    // Linear regression for trendline
    const n = observations.length;
    if (n >= 2) {
        const xs = observations.map(o => parseFloat(o.d));
        const ys = observations.map(o => parseFloat(o.dia));
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
        const sumX2 = xs.reduce((s, x) => s + x * x, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        divergenceChart.data.datasets[1].data = [
            { x: minX, y: slope * minX + intercept },
            { x: maxX, y: slope * maxX + intercept }
        ];
    } else {
        divergenceChart.data.datasets[1].data = [];
    }

    divergenceChart.update();
}

// Wavelength → colour map (nm)
const WAVELENGTH_COLORS = {
    405: { r: 180, g: 0, b: 255, name: "Violet 405 nm" },
    450: { r: 50, g: 50, b: 255, name: "Blue 450 nm" },
    532: { r: 0, g: 220, b: 60, name: "Green 532 nm" },
    633: { r: 255, g: 30, b: 0, name: "Red 633 nm" },
    780: { r: 220, g: 0, b: 40, name: "IR 780 nm" },
};

// ─── PHYSICS ─────────────────────────────────────────────────────────────────
/**
 * Gaussian beam half-width at position z (cm → mm conversion handled externally)
 * @param {number} w0   beam waist radius (mm)
 * @param {number} z    distance from waist (cm)
 * @param {number} lambda wavelength (nm)
 * @returns {number} w(z) in mm
 */
function gaussianHalfWidth(w0, z, lambda) {
    const zCm = z;                           // distance in cm
    const zMm = zCm * 10;                    // convert to mm
    const lMm = lambda * 1e-6;               // nm → mm
    const zR = (Math.PI * w0 * w0) / lMm;  // Rayleigh range (mm)
    return w0 * Math.sqrt(1 + Math.pow(zMm / zR, 2));
}

/**
 * Linear approximation: D(x) = D0 + θ·x
 */
function linearDiameter(D0, theta, x) {
    return D0 + theta * x;
}

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────

/** Convert (r,g,b,a) to css string */
function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
}

/**
 * Draw a single Gaussian beam slice at x with half-width hw (canvas pixels)
 * Uses a radial gradient to simulate Gaussian intensity profile.
 */
function drawBeamSlice(x, centerY, hw, color, alpha) {
    const grad = ctx.createRadialGradient(x, centerY, 0, x, centerY, hw * 2.5);
    grad.addColorStop(0, rgba(255, 255, 255, alpha * 0.95));       // bright core
    grad.addColorStop(0.15, rgba(color.r, color.g, color.b, alpha * 0.85));
    grad.addColorStop(0.45, rgba(color.r, color.g, color.b, alpha * 0.4));
    grad.addColorStop(0.75, rgba(color.r, color.g, color.b, alpha * 0.12));
    grad.addColorStop(1, rgba(color.r, color.g, color.b, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(x - hw * 2.5, centerY - hw * 2.5, hw * 5, hw * 5);
}

/**
 * Draw bench ruler ticks along the bottom of the canvas
 */
function drawRuler(maxDistCm, laserX, detectorX) {
    const rulerY = canvas.height - 22;
    const totalPx = detectorX - laserX;

    ctx.save();
    ctx.strokeStyle = "#5a7a8a";
    ctx.fillStyle = "#8ab";
    ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "center";

    // Baseline
    ctx.beginPath();
    ctx.moveTo(laserX, rulerY);
    ctx.lineTo(detectorX + 20, rulerY);
    ctx.lineWidth = 1;
    ctx.stroke();

    const step = maxDistCm <= 100 ? 10 : 20;
    for (let d = 0; d <= maxDistCm; d += step) {
        const px = laserX + (d / maxDistCm) * totalPx;
        const tickH = (d % 50 === 0) ? 8 : 4;
        ctx.beginPath();
        ctx.moveTo(px, rulerY);
        ctx.lineTo(px, rulerY - tickH);
        ctx.stroke();
        if (d % 50 === 0) {
            ctx.fillText(d + " cm", px, rulerY + 12);
        }
    }
    ctx.restore();
}

/**
 * Draw the laser source housing
 */
function drawLaserSource(x, y, color) {
    ctx.save();

    // Body
    const grad = ctx.createLinearGradient(x - 38, y - 14, x - 38, y + 14);
    grad.addColorStop(0, "#4a5568");
    grad.addColorStop(0.5, "#718096");
    grad.addColorStop(1, "#2d3748");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x - 58, y - 14, 52, 28, 5);
    ctx.fill();

    // Aperture ring
    ctx.strokeStyle = "#a0aec0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 8, y, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing aperture
    const apGrad = ctx.createRadialGradient(x - 8, y, 0, x - 8, y, 7);
    apGrad.addColorStop(0, rgba(color.r, color.g, color.b, 1));
    apGrad.addColorStop(1, rgba(color.r, color.g, color.b, 0.1));
    ctx.fillStyle = apGrad;
    ctx.beginPath();
    ctx.arc(x - 8, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("LASER", x - 34, y + 24);

    ctx.restore();
}

/**
 * Draw the detector screen / card
 */
function drawDetector(x, centerY, halfWidth, color, diameter) {
    ctx.save();

    // Screen panel
    const sGrad = ctx.createLinearGradient(x, 0, x + 14, 0);
    sGrad.addColorStop(0, "#1a202c");
    sGrad.addColorStop(1, "#2d3748");
    ctx.fillStyle = sGrad;
    ctx.fillRect(x, centerY - 60, 14, 120);

    // Highlight edge
    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, centerY - 60, 14, 120);

    // Spot on detector — simulate Gaussian blob
    const spotR = Math.max(3, Math.min(halfWidth * 1.1, 55));

    // Glow halo
    const haloGrad = ctx.createRadialGradient(x + 7, centerY, 0, x + 7, centerY, spotR * 2.2);
    haloGrad.addColorStop(0, rgba(color.r, color.g, color.b, 0.6));
    haloGrad.addColorStop(0.4, rgba(color.r, color.g, color.b, 0.25));
    haloGrad.addColorStop(1, rgba(color.r, color.g, color.b, 0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(x + 7, centerY, spotR * 2.2, spotR * 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Core spot
    const spotGrad = ctx.createRadialGradient(x + 7, centerY, 0, x + 7, centerY, spotR);
    spotGrad.addColorStop(0, rgba(255, 255, 255, 0.95));
    spotGrad.addColorStop(0.3, rgba(color.r, color.g, color.b, 0.9));
    spotGrad.addColorStop(0.8, rgba(color.r, color.g, color.b, 0.4));
    spotGrad.addColorStop(1, rgba(color.r, color.g, color.b, 0));
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(x + 7, centerY, spotR, spotR, 0, 0, Math.PI * 2);
    ctx.fill();

    // Diameter annotation
    ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.7);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x + 20, centerY - spotR);
    ctx.lineTo(x + 32, centerY - spotR);
    ctx.moveTo(x + 20, centerY + spotR);
    ctx.lineTo(x + 32, centerY + spotR);
    ctx.moveTo(x + 26, centerY - spotR);
    ctx.lineTo(x + 26, centerY + spotR);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = rgba(color.r, color.g, color.b, 0.9);
    ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(diameter.toFixed(2) + " mm", x + 34, centerY + 4);

    // "DETECTOR" label
    ctx.save();
    ctx.translate(x + 7, centerY + 70);
    ctx.fillStyle = "#8ab";
    ctx.font = "8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("DETECTOR", 0, 0);
    ctx.restore();

    ctx.restore();
}

// ─── MAIN DRAW ────────────────────────────────────────────────────────────────
function drawBeam() {
    const W = canvas.width;
    const H = canvas.height;
    const centerY = H / 2;

    // Read sliders
    const distanceCm = parseFloat(distanceSlider.value);
    const theta = parseFloat(thetaSlider.value);       // mrad/cm scale
    const w0mm = parseFloat(waistSlider.value);       // beam waist mm
    const lambda = parseInt(lambdaSelect.value);        // nm
    const color = WAVELENGTH_COLORS[lambda];

    // Gaussian beam diameter at this distance
    const wz = gaussianHalfWidth(w0mm / 2, distanceCm, lambda);   // half-width (mm)
    const diameterMm = 2 * wz;

    // Canvas geometry
    const laserX = 60;
    const maxDistCm = parseFloat(distanceSlider.max);
    const totalPx = W - laserX - 80;                             // pixels for max distance
    const detectorX = laserX + (distanceCm / maxDistCm) * totalPx;

    // ── BACKGROUND ──
    ctx.clearRect(0, 0, W, H);

    // Dark optical bench background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0d1117");
    bgGrad.addColorStop(1, "#161b22");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Bench rail
    ctx.save();
    const railGrad = ctx.createLinearGradient(0, centerY + 28, 0, centerY + 38);
    railGrad.addColorStop(0, "#3a4a5a");
    railGrad.addColorStop(0.5, "#5a7a8a");
    railGrad.addColorStop(1, "#2a3a4a");
    ctx.fillStyle = railGrad;
    ctx.fillRect(30, centerY + 28, W - 40, 10);
    ctx.restore();

    // ── RULER ──
    drawRuler(maxDistCm, laserX, laserX + totalPx);

    // ── GAUSSIAN BEAM PATH ──
    // Render beam as series of slices for smooth Gaussian profile
    const steps = 120;
    const noise = (noiseOffset) => (Math.sin(noiseOffset * 13.7) * 0.018 + 1); // subtle flicker

    for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const xPx = laserX + frac * (detectorX - laserX);
        const zCm = frac * distanceCm;
        const wz_i = gaussianHalfWidth(w0mm / 2, zCm, lambda);      // mm
        const hwPx = (wz_i / 10) * (totalPx / maxDistCm) * 4.5;     // scale to canvas pixels

        const flicker = noise(noiseOffset + i * 0.05);
        const alpha = 0.055 * flicker;

        ctx.save();
        ctx.shadowBlur = hwPx * 2.5;
        ctx.shadowColor = rgba(color.r, color.g, color.b, 0.5);
        drawBeamSlice(xPx, centerY, hwPx * flicker, color, alpha);
        ctx.restore();
    }

    // ── BRIGHT BEAM CORE (centre line glow) ──
    ctx.save();
    const coreGrad = ctx.createLinearGradient(laserX, 0, detectorX, 0);
    coreGrad.addColorStop(0, rgba(255, 255, 255, 0.9));
    coreGrad.addColorStop(0.08, rgba(color.r, color.g, color.b, 0.8));
    coreGrad.addColorStop(0.5, rgba(color.r, color.g, color.b, 0.55));
    coreGrad.addColorStop(1, rgba(color.r, color.g, color.b, 0.3));
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = rgba(color.r, color.g, color.b, 0.9);
    ctx.beginPath();
    ctx.moveTo(laserX, centerY);
    ctx.lineTo(detectorX, centerY);
    ctx.stroke();
    ctx.restore();

    // ── BEAM ENVELOPE LINES ──
    ctx.save();
    ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.25);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);

    const hwStart = gaussianHalfWidth(w0mm / 2, 0, lambda);
    const hwPxS = (hwStart / 10) * (totalPx / maxDistCm) * 4.5;
    const hwEnd = gaussianHalfWidth(w0mm / 2, distanceCm, lambda);
    const hwPxE = (hwEnd / 10) * (totalPx / maxDistCm) * 4.5;

    ctx.beginPath();
    ctx.moveTo(laserX, centerY - hwPxS);
    ctx.lineTo(detectorX, centerY - hwPxE);
    ctx.moveTo(laserX, centerY + hwPxS);
    ctx.lineTo(detectorX, centerY + hwPxE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── LASER SOURCE ──
    drawLaserSource(laserX, centerY, color);

    // ── DETECTOR ──
    const spotHW = Math.max(3, Math.min((wz / 10) * (totalPx / maxDistCm) * 4.5, 52));
    drawDetector(detectorX, centerY, spotHW, color, diameterMm);

    // ── UPDATE READOUTS ──
    distanceDisplay.textContent = distanceCm.toFixed(0);
    diameterDisplay.textContent = diameterMm.toFixed(3);

    // Live divergence (half-angle in mrad)
    const thetaRad = Math.atan(wz / (distanceCm * 10));  // rad (mm/mm)
    const thetaMrad = thetaRad * 1000;
    if (divergenceDisplay) {
        divergenceDisplay.textContent = thetaMrad.toFixed(3) + " mrad";
    }

    // Tick for flicker animation
    noiseOffset += 0.04;
}

// ─── ANIMATION LOOP ──────────────────────────────────────────────────────────
function animate() {
    drawBeam();
    animFrameId = requestAnimationFrame(animate);
}

// ─── OBSERVATION TABLE ───────────────────────────────────────────────────────
function addRow() {
    const distanceCm = parseFloat(distanceSlider.value);
    const lambda = parseInt(lambdaSelect.value);
    const w0mm = parseFloat(waistSlider.value);
    const wz = gaussianHalfWidth(w0mm / 2, distanceCm, lambda);
    const diameterMm = (2 * wz).toFixed(4);

    observations.push({ d: distanceCm, dia: diameterMm });
    renderTable();
}

function renderTable() {
    obsBody.innerHTML = observations.map((obs, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${obs.d}</td>
      <td>${obs.dia}</td>
    </tr>
  `).join("");
    const hint = document.getElementById("empty-hint");
    if (hint) hint.style.display = observations.length ? "none" : "block";
    updateChart();
}

// ─── DIVERGENCE CALCULATION ──────────────────────────────────────────────────
function calculateDivergence() {
    if (observations.length < 2) {
        showResult(`<div class="alert alert-warning">⚠ Add at least 2 readings first.</div>`);
        return;
    }

    const first = observations[0];
    const last = observations[observations.length - 1];

    const D1mm = parseFloat(first.dia);
    const D2mm = parseFloat(last.dia);
    const Lcm = parseFloat(last.d) - parseFloat(first.d);

    if (Lcm <= 0) {
        showResult(`<div class="alert alert-danger">Distance between readings must be > 0.</div>`);
        return;
    }

    const Lmm = Lcm * 10;
    const thetaRad = (D2mm - D1mm) / Lmm;       // half-angle approx (rad)
    const thetaMrad = thetaRad * 1000;
    const thetaFull = thetaMrad * 2;              // full-angle

    showResult(`
    <hr class="my-4">
    <div class="card shadow p-4 bg-white rounded border-primary">
      <h3 class="text-primary border-bottom pb-2 mb-4">Final Lab Report</h3>
      <div class="row">
        <div class="col-md-6">
          <h5>Governing Formula</h5>
          <p class="fs-5 fw-bold font-monospace">θ = (D₂ − D₁) / (2·L)</p>
          <ul class="text-muted small">
            <li>D₁ = ${D1mm} mm &nbsp;at ${first.d} cm</li>
            <li>D₂ = ${D2mm} mm &nbsp;at ${last.d} cm</li>
            <li>L = ${Lcm} cm = ${Lmm} mm</li>
          </ul>
        </div>
        <div class="col-md-6">
          <div class="alert alert-info py-4 text-center">
            <h4 class="alert-heading">Calculated Divergence</h4>
            <p class="fs-4 mb-1 fw-bold">θ = ${thetaMrad.toFixed(4)} mrad</p>
            <p class="mb-0 text-muted small">Full-angle 2θ = ${thetaFull.toFixed(4)} mrad</p>
          </div>
        </div>
      </div>
      <div class="mt-3 p-3 bg-light rounded">
        <h5>Conclusion:</h5>
        <p>Using ${observations.length} readings over a baseline of <b>${Lcm} cm</b>,
        the beam diameter grew from <b>${D1mm} mm</b> to <b>${D2mm} mm</b>.
        The half-angle divergence was found to be <b>θ = ${thetaMrad.toFixed(4)} mrad</b>,
        confirming the linear spreading behaviour of the laser beam.</p>
      </div>
    </div>
  `);
}

function showResult(html) {
    document.getElementById("result").innerHTML = html;
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
document.getElementById("download-pdf").addEventListener("click", async function () {
    if (observations.length === 0) {
        alert("No data recorded!"); return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text('Laser Beam Divergence \u2013 Lab Report', PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(9).setTextColor(100);
    doc.text('Formula: \u03B8 = (D\u2082 - D\u2081) / (2 \u00d7 L)', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);

    doc.autoTable({
        head: [["#", "Distance (cm)", "Beam Diameter (mm)"]],
        body: observations.map((o, i) => [i + 1, o.d, o.dia]),
        startY: 67,
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 46] },
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    let y = doc.lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
    doc.text('Formula & Calculations:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('\u03B8 = (D\u2082 - D\u2081) / (2 \u00d7 L)', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Calculated Divergence (\u03B8) = _____________ mrad', 20, y + 8);
    doc.text('Full Angle (2\u03B8) = _____________ mrad', 20, y + 16);
    
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion: __________________________________________________', 20, y + 16);

    if (observations.length >= 2) {
        const first = observations[0];
        const last = observations[observations.length - 1];
        const D1 = parseFloat(first.dia), D2 = parseFloat(last.dia);
        const L = (parseFloat(last.d) - parseFloat(first.d)) * 10;
        const th_rad = (D2 - D1) / (L * 2);
        const th_mrad = (th_rad * 1000).toFixed(4);

        doc.setTextColor(30, 80, 160);
        doc.text(`[Computed] Divergence \u03B8 = ${th_mrad} mrad`, 20, y + 36);
    }

    // ── Embed the chart image ──
    try {
        const chartCanvas = document.getElementById('divergenceChart');
        const chartImg = chartCanvas.toDataURL('image/png');
        const pageH = doc.internal.pageSize.getHeight();
        const currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 55 : y + 55;
        // Add new page if not enough space
        if (currentY + 90 > pageH) doc.addPage();
        const imgY = currentY + 10 > pageH ? 20 : currentY + 10;
        doc.addPage();
        doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
        doc.text('Graph: Beam Diameter vs Distance', PW / 2, 20, { align: 'center' });
        doc.addImage(chartImg, 'PNG', 15, 28, PW - 30, 100);
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100);
        doc.text('Red dots = recorded readings.  Dashed line = linear fit (divergence trend).', PW / 2, 135, { align: 'center' });
    } catch (e) { /* chart embed optional */ }

    doc.save("Laser_Divergence_Report.pdf");
});

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
[distanceSlider, thetaSlider, waistSlider].forEach(el =>
    el.addEventListener("input", () => { /* drawBeam happens in rAF */ })
);
lambdaSelect.addEventListener("change", () => { /* colour updates live */ });

document.getElementById("add-reading").addEventListener("click", addRow);

document.getElementById("clear-data").addEventListener("click", () => {
    observations = [];
    renderTable();
    document.getElementById("result").innerHTML = "";
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
animate();