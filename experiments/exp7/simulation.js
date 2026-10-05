"use strict";

// ─── CANVAS SETUP ────────────────────────────────────────────
const canvas = document.getElementById("dgCanvas");
const ctx = canvas.getContext("2d");

const patternCanvas = document.getElementById("patternCanvas");
const patternCtx = patternCanvas.getContext("2d");

const graphCanvas = document.getElementById("graphCanvas");
const graphCtx = graphCanvas ? graphCanvas.getContext("2d") : null;

// ─── DOM ELEMENTS ────────────────────────────────────────────
const waveSlider = document.getElementById("wave-slider");
const waveBadge = document.getElementById("wave-badge");
const sourceSelect = document.getElementById("source-select");
const gratingSelect = document.getElementById("grating-select");
const dBadge = document.getElementById("d-badge");
const orderSelect = document.getElementById("order-select");
const thetaTheoBadge = document.getElementById("theta-theo-badge");
const thetaSlider = document.getElementById("theta-slider");
const thetaMeasBadge = document.getElementById("theta-meas-badge");
const alignStatus = document.getElementById("align-status");
const statusLed = document.getElementById("status-led");
const experimentModeLabel = document.getElementById("experiment-mode-label");
const whiteLightToggle = document.getElementById("white-light-toggle");
const wavelengthControls = document.getElementById("wavelength-controls");
const addReadingBtn = document.getElementById("add-reading");
const obsBody = document.getElementById("obs-body");
const btnFineUp = document.getElementById("theta-fine-up");
const btnFineDown = document.getElementById("theta-fine-down");

// ─── STATE ───────────────────────────────────────────────────
let lambda_nm = 589;        // current wavelength (nm)
let N_lpmm = 600;           // lines per mm
let orderN = 1;             // diffraction order
let theta_meas = 0;         // measured angle (degrees)
let isWhiteLight = false;   // white light mode
let observations = [];      // recorded observations
let animFrameId = null;
let animTick = 0;           // animation tick counter

// Ray animation particles
let rays = [];

// ─── PHYSICS CONSTANTS ───────────────────────────────────────
const WHITE_WAVELENGTHS = [400, 440, 480, 520, 560, 600, 640, 680, 700];

// ─── COLOR UTILITIES ─────────────────────────────────────────
function getWavelengthColor(wl) {
    if (wl < 380) return { r: 100, g: 0, b: 150, a: 1 };
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
        r = 1; g = 0; b = 0;
    }

    let factor;
    if (wl >= 380 && wl < 420) factor = 0.3 + 0.7 * (wl - 380) / (420 - 380);
    else if (wl >= 420 && wl < 701) factor = 1.0;
    else if (wl >= 701 && wl <= 780) factor = 0.3 + 0.7 * (780 - wl) / (780 - 700);
    else factor = 0.3;

    return {
        r: Math.round(r * 255 * factor),
        g: Math.round(g * 255 * factor),
        b: Math.round(b * 255 * factor),
        a: 1
    };
}

function colorStr(wl, alpha) {
    const c = getWavelengthColor(wl);
    return `rgba(${c.r},${c.g},${c.b},${alpha !== undefined ? alpha : 1})`;
}

function colorStrRGB(r, g, b, a) {
    return `rgba(${r},${g},${b},${a !== undefined ? a : 1})`;
}

// ─── PHYSICS ENGINE ──────────────────────────────────────────
function gratingSpacing_m(N_linesPerMM) {
    // d = 1 / N   (N in lines/m)
    return 1.0 / (N_linesPerMM * 1000);
}

function theoreticalAngle_deg(order, lambda_m, d_m) {
    if (order === 0) return 0;
    const sinTheta = (order * lambda_m) / d_m;
    if (Math.abs(sinTheta) > 1) return null; // impossible order
    return (Math.asin(sinTheta) * 180) / Math.PI;
}

function calculatedWavelength_nm(theta_deg, order, d_m) {
    if (order === 0) return null;
    const sinTheta = Math.sin((theta_deg * Math.PI) / 180);
    return (d_m * sinTheta / order) * 1e9;
}

function isOrderPossible(order, lambda_m, d_m) {
    if (order === 0) return true;
    return Math.abs(order * lambda_m / d_m) <= 1;
}

// ─── UPDATE PARAMS ───────────────────────────────────────────
function updateParams() {
    // Read UI values
    lambda_nm = parseInt(waveSlider.value);
    N_lpmm = parseInt(gratingSelect.value);
    orderN = parseInt(orderSelect.value);
    theta_meas = parseFloat(thetaSlider.value);
    isWhiteLight = whiteLightToggle.checked;

    const d_m = gratingSpacing_m(N_lpmm);

    // Update badges
    waveBadge.textContent = lambda_nm + " nm";
    thetaMeasBadge.textContent = theta_meas.toFixed(2) + "°";

    // Update d badge
    const d_exp = d_m.toExponential(3);
    dBadge.innerHTML = `d = ${d_exp} m`;

    // Theoretical angle
    const lambda_m = lambda_nm * 1e-9;
    const theo = theoreticalAngle_deg(orderN, lambda_m, d_m);
    if (theo === null) {
        thetaTheoBadge.textContent = "No maximum (impossible order)";
        alignStatus.textContent = "No principal maximum exists for this order.";
        alignStatus.classList.remove("aligned");
        statusLed.classList.remove("aligned");
        experimentModeLabel.textContent = "Order Not Possible";
    } else {
        thetaTheoBadge.textContent = `θ = ${theo.toFixed(2)}°`;

        // Check alignment (within ±0.5°)
        const diff = Math.abs(theta_meas - theo);
        if (diff <= 0.5) {
            alignStatus.textContent = "✓ Maximum detected — Reading can be recorded";
            alignStatus.classList.add("aligned");
            statusLed.classList.add("aligned");
            experimentModeLabel.textContent = "Maximum Detected";
        } else if (diff <= 2.0) {
            alignStatus.textContent = `⟶ Close — shift by ${(theo - theta_meas).toFixed(2)}°`;
            alignStatus.classList.remove("aligned");
            statusLed.classList.remove("aligned");
            experimentModeLabel.textContent = "Near Maximum";
        } else {
            alignStatus.textContent = "Adjust telescope to locate the principal maximum";
            alignStatus.classList.remove("aligned");
            statusLed.classList.remove("aligned");
            experimentModeLabel.textContent = "Experiment Running";
        }
    }

    // Disable wavelength controls in white light mode
    const wlControls = document.getElementById("wavelength-controls");
    if (wlControls) {
        wlControls.style.opacity = isWhiteLight ? "0.35" : "1";
        wlControls.style.pointerEvents = isWhiteLight ? "none" : "auto";
    }

    // Trigger MathJax re-render
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
}

