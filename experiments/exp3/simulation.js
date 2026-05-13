/* =====================================================================
   Exp 3 – Energy Band Gap Simulation  (Ge semiconductor)
   Physics: ln(R) = Eg/(2kT) + C  →  slope = Eg/(2k)
   k = 8.617 × 10⁻⁵ eV/K
   ===================================================================== */

/* ── Constants ────────────────────────────────────────────────────── */
const k_eV = 8.617e-5;
const Eg_true = 0.67;        // Germanium band gap [eV]

/* ── DOM refs ─────────────────────────────────────────────────────── */
const tempSlider = document.getElementById('temp-slider');
const tempBadge = document.getElementById('temp-badge');
const tempReadout = document.getElementById('temp-readout');
const celsiusOut = document.getElementById('celsius-readout');
const rMeter = document.getElementById('r-meter');
const thermMercury = document.getElementById('therm-mercury');
const thermBulb = document.getElementById('therm-bulb');
const carrierCount = document.getElementById('carrier-count');
const pointsBadge = document.getElementById('points-badge');
const obsBody = document.getElementById('obs-body');
const addBtn = document.getElementById('add-reading');
const clearBtn = document.getElementById('clear-data');
const bandCanvas = document.getElementById('bandCanvas');
const bCtx = bandCanvas.getContext('2d');

let observations = [];
let animT = 300;
let animTick = 0;

/* ── Polyfill roundRect for older Chrome ─────────────────────────── */
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        const rad = Array.isArray(r) ? r[0] : r;
        this.beginPath();
        this.moveTo(x + rad, y);
        this.lineTo(x + w - rad, y);
        this.quadraticCurveTo(x + w, y, x + w, y + rad);
        this.lineTo(x + w, y + h - rad);
        this.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
        this.lineTo(x + rad, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - rad);
        this.lineTo(x, y + rad);
        this.quadraticCurveTo(x, y, x + rad, y);
        this.closePath();
    };
}

/* ── Size canvas ─────────────────────────────────────────────────── */
function sizeCanvas() {
    /* Try multiple methods to get the true pixel width */
    const rect = bandCanvas.getBoundingClientRect();
    const w = (rect && rect.width > 10) ? rect.width
        : bandCanvas.parentElement ? bandCanvas.parentElement.clientWidth
            : 600;
    bandCanvas.width = Math.round(w);
    bandCanvas.height = 230;
}
window.addEventListener('resize', () => { sizeCanvas(); spawnElectrons(); });

/* ── Physics ──────────────────────────────────────────────────────── */
function calcResistance(T, addNoise) {
    const R0 = 100 * Math.exp(-Eg_true / (2 * k_eV * 300));
    let R = R0 * Math.exp(Eg_true / (2 * k_eV * T));
    if (addNoise) R *= 1 + (Math.random() - 0.5) * 0.01;
    return Math.max(R, 0.01);
}

/* ════════════════════════════════════════════════════════════════════
   ELECTRON OBJECTS
   ══════════════════════════════════════════════════════════════════ */
let electrons = [];

function bandLayout() {
    const W = bandCanvas.width, H = bandCanvas.height;
    const pad = 14, zH = (H - 2 * pad) / 3;
    return {
        W, H, pad, zH,
        cbTop: pad, cbBot: pad + zH,
        gbTop: pad + zH, gbBot: pad + 2 * zH,
        vbTop: pad + 2 * zH, vbBot: H - pad
    };
}

function spawnElectrons() {
    electrons = [];
    const L = bandLayout();
    for (let i = 0; i < 36; i++) {
        electrons.push({
            x: 18 + Math.random() * (L.W - 36),
            y: L.vbTop + 10 + Math.random() * (L.zH - 20),
            baseY: 0,
            vibPhase: Math.random() * Math.PI * 2,
            band: 'valence',
            jumping: false,
            targetY: 0,
            trail: []
        });
    }
    electrons.forEach(e => { e.baseY = e.y; });
}

function targetInCB(T) {
    const t = (T - 300) / 200;
    return Math.round(t * t * 22);
}

