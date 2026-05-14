"use strict";

const canvas = document.getElementById("benchCanvas");
const ctx = canvas.getContext("2d");

const zoomCanvas = document.getElementById("zoomCanvas");
const zoomCtx = zoomCanvas.getContext("2d");

// Controls
const distanceSlider = document.getElementById("distance-slider");
const thicknessSlider = document.getElementById("thickness-slider");
const lambdaSelect = document.getElementById("lambda-select");

const distBadge = document.getElementById("dist-badge");
const thickBadge = document.getElementById("thick-badge");

const btnLaser = document.getElementById("btn-laser");
const laserLabel = document.getElementById("laser-label");

const caliperContainer = document.getElementById("caliper-container");
const caliperLeft = document.getElementById("caliper-left");
const caliperRight = document.getElementById("caliper-right");
const betaValDisplay = document.getElementById("beta-val");

const addReadingBtn = document.getElementById("add-reading");

// State
let isLaserOn = false;
let D_cm = 120;
let a_um = 50;
let lambda_nm = 633;

let observations = [];

let animFrameId = null;
let noiseOffset = 0;

/* Diffraction Chart (β vs D) */
const chartCtx = document.getElementById('hairChart').getContext('2d');
const hairChart = new Chart(chartCtx, {
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
                        ? `β = ${ctx.parsed.y.toFixed(2)} mm @ D = ${ctx.parsed.x.toFixed(1)} cm`
                        : null
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Screen Distance D (cm)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            },
            y: {
                title: { display: true, text: 'Fringe Width β (mm)', font: { size: 12, weight: 'bold' } },
                grid: { color: 'rgba(0,0,0,0.06)' }
            }
        }
    }
});

function updateChart() {
    if (observations.length === 0) {
        hairChart.data.datasets[0].data = [];
        hairChart.data.datasets[1].data = [];
        hairChart.update();
        return;
    }

    // Scatter points
    hairChart.data.datasets[0].data = observations.map(o => ({
        x: o.d,
        y: o.beta
    }));

    // Linear regression for trendline
    const n = observations.length;
    if (n >= 2) {
        const xs = observations.map(o => o.d);
        const ys = observations.map(o => o.beta);
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
            hairChart.data.datasets[1].data = [
                { x: minX, y: slope * minX + intercept },
                { x: maxX, y: slope * maxX + intercept }
            ];
        }
    } else {
        hairChart.data.datasets[1].data = [];
    }
    
    hairChart.update();
}

// Wavelength to RGB
const WAVE_COLORS = {
    405: { r: 138, g: 43, b: 226, glow: "rgba(138, 43, 226, 0.4)" },
    532: { r: 0, g: 255, b: 0, glow: "rgba(0, 255, 0, 0.4)" },
    633: { r: 255, g: 30, b: 0, glow: "rgba(255, 30, 0, 0.4)" }
};

// Caliper State
// Using percentage 0 to 100 for left and right
let calLeftPos = 40;
let calRightPos = 60;
let isDraggingL = false;
let isDraggingR = false;

// Zoom View real-world span (width of the zoom view in mm)
// To accommodate different fringe separations, we auto-scale slightly or keep it fixed.
// Largest fringe: lambda=633, D=250cm, a=30um => y = 52.7 mm => beta = 105 mm.
// Smallest fringe: lambda=405, D=80cm, a=120um => y = 2.7 mm => beta = 5.4 mm.
// It's better to dynamically scale the zoom view based on the current math, but tell the student the "scale".
// Actually, let's keep a fixed scale of 120 mm width if possible. At 120mm, beta=105mm fits.
const ZOOM_SPAN_MM = 120; 

function rgba(r,g,b,a) {
    return `rgba(${r},${g},${b},${a})`;
}

// ─── INIT & EVENT LISTENERS ──────────────────────────────────────────