// ─── INITIALIZATION ──────────────────────────────────────────
function init() {
    waveSlider.addEventListener("input", () => {
        sourceSelect.value = ""; // deselect preset
        updateParams();
    });

    sourceSelect.addEventListener("change", () => {
        if (sourceSelect.value) {
            waveSlider.value = sourceSelect.value;
            lambda_nm = parseInt(sourceSelect.value);
            updateParams();
        }
    });

    gratingSelect.addEventListener("change", updateParams);
    orderSelect.addEventListener("change", updateParams);
    whiteLightToggle.addEventListener("change", updateParams);

    thetaSlider.addEventListener("input", updateParams);

    btnFineUp.addEventListener("click", () => {
        let v = parseFloat(thetaSlider.value);
        if (v < 90) {
            thetaSlider.value = Math.min(90, v + 0.05).toFixed(2);
            updateParams();
        }
    });

    btnFineDown.addEventListener("click", () => {
        let v = parseFloat(thetaSlider.value);
        if (v > 0) {
            thetaSlider.value = Math.max(0, v - 0.05).toFixed(2);
            updateParams();
        }
    });

    // Set initial slider to match sodium D theoretical angle
    const d0 = gratingSpacing_m(600);
    const initialTheta = theoreticalAngle_deg(1, 589e-9, d0);
    if (initialTheta !== null) {
        thetaSlider.value = (initialTheta + 0.8).toFixed(2); // slight offset so student has to find it
    }

    updateParams();
    renderLoop();
}

// ─── APPARATUS DRAWING ───────────────────────────────────────
function drawBackground(W, H) {
    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
}

function drawLightSource(W, H) {
    const sx = 30, sy = H / 2 - 40;

    // Stand
    ctx.fillStyle = "#1c1e1d";
    ctx.fillRect(65, H / 2 + 20, 12, 100);
    ctx.fillStyle = "#0c0d0c";
    ctx.fillRect(45, H / 2 + 115, 52, 12);

    // Housing
    const grd = ctx.createLinearGradient(sx, sy, sx, sy + 80);
    grd.addColorStop(0, "#4a534c");
    grd.addColorStop(0.2, "#2f3631");
    grd.addColorStop(1, "#181c19");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(sx, sy, 130, 80, 6);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Emitter bulb glow
    const clr = isWhiteLight ? { r: 255, g: 255, b: 255 } : getWavelengthColor(lambda_nm);
    const glow = ctx.createRadialGradient(sx + 110, H / 2, 0, sx + 110, H / 2, 22);
    glow.addColorStop(0, colorStrRGB(clr.r, clr.g, clr.b, 1));
    glow.addColorStop(0.5, colorStrRGB(clr.r, clr.g, clr.b, 0.5));
    glow.addColorStop(1, colorStrRGB(clr.r, clr.g, clr.b, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sx + 90, H / 2 - 22, 44, 44);

    // Aperture slit
    ctx.fillStyle = "#060706";
    ctx.fillRect(sx + 125, H / 2 - 16, 8, 32);
    // Slit opening
    ctx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, 0.9);
    ctx.fillRect(sx + 125, H / 2 - 6, 8, 12);

    // Label
    ctx.fillStyle = "#b0bcb7";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIGHT SOURCE", sx + 65, sy - 10);
}

function drawCollimator(W, H) {
    const cx = 185;
    const cy = H / 2;

    // Tube
    ctx.fillStyle = "#2a2d2b";
    ctx.fillRect(cx, cy - 18, 80, 36);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy - 18, 80, 36);

    // Lens at the end
    ctx.beginPath();
    ctx.ellipse(cx + 80, cy, 9, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = isWhiteLight ? "rgba(200,220,255,0.35)" : colorStr(lambda_nm, 0.3);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#888";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COLLIMATOR", cx + 40, H / 2 - 26);
}

function drawGrating(W, H) {
    const gx = 490;
    const gy = H / 2 - 80;
    const gh = 160;

    // Frame
    ctx.fillStyle = "#1a1c1b";
    ctx.fillRect(gx - 8, gy, 8, gh);
    ctx.fillRect(gx + 16, gy, 8, gh);
    // Frame top/bottom bars
    ctx.fillStyle = "#333";
    ctx.fillRect(gx - 8, gy, 32, 8);
    ctx.fillRect(gx - 8, gy + gh - 8, 32, 8);

    // Grating lines
    const numLines = Math.min(60, Math.floor(N_lpmm / 20));
    const lineSpacing = gh / numLines;
    ctx.strokeStyle = "rgba(180,220,255,0.55)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= numLines; i++) {
        const y = gy + i * lineSpacing;
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx + 16, y);
        ctx.stroke();
    }

    // Grating glass tint
    const tgrad = ctx.createLinearGradient(gx, 0, gx + 16, 0);
    tgrad.addColorStop(0, "rgba(180,220,255,0.07)");
    tgrad.addColorStop(0.5, "rgba(180,220,255,0.18)");
    tgrad.addColorStop(1, "rgba(180,220,255,0.07)");
    ctx.fillStyle = tgrad;
    ctx.fillRect(gx, gy + 8, 16, gh - 16);

    // Stand
    ctx.fillStyle = "#1a1c1b";
    ctx.fillRect(gx - 4, gy + gh, 24, 50);
    ctx.fillRect(gx - 14, gy + gh + 44, 44, 10);

    // Label
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DIFFRACTION", gx + 8, gy - 20);
    ctx.fillText("GRATING", gx + 8, gy - 6);
    ctx.fillStyle = "#666";
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText(`N = ${N_lpmm} l/mm`, gx + 8, gy + gh + 72);
}