/* ── Tick ─────────────────────────────────────────────────────────── */
function tickElectrons() {
    animTick++;
    const L = bandLayout();
    const want = targetInCB(animT);
    const haveInCB = electrons.filter(e => e.band === 'conduction' && !e.jumping).length;

    /* Promote or demote once every ~8 frames for smooth animation */
    if (animTick % 8 === 0) {
        if (haveInCB < want) {
            const vb = electrons.filter(e => e.band === 'valence' && !e.jumping);
            if (vb.length) {
                const e = vb[Math.floor(Math.random() * vb.length)];
                e.jumping = true;
                e.targetY = L.cbTop + 8 + Math.random() * (L.zH - 16);
            }
        } else if (haveInCB > want) {
            const cb = electrons.filter(e => e.band === 'conduction' && !e.jumping);
            if (cb.length) {
                const e = cb[Math.floor(Math.random() * cb.length)];
                e.jumping = true;
                e.targetY = L.vbTop + 8 + Math.random() * (L.zH - 16);
            }
        }
    }

    electrons.forEach(e => {
        if (e.jumping) {
            /* Move toward target (passes through the gap!) */
            const dy = e.targetY - e.y;
            e.y += dy * 0.10;
            if (Math.abs(dy) < 1.5) {
                e.y = e.targetY;
                e.baseY = e.y;
                e.jumping = false;
                e.band = (e.y < L.gbTop) ? 'conduction' : 'valence';
                e.trail = [];
            }
            /* Record trail */
            e.trail.push({ x: e.x, y: e.y });
            if (e.trail.length > 14) e.trail.shift();
        } else {
            /* Vibrate + drift */
            e.vibPhase += (e.band === 'conduction') ? 0.07 : 0.035;
            const amp = (e.band === 'conduction') ? 3.5 : 1.6;
            e.y = e.baseY + Math.sin(e.vibPhase) * amp;

            /* Horizontal Brownian drift */
            e.x += (Math.random() - 0.5) * (e.band === 'conduction' ? 2.2 : 0.7);
            e.x = Math.max(14, Math.min(L.W - 14, e.x));

            /* Slow vertical drift every few frames */
            if (animTick % 40 === 0) {
                const drift = (Math.random() - 0.5) * 10;
                const newBase = e.baseY + drift;
                if (e.band === 'valence') e.baseY = Math.max(L.vbTop + 8, Math.min(L.vbBot - 8, newBase));
                else e.baseY = Math.max(L.cbTop + 8, Math.min(L.cbBot - 8, newBase));
            }

            e.trail = [];
        }
    });

    /* Update carrier badge */
    const inCB = electrons.filter(e => e.band === 'conduction').length;
    carrierCount.textContent = inCB;
}