function init() {
    distanceSlider.addEventListener("input", updateParams);
    thicknessSlider.addEventListener("input", updateParams);
    lambdaSelect.addEventListener("change", updateParams);

    // Caliper dragging logic
    setupCalipers();

    updateParams();
    renderLoop();
}

function toggleLaser() {
    isLaserOn = !isLaserOn;
    if(isLaserOn) {
        btnLaser.classList.add("active");
        laserLabel.innerText = "LASER ON";
        caliperContainer.style.display = "block";
        addReadingBtn.disabled = false;
    } else {
        btnLaser.classList.remove("active");
        laserLabel.innerText = "LASER OFF";
        caliperContainer.style.display = "none";
        addReadingBtn.disabled = true;
    }
}

function updateParams() {
    D_cm = parseFloat(distanceSlider.value);
    a_um = parseFloat(thicknessSlider.value);
    lambda_nm = parseInt(lambdaSelect.value);

    distBadge.textContent = D_cm.toFixed(1) + " cm";
    thickBadge.textContent = a_um + " µm";
    
    updateCaliperText();
}

// ─── CALIPER INTERACTION ──────────────────────────────────────────────

function setupCalipers() {
    const cont = caliperContainer;

    const onMove = (e) => {
        const rect = cont.getBoundingClientRect();
        let x = e.clientX || (e.touches && e.touches[0].clientX);
        if(!x) return;
        let p = ((x - rect.left) / rect.width) * 100;
        p = Math.max(0, Math.min(100, p));

        if(isDraggingL) {
            calLeftPos = Math.min(p, calRightPos - 1); // keep left of right
        } else if(isDraggingR) {
            calRightPos = Math.max(p, calLeftPos + 1); // keep right of left
        }
        applyCaliperPositions();
    };

    const endDrag = () => {
        isDraggingL = false;
        isDraggingR = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", endDrag);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", endDrag);
    };

    const startDragL = (e) => {
        isDraggingL = true;
        e.preventDefault();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", endDrag);
        document.addEventListener("touchmove", onMove, {passive:false});
        document.addEventListener("touchend", endDrag);
    };

    const startDragR = (e) => {
        isDraggingR = true;
        e.preventDefault();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", endDrag);
        document.addEventListener("touchmove", onMove, {passive:false});
        document.addEventListener("touchend", endDrag);
    };

    caliperLeft.addEventListener("mousedown", startDragL);
    caliperLeft.addEventListener("touchstart", startDragL, {passive:false});
    
    caliperRight.addEventListener("mousedown", startDragR);
    caliperRight.addEventListener("touchstart", startDragR, {passive:false});

    applyCaliperPositions();
}

function applyCaliperPositions() {
    caliperLeft.style.left = calLeftPos + "%";
    caliperRight.style.left = calRightPos + "%";
    updateCaliperText();
}

function updateCaliperText() {
    // calculate beta based on the zoom span
    let pDiff = calRightPos - calLeftPos;
    let beta_mm = (pDiff / 100) * ZOOM_SPAN_MM;
    betaValDisplay.textContent = beta_mm.toFixed(2);
}

// ─── RENDERING ────────────────────────────────────────────────────────