function drawTelescope(W, H) {
    const tx = 900;
    const cy = H / 2;

    // Pivot dot at grating center projected
    // Telescope tube rotated by theta_meas
    const theta_rad = (theta_meas * Math.PI) / 180;

    ctx.save();
    ctx.translate(500, cy); // pivot at grating
    ctx.rotate(-theta_rad); // rotate CCW by theta

    // Telescope tube
    ctx.fillStyle = "#2a2d2b";
    ctx.beginPath();
    ctx.roundRect(80, -15, 340, 30, 4);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Objective lens
    ctx.beginPath();
    ctx.ellipse(80, 0, 10, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = isWhiteLight ? "rgba(200,220,255,0.3)" : colorStr(lambda_nm, 0.25);
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyepiece
    ctx.fillStyle = "#1a1c1b";
    ctx.fillRect(395, -20, 26, 40);
    ctx.fillStyle = "#333";
    ctx.fillRect(420, -14, 10, 28);

    // Label
    ctx.fillStyle = "#888";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TELESCOPE", 230, -24);

    ctx.restore();

    // Angle arc indicator at grating
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(500, cy, 70, -Math.PI / 2, -(Math.PI / 2) - theta_rad, true);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle label
    if (theta_meas > 0.5) {
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "italic 13px 'Courier New'";
        ctx.textAlign = "left";
        const midAngleRad = -(Math.PI / 2) - theta_rad / 2;
        const rx = 500 + 90 * Math.cos(midAngleRad);
        const ry = cy + 90 * Math.sin(midAngleRad);
        ctx.fillText(`θ = ${theta_meas.toFixed(1)}°`, rx + 5, ry);
    }
}

function drawIncidentBeam(W, H) {
    const clr = isWhiteLight ? { r: 255, g: 255, b: 255 } : getWavelengthColor(lambda_nm);

    if (isWhiteLight) {
        // Draw rainbow beam
        const rainbowWLs = [650, 590, 550, 490, 440, 400];
        rainbowWLs.forEach((wl, idx) => {
            const c = getWavelengthColor(wl);
            const yOffset = (idx - 2.5) * 2;
            const g = ctx.createLinearGradient(270, 0, 490, 0);
            g.addColorStop(0, colorStrRGB(c.r, c.g, c.b, 0));
            g.addColorStop(0.5, colorStrRGB(c.r, c.g, c.b, 0.6));
            g.addColorStop(1, colorStrRGB(c.r, c.g, c.b, 0.6));
            ctx.fillStyle = g;
            ctx.fillRect(270, H / 2 - 6 + yOffset, 220, 2.5);
        });
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(270, H / 2 - 2, 220, 4);
    } else {
        const alpha = 0.85;
        const g = ctx.createLinearGradient(270, 0, 490, 0);
        g.addColorStop(0, colorStrRGB(clr.r, clr.g, clr.b, 0));
        g.addColorStop(0.4, colorStrRGB(clr.r, clr.g, clr.b, alpha));
        g.addColorStop(1, colorStrRGB(clr.r, clr.g, clr.b, alpha));
        ctx.fillStyle = g;
        ctx.fillRect(270, H / 2 - 8, 220, 16);

        // Bright core
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(270, H / 2 - 2, 220, 4);

        // Lambda label on beam
        ctx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, 1);
        ctx.font = "italic 13px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText(`λ = ${lambda_nm} nm`, 375, H / 2 - 16);
    }
}

