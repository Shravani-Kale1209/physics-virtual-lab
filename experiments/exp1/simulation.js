"use strict";

const canvas = document.getElementById("peCanvas");
const ctx = canvas.getContext("2d");

// DOM Elements
const waveSlider = document.getElementById("wave-slider");
const waveBadge = document.getElementById("wave-badge");
const materialSelect = document.getElementById("material-select");
const voltSlider = document.getElementById("volt-slider");
const voltBadge = document.getElementById("volt-badge");

const btnFineUp = document.getElementById("fine-tune-up");
const btnFineDown = document.getElementById("fine-tune-down");
const addReadingBtn = document.getElementById("add-reading");
const obsBody = document.getElementById("obs-body");
const graphCanvas = document.getElementById("graphCanvas");
const graphCtx = graphCanvas ? graphCanvas.getContext("2d") : null;

let observations = [];
let animFrameId = null;

// Physics Constants
const h_ev = 4.135667696e-15; // eV s
const h_j = 6.62607015e-34; // J s
const c = 2.99792458e8; // m/s
const e_charge = 1.602176634e-19; // C

// State
let lambda_nm = 400;
let phi_eV = 2.28;
let v_applied = 0.00; // Expected to be negative or 0

let k_max_eV = 0; // Max kinetic energy

// Wavelength to RGB color map (approximate)
function getWavelengthColor(wl) {
    if(wl < 380) return {r: 100, g: 0, b: 150, alpha: 1}; // UV rep
    let r, g, b;
    if (wl >= 380 && wl < 440) {
        r = -(wl - 440) / (440 - 380); g = 0; b = 1;
    } else if (wl >= 440 && wl < 490) {
        r = 0; g = (wl - 440) / (490 - 440); b = 1;
    } else if (wl >= 490 && wl < 510) {
        r = 0; g = 1; b = -(wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        r = (wl - 510) / (580 - 510); g = 1; b = 0;
    } else if (wl >= 580 && wl < 645) {
        r = 1; g = -(wl - 645) / (645 - 580); b = 0;
    } else if (wl >= 645 && wl <= 780) {
        r = 1; g = 0; b = 0;
    } else {
        r = 1; g = 0; b = 0; // IR rep
    }

    let factor;
    if (wl >= 380 && wl < 420) factor = 0.3 + 0.7*(wl - 380)/(420 - 380);
    else if (wl >= 420 && wl < 701) factor = 1.0;
    else if (wl >= 701 && wl <= 780) factor = 0.3 + 0.7*(780 - wl)/(780 - 700);
    else factor = 0.3;

    return {
        r: Math.round(r * 255 * factor), 
        g: Math.round(g * 255 * factor), 
        b: Math.round(b * 255 * factor)
    };
}

let electrons = [];
let photocurrent = 0; // Relative arbitrary unit for display

// ─── INITIALIZATION ──────────────────────────────────────────

function init() {
    waveSlider.addEventListener("input", updateParams);
    materialSelect.addEventListener("change", updateParams);
    voltSlider.addEventListener("input", updateParams);

    btnFineUp.addEventListener("click", () => {
        let v = parseFloat(voltSlider.value);
        if (v < 0) {
            voltSlider.value = (v + 0.01).toFixed(2);
            updateParams();
        }
    });

    btnFineDown.addEventListener("click", () => {
        let v = parseFloat(voltSlider.value);
        if (v > -10) {
            voltSlider.value = (v - 0.01).toFixed(2);
            updateParams();
        }
    });

    updateParams();
    renderLoop();
}

function updateParams() {
    lambda_nm = parseInt(waveSlider.value);
    phi_eV = parseFloat(materialSelect.value);
    v_applied = parseFloat(voltSlider.value);

    waveBadge.innerText = lambda_nm + " nm";
    voltBadge.innerText = v_applied.toFixed(2) + " V";

    // Recalculate Physics
    let E_photon_eV = 1240 / lambda_nm;
    
    // Slight random variation per metal so equation works perfectly but has noise?
    // Actually letting the direct math represent the exact simulation forces
    if (E_photon_eV > phi_eV) {
        k_max_eV = E_photon_eV - phi_eV;
    } else {
        k_max_eV = 0; // No emission
    }

    // Re-render MathJax equation if needed
    if(window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
}

// ─── PARTICLE LOGIC ──────────────────────────────────────────

function spawnElectrons() {
    if (k_max_eV <= 0) return;
    
    // Spawn rate
    let spawnRate = 0.08 + (k_max_eV * 0.02); 
    if (Math.random() < spawnRate) {
        // Emit roughly between 0.1 and k_max_eV
        let k_emitted = (Math.random() * 0.9 + 0.1) * k_max_eV;

        // Velocity = sqrt(K) roughly, mapped to canvas pixels/frame
        let vx = 0.5 + Math.sqrt(k_emitted) * 1.5; 

        electrons.push({
            x: 520, // Cathode surfce
            y: 190 + Math.random() * 40,
            vx: vx,
            vy: (Math.random() - 0.5) * 0.2, // slight vertical drift
            k_initial: k_emitted
        });
    }
}

function updateElectrons(ctx) {
    let activeElectrons = [];
    let currentPulse = 0;

    // Dist between plates roughly 520 to 880 = 360 px
    const W_gap = 360; 
    
    // Retarding potential decelerates them
    // Assuming potential is linear across gap.
    // Accel a = e * V / d. Since V is negative, V causes Deceleration (-ax)
    // Map eV directly to Deceleration applied per frame
    // Total delta K across gap = -v_applied (in eV, since V is negative, V_A - V_C = v_applied)
    // If an electron has K_initial, and travels distance x: 
    // kinetic energy at x: K(x) = K_initial + (v_applied) * (x / W_gap)
    // If K(x) <= 0, it stops and moves backwards!
    
    for (let e of electrons) {
        // Update velocity based on position and potential
        // Force F = V_applied / W_gap. (v_applied is negative).
        let accel = (v_applied * 2.0) / (W_gap); // magic scaling for visual appeal
        e.vx += accel;
        
        e.x += e.vx;
        e.y += e.vy;

        // Boundary checks
        if (e.x > 880) {
            // Hit anode! Register current.
            currentPulse++;
        } else if (e.x < 520 && e.vx < 0) {
            // Hit cathode returning.
        } else {
            activeElectrons.push(e);
        }
    }

    electrons = activeElectrons;

    // Update photocurrent smoothly
    photocurrent = photocurrent * 0.9 + currentPulse * 0.1;
}

// ─── RENDER ENGINE ──────────────────────────────────────────

function renderLoop() {
    const W = canvas.width;
    const H = canvas.height;
    
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#1e201f"; // Background color match
    ctx.fillRect(0,0,W,H);

    // Draw Light Beam
    let clr = getWavelengthColor(lambda_nm);
    drawLightBeam(ctx, clr);
    
    // Draw Apparatus
    drawLightSource(ctx);
    drawVacuumTube(ctx);
    drawVoltmeter(ctx);

    // Update & Draw Electrons
    spawnElectrons();
    updateElectrons();
    drawElectrons(ctx);

    // Voltmeter text
    drawVoltmeterScreen(ctx);

    animFrameId = requestAnimationFrame(renderLoop);
}

function drawLightBeam(ctx, clr) {
    let alpha = k_max_eV > 0 ? 0.8 : 0.6; // slightly dimmer if no emission
    const grad = ctx.createLinearGradient(0, 180, 0, 240);
    grad.addColorStop(0, `rgba(${clr.r},${clr.g},${clr.b}, 0)`);
    grad.addColorStop(0.5, `rgba(${clr.r},${clr.g},${clr.b}, ${alpha})`);
    grad.addColorStop(1, `rgba(${clr.r},${clr.g},${clr.b}, 0)`);

    ctx.fillStyle = grad;
    // Base Box is at x=50 to 250. Tube starts at 400.
    ctx.fillRect(250, 180, 270, 60);

    // Bright core
    ctx.fillStyle = `rgba(255,255,255,0.7)`;
    ctx.fillRect(250, 208, 270, 4);

    // Label on beam
    ctx.fillStyle = `rgba(${clr.r},${clr.g},${clr.b}, 1)`;
    ctx.font = "italic 16px 'Courier New'";
    ctx.fillText(`Light (λ = ${lambda_nm} nm)`, 280, 260);
}

function drawLightSource(ctx) {
    ctx.save();
    
    // Stand
    ctx.fillStyle = "#161817";
    ctx.fillRect(130, 250, 15, 120);
    ctx.fillStyle = "#0c0d0c";
    ctx.fillRect(90, 360, 95, 15);
    
    // Laser Box
    const grad = ctx.createLinearGradient(0, 150, 0, 250);
    grad.addColorStop(0, "#4a534c");
    grad.addColorStop(0.2, "#2f3631");
    grad.addColorStop(1, "#181c19");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(50, 160, 180, 100, 8);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#111";
    ctx.stroke();

    // Lens
    ctx.fillStyle = "#111";
    ctx.fillRect(230, 180, 10, 60);
    ctx.beginPath();
    ctx.ellipse(240, 210, 8, 30, 0, 0, Math.PI*2);
    ctx.fillStyle = "#222";
    ctx.fill();
    
    ctx.fillStyle = "#b0bcb7";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Monochromatic Light Source", 45, 140);
    
    ctx.restore();
}

function drawVacuumTube(ctx) {
    ctx.save();
    
    // Tube Glass Outline
    ctx.beginPath();
    ctx.roundRect(450, 130, 500, 160, 60);
    
    // Glass fill
    const tGrad = ctx.createLinearGradient(0,130,0,290);
    tGrad.addColorStop(0, "rgba(255,255,255,0.2)");
    tGrad.addColorStop(0.2, "rgba(255,255,255,0.05)");
    tGrad.addColorStop(0.8, "rgba(255,255,255,0.02)");
    tGrad.addColorStop(1, "rgba(255,255,255,0.15)");
    ctx.fillStyle = tGrad;
    ctx.fill();
    
    // Glass Stroke
    ctx.strokeStyle = "rgba(200,240,255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left Stand
    ctx.fillStyle = "#161817";
    ctx.fillRect(505, 290, 10, 80);
    
    // Right Stand
    ctx.fillStyle = "#161817";
    ctx.fillRect(885, 290, 10, 80);

    // Cathode (Left)
    ctx.fillStyle = "#a8aba9"; // Silver block
    ctx.fillRect(500, 170, 20, 80);
    ctx.beginPath();
    ctx.ellipse(500, 210, 6, 40, 0, 0, Math.PI*2);
    ctx.fillStyle = "#dae0dc";
    ctx.fill();
    
    ctx.fillStyle = "#b0bcb7";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Photosensitive Cathode", 510, 110);

    // Anode (Right)
    ctx.fillStyle = "#a8aba9";
    ctx.fillRect(880, 170, 15, 80);
    ctx.beginPath();
    ctx.ellipse(880, 210, 5, 40, 0, 0, Math.PI*2);
    ctx.fillStyle = "#dae0dc"; // copper center or silver
    ctx.fill();
    
    ctx.fillStyle = "#b0bcb7";
    ctx.fillText("Collector Anode", 885, 110);

    // Wires sticking out
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 4;
    // Left wire
    ctx.beginPath();
    ctx.moveTo(510, 290); // inside stand
    ctx.lineTo(440, 290);
    ctx.lineTo(440, 370);
    ctx.lineTo(480, 370);
    ctx.stroke();

    // Right wire
    ctx.strokeStyle = "#ca2222"; // Red Positive
    ctx.beginPath();
    ctx.moveTo(890, 290);
    ctx.lineTo(960, 290);
    ctx.lineTo(960, 370);
    ctx.lineTo(920, 370);
    ctx.stroke();

    ctx.restore();
}

function drawVoltmeter(ctx) {
    ctx.save();
    
    // Voltmeter + Ammeter Box
    const grad = ctx.createLinearGradient(0, 340, 0, 420);
    grad.addColorStop(0, "#d18731"); // Copper/wood color
    grad.addColorStop(0.5, "#a86315");
    grad.addColorStop(1, "#6b3d0a");
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(460, 340, 480, 80, 8);
    ctx.fill();
    ctx.strokeStyle = "#502804";
    ctx.stroke();
    
    // Voltmeter Screen bezel
    ctx.fillStyle = "#111";
    ctx.fillRect(480, 355, 130, 40);

    // Ammeter Screen bezel
    ctx.fillStyle = "#111";
    ctx.fillRect(660, 355, 130, 40);

    // Knob
    ctx.beginPath();
    ctx.arc(880, 375, 20, 0, Math.PI*2);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.stroke();
    // Knob indicator
    ctx.beginPath();
    ctx.arc(870, 370, 3, 0, Math.PI*2);
    ctx.fillStyle = "#aaa";
    ctx.fill();

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Voltmeter", 545, 348);
    ctx.fillText("Microammeter", 725, 348);
    
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#ddd";
    ctx.fillText("(Retarding V₀)", 545, 410);
    ctx.fillText("(Photocurrent I)", 725, 410);

    ctx.restore();
}

function drawElectrons(ctx) {
    ctx.save();
    for (let e of electrons) {
        // Draw blue glow
        let rad = 5;
        let grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rad*2.5);
        grad.addColorStop(0, "white");
        grad.addColorStop(0.3, "#00aaff");
        grad.addColorStop(1, "rgba(0,170,255,0)");

        ctx.fillStyle = grad;
        ctx.fillRect(e.x - rad*3, e.y - rad*3, rad*6, rad*6);
        
        ctx.beginPath();
        ctx.arc(e.x, e.y, rad, 0, Math.PI*2);
        ctx.fillStyle = "#7bd0ff";
        ctx.fill();
    }
    
    if (electrons.length > 0) {
        ctx.fillStyle = "#00aaff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Emitted Electrons", 700, 280);
    }

    ctx.restore();
}

