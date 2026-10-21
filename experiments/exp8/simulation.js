"use strict";

// ─── CANVAS & CONTEXT ──────────────────────────────────────────
const canvas     = document.getElementById("nrCanvas");
const ctx        = canvas.getContext("2d");
const graphCvs   = document.getElementById("graphCanvas");
const graphCtx   = graphCvs.getContext("2d");

// ─── DOM REFS ─────────────────────────────────────────────────
const waveSlider    = document.getElementById("wave-slider");
const waveVal       = document.getElementById("wave-val");
const sourceSel     = document.getElementById("source-sel");
const rSlider       = document.getElementById("r-slider");
const rVal          = document.getElementById("r-val");
const ringPrev      = document.getElementById("ring-prev");
const ringNext      = document.getElementById("ring-next");
const ringNDisplay  = document.getElementById("ring-n-display");
const diamRingLabel = document.getElementById("diam-ring-label");
const diamValEl     = document.getElementById("diam-val");
const btnRecord     = document.getElementById("btn-record");
const obsBody       = document.getElementById("obs-body");
const btnClear      = document.getElementById("btn-clear");
const btnPdf        = document.getElementById("btn-pdf");

// ─── STATE ────────────────────────────────────────────────────
let lambda_nm = 589;    // nm
let R_m       = 1.00;   // metres
let ringN     = 5;      // selected ring number
let obs       = [];     // recorded observations
let animTick  = 0;

// ─── COLOUR UTILITIES ─────────────────────────────────────────
function wlColor(wl) {
    if (wl < 380) return { r: 100, g: 0, b: 150 };
    let r, g, b;
    if      (wl < 440) { r = -(wl-440)/(440-380); g = 0;              b = 1; }
    else if (wl < 490) { r = 0;                    g = (wl-440)/50;   b = 1; }
    else if (wl < 510) { r = 0;                    g = 1;              b = -(wl-510)/20; }
    else if (wl < 580) { r = (wl-510)/70;          g = 1;              b = 0; }
    else if (wl < 645) { r = 1;                    g = -(wl-645)/65;  b = 0; }
    else               { r = 1;                    g = 0;              b = 0; }

    const f = wl < 420 ? 0.3 + 0.7*(wl-380)/40
            : wl > 700 ? 0.3 + 0.7*(780-wl)/80
            : 1.0;
    return {
        r: Math.round(r*255*f),
        g: Math.round(g*255*f),
        b: Math.round(b*255*f)
    };
}

// ─── PHYSICS ──────────────────────────────────────────────────
function darkRingRadius_m(n) {
    return Math.sqrt(n * R_m * lambda_nm * 1e-9);
}
function darkRingDiam_mm(n) {
    return darkRingRadius_m(n) * 2 * 1000;
}

// Scale: ring-15 sits at 44% of half-canvas width
function getScale() {
    const r15 = darkRingRadius_m(15);
    return (canvas.width * 0.44) / r15;
}