function drawDiffractedRays(W, H) {
    const gx = 500; // grating center x
    const cy = H / 2;
    const d_m = gratingSpacing_m(N_lpmm);

    // Draw transmitted (0th order) and diffracted orders
    const ordersToShow = [0, 1, 2, 3];

    if (isWhiteLight) {
        // Show white light spectrum
        for (let ord of [1, 2]) {
            WHITE_WAVELENGTHS.forEach(wl => {
                const lm = wl * 1e-9;
                if (!isOrderPossible(ord, lm, d_m)) return;
                const th = theoreticalAngle_deg(ord, lm, d_m);
                if (th === null) return;
                const th_r = (th * Math.PI) / 180;

                // Draw both positive and negative side
                [-1, 1].forEach(side => {
                    const endX = gx + 420 * Math.cos(th_r * side);
                    const endY = cy - 420 * Math.sin(th_r * side);
                    const c = getWavelengthColor(wl);
                    ctx.strokeStyle = colorStrRGB(c.r, c.g, c.b, 0.45);
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([8, 5]);
                    ctx.beginPath();
                    ctx.moveTo(gx, cy);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                });
            });
        }

        // 0th order (white line straight through)
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gx, cy);
        ctx.lineTo(gx + 420, cy);
        ctx.stroke();

    } else {
        const lambda_m = lambda_nm * 1e-9;
        const clr = getWavelengthColor(lambda_nm);

        ordersToShow.forEach(ord => {
            if (!isOrderPossible(ord, lambda_m, d_m)) return;
            const th = theoreticalAngle_deg(ord, lambda_m, d_m);
            if (th === null) return;
            const th_r = (th * Math.PI) / 180;

            const isSelected = (ord === orderN);
            const baseAlpha = isSelected ? 0.9 : 0.4;
            const lineW = isSelected ? 2.5 : 1.2;

            if (ord === 0) {
                // 0th order — straight
                ctx.strokeStyle = colorStrRGB(clr.r, clr.g, clr.b, baseAlpha);
                ctx.lineWidth = lineW;
                ctx.beginPath();
                ctx.moveTo(gx, cy);
                ctx.lineTo(gx + 420, cy);
                ctx.stroke();
            } else {
                // +order
                const endX1 = gx + 420 * Math.cos(th_r);
                const endY1 = cy - 420 * Math.sin(th_r);
                ctx.strokeStyle = colorStrRGB(clr.r, clr.g, clr.b, baseAlpha);
                ctx.lineWidth = lineW;
                if (!isSelected) ctx.setLineDash([8, 5]);
                ctx.beginPath();
                ctx.moveTo(gx, cy);
                ctx.lineTo(endX1, endY1);
                ctx.stroke();
                ctx.setLineDash([]);

                // –order
                const endX2 = gx + 420 * Math.cos(th_r);
                const endY2 = cy + 420 * Math.sin(th_r);
                ctx.strokeStyle = colorStrRGB(clr.r, clr.g, clr.b, baseAlpha);
                ctx.lineWidth = lineW;
                if (!isSelected) ctx.setLineDash([8, 5]);
                ctx.beginPath();
                ctx.moveTo(gx, cy);
                ctx.lineTo(endX2, endY2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Order labels
                if (ord <= 2) {
                    ctx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, 0.8);
                    ctx.font = "11px 'Courier New'";
                    ctx.textAlign = "left";
                    ctx.fillText(`n=${ord}`, endX1 + 4, endY1 - 2);
                    ctx.fillText(`n=-${ord}`, endX2 + 4, endY2 + 12);
                }
            }
        });

        // Telescope ray overlay
        const thMeas_r = (theta_meas * Math.PI) / 180;
        const thTrans_r = (theoreticalAngle_deg(orderN, lambda_m, d_m) * Math.PI) / 180 || 0;
        const diff = Math.abs(theta_meas - (theoreticalAngle_deg(orderN, lambda_m, d_m) || 0));
        if (diff <= 0.5 && orderN > 0) {
            // Glow on detected ray
            ctx.shadowBlur = 14;
            ctx.shadowColor = colorStrRGB(clr.r, clr.g, clr.b, 1);
            ctx.strokeStyle = colorStrRGB(clr.r, clr.g, clr.b, 1);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(gx, cy);
            ctx.lineTo(gx + 420 * Math.cos(thMeas_r), cy - 420 * Math.sin(thMeas_r));
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
}

function drawAnimatedRayParticles(W, H) {
    animTick++;
    const gx = 500;
    const cy = H / 2;
    const d_m = gratingSpacing_m(N_lpmm);

    // Spawn particles along incident beam periodically
    if (animTick % 4 === 0) {
        if (isWhiteLight) {
            WHITE_WAVELENGTHS.filter((_, i) => i % 3 === 0).forEach(wl => {
                rays.push({ x: 175, y: cy, wl: wl, phase: "incident", t: 0, ord: 1, side: 1 });
            });
        } else {
            rays.push({ x: 175, y: cy, wl: lambda_nm, phase: "incident", t: 0, ord: orderN, side: 1 });
        }
    }

    // Update and draw particles
    const newRays = [];
    const speed = 6;

    for (const ray of rays) {
        const clr = getWavelengthColor(ray.wl);
        const lambda_m = ray.wl * 1e-9;

        if (ray.phase === "incident") {
            ray.x += speed;
            ray.t++;
            if (ray.x < gx) {
                // Draw
                ctx.beginPath();
                ctx.arc(ray.x, cy, 3, 0, Math.PI * 2);
                ctx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, 0.9);
                ctx.fill();
                newRays.push(ray);
            } else {
                // Diffract — spawn a particle in the diffracted direction
                if (isOrderPossible(ray.ord, lambda_m, d_m)) {
                    const th = theoreticalAngle_deg(ray.ord, lambda_m, d_m);
                    if (th !== null) {
                        const th_r = (th * Math.PI) / 180;
                        const dx = speed * Math.cos(th_r);
                        const dy = -speed * Math.sin(th_r) * ray.side;
                        newRays.push({ x: gx, y: cy, wl: ray.wl, phase: "diffracted", dx, dy, t: 0 });
                    }
                }
                // Always pass 0th order
                newRays.push({ x: gx, y: cy, wl: ray.wl, phase: "diffracted", dx: speed, dy: 0, t: 0 });
            }
        } else if (ray.phase === "diffracted") {
            ray.x += ray.dx;
            ray.y += ray.dy;
            ray.t++;
            if (ray.x < W + 10 && ray.y > -10 && ray.y < H + 10) {
                ctx.beginPath();
                ctx.arc(ray.x, ray.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, Math.max(0, 0.85 - ray.t * 0.01));
                ctx.fill();
                newRays.push(ray);
            }
        }
    }

    rays = newRays.slice(-200); // cap
}

function drawScreenIndicators(W, H) {
    // Vertical screen at right
    const sx = 940;
    ctx.fillStyle = "#1e2020";
    ctx.fillRect(sx, 60, 10, H - 120);
    ctx.fillStyle = "#333";
    ctx.fillRect(sx, 55, 10, 10);
    ctx.fillRect(sx, H - 65, 10, 10);

    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCREEN", sx + 5, 48);
}