function drawVoltmeterScreen(ctx) {
    ctx.save();
    
    // Voltmeter display text
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#00ff00"; // Glowing green LCD
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff00";
    ctx.fillText(v_applied.toFixed(2) + " V", 545, 383);

    // Ammeter display text
    // Calculate a stable theoretical current instead of relying on discrete particle hits
    let target_I = 0;
    let expected_V0 = -k_max_eV; 
    if (k_max_eV > 0 && v_applied > expected_V0) {
        // v_applied is negative, expected_V0 is more negative
        // margin is how much kinetic energy is left over
        let margin = v_applied - expected_V0; 
        target_I = Math.pow(margin, 1.5) * 45.0; 
        
        // Add minimal realistic jitter (±0.02)
        let noise = (Math.random() - 0.5) * 0.04;
        target_I = Math.max(0.00, target_I + noise);
    }
    
    // Smooth transition to target
    photocurrent = photocurrent * 0.85 + target_I * 0.15;
    
    let display_I = photocurrent > 0.01 ? photocurrent : 0.00;
    
    ctx.fillStyle = "#ffaa00"; // Glowing orange/yellow LCD for current
    ctx.shadowColor = "#ffaa00";
    ctx.fillText(display_I.toFixed(2) + " µA", 725, 383);

    ctx.restore();
}