function drawOpticalBench() {
    const W = canvas.width;
    const H = canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, W, H);

    // 1. Perspective Grid & Background Base
    const grad = ctx.createLinearGradient(0, H/2, 0, H);
    grad.addColorStop(0, "#0d1117");
    grad.addColorStop(1, "#161b22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H/2, W, H/2);

    const basePath = H / 2 + 50;

    // Rail Track
    ctx.fillStyle = "#1e242c";
    ctx.fillRect(80, basePath, W - 180, 20);
    ctx.fillStyle = "#111418";
    ctx.fillRect(80, basePath + 20, W - 180, 25); // thickness
    
    // Ruler marks on the rail
    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 250; i += 10) {
        let x = 300 + (i / 250) * (W - 500);
        let y = basePath + 20;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + ((i % 50 === 0) ? 10 : 5));
        if (i % 50 === 0) {
            ctx.fillStyle = "#8b949e";
            ctx.font = "10px sans-serif";
            ctx.fillText(i, x - 5, y + 20);
        }
    }
    ctx.stroke();

    // Mapping physical distance D to canvas pixels
    // D is simulated distance from hair to screen
    // Let hair be fixed at x=300
    const hairX = 300;
    // Let screen vary from x=400 to 1000
    let screenX = 300 + ((D_cm) / 250) * (W - 500);

    // Laser Source (fixed at left)
    const laserX = 120;
    const centerH = basePath - 70; // optical center y

    drawEquipmentStand(laserX, basePath, centerH);
    drawLaserTube(laserX, centerH);

    // Hair Holder
    drawEquipmentStand(hairX, basePath, centerH);
    drawHairMount(hairX, centerH);

    // Screen
    drawScreenBase(screenX, basePath, centerH);
    
    if (isLaserOn) {
        drawVolumetricBeams(laserX, hairX, screenX, centerH);
    }

    drawScreenPanel(screenX, centerH, isLaserOn);
}

function drawEquipmentStand(x, baseY, optY) {
    ctx.fillStyle = "#21262d";
    ctx.fillRect(x - 15, optY + 10, 30, baseY - optY - 10);
    // Base clamp
    ctx.fillStyle = "#161b22";
    ctx.fillRect(x - 20, baseY, 40, 25);
    ctx.strokeStyle = "#30363d";
    ctx.strokeRect(x - 20, baseY, 40, 25);
}

function drawLaserTube(x, y) {
    // cylindrical body
    const lg = ctx.createLinearGradient(0, y - 20, 0, y + 20);
    lg.addColorStop(0, "#444");
    lg.addColorStop(0.5, "#888");
    lg.addColorStop(1, "#222");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(x - 60, y - 15, 80, 30, 4);
    ctx.fill();

    // Aperture end
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 15, y - 10, 8, 20);
}

function drawHairMount(x, y) {
    ctx.fillStyle = "#161b22";
    ctx.fillRect(x - 5, y - 40, 10, 80);
    ctx.strokeStyle = "#666";
    ctx.strokeRect(x - 5, y - 40, 10, 80);
    // The hair (hole)
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI*2);
    ctx.fill();
    // Hair strand
    ctx.strokeStyle = "#aaaaaa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y + 15);
    ctx.stroke();
}

function drawScreenBase(x, baseY, optY) {
    ctx.fillStyle = "#21262d";
    // Stand
    ctx.fillRect(x - 10, optY, 20, baseY - optY);
    // Clamp
    ctx.fillStyle = "#161b22";
    ctx.fillRect(x - 25, baseY, 50, 25);
}