// ─── MAIN CANVAS RENDER LOOP ─────────────────────────────────
function renderLoop() {
    const W = canvas.width;
    const H = canvas.height;

    drawBackground(W, H);
    drawIncidentBeam(W, H);
    drawLightSource(W, H);
    drawCollimator(W, H);
    drawGrating(W, H);
    drawDiffractedRays(W, H);
    drawAnimatedRayParticles(W, H);
    drawScreenIndicators(W, H);
    drawTelescope(W, H);

    animFrameId = requestAnimationFrame(renderLoop);
}

// ─── DIFFRACTION PATTERN CANVAS ──────────────────────────────
function drawDiffractionPattern() {
    const W = patternCanvas.width;
    const H = patternCanvas.height;
    patternCtx.clearRect(0, 0, W, H);
    patternCtx.fillStyle = "#0a0a0a";
    patternCtx.fillRect(0, 0, W, H);

    const d_m = gratingSpacing_m(N_lpmm);
    const cx = W / 2;
    const maxOrders = 3;
    const scale = (W / 2 - 30) / 1.0; // pixels per unit sinTheta

    if (isWhiteLight) {
        // Draw white light spectrum
        // Render from red outward then to violet so violet is on top
        const wls = [700, 650, 600, 560, 520, 490, 440, 400];
        for (let ord = 1; ord <= maxOrders; ord++) {
            wls.forEach(wl => {
                const lm = wl * 1e-9;
                if (!isOrderPossible(ord, lm, d_m)) return;
                const sinT = ord * lm / d_m;
                const px_pos = cx + sinT * scale;
                const px_neg = cx - sinT * scale;
                const clr = getWavelengthColor(wl);

                // Each wavelength is a vertical stripe of its color
                const bw = Math.max(3, 8 - ord * 2);
                [-1, 1].forEach(side => {
                    const bx = side === 1 ? px_pos : px_neg;
                    const grd = patternCtx.createLinearGradient(bx - bw, 0, bx + bw, 0);
                    grd.addColorStop(0, colorStrRGB(clr.r, clr.g, clr.b, 0));
                    grd.addColorStop(0.5, colorStrRGB(clr.r, clr.g, clr.b, 0.9 / ord));
                    grd.addColorStop(1, colorStrRGB(clr.r, clr.g, clr.b, 0));
                    patternCtx.fillStyle = grd;
                    patternCtx.fillRect(bx - bw, 8, bw * 2, H - 16);
                });
            });
        }

        // 0th order — white
        const grd0 = patternCtx.createLinearGradient(cx - 15, 0, cx + 15, 0);
        grd0.addColorStop(0, "rgba(255,255,255,0)");
        grd0.addColorStop(0.5, "rgba(255,255,255,1)");
        grd0.addColorStop(1, "rgba(255,255,255,0)");
        patternCtx.fillStyle = grd0;
        patternCtx.fillRect(cx - 15, 8, 30, H - 16);

    } else {
        const lambda_m = lambda_nm * 1e-9;
        const clr = getWavelengthColor(lambda_nm);

        for (let ord = -maxOrders; ord <= maxOrders; ord++) {
            if (!isOrderPossible(Math.abs(ord), lambda_m, d_m)) continue;
            const sinT = ord * lambda_m / d_m;
            const px = cx + sinT * scale;

            const isSelected = (ord === orderN || ord === -orderN);
            const brightness = isSelected ? 1.0 : 0.6;
            const bw = isSelected ? 10 : 7;

            const grd = patternCtx.createLinearGradient(px - bw * 2, 0, px + bw * 2, 0);
            grd.addColorStop(0, colorStrRGB(clr.r, clr.g, clr.b, 0));
            grd.addColorStop(0.5, colorStrRGB(clr.r, clr.g, clr.b, brightness));
            grd.addColorStop(1, colorStrRGB(clr.r, clr.g, clr.b, 0));
            patternCtx.fillStyle = grd;
            patternCtx.fillRect(px - bw * 2, 8, bw * 4, H - 24);

            // Order label
            patternCtx.fillStyle = isSelected ? "rgba(255,255,255,0.9)" : "rgba(150,150,150,0.7)";
            patternCtx.font = "10px 'Courier New'";
            patternCtx.textAlign = "center";
            patternCtx.fillText(ord === 0 ? "0" : `${ord > 0 ? "+" : ""}${ord}`, px, H - 4);
        }
    }

    // Telescope cursor on pattern
    if (!isWhiteLight) {
        const lambda_m = lambda_nm * 1e-9;
        const sinT_meas = Math.sin((theta_meas * Math.PI) / 180);
        const cursorX = cx + sinT_meas * scale;
        patternCtx.strokeStyle = "rgba(255,255,255,0.7)";
        patternCtx.lineWidth = 1.5;
        patternCtx.setLineDash([4, 4]);
        patternCtx.beginPath();
        patternCtx.moveTo(cursorX, 6);
        patternCtx.lineTo(cursorX, H - 16);
        patternCtx.stroke();
        patternCtx.setLineDash([]);

        // Tick
        patternCtx.fillStyle = "rgba(255,255,255,0.8)";
        patternCtx.beginPath();
        patternCtx.moveTo(cursorX - 5, 6);
        patternCtx.lineTo(cursorX + 5, 6);
        patternCtx.lineTo(cursorX, 12);
        patternCtx.closePath();
        patternCtx.fill();
    }
}

// Continuously redraw pattern
function patternLoop() {
    drawDiffractionPattern();
    requestAnimationFrame(patternLoop);
}