/* ── Draw band diagram ────────────────────────────────────────────── */
function drawBands() {
    const W = bandCanvas.width, H = bandCanvas.height;
    const L = bandLayout();
    const t = Math.max(0, Math.min(1, (animT - 300) / 200));

    bCtx.clearRect(0, 0, W, H);

    /* ── BG gradient (cool→hot) */
    const bg = bCtx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgba(224,242,254,${0.85 + t * 0.1})`);
    bg.addColorStop(1, `rgba(254,226,226,${0.4 + t * 0.55})`);
    bCtx.fillStyle = bg;
    bCtx.fillRect(0, 0, W, H);

    /* ══ Conduction Band ══ */
    const cbGrad = bCtx.createLinearGradient(0, L.cbTop, 0, L.cbBot);
    cbGrad.addColorStop(0, 'rgba(219,234,254,0.95)');
    cbGrad.addColorStop(1, 'rgba(147,197,253,0.6)');
    bCtx.fillStyle = cbGrad;
    bCtx.beginPath();
    bCtx.roundRect(8, L.cbTop, W - 16, L.zH, [10, 10, 0, 0]);
    bCtx.fill();
    bCtx.strokeStyle = '#60a5fa';
    bCtx.lineWidth = 1.8;
    bCtx.stroke();

    /* CB label */
    bCtx.fillStyle = '#1d4ed8';
    bCtx.font = 'bold 12px Inter, Arial';
    bCtx.textAlign = 'left';
    bCtx.textBaseline = 'top';
    bCtx.fillText('Conduction Band  (CB)', 18, L.cbTop + 6);

    /* CB floor line */
    bCtx.strokeStyle = '#2563eb';
    bCtx.lineWidth = 2;
    bCtx.setLineDash([]);
    bCtx.beginPath();
    bCtx.moveTo(8, L.cbBot);
    bCtx.lineTo(W - 8, L.cbBot);
    bCtx.stroke();

    /* ══ Band Gap ══ */
    const gapFill = bCtx.createLinearGradient(0, L.gbTop, 0, L.gbBot);
    gapFill.addColorStop(0, `rgba(254,243,199,${0.5 + t * 0.35})`);
    gapFill.addColorStop(1, `rgba(253,230,138,${0.3 + t * 0.4})`);
    bCtx.fillStyle = gapFill;
    bCtx.fillRect(8, L.gbTop, W - 16, L.zH);

    /* Dashed centre */
    const midGap = L.gbTop + L.zH / 2;
    bCtx.strokeStyle = `rgba(251,191,36,${0.6 + t * 0.4})`;
    bCtx.lineWidth = 1.2;
    bCtx.setLineDash([7, 7]);
    bCtx.beginPath();
    bCtx.moveTo(28, midGap);
    bCtx.lineTo(W - 100, midGap);
    bCtx.stroke();
    bCtx.setLineDash([]);

    /* Eg arrow + label */
    const ax = W - 36;
    bCtx.strokeStyle = '#d97706';
    bCtx.lineWidth = 1.5;
    /* top arrow (up) */
    bCtx.beginPath(); bCtx.moveTo(ax, L.gbBot - 2); bCtx.lineTo(ax, L.cbBot + 2); bCtx.stroke();
    arrowTip(ax, L.cbBot + 2, -1);
    /* bottom arrow (down) */
    bCtx.beginPath(); bCtx.moveTo(ax, L.gbTop + 2); bCtx.lineTo(ax, L.vbTop - 2); bCtx.stroke();
    arrowTip(ax, L.vbTop - 2, 1);

    bCtx.fillStyle = '#92400e';
    bCtx.font = 'bold 12px Inter, Arial';
    bCtx.textAlign = 'right';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('Eg = 0.67 eV', ax - 8, midGap);

    /* ══ Valence Band ══ */
    const vbGrad = bCtx.createLinearGradient(0, L.vbTop, 0, L.vbBot);
    vbGrad.addColorStop(0, 'rgba(209,250,229,0.8)');
    vbGrad.addColorStop(1, `rgba(167,243,208,${0.7 + t * 0.25})`);
    bCtx.fillStyle = vbGrad;
    bCtx.beginPath();
    bCtx.roundRect(8, L.vbTop, W - 16, L.zH, [0, 0, 10, 10]);
    bCtx.fill();
    bCtx.strokeStyle = '#6ee7b7';
    bCtx.lineWidth = 1.8;
    bCtx.stroke();

    /* VB top line */
    bCtx.strokeStyle = '#10b981';
    bCtx.lineWidth = 2;
    bCtx.setLineDash([]);
    bCtx.beginPath();
    bCtx.moveTo(8, L.vbTop);
    bCtx.lineTo(W - 8, L.vbTop);
    bCtx.stroke();

    /* VB label */
    bCtx.fillStyle = '#065f46';
    bCtx.font = 'bold 12px Inter, Arial';
    bCtx.textAlign = 'left';
    bCtx.textBaseline = 'top';
    bCtx.fillText('Valence Band  (VB)', 18, L.vbTop + 6);

    /* ══ Thermal glow overlay in VB at high T ══ */
    if (t > 0.05) {
        const heatGrd = bCtx.createLinearGradient(0, L.vbTop, 0, L.vbBot);
        heatGrd.addColorStop(0, 'rgba(239,68,68,0)');
        heatGrd.addColorStop(1, `rgba(239,68,68,${t * 0.22})`);
        bCtx.fillStyle = heatGrd;
        bCtx.fillRect(8, L.vbTop, W - 16, L.zH);
    }

    /* ══ Electrons ══ */
    electrons.forEach(e => {
        /* Draw jump trail */
        if (e.trail.length > 1) {
            bCtx.beginPath();
            bCtx.moveTo(e.trail[0].x, e.trail[0].y);
            e.trail.forEach(pt => bCtx.lineTo(pt.x, pt.y));
            bCtx.strokeStyle = 'rgba(251,191,36,0.55)';
            bCtx.lineWidth = 1.5;
            bCtx.setLineDash([]);
            bCtx.stroke();
        }

        /* Glow shadow for CB electrons */
        if (e.band === 'conduction' || e.jumping) {
            bCtx.save();
            bCtx.shadowBlur = 12;
            bCtx.shadowColor = e.jumping ? '#fbbf24' : '#3b82f6';
            bCtx.beginPath();
            bCtx.arc(e.x, e.y, 6, 0, Math.PI * 2);
            bCtx.fillStyle = e.jumping ? '#fde68a' : '#60a5fa';
            bCtx.fill();
            bCtx.restore();
        }

        /* Electron circle */
        const grad = bCtx.createRadialGradient(e.x - 2, e.y - 2, 1, e.x, e.y, 6.5);
        if (e.jumping) {
            grad.addColorStop(0, '#fef3c7');
            grad.addColorStop(1, '#f59e0b');
        } else if (e.band === 'conduction') {
            grad.addColorStop(0, '#bfdbfe');
            grad.addColorStop(1, '#2563eb');
        } else {
            grad.addColorStop(0, '#a7f3d0');
            grad.addColorStop(1, '#059669');
        }
        bCtx.beginPath();
        bCtx.arc(e.x, e.y, 6, 0, Math.PI * 2);
        bCtx.fillStyle = grad;
        bCtx.fill();

        /* '−' label */
        bCtx.fillStyle = '#fff';
        bCtx.font = 'bold 10px Arial';
        bCtx.textAlign = 'center';
        bCtx.textBaseline = 'middle';
        bCtx.fillText('−', e.x, e.y + 0.5);
    });

    /* ══ Temperature overlay ══ */
    const tCol = t < 0.35 ? '#0ea5e9' : t < 0.7 ? '#f59e0b' : '#ef4444';
    bCtx.fillStyle = tCol;
    bCtx.font = 'bold 13px Inter, Arial';
    bCtx.textAlign = 'left';
    bCtx.textBaseline = 'top';
    bCtx.fillText(`T = ${animT} K`, 18, L.cbTop + 22);
}

function arrowTip(x, y, dir) {  /* dir: -1 = up, 1 = down */
    bCtx.fillStyle = '#d97706';
    bCtx.beginPath();
    if (dir < 0) {
        bCtx.moveTo(x, y);
        bCtx.lineTo(x - 4.5, y + 9);
        bCtx.lineTo(x + 4.5, y + 9);
    } else {
        bCtx.moveTo(x, y);
        bCtx.lineTo(x - 4.5, y - 9);
        bCtx.lineTo(x + 4.5, y - 9);
    }
    bCtx.closePath();
    bCtx.fill();
}

/* ── Main animation loop ─────────────────────────────────────────── */
function animLoop() {
    tickElectrons();
    drawBands();
    requestAnimationFrame(animLoop);
}

/* ════════════════════════════════════════════════════════════════════
   UPDATE SIMULATION UI
   ══════════════════════════════════════════════════════════════════ */
function updateSimulation() {
    const T = parseInt(tempSlider.value);
    animT = T;
    const t = (T - 300) / 200;

    tempBadge.textContent = T + ' K';
    tempReadout.textContent = T + ' K';
    celsiusOut.textContent = (T - 273) + ' °C';
    rMeter.textContent = calcResistance(T, false).toFixed(2);

    /* Thermometer */
    thermMercury.style.height = (t * 100) + '%';

    /* Bulb intensity */
    const bR = Math.round(180 + t * 75);
    thermBulb.style.boxShadow = `0 0 ${10 + t * 20}px rgba(${bR},60,60,${0.55 + t * 0.4})`;

    /* Resistance colour: monochrome based on level */
    const level = Math.round(255 - t * 180);
    rMeter.style.color = `rgb(${level > 80 ? level : 80},${level > 80 ? level : 80},${level > 80 ? level : 80})`;
}

/* ════════════════════════════════════════════════════════════════════
   OBSERVATIONS TABLE
   ══════════════════════════════════════════════════════════════════ */
function renderTable() {
    obsBody.innerHTML = observations.map((obs, i) => `
        <tr>
            <td class="fw-semibold text-secondary">${i + 1}</td>
            <td>${obs.T}</td>
            <td>${obs.R.toFixed(2)}</td>
            <td>${(1 / obs.T).toExponential(3)}</td>
            <td>${Math.log(obs.R).toFixed(4)}</td>
        </tr>
    `).join('');
    pointsBadge.textContent = observations.length + ' point' + (observations.length !== 1 ? 's' : '');
}

function addRow() {
    const T = parseInt(tempSlider.value);
    if (observations.some(o => o.T === T)) {
        alert(`A reading at ${T} K already exists. Choose a different temperature.`);
        return;
    }
    if (observations.length >= 10) {
        alert('Maximum 10 readings allowed. Clear the table to restart.');
        return;
    }
    const R = calcResistance(T);
    observations.push({ T, R });
    observations.sort((a, b) => a.T - b.T);
    renderTable();
    updateChart();
}

/* ════════════════════════════════════════════════════════════════════
   CHART.JS – ln(R) vs 1/T
   ══════════════════════════════════════════════════════════════════ */
const chartCtx = document.getElementById('bandGapChart').getContext('2d');
const bandGapChart = new Chart(chartCtx, {
    type: 'scatter',
    data: {
        datasets: [
            {
                label: 'ln(R) vs 1/T  (observed)',
                borderColor: '#111111',
                backgroundColor: '#111111',
                pointRadius: 7, pointHoverRadius: 10,
                data: []
            },
            {
                label: 'Best-fit line',
                type: 'line',
                borderColor: '#555555',
                backgroundColor: 'transparent',
                borderWidth: 2.5, pointRadius: 0,
                borderDash: [6, 4],
                tension: 0, data: []
            }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 350 },
        scales: {
            x: {
                title: { display: true, text: '1/T  (K⁻¹)', font: { size: 12, weight: '600' }, color: '#333333' },
                ticks: { callback: v => v.toExponential(1), color: '#333333' },
                grid: { color: 'rgba(0,0,0,0.08)' }
            },
            y: {
                title: { display: true, text: 'ln(R)', font: { size: 12, weight: '600' }, color: '#333333' },
                ticks: { color: '#333333' },
                grid: { color: 'rgba(0,0,0,0.08)' }
            }
        },
        plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 }, color: '#333333' } },
            tooltip: { callbacks: { label: it => `1/T=${it.parsed.x.toExponential(3)}, ln(R)=${it.parsed.y.toFixed(4)}` } }
        }
    }
});

function updateChart() {
    const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
    bandGapChart.data.datasets[0].data = pts;
    if (pts.length >= 2) {
        const { slope, intercept } = linreg(pts);
        const xs = pts.map(p => p.x);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        bandGapChart.data.datasets[1].data = [
            { x: x0, y: slope * x0 + intercept },
            { x: x1, y: slope * x1 + intercept }
        ];
    } else {
        bandGapChart.data.datasets[1].data = [];
    }
    bandGapChart.update();
}

function linreg(pts) {
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    return { slope, intercept: (sy - slope * sx) / n };
}

/* ════════════════════════════════════════════════════════════════════
   CALCULATE BAND GAP
   ══════════════════════════════════════════════════════════════════ */
function calculateBandGap() {
    if (observations.length < 3) {
        alert('Please record at least 3 readings at different temperatures!');
        return;
    }
    const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
    const { slope } = linreg(pts);
    const Eg_calc = 2 * k_eV * slope;
    const pctErr = Math.abs((Eg_calc - Eg_true) / Eg_true * 100);
    const errColor = pctErr < 10 ? '#4ade80' : '#f87171';

    const out = document.getElementById('calculation-output');
    out.innerHTML = `
        <hr class="my-4">
        <div class="card result-card shadow overflow-hidden">
            <div class="result-hero">
                <div class="eg-label mb-1">Calculated Energy Band Gap</div>
                <div class="eg-value">E<sub>g</sub> = ${Eg_calc.toFixed(3)} eV</div>
                <div class="mt-3 d-flex justify-content-center gap-4" style="font-size:0.83rem;">
                    <span style="color:#9ca3af;">Standard (Ge): <strong style="color:#fbbf24;">0.67 eV</strong></span>
                    <span style="color:#9ca3af;">Error: <strong style="color:${errColor};">${pctErr.toFixed(1)} %</strong></span>
                    <span style="color:#9ca3af;">Slope: <strong style="color:#a5f3fc;">${slope.toFixed(1)} K</strong></span>
                </div>
            </div>
            <div class="p-4">
                <div class="row g-4">
                    <div class="col-md-5">
                        <h6 class="fw-bold mb-2">Governing Formula</h6>
                        <p>$$E_g = 2k \\times \\text{slope}$$</p>
                        <ul class="text-muted" style="font-size:0.82rem; line-height:1.8;">
                            <li>$k = 8.617 \\times 10^{-5}$ eV/K</li>
                            <li>Slope $= ${slope.toFixed(1)}$ K (from graph)</li>
                            <li>Readings: ${observations.length}</li>
                        </ul>
                    </div>
                    <div class="col-md-7">
                        <h6 class="fw-bold mb-2">Conclusion</h6>
                        <p style="font-size:0.85rem; color:#374151; line-height:1.7;">
                            The slope of $\\ln(R)$ vs $\\frac{1}{T}$ was
                            <strong>${slope.toFixed(1)} K</strong>.
                            Applying $E_g = 2k \\times \\text{slope}$ gives
                            <strong>${Eg_calc.toFixed(3)} eV</strong>
                            vs. the standard Ge value of <strong>0.67 eV</strong>
                            (error ${pctErr.toFixed(1)} %).
                            As temperature rises, thermal energy promotes electrons
                            across the band gap, dramatically increasing carrier
                            density and lowering resistance — exactly as the
                            animation shows.
                        </p>
                    </div>
                </div>
            </div>
        </div>`;

    if (window.MathJax) MathJax.typesetPromise();
    out.scrollIntoView({ behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════════════════════
   PDF
   ══════════════════════════════════════════════════════════════════ */
document.getElementById('download-pdf').addEventListener('click', () => {
    if (!observations.length) { alert('No data. Record some observations first.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text('Determination of Energy Band Gap \u2013 Lab Report', PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(9).setTextColor(100);
    doc.text('Formula: Eg = 2 \u00d7 k \u00d7 slope of ln(R) vs 1/T    (k = 8.617 \u00d7 10\u207b\u2075 eV/K)', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);
    doc.autoTable({
        startY: 67,
        head: [['#', 'T (K)', 'R (k\u03a9)', '1/T (K\u207b\u00b9)', 'ln(R)']],
        body: observations.map((o, i) => [i + 1, o.T, o.R.toFixed(2), (1 / o.T).toExponential(3), Math.log(o.R).toFixed(4)]),
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 46] },
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    let y = doc.lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
    doc.text('Formula & Calculations:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Eg = 2 \u00d7 k \u00d7 slope', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Energy Band Gap (Eg) = _____________ eV', 20, y + 8);
    doc.text('Standard Value (Ge) = 0.67 eV', 20, y + 16);

    if (observations.length >= 3) {
        const pts = observations.map(o => ({ x: 1 / o.T, y: Math.log(o.R) }));
        const { slope } = linreg(pts);
        const Eg = 2 * k_eV * slope;
        doc.setTextColor(30, 80, 160);
        doc.text(`[Computed]  Slope = ${slope.toFixed(1)} K,   Eg = ${Eg.toFixed(3)} eV`, 20, y + 26);
    }

    doc.save('Energy_BandGap_Lab_Report.pdf');
});

/* ── Listeners ────────────────────────────────────────────────────── */
tempSlider.addEventListener('input', updateSimulation);
addBtn.addEventListener('click', addRow);
clearBtn.addEventListener('click', () => {
    observations = [];
    renderTable();
    updateChart();
    document.getElementById('calculation-output').innerHTML = '';
});

/* ── Boot: defer 250ms so browser has laid out all flex/grid widths ── */
function boot() {
    sizeCanvas();
    spawnElectrons();
    updateSimulation();
    animLoop();
}
setTimeout(boot, 250);