function drawScreenPanel(x, y, on) {
    // Isometric sort of flat panel
    // It's facing left slightly
    ctx.save();
    
    // Board
    ctx.fillStyle = "#0d1117";
    ctx.beginPath();
    ctx.moveTo(x, y - 80);
    ctx.lineTo(x + 30, y - 90);
    ctx.lineTo(x + 30, y + 110);
    ctx.lineTo(x, y + 100);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 2;
    ctx.stroke();

    // The projection
    if (on) {
        ctx.globalCompositeOperation = "screen";
        let c = WAVE_COLORS[lambda_nm];
        const rad = 20;

        // Draw an elongated glowing dot map mapping the 1D intensity natively on the board
        // To give a 3D feel we just draw layered ellipses
        let D_m = D_cm / 100;
        let lam_m = lambda_nm * 1e-9;
        let actual_a_m = a_um * 1e-6;
        let y_m = (lam_m * D_m) / actual_a_m; 
        
        // y_m is in meters. Map to canvas screen panel size. 
        // Real screen panel is say 20x20 cm.
        let scale = 150 / 0.1; // roughly canvas pixels per meter
        let fringePx = y_m * scale;

        ctx.fillStyle = rgba(c.r, c.g, c.b, 0.9);
        // Center fringe
        ctx.beginPath();
        ctx.ellipse(x + 5, y + 5, 2, fringePx*0.8, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = rgba(c.r, c.g, c.b, 0.4);
        ctx.beginPath();
        ctx.ellipse(x + 10, y + 2, 4, fringePx*0.4, 0, 0, Math.PI*2);
        ctx.fill();

        for(let n=1; n<=4; n++) {
            let intent = 0.5 / (n);
            ctx.fillStyle = rgba(c.r, c.g, c.b, intent);
            // up and down spots
            ctx.beginPath();
            ctx.ellipse(x + 10, y + 2 - n*fringePx*0.9, 3, fringePx*0.2, 0, 0, Math.PI*2);
            ctx.ellipse(x + 10, y + 2 + n*fringePx*0.9, 3, fringePx*0.2, 0, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";
    }

    ctx.restore();
}

function drawVolumetricBeams(laserX, hairX, screenX, y) {
    ctx.save();
    let c = WAVE_COLORS[lambda_nm];
    
    // Beam from laser to holder (solid)
    ctx.globalCompositeOperation = "screen";
    let bgGrad = ctx.createLinearGradient(0, y-10, 0, y+10);
    bgGrad.addColorStop(0, rgba(c.r, c.g, c.b, 0));
    bgGrad.addColorStop(0.5, rgba(c.r, c.g, c.b, 0.8));
    bgGrad.addColorStop(1, rgba(c.r, c.g, c.b, 0));
    
    ctx.fillStyle = bgGrad;
    ctx.fillRect(laserX + 23, y - 5, hairX - laserX - 25, 10);
    
    // Core line
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(laserX + 23, y);
    ctx.lineTo(hairX, y);
    ctx.stroke();

    // Diffracted beams from hair to screen
    // Draw central bright beam
    ctx.beginPath();
    ctx.moveTo(hairX, y);
    ctx.lineTo(screenX, y);
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.7);
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hairX, y);
    ctx.lineTo(screenX, y);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spreading fan
    const numFans = 5;
    const spreadAngle = 0.08 * (lambda_nm / 633) * (50 / a_um); // visual flare calculation
    for(let i=1; i<=numFans; i++) {
        let alpha = 0.4 / i;
        ctx.strokeStyle = rgba(c.r, c.g, c.b, alpha);
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        let dy = Math.sin(spreadAngle * i) * (screenX - hairX);
        ctx.moveTo(hairX, y);
        ctx.lineTo(screenX, y - dy * 0.8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hairX, y);
        ctx.lineTo(screenX, y + dy * 0.8);
        ctx.stroke();
    }

    ctx.restore();
}

function drawZoomPanel() {
    const W = zoomCanvas.width;
    const H = zoomCanvas.height;

    zoomCtx.clearRect(0,0,W,H);

    if(!isLaserOn) {
        // Just noise or black
        zoomCtx.fillStyle = "#050505";
        zoomCtx.fillRect(0,0,W,H);
        return;
    }

    // Physics math for true accurate sinc representation
    let D_m = D_cm / 100;
    let actual_a_m = a_um * 1e-6;
    let lam_m = lambda_nm * 1e-9;
    
    // y_m = distance to first minima
    let y_m = (lam_m * D_m) / actual_a_m;
    let y_mm = y_m * 1000;

    let c = WAVE_COLORS[lambda_nm];
    let imgData = zoomCtx.createImageData(W, H);
    let data = imgData.data;

    let center_x = W / 2;
    // zoom view span mapping
    // We said ZOOM_SPAN_MM = 120 (±60mm from center)
    let max_mm = ZOOM_SPAN_MM / 2; 

    // Add noise simulation
    noiseOffset += 0.04;

    for (let px = 0; px < W; px++) {
        // X in mm from center
        let x_mm = ((px - center_x) / center_x) * max_mm;
        
        let beta = Math.PI * x_mm / y_mm;
        let intensity = 1.0;
        
        if (x_mm !== 0) {
            intensity = Math.pow(Math.sin(beta) / beta, 2);
        }

        // Apply gamma/log scale to boost faint higher-order fringes
        intensity = Math.pow(intensity, 0.48); 

        // Add visual sensor noise
        let flicker = 1 + (Math.sin(noiseOffset)*0.02);
        intensity = Math.max(0, Math.min(1, intensity * flicker));

        let r = c.r * intensity;
        let g = c.g * intensity;
        let b = c.b * intensity;

        for (let py = 0; py < H; py++) {
            // Apply a slight gaussian falloff vertically so bands are bounded like real gaussian laser beams
            let yDist = Math.abs(py - H/2) / (H/2);
            let yFalloff = Math.exp(-yDist*yDist * 2.5);

            let v_intensity = intensity * yFalloff + (Math.random()*0.04);
            v_intensity = Math.min(1, Math.max(0, v_intensity));

            let idx = (py * W + px) * 4;
            data[idx] = c.r * v_intensity;
            data[idx+1] = c.g * v_intensity;
            data[idx+2] = c.b * v_intensity;
            data[idx+3] = 255; 
        }
    }

    zoomCtx.putImageData(imgData, 0, 0);

    // Draw mm scale on top of the zoom
    zoomCtx.strokeStyle = "rgba(255,255,255,0.3)";
    zoomCtx.fillStyle = "rgba(255,255,255,0.7)";
    zoomCtx.font = "11px monospace";
    zoomCtx.textAlign = "center";
    
    zoomCtx.beginPath();
    zoomCtx.moveTo(0, 15);
    zoomCtx.lineTo(W, 15);
    for(let i = -max_mm; i <= max_mm; i += 10) {
        let px = center_x + (i / max_mm) * center_x;
        zoomCtx.moveTo(px, 15);
        zoomCtx.lineTo(px, (i % 20 === 0) ? 25 : 20);
        if (i % 20 === 0) {
            zoomCtx.fillText(i, px, 35);
        }
    }
    zoomCtx.stroke();
}

function renderLoop() {
    drawOpticalBench();
    drawZoomPanel();
    animFrameId = requestAnimationFrame(renderLoop);
}

// ─── DATA HANDLING & LOGIC ─────────────────────────────────────────────

addReadingBtn.addEventListener('click', () => {
    // In real experiment, student reads beta manually. We capture their current caliper setting!
    let pDiff = calRightPos - calLeftPos;
    let meas_beta_mm = (pDiff / 100) * ZOOM_SPAN_MM;

    if (meas_beta_mm < 0.5) {
        alert("Please set the calipers to measure the distance between the primary dark fringes (β).");
        return;
    }

    // Mathematical Calculation based on measurements
    let D_m = D_cm / 100;
    let lam_m = lambda_nm * 1e-9;
    let beta_m = meas_beta_mm / 1000;

    // Formula: a = 2*lam_m*D / beta
    let meas_a_m = (2 * lam_m * D_m) / beta_m;
    let meas_a_um = meas_a_m * 1e6;

    observations.push({
        d: D_cm,
        beta: parseFloat(meas_beta_mm.toFixed(2)),
        lambda: lambda_nm,
        calcA: parseFloat(meas_a_um.toFixed(2))
    });

    renderTable();
});

function renderTable() {
    const tbody = document.getElementById('obs-body');
    const hint = document.getElementById('empty-hint');
    tbody.innerHTML = '';
    
    if(observations.length === 0) {
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
        observations.forEach((o, i) => {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i+1}</td>
                <td>${o.d}</td>
                <td class="text-warning fw-bold">${o.beta}</td>
                <td>${o.lambda}</td>
                <td class="text-success">${o.calcA}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    updateChart();
}

document.getElementById('clear-data').addEventListener('click', () => {
    observations = [];
    renderTable();
    document.getElementById('result').innerHTML = '';
});

function calcResult() {
    if(observations.length === 0) {
        alert("Please record some readings first.");
        return;
    }

    let sumA = 0;
    observations.forEach(o => { sumA += o.calcA; });
    let avg_a_um = sumA / observations.length;

    let pctError = Math.abs((avg_a_um - a_um) / a_um) * 100;

    document.getElementById('result').innerHTML = `
        <div class="card shadow p-4 bg-white rounded border-primary">
            <h3 class="text-primary border-bottom pb-2 mb-4">Final Result Analysis</h3>
            <div class="row text-center">
                <div class="col-md-6">
                    <div class="alert alert-success py-4">
                        <h4>Calculated Mean Thickness (a)</h4>
                        <p class="fs-2 mb-0 fw-bold">${avg_a_um.toFixed(2)} µm</p>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-secondary py-4">
                        <h4>Actual Ground Truth</h4>
                        <p class="fs-3 mb-0">${a_um} µm</p>
                        <p class="mb-0 text-muted">% Error: ${pctError.toFixed(2)}% based on caliper placement.</p>
                    </div>
                </div>
            </div>
            <div class="text-muted small text-center mt-2">
                Note: In a physical lab, inaccuracies arise from measuring the spread on the screen ruler. 
                Your error is determined by how perfectly you placed the yellow calipers on the first dark fringes!
            </div>
        </div>
    `;
}

// ─── PDF REPORT ──────────────────────────────────────────

document.getElementById('download-pdf').addEventListener('click', () => {
    if (observations.length === 0) {
        alert("No data recorded!"); return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Quantum Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text('Determination of Hair Thickness via Diffraction \u2013 Lab Report', PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(10).setTextColor(100);
    doc.text('Formula: d = (n \u00d7 \u03bb \u00d7 D) / x    (where x = \u03B2/2 for n=1)', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);

    const tableData = observations.map((o, i) => [
        i + 1, o.d, o.beta, o.lambda, o.calcA
    ]);

    doc.autoTable({
        startY: 67,
        head: [['#', 'Screen Dist D (cm)', 'Measured \u03B2 (mm)', 'Wavelength (nm)', 'Calc Thickness (µm)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 46] },
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    let y = doc.lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
    doc.text('Formula & Calculations:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('d = (2 \u00d7 \u03bb \u00d7 D) / \u03B2', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Calculated Hair Thickness (d) = _____________ µm', 20, y + 8);
    doc.text('Standard Ground Truth (a) = ' + a_um + ' µm', 20, y + 16);
    
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion: __________________________________________________', 20, y + 16);

    let sumA = 0;
    observations.forEach(o => { sumA += o.calcA; });
    let avg_a_um = sumA / observations.length;

    doc.setTextColor(30, 80, 160);
    doc.text(`[Computed] Average Calculated Thickness = ${avg_a_um.toFixed(2)} µm`, 20, y + 36);

    // ── Embed the chart image ──
    try {
        const chartCanvas = document.getElementById('hairChart');
        const chartImg = chartCanvas.toDataURL('image/png');
        const currentY = y + 46;
        const pageH = doc.internal.pageSize.getHeight();
        if (currentY + 60 > pageH) doc.addPage();
        doc.addPage();
        doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
        doc.text('Graph: Fringe Width (β) vs Screen Distance (D)', PW / 2, 20, { align: 'center' });
        doc.addImage(chartImg, 'PNG', 15, 28, PW - 30, 100);
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100);
        doc.text('Red dots = recorded readings. Dashed line = linear fit.', PW / 2, 135, { align: 'center' });
    } catch (e) { /* chart embed optional */ }

    doc.save("Hair_Thickness_Report.pdf");
});

window.onload = init;