// ─── DRAW RINGS ───────────────────────────────────────────────
function drawScene() {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const scale = getScale();
    const c = wlColor(lambda_nm);
    const MAX = 18;

    // Background
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, W, H);

    // Subtle crosshair
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.stroke();

    // Precompute dark ring radii (px)
    const rPx = [0];
    for (let k = 1; k <= MAX; k++) {
        rPx.push(darkRingRadius_m(k) * scale);
    }

    // Draw bright bands between consecutive dark rings (outermost first)
    const breathe = Math.sin(animTick * 0.016) * 0.025;
    for (let k = MAX; k >= 1; k--) {
        const ri = rPx[k - 1];
        const ro = rPx[k];
        if (ro > W * 0.70) continue;

        const fade = Math.max(0.12, 1 - (k - 1) * 0.052);
        const peak = 0.88 * (1 + breathe) * fade;

        const g = ctx.createRadialGradient(cx, cy, ri, cx, cy, ro);
        g.addColorStop(0,    `rgba(${c.r},${c.g},${c.b},0)`);
        g.addColorStop(0.4,  `rgba(${c.r},${c.g},${c.b},${(peak*0.85).toFixed(3)})`);
        g.addColorStop(0.5,  `rgba(${c.r},${c.g},${c.b},${peak.toFixed(3)})`);
        g.addColorStop(0.6,  `rgba(${c.r},${c.g},${c.b},${(peak*0.85).toFixed(3)})`);
        g.addColorStop(1,    `rgba(${c.r},${c.g},${c.b},0)`);

        ctx.beginPath();
        ctx.arc(cx, cy, ro, 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(0, ri - 0.5), 0, Math.PI * 2, true);
        ctx.fillStyle = g;
        ctx.fill();
    }

    // Dark ring thin outlines
    for (let k = 1; k <= MAX; k++) {
        if (rPx[k] > W * 0.70) break;
        ctx.beginPath();
        ctx.arc(cx, cy, rPx[k], 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = Math.max(1, rPx[1] * 0.16);
        ctx.stroke();
    }

    // Central contact glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    glow.addColorStop(0,   "rgba(255,255,245,0.28)");
    glow.addColorStop(0.5, "rgba(255,255,245,0.05)");
    glow.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Ring number labels on dark rings (subtle)
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let k = 1; k <= Math.min(MAX, 12); k++) {
        if (rPx[k] > W * 0.68 || rPx[k] < 8) continue;
        ctx.fillStyle = `rgba(255,255,255,${k === ringN ? 0 : 0.18})`;
        ctx.fillText(k, cx + rPx[k] * Math.cos(-0.3) + 3, cy + rPx[k] * Math.sin(-0.3));
    }

    // ── Highlight selected ring ──────────────────────────────
    const rSel = ringN <= MAX ? rPx[ringN] : null;
    if (rSel && rSel < W * 0.70) {
        // Glowing dashed circle
        ctx.beginPath();
        ctx.arc(cx, cy, rSel, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([7, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Diameter line
        ctx.beginPath();
        ctx.moveTo(cx - rSel, cy);
        ctx.lineTo(cx + rSel, cy);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ring label above
        const D_mm = darkRingDiam_mm(ringN);
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(255,255,255,0.90)";
        ctx.fillText(`Ring ${ringN}`, cx, cy - rSel - 8);

        // Diameter label below
        ctx.font = "11px 'Courier New', monospace";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(150,255,150,0.80)";
        ctx.fillText(`D = ${D_mm.toFixed(3)} mm`, cx, cy + rSel + 8);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
}

// ─── UPDATE DIAMETER DISPLAY ──────────────────────────────────
function updateDiamDisplay() {
    const D = darkRingDiam_mm(ringN);
    diamValEl.textContent = `${D.toFixed(4)} mm`;
    ringNDisplay.textContent = ringN;
    diamRingLabel.textContent = ringN;
}

// ─── ANIMATION ────────────────────────────────────────────────
function loop() {
    animTick++;
    drawScene();
    requestAnimationFrame(loop);
}

// ─── REGRESSION (through origin) ──────────────────────────────
function slopeThroughOrigin(xs, ys) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += xs[i]*ys[i]; den += xs[i]*xs[i]; }
    return den === 0 ? 0 : num / den;
}

// ─── DRAW GRAPH ───────────────────────────────────────────────
function drawGraph() {
    const GW = graphCvs.width, GH = graphCvs.height;
    const pad = { t:28, r:16, b:44, l:54 };
    const pw = GW - pad.l - pad.r, ph = GH - pad.t - pad.b;

    graphCtx.clearRect(0, 0, GW, GH);
    graphCtx.fillStyle = "#fff";
    graphCtx.fillRect(0, 0, GW, GH);

    // Axes
    graphCtx.strokeStyle = "#ccc";
    graphCtx.lineWidth = 1;
    graphCtx.beginPath();
    graphCtx.moveTo(pad.l, pad.t);
    graphCtx.lineTo(pad.l, pad.t + ph);
    graphCtx.lineTo(pad.l + pw, pad.t + ph);
    graphCtx.stroke();

    // Axis labels
    graphCtx.fillStyle = "#666";
    graphCtx.font = "11px Arial";
    graphCtx.textAlign = "center";
    graphCtx.fillText("Ring number  n", pad.l + pw/2, GH - 4);
    graphCtx.save();
    graphCtx.translate(13, pad.t + ph/2);
    graphCtx.rotate(-Math.PI/2);
    graphCtx.fillText("Dₙ² (mm²)", 0, 0);
    graphCtx.restore();

    if (obs.length === 0) {
        graphCtx.fillStyle = "#bbb";
        graphCtx.font = "12px Arial";
        graphCtx.textAlign = "center";
        graphCtx.fillText("Record readings to plot graph", pad.l + pw/2, pad.t + ph/2);
        return;
    }

    const ns  = obs.map(o => o.n);
    const d2s = obs.map(o => o.D2);
    const nMax  = Math.max(...ns,  3) * 1.2;
    const d2Max = Math.max(...d2s, 0.001) * 1.25;

    const gx = n  => pad.l + (n  / nMax)  * pw;
    const gy = d2 => pad.t + ph - (d2 / d2Max) * ph;

    // Grid
    graphCtx.strokeStyle = "#f0f0f0";
    graphCtx.setLineDash([3,3]);
    for (let i = 1; i <= 5; i++) {
        const x = gx(nMax / 5 * i); const y = gy(d2Max / 5 * i);
        graphCtx.beginPath(); graphCtx.moveTo(x, pad.t); graphCtx.lineTo(x, pad.t+ph); graphCtx.stroke();
        graphCtx.beginPath(); graphCtx.moveTo(pad.l, y); graphCtx.lineTo(pad.l+pw, y); graphCtx.stroke();
    }
    graphCtx.setLineDash([]);

    // Tick labels
    graphCtx.fillStyle = "#888"; graphCtx.font = "9px Arial";
    graphCtx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
        graphCtx.fillText((nMax/5*i).toFixed(0), gx(nMax/5*i), pad.t+ph+12);
    }
    graphCtx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
        graphCtx.fillText((d2Max/5*i).toFixed(2), pad.l-4, gy(d2Max/5*i)+4);
    }

    // Regression line
    if (obs.length >= 2) {
        const slope = slopeThroughOrigin(ns, d2s);
        graphCtx.beginPath();
        graphCtx.moveTo(gx(0), gy(0));
        graphCtx.lineTo(gx(nMax), Math.max(pad.t, gy(slope * nMax)));
        graphCtx.strokeStyle = "#3a7bd5";
        graphCtx.lineWidth = 2;
        graphCtx.stroke();

        const lCalc = (slope * 1e-6) / (4 * R_m) * 1e9;
        graphCtx.fillStyle = "#3a7bd5";
        graphCtx.font = "bold 9px 'Courier New', monospace";
        graphCtx.textAlign = "left";
        graphCtx.fillText(`slope = ${slope.toFixed(4)} mm²`, pad.l+4, pad.t+14);
        graphCtx.fillText(`λ ≈ ${lCalc.toFixed(1)} nm`, pad.l+4, pad.t+26);
    }

    // Points
    obs.forEach(o => {
        graphCtx.beginPath();
        graphCtx.arc(gx(o.n), gy(o.D2), 5, 0, Math.PI*2);
        graphCtx.fillStyle = "#cc2200";
        graphCtx.fill();
        graphCtx.strokeStyle = "#fff";
        graphCtx.lineWidth = 1;
        graphCtx.stroke();
    });
}