// ─── REPORT & MATH ──────────────────────────────────────────

addReadingBtn.addEventListener("click", () => {
    // Math to get frequency: 
    let f_Hz = c / (lambda_nm * 1e-9);
    let f_e14 = f_Hz / 1e14;

    // Check if stopping potential is exact.
    // Real V0 = -K_max.
    let expected_V0 = -k_max_eV; // eg. E = 3.1eV, Phi = 2.28eV -> K=0.82eV. V0=-0.82V.
    
    // It's acceptable if user records a value slightly more negative, meaning no electrons arrive.
    // To make them "hit" the right value, let's just log whatever they are at, 
    // but the math calculates 'h' assuming V0 is what they dialed.
    
    if (k_max_eV === 0 && v_applied === 0) {
        alert("At this wavelength, photon energy is below the work function. No photoelectrons emitted!");
        return;
    }

    // if v_applied is not close to expected_V0, the calculation for 'h' will just be wrong (error!)
    
    let materialName = materialSelect.options[materialSelect.selectedIndex].text.split(' ')[0];

    observations.push({
        mat: materialName,
        lambda: lambda_nm,
        freq: parseFloat(f_e14.toFixed(2)),
        // The student records V_applied. In real life they drop it till photocurrent reaches 0.
        // Because of noise and visual, maybe they drop it to -0.83 when true is -0.82.
        v0: parseFloat(v_applied.toFixed(2))
    });

    renderTable();
});