// ─── OBSERVATION TABLE ───────────────────────────────────────
function renderTable() {
    obsBody.innerHTML = '';
    observations.forEach((o, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${o.lambda}</td>
            <td>${o.N}</td>
            <td>${o.d_m.toExponential(3)}</td>
            <td>${o.n}</td>
            <td>${o.thetaTheo.toFixed(2)}</td>
            <td class="fw-bold">${o.thetaMeas.toFixed(2)}</td>
            <td>${o.calcLambda !== null ? o.calcLambda.toFixed(1) : '—'}</td>
        `;
        obsBody.appendChild(tr);
    });
    drawGraph();
}

// ─── ADD READING ─────────────────────────────────────────────
addReadingBtn.addEventListener("click", () => {
    const d_m = gratingSpacing_m(N_lpmm);
    const lambda_m = lambda_nm * 1e-9;
    const theo = theoreticalAngle_deg(orderN, lambda_m, d_m);

    if (theo === null) {
        alert("No principal maximum exists for this order with current settings.");
        return;
    }

    if (orderN === 0) {
        alert("Order 0 (central maximum) is not useful for wavelength determination. Select order 1, 2, or 3.");
        return;
    }

    // Add small measurement noise (±0.15°) for realism
    const noise = (Math.random() - 0.5) * 0.3;
    const measWithNoise = theta_meas + noise;

    const calcLambda = calculatedWavelength_nm(measWithNoise, orderN, d_m);

    observations.push({
        lambda: lambda_nm,
        N: N_lpmm,
        d_m: d_m,
        n: orderN,
        thetaTheo: theo,
        thetaMeas: parseFloat(measWithNoise.toFixed(2)),
        calcLambda: calcLambda !== null ? parseFloat(calcLambda.toFixed(2)) : null,
        sinTheta: Math.sin((measWithNoise * Math.PI) / 180)
    });

    renderTable();
});

// ─── GRAPH ───────────────────────────────────────────────────
function drawGraph() {
    if (!graphCtx) return;
    const W = graphCanvas.width;
    const H = graphCanvas.height;

    graphCtx.clearRect(0, 0, W, H);
    graphCtx.fillStyle = '#ffffff';
    graphCtx.fillRect(0, 0, W, H);

    const pLeft = 55, pRight = 24, pTop = 28, pBot = 50;

    // Axis range: λ from 380 to 720 nm; sinθ from 0 to 1.0
    const minX = 380, maxX = 720;
    const minY = 0, maxY = 1.0;

    const toCanvasX = (lam) => pLeft + ((lam - minX) / (maxX - minX)) * (W - pLeft - pRight);
    const toCanvasY = (s) => H - pBot - ((s - minY) / (maxY - minY)) * (H - pBot - pTop);

    // Grid
    graphCtx.strokeStyle = 'rgba(0,0,0,0.08)';
    graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    for (let lam = 400; lam <= 720; lam += 50) {
        const px = toCanvasX(lam);
        graphCtx.moveTo(px, pTop); graphCtx.lineTo(px, H - pBot);
    }
    for (let s = 0; s <= 1.0; s += 0.1) {
        const py = toCanvasY(s);
        graphCtx.moveTo(pLeft, py); graphCtx.lineTo(W - pRight, py);
    }
    graphCtx.stroke();

    // Axes
    graphCtx.strokeStyle = '#111111';
    graphCtx.lineWidth = 1.8;
    graphCtx.beginPath();
    graphCtx.moveTo(pLeft, pTop); graphCtx.lineTo(pLeft, H - pBot);
    graphCtx.moveTo(pLeft, H - pBot); graphCtx.lineTo(W - pRight, H - pBot);
    graphCtx.stroke();

    // Tick labels
    graphCtx.fillStyle = '#333';
    graphCtx.font = "10px 'Courier New'";
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    for (let lam = 400; lam <= 700; lam += 50) {
        graphCtx.fillText(lam, toCanvasX(lam), H - pBot + 6);
    }
    graphCtx.textAlign = 'right';
    graphCtx.textBaseline = 'middle';
    for (let s = 0; s <= 1.0; s += 0.2) {
        graphCtx.fillText(s.toFixed(1), pLeft - 8, toCanvasY(s));
    }

    // Axis titles
    graphCtx.fillStyle = '#111';
    graphCtx.font = "11px 'Courier New'";
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    graphCtx.fillText('λ (nm)', pLeft + (W - pLeft - pRight) / 2, H - pBot + 22);
    graphCtx.save();
    graphCtx.translate(14, pTop + (H - pTop - pBot) / 2);
    graphCtx.rotate(-Math.PI / 2);
    graphCtx.fillText('sin θ', 0, 0);
    graphCtx.restore();

    // Graph title
    graphCtx.fillStyle = '#333';
    graphCtx.font = "bold 11px sans-serif";
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'top';
    graphCtx.fillText('sin θ vs λ', pLeft + (W - pLeft - pRight) / 2, 6);

    if (observations.length >= 2) {
        // Linear regression: y = m*x + b where x = lambda_nm*1e-9 (m), y = sinTheta
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        const n = observations.length;
        observations.forEach(o => {
            const x = o.lambda; // nm (for graph display, regression also in nm)
            const y = o.sinTheta;
            sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
        });
        const den = n * sumXX - sumX * sumX;
        if (den !== 0) {
            const m = (n * sumXY - sumX * sumY) / den;
            const b = (sumY - m * sumX) / n;
            const y1 = m * minX + b;
            const y2 = m * maxX + b;
            graphCtx.strokeStyle = '#111111';
            graphCtx.lineWidth = 2;
            graphCtx.setLineDash([6, 4]);
            graphCtx.beginPath();
            graphCtx.moveTo(toCanvasX(minX), toCanvasY(y1));
            graphCtx.lineTo(toCanvasX(maxX), toCanvasY(y2));
            graphCtx.stroke();
            graphCtx.setLineDash([]);
        }
    }

    // Data points (colored by wavelength)
    observations.forEach(o => {
        const px = toCanvasX(o.lambda);
        const py = toCanvasY(o.sinTheta);
        const clr = getWavelengthColor(o.lambda);
        graphCtx.beginPath();
        graphCtx.arc(px, py, 5, 0, Math.PI * 2);
        graphCtx.fillStyle = colorStrRGB(clr.r, clr.g, clr.b, 1);
        graphCtx.fill();
        graphCtx.strokeStyle = '#111111';
        graphCtx.lineWidth = 1.5;
        graphCtx.stroke();
    });
}

// ─── CLEAR DATA ──────────────────────────────────────────────
document.getElementById('clear-data').addEventListener('click', () => {
    observations = [];
    renderTable();
    document.getElementById('calculation-output').innerHTML = '';
});

// ─── CALCULATE RESULT ────────────────────────────────────────
function calculateResult() {
    const calcOutput = document.getElementById('calculation-output');

    if (observations.length < 3) {
        calcOutput.innerHTML = `
            <div class="alert alert-warning">
                <strong>Insufficient data.</strong> Please record at least 3 readings with different wavelengths to perform linear regression.
            </div>`;
        return;
    }

    // Regression: sinθ = (n/d) × λ  →  sinθ vs λ(m)
    // Using λ in nm for x, the slope m_nm is in nm⁻¹
    // then d = n / (slope_m), slope_m = slope_nm × 1e9
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n_obs = observations.length;

    observations.forEach(o => {
        const x = o.lambda * 1e-9; // metres
        const y = o.sinTheta;
        sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
    });

    const den = n_obs * sumXX - sumX * sumX;
    if (den === 0) {
        alert("Use different wavelengths to compute a meaningful slope.");
        return;
    }

    const slope_m = (n_obs * sumXY - sumX * sumY) / den; // sinθ per metre
    const intercept = (sumY - slope_m * sumX) / n_obs;

    // R²
    const yMean = sumY / n_obs;
    let ssTot = 0, ssRes = 0;
    observations.forEach(o => {
        const x = o.lambda * 1e-9;
        const yPred = slope_m * x + intercept;
        ssTot += (o.sinTheta - yMean) ** 2;
        ssRes += (o.sinTheta - yPred) ** 2;
    });
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

    // Use modal order (most common n in recordings)
    const orderCounts = {};
    observations.forEach(o => { orderCounts[o.n] = (orderCounts[o.n] || 0) + 1; });
    const modalOrder = parseInt(Object.keys(orderCounts).sort((a, b) => orderCounts[b] - orderCounts[a])[0]);

    // d = n / slope_m
    const d_exp = modalOrder / slope_m;
    const N_exp = 1.0 / d_exp; // lines/m
    const N_exp_lpmm = N_exp / 1000;

    // Theoretical N — use first observation's N for comparison
    const N_theo = observations[0].N; // lines/mm
    const d_theo = gratingSpacing_m(N_theo);
    const percError = Math.abs(N_exp_lpmm - N_theo) / N_theo * 100;

    calcOutput.innerHTML = `
        <div class="card shadow p-4 bg-white rounded">
            <h3 class="border-bottom pb-2 mb-3" style="color:#111;">Final Result: Diffraction Grating Analysis</h3>
            <div class="row g-4">
                <div class="col-md-6">
                    <h5 class="fw-bold">Linear Regression (sin θ vs λ)</h5>
                    <p class="mb-1">Number of readings: <strong>${n_obs}</strong></p>
                    <p class="mb-1">Slope $m = \\frac{n}{d}$: <strong>${slope_m.toExponential(4)} m⁻¹</strong></p>
                    <p class="mb-1">Intercept: <strong>${intercept.toFixed(4)}</strong></p>
                    <p class="mb-1">R²: <strong>${r2.toFixed(4)}</strong></p>
                    <hr>
                    <p class="mb-1">Modal order used: <strong>n = ${modalOrder}</strong></p>
                    <p class="mb-1">$d = n / m = ${modalOrder} / ${slope_m.toExponential(3)}$</p>
                    <p class="mb-1">Experimental $d = $ <strong>${d_exp.toExponential(4)} m</strong></p>
                    <p class="mb-1">Experimental $N = 1/d = $ <strong>${(N_exp_lpmm).toFixed(1)} lines/mm</strong></p>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-info py-3 text-center mb-0">
                        <h4 class="alert-heading">Experimental Result</h4>
                        <p class="fs-5 fw-bold mb-1">Grating Density = ${N_exp_lpmm.toFixed(0)} lines/mm</p>
                        <p class="mb-1">Theoretical: ${N_theo} lines/mm</p>
                        <p class="mb-1">Grating Spacing d = ${d_exp.toExponential(4)} m</p>
                        <hr>
                        <p class="mb-0 fw-bold">Percentage Error = ${percError.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        </div>`;

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
}

// ─── PDF REPORT ──────────────────────────────────────────────
document.getElementById('download-pdf').addEventListener('click', () => {
    if (observations.length === 0) {
        alert("No observations recorded. Add readings before downloading the report.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFont('helvetica', 'bold').setFontSize(16);
    doc.text('PICT Physics Virtual Lab', PW / 2, 14, { align: 'center' });

    doc.setFontSize(11).setFont('helvetica', 'normal');
    doc.text('Determination of Wavelength of Light Using Diffraction Grating', PW / 2, 21, { align: 'center' });
    doc.text('Lab Report', PW / 2, 27, { align: 'center' });
    doc.line(20, 30, PW - 20, 30);

    // Student details
    doc.setFontSize(10);
    doc.text('Name: ____________________________________', 20, 38);
    doc.text('Roll No: __________________', 130, 38);
    doc.text('Date: ____________________', 20, 45);

    // Aim
    let y = 55;
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Aim:', 20, y);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(
        'To determine the wavelength of monochromatic light and verify the diffraction grating equation using a diffraction grating.',
        20, y + 6, { maxWidth: PW - 40 }
    );
    y += 18;

    // Apparatus
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Apparatus:', 20, y);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    const apparatus = [
        'Monochromatic light source (Sodium lamp / Laser)',
        'Collimator with slit',
        'Diffraction grating (known line density)',
        'Telescope / Observation screen',
        'Vernier table (optical bench)',
    ];
    apparatus.forEach((item, idx) => {
        doc.text(`\u2022 ${item}`, 24, y + 7 + idx * 6);
    });
    y += 7 + apparatus.length * 6 + 4;

    // Theory
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Theory:', 20, y);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    const theory = [
        'A diffraction grating consists of a large number of equally spaced parallel slits.',
        'When monochromatic light of wavelength lambda is incident normally on the grating,',
        'constructive interference (principal maxima) occur at angles theta satisfying:',
        '',
        '          d sin(theta) = n * lambda',
        '',
        'where  d = grating element (spacing between adjacent slits, d = 1/N)',
        '       N = number of lines per metre',
        '       n = order of diffraction (0, 1, 2, 3, ...)',
        '       theta = angle of diffraction',
        '       lambda = wavelength of incident light',
        '',
        'By measuring theta for a known order n and grating spacing d,',
        'the wavelength can be determined as:  lambda = d * sin(theta) / n',
    ];
    theory.forEach((line, idx) => {
        doc.text(line, 20, y + 7 + idx * 5.5);
    });
    y += 7 + theory.length * 5.5 + 6;

    // Observations table
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, y);

    const tableHead = [['Sl.', '\u03bb (nm)', 'N (l/mm)', 'd (m)', 'Order n',
        'Theo. \u03b8 (\u00b0)', 'Meas. \u03b8 (\u00b0)', 'Calc. \u03bb (nm)']];

    const tableBody = observations.map((o, i) => [
        i + 1,
        o.lambda,
        o.N,
        o.d_m.toExponential(3),
        o.n,
        o.thetaTheo.toFixed(2),
        o.thetaMeas.toFixed(2),
        o.calcLambda !== null ? o.calcLambda.toFixed(2) : '—',
    ]);

    doc.autoTable({
        startY: y + 5,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 46] },
        styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    y = doc.lastAutoTable.finalY + 10;

    // Calculations
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Calculations:', 20, y);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    y += 7;

    if (observations.length >= 3) {
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        const n_obs = observations.length;
        observations.forEach(o => {
            const x = o.lambda * 1e-9;
            const yy = o.sinTheta;
            sumX += x; sumY += yy; sumXY += x * yy; sumXX += x * x;
        });
        const den = n_obs * sumXX - sumX * sumX;
        if (den !== 0) {
            const slope_m = (n_obs * sumXY - sumX * sumY) / den;
            const intercept = (sumY - slope_m * sumX) / n_obs;

            const orderCounts = {};
            observations.forEach(o => { orderCounts[o.n] = (orderCounts[o.n] || 0) + 1; });
            const modalOrder = parseInt(Object.keys(orderCounts).sort((a, b) => orderCounts[b] - orderCounts[a])[0]);

            const d_exp = modalOrder / slope_m;
            const N_exp_lpmm = 1.0 / (d_exp * 1000);
            const N_theo = observations[0].N;
            const percError = Math.abs(N_exp_lpmm - N_theo) / N_theo * 100;

            const calcLines = [
                `Linear Regression: sin(theta) = m * lambda + b`,
                `Slope m = ${slope_m.toExponential(4)} m^-1`,
                `Intercept b = ${intercept.toFixed(4)}`,
                ``,
                `Grating spacing  d = n / m = ${modalOrder} / ${slope_m.toExponential(3)} = ${d_exp.toExponential(4)} m`,
                `Grating density  N = 1/d = ${N_exp_lpmm.toFixed(1)} lines/mm`,
                `Theoretical N (selected) = ${N_theo} lines/mm`,
                `Percentage Error = |${N_exp_lpmm.toFixed(1)} - ${N_theo}| / ${N_theo} x 100 = ${percError.toFixed(2)}%`,
            ];
            calcLines.forEach((line, idx) => {
                doc.text(line, 20, y + idx * 6);
            });
            y += calcLines.length * 6 + 8;

            // Result
            doc.setFont('helvetica', 'bold').setFontSize(11);
            doc.text('Result:', 20, y);
            doc.setFont('helvetica', 'normal').setFontSize(10);
            doc.text(`Experimental Grating Density = ${N_exp_lpmm.toFixed(0)} lines/mm`, 20, y + 7);
            doc.text(`Experimental Grating Spacing d = ${d_exp.toExponential(4)} m`, 20, y + 14);
            doc.text(`Percentage Error = ${percError.toFixed(2)}%`, 20, y + 21);
            y += 32;

            // Conclusion
            doc.setFont('helvetica', 'bold').setFontSize(11);
            doc.text('Conclusion:', 20, y);
            doc.setFont('helvetica', 'normal').setFontSize(10);
            const conclusion = percError < 5
                ? `The diffraction grating equation d sin(theta) = n*lambda was verified experimentally. The experimental grating density (${N_exp_lpmm.toFixed(0)} lines/mm) agrees well with the theoretical value (${N_theo} lines/mm) with a percentage error of ${percError.toFixed(2)}%, indicating good experimental accuracy.`
                : `The diffraction grating experiment was performed. The experimental grating density was found to be ${N_exp_lpmm.toFixed(0)} lines/mm compared to the theoretical value of ${N_theo} lines/mm (error: ${percError.toFixed(2)}%). Further readings with more accurate angle measurements are recommended.`;
            doc.text(conclusion, 20, y + 7, { maxWidth: PW - 40 });
        }
    } else {
        doc.text('Insufficient readings (< 3) for regression analysis. Add more observations for a complete report.', 20, y, { maxWidth: PW - 40 });
    }

    doc.save("Diffraction_Grating_Lab_Report.pdf");
});

// ─── WINDOW ONLOAD ───────────────────────────────────────────
window.onload = () => {
    init();
    drawGraph();
    patternLoop();
};