// ─── RECORD READING ───────────────────────────────────────────
function recordReading() {
    const D_mm = darkRingDiam_mm(ringN);
    const D2   = D_mm * D_mm;
    const calcL = D2 / (4 * ringN * R_m) * 1e-6 * 1e9;   // nm

    obs.push({ n: ringN, D_mm, D2, calcL, lambda_nm, R_m });
    renderTable();
    drawGraph();

    // Advance to next ring automatically
    if (ringN < 15) {
        ringN++;
        updateDiamDisplay();
    }

    // Brief button feedback
    btnRecord.textContent = "✓ Recorded!";
    btnRecord.style.background = "#27a65c";
    setTimeout(() => {
        btnRecord.textContent = "+ Record Reading";
        btnRecord.style.background = "";
    }, 700);
}

// ─── RENDER TABLE ─────────────────────────────────────────────
function renderTable() {
    if (obs.length === 0) {
        obsBody.innerHTML = `<tr><td colspan="6" class="empty-hint">No readings yet — record at least 5 rings.</td></tr>`;
        return;
    }
    obsBody.innerHTML = obs.map((o, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${o.n}</td>
            <td>${o.D_mm.toFixed(4)}</td>
            <td>${o.D2.toFixed(4)}</td>
            <td>${o.calcL.toFixed(2)}</td>
            <td><button class="btn-del" onclick="deleteRow(${i})">✕</button></td>
        </tr>`).join("");
}

function deleteRow(i) {
    obs.splice(i, 1);
    renderTable();
    drawGraph();
}

// ─── CLEAR ────────────────────────────────────────────────────
function clearData() {
    obs = [];
    document.getElementById("result-out").innerHTML = "";
    renderTable();
    drawGraph();
}

// ─── CALCULATE RESULT ─────────────────────────────────────────
function calculateResult() {
    const out = document.getElementById("result-out");
    if (obs.length < 3) {
        out.innerHTML = `<div class="alert alert-warning mx-3">Add at least 3 readings first.</div>`;
        return;
    }

    const ns  = obs.map(o => o.n);
    const d2s = obs.map(o => o.D2);
    const slope = slopeThroughOrigin(ns, d2s);   // mm²
    const lCalc = (slope * 1e-6) / (4 * R_m) * 1e9;  // nm
    const err   = Math.abs(lCalc - lambda_nm) / lambda_nm * 100;
    const good  = err < 5;
    const meanL = obs.reduce((s,o) => s + o.calcL, 0) / obs.length;

    out.innerHTML = `
    <div style="margin:0 16px 32px; background:#fff; border:1px solid #e0e0e0; border-radius:10px; overflow:hidden; max-width:680px;">
        <div style="background:#111;color:#fff;padding:12px 20px;font-weight:700;font-size:0.95rem;">
            Result — Newton's Rings
        </div>
        <div style="padding:20px 24px;">
            <table style="width:100%;font-size:0.86rem;border-collapse:collapse;margin-bottom:16px;">
                <tr><td style="color:#777;padding:4px 0;width:55%">Set wavelength λ</td><td style="font-weight:700">${lambda_nm} nm</td></tr>
                <tr><td style="color:#777;padding:4px 0">Radius of curvature R</td><td style="font-weight:700">${R_m.toFixed(2)} m</td></tr>
                <tr><td style="color:#777;padding:4px 0">Readings recorded</td><td style="font-weight:700">${obs.length}</td></tr>
            </table>
            <div style="background:#f5f5f5;border-radius:6px;padding:12px 14px;font-family:'Courier New',monospace;font-size:0.82rem;margin-bottom:12px;">
                Slope of D² vs n &nbsp;=&nbsp; 4Rλ &nbsp;=&nbsp; <strong>${slope.toFixed(5)} mm²/ring</strong><br>
                λ = slope / (4 × R) = ${slope.toFixed(5)} × 10⁻⁶ / (4 × ${R_m.toFixed(2)}) = <strong>${lCalc.toFixed(2)} nm</strong>
            </div>
            <div style="background:${good?'#eaffef':'#fff8ec'};border:1px solid ${good?'#88cc99':'#ddaa55'};border-radius:8px;padding:12px 16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-weight:700;font-size:1rem;">Percentage Error = ${err.toFixed(2)}%</span>
                    <span style="background:${good?'#27a65c':'#e08b00'};color:#fff;padding:3px 10px;border-radius:4px;font-size:0.78rem;font-weight:700;">
                        ${good ? '✓ Good Accuracy' : '⚠ Check Readings'}
                    </span>
                </div>
                <p style="font-size:0.83rem;color:#444;margin:0;">
                    ${good
                        ? `Confirmed: <strong>D² = 4nRλ</strong>. Measured λ = <strong>${lCalc.toFixed(1)} nm</strong>, set λ = ${lambda_nm} nm. Error is within 5%.`
                        : `Measured λ = <strong>${lCalc.toFixed(1)} nm</strong>, set λ = ${lambda_nm} nm (error ${err.toFixed(2)}%). Try recording more evenly-spaced rings.`
                    }
                </p>
            </div>
        </div>
    </div>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── PDF REPORT ───────────────────────────────────────────────
btnPdf.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = doc.internal.pageSize.getWidth();
    let y = 20;
    const today = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" });

    // Header
    doc.setFillColor(17,17,17); doc.rect(0,0,PW,14,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold").setFontSize(11);
    doc.text("PICT Physics Virtual Lab", 14, 9);
    doc.setFont("helvetica","normal").setFontSize(9);
    doc.text(`Date: ${today}`, PW-14, 9, { align:"right" });
    doc.setTextColor(0,0,0);

    // Title
    doc.setFont("helvetica","bold").setFontSize(14);
    doc.text("Experiment 8: Newton's Rings", PW/2, y, { align:"center" });
    y += 6;
    doc.setFont("helvetica","italic").setFontSize(10);
    doc.text("Determination of Wavelength of Light", PW/2, y, { align:"center" });
    y += 8;
    doc.setDrawColor(180,180,180); doc.line(14, y, PW-14, y);
    y += 8;

    // Aim
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Aim:", 14, y); y += 6;
    doc.setFont("helvetica","normal").setFontSize(10);
    doc.text("To determine the wavelength of monochromatic light using Newton's rings formed by interference in the thin air film between a plano-convex lens and a flat glass plate.", 14, y, { maxWidth: PW-28 });
    y += 14;

    // Apparatus
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Apparatus:", 14, y); y += 6;
    doc.setFont("helvetica","normal").setFontSize(10);
    ["Sodium lamp / monochromatic light source","Plano-convex lens (known R)","Optically flat glass plate","Travelling microscope","Sodium D-line filter"].forEach(s => {
        doc.text(`\u2022 ${s}`, 18, y); y += 5.5;
    });
    y += 4;

    // Theory
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Theory:", 14, y); y += 6;
    doc.setFont("helvetica","normal").setFontSize(10);
    [
        "An air film of slowly increasing thickness is formed between a plano-convex lens",
        "and a flat glass plate. Interference between rays reflected from the top and bottom",
        "of this air film produces concentric dark and bright rings.",
        "","For the n-th dark ring (destructive interference):",
        "","     D_n^2 = 4 * n * R * lambda",
        "","where D_n = diameter of n-th dark ring (m), n = ring number, R = radius of",
        "curvature (m), lambda = wavelength of incident light (m).",
        "","A graph of D_n^2 vs n is a straight line through the origin with slope = 4*R*lambda."
    ].forEach(l => { doc.text(l, 14, y, { maxWidth: PW-28 }); y += 5.5; });
    y += 5;

    // Parameters
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Set Parameters:", 14, y); y += 6;
    doc.setFont("helvetica","normal").setFontSize(10);
    doc.text(`\u2022 lambda = ${lambda_nm} nm = ${(lambda_nm*1e-9).toExponential(3)} m`, 18, y); y += 5.5;
    doc.text(`\u2022 R = ${R_m.toFixed(2)} m`, 18, y); y += 9;

    // Observations table
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Observations:", 14, y);
    doc.autoTable({
        startY: y + 4,
        head: [["Sl.","n","Dn (mm)","Dn² (mm²)","Calc. lambda (nm)"]],
        body: obs.map((o,i) => [i+1, o.n, o.D_mm.toFixed(4), o.D2.toFixed(4), o.calcL.toFixed(2)]),
        theme:"grid", headStyles:{ fillColor:[26,26,46] },
        styles:{ fontSize:9, cellPadding:3, halign:"center" },
        margin:{ left:14, right:14 }
    });
    y = doc.lastAutoTable.finalY + 10;

    // Calculations
    doc.setFont("helvetica","bold").setFontSize(11); doc.text("Calculations:", 14, y); y += 6;
    doc.setFont("helvetica","normal").setFontSize(10);

    if (obs.length >= 2) {
        const slope = slopeThroughOrigin(obs.map(o=>o.n), obs.map(o=>o.D2));
        const lc = (slope*1e-6)/(4*R_m)*1e9;
        const pe = Math.abs(lc-lambda_nm)/lambda_nm*100;
        [
            `From graph (D^2 vs n, through origin):`,
            `  Slope = 4Rl = ${slope.toFixed(5)} mm^2/ring`,
            `  l = slope / (4 x R) = ${slope.toFixed(5)} x 10^-6 / (4 x ${R_m.toFixed(2)}) = ${lc.toFixed(2)} nm`,
            `  Set l = ${lambda_nm} nm   |   Percentage Error = ${pe.toFixed(2)}%`
        ].forEach(l => { if (y>260){doc.addPage();y=20;} doc.text(l,14,y,{maxWidth:PW-28}); y+=5.5; });
        y += 5;

        doc.setFont("helvetica","bold").setFontSize(11); doc.text("Result:", 14, y); y += 6;
        doc.setFont("helvetica","normal").setFontSize(10);
        doc.text(`Calculated wavelength = ${lc.toFixed(2)} nm    Percentage Error = ${pe.toFixed(2)}%`, 14, y);
        y += 10;

        doc.setFont("helvetica","bold").setFontSize(11); doc.text("Conclusion:", 14, y); y += 6;
        doc.setFont("helvetica","normal").setFontSize(10);
        const conc = pe < 5
            ? `The Newton's rings experiment confirms D^2 = 4nRl. The measured wavelength (${lc.toFixed(1)} nm) agrees with the set value (${lambda_nm} nm) within ${pe.toFixed(2)}% error.`
            : `The measured wavelength was ${lc.toFixed(1)} nm vs set value ${lambda_nm} nm (error ${pe.toFixed(2)}%). More readings are recommended for better accuracy.`;
        doc.text(conc, 14, y, { maxWidth: PW-28 });
    } else {
        doc.text("Insufficient data. Add at least 3 readings.", 14, y);
    }

    doc.save("Newtons_Rings_Lab_Report.pdf");
});

// ─── EVENT LISTENERS ──────────────────────────────────────────

waveSlider.addEventListener("input", () => {
    lambda_nm = parseInt(waveSlider.value);
    waveVal.textContent = `${lambda_nm} nm`;
    // sync dropdown
    const opts = Array.from(sourceSel.options).map(o => parseInt(o.value));
    const near = opts.reduce((a,b) => Math.abs(b-lambda_nm)<Math.abs(a-lambda_nm)?b:a);
    if (near === lambda_nm) sourceSel.value = lambda_nm;
    updateDiamDisplay();
});

sourceSel.addEventListener("change", () => {
    lambda_nm = parseInt(sourceSel.value);
    waveSlider.value = lambda_nm;
    waveVal.textContent = `${lambda_nm} nm`;
    updateDiamDisplay();
});

rSlider.addEventListener("input", () => {
    R_m = parseFloat(rSlider.value);
    rVal.textContent = `${R_m.toFixed(2)} m`;
    updateDiamDisplay();
});

ringPrev.addEventListener("click", () => {
    if (ringN > 1) { ringN--; updateDiamDisplay(); }
});

ringNext.addEventListener("click", () => {
    if (ringN < 15) { ringN++; updateDiamDisplay(); }
});

btnRecord.addEventListener("click", recordReading);
btnClear.addEventListener("click", clearData);

// ─── INIT ─────────────────────────────────────────────────────
window.onload = () => {
    updateDiamDisplay();
    drawGraph();
    loop();
};