function renderTable() {
    obsBody.innerHTML = '';
    observations.forEach((o, i) => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td>${o.lambda}</td>
            <td>${o.freq.toFixed(2)}</td>
            <td class="fw-bold">${Math.abs(o.v0).toFixed(2)}</td>
        `;
        obsBody.appendChild(tr);
    });
    drawGraph();
}

function drawGraph() {
    if(!graphCtx) return;
    const W = graphCanvas.width;
    const H = graphCanvas.height;

    // White canvas background
    graphCtx.clearRect(0,0,W,H);
    graphCtx.fillStyle = '#ffffff';
    graphCtx.fillRect(0,0,W,H);

    // Padding
    const pLeft = 48;
    const pRight = 24;
    const pTop = 24;
    const pBot = 44;

    // Fixed axis ranges
    const minX = 4, maxX = 12;
    const minY = -0.5, maxY = 4.0;

    // ── Grid lines (light grey) ──
    graphCtx.strokeStyle = 'rgba(0,0,0,0.10)';
    graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    for (let x = minX; x <= maxX; x++) {
        let px = pLeft + ((x - minX) / (maxX - minX)) * (W - pLeft - pRight);
        graphCtx.moveTo(px, pTop);
        graphCtx.lineTo(px, H - pBot);
    }
    for (let y = 0; y <= maxY; y += 0.5) {
        let py = H - pBot - ((y - minY) / (maxY - minY)) * (H - pBot - pTop);
        graphCtx.moveTo(pLeft, py);
        graphCtx.lineTo(W - pRight, py);
    }
    graphCtx.stroke();

    // ── Axes (solid black) ──
    let yZero = H - pBot - ((0 - minY) / (maxY - minY)) * (H - pBot - pTop);
    graphCtx.strokeStyle = '#111111';
    graphCtx.lineWidth = 1.8;
    graphCtx.beginPath();
    graphCtx.moveTo(pLeft, yZero); graphCtx.lineTo(W - pRight, yZero); // X axis
    graphCtx.moveTo(pLeft, pTop);  graphCtx.lineTo(pLeft, H - pBot);   // Y axis
    graphCtx.stroke();

    // ── Axis tick labels ──
    graphCtx.fillStyle = '#333333';
    graphCtx.font = "11px 'Courier New', monospace";
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    for (let x = minX; x <= maxX; x++) {
        let px = pLeft + ((x - minX) / (maxX - minX)) * (W - pLeft - pRight);
        if (x > minX) graphCtx.fillText(x, px, yZero + 6);
    }
    graphCtx.textAlign = 'right';
    graphCtx.textBaseline = 'middle';
    for (let y = 0; y <= maxY; y++) {
        let py = H - pBot - ((y - minY) / (maxY - minY)) * (H - pBot - pTop);
        graphCtx.fillText(y.toFixed(1), pLeft - 8, py);
    }

    // Axis titles
    graphCtx.fillStyle = '#111111';
    graphCtx.font = "11px 'Courier New', monospace";
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    graphCtx.fillText('ν (×10¹⁴ Hz)', pLeft + (W - pLeft - pRight) / 2, H - pBot + 14);
    graphCtx.save();
    graphCtx.translate(14, pTop + (H - pTop - pBot) / 2);
    graphCtx.rotate(-Math.PI / 2);
    graphCtx.fillText('V₀ (V)', 0, 0);
    graphCtx.restore();

    // ── Best-fit line (black dashed) ──
    let n = observations.length;
    if (n >= 2) {
        let sumX=0, sumY=0, sumXY=0, sumXX=0;
        observations.forEach(o => {
            let x = o.freq, y = Math.abs(o.v0);
            sumX += x; sumY += y; sumXY += x*y; sumXX += x*x;
        });
        let den = n*sumXX - sumX*sumX;
        if (den !== 0) {
            let m = (n*sumXY - sumX*sumY) / den;
            let intercept = (sumY - m*sumX) / n;
            let py1 = H - pBot - (((m*minX + intercept) - minY) / (maxY - minY)) * (H - pBot - pTop);
            let py2 = H - pBot - (((m*maxX + intercept) - minY) / (maxY - minY)) * (H - pBot - pTop);
            graphCtx.strokeStyle = '#111111';
            graphCtx.lineWidth = 2;
            graphCtx.setLineDash([6, 4]);
            graphCtx.beginPath();
            graphCtx.moveTo(pLeft, py1);
            graphCtx.lineTo(W - pRight, py2);
            graphCtx.stroke();
            graphCtx.setLineDash([]);
        }
    }

    // ── Data points (black fill, white stroke) ──
    observations.forEach(o => {
        let px = pLeft + ((o.freq - minX) / (maxX - minX)) * (W - pLeft - pRight);
        let py = H - pBot - ((Math.abs(o.v0) - minY) / (maxY - minY)) * (H - pBot - pTop);
        graphCtx.fillStyle = '#111111';
        graphCtx.beginPath();
        graphCtx.arc(px, py, 5, 0, Math.PI*2);
        graphCtx.fill();
        graphCtx.strokeStyle = '#ffffff';
        graphCtx.lineWidth = 1.5;
        graphCtx.stroke();
    });
}

document.getElementById('clear-data').addEventListener('click', () => {
    observations = [];
    renderTable();
    document.getElementById('calculation-output').innerHTML = '';
});

function calculatePlanck() {
    if (observations.length < 3) {
        alert("Please record at least 3 readings with different wavelengths to perform a linear regression.");
        return;
    }

    // X: Freq (nu in 10^14 Hz or standard)
    // Y: V0 magnitude. 
    // Equation: e*|V0| = h*nu - Phi  =>  |V0| = (h/e)*nu - Phi/e
    // Let's take V0 magnitude |V0|.
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    let n = observations.length;

    observations.forEach(o => {
        let nu = o.freq * 1e14; // in Hz
        let v0_mag = Math.abs(o.v0); // Magnitude
        
        sumX += nu;
        sumY += v0_mag;
        sumXY += nu * v0_mag;
        sumXX += nu * nu;
    });

    let xMean = sumX / n;
    let yMean = sumY / n;

    // slope m = [ n(sumXY) - (sumX)(sumY) ] / [ n(sumXX) - (sumX)^2 ]
    let num = n * sumXY - sumX * sumY;
    let den = n * sumXX - sumX * sumX;
    
    if (den === 0) {
        alert("Provide different frequencies (wavelengths) to calculate slope.");
        return;
    }

    let m_slope = num / den; // V / Hz  (which is Volts * seconds)
    
    // slope m = h / e 
    // h = m * e
    let calc_h = m_slope * e_charge;
    
    let err = Math.abs(calc_h - h_j) / h_j * 100;

    // Formatting nice string:
    let [mantissa, exponent] = calc_h.toExponential(4).split('e');
    exponent = exponent.replace('+', '');
    let hStr = `${mantissa} \\times 10^{${exponent}}`;

    document.getElementById('calculation-output').innerHTML = `
        <div class="card shadow p-4 bg-white rounded border-success">
            <h3 class="text-success border-bottom pb-2 mb-3">Final Result: Planck's Constant</h3>
            <div class="row">
                <div class="col-md-6">
                    <h5 class="fw-bold">Linear Regression Data</h5>
                    <p class="mb-1">Slope ($V_0$ vs $\\nu$) $m = ${m_slope.toPrecision(4)}$ V·s</p>
                    <p class="mb-1">Formula: $h = m \\cdot e$</p>
                    <p class="mb-1 text-muted">Where $e = 1.602 \\times 10^{-19}$ C</p>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-info py-3 text-center mb-0">
                        <h4 class="alert-heading">Experimental Value</h4>
                        <p class="fs-4 fw-bold mb-1">$h = ${hStr}$ J·s</p>
                        <small class="text-danger">Error vs Literature: ${err.toFixed(2)}%</small>
                    </div>
                </div>
            </div>
        </div>
    `;

    if(window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
}

document.getElementById('download-pdf').addEventListener('click', () => {
    if (observations.length === 0) {
        alert("No data recorded!"); return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text("Determination of Planck's Constant \u2013 Lab Report", PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(9).setTextColor(100);
    doc.text('Formula: h = e \u00d7 slope of V\u2080 vs \u03bd    (e = 1.602 \u00d7 10\u207b\u00b9\u2079 C)', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);
    
    const tableData = observations.map((o, i) => [
        i+1, o.mat, o.lambda, o.freq, o.v0
    ]);
    
    doc.autoTable({
        startY: 67,
        head: [['#', 'Material', 'Wavelength (nm)', 'Frequency (1e14 Hz)', 'Stopping Potential (V)']],
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
    doc.text('h = e \u00d7 slope', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Planck's Constant (h) = _____________ J·s", 20, y + 8);
    doc.text('Standard Value (h) = 6.626 \u00d7 10\u207b\u00b3\u2074 J·s', 20, y + 16);
    
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion: __________________________________________________', 20, y + 16);

    if (observations.length >= 3) {
        let sumX=0, sumY=0, sumXY=0, sumXX=0, n=observations.length;
        observations.forEach(o => { let nu=o.freq*1e14; let v0m=Math.abs(o.v0); sumX+=nu; sumY+=v0m; sumXY+=nu*v0m; sumXX+=nu*nu; });
        let den = n*sumXX - sumX*sumX;
        if(den !== 0) {
            let m_slope = (n*sumXY - sumX*sumY) / den;
            let calc_h = m_slope * e_charge;
            doc.setTextColor(30, 80, 160);
            doc.text(`[Computed] Slope = ${m_slope.toPrecision(4)} V·s,  h = ${calc_h.toExponential(4)} J·s`, 20, y + 36);
        }
    }

    doc.save("PlancksExp_Lab_Report.pdf");
});

window.onload = () => {
    init();
    drawGraph();
};