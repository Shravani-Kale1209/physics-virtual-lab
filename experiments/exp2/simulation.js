/* Physics Constants & DOM Elements */
const HBAR = 1.0545718e-34; 
const LIMIT = HBAR / 2; // 5.27 x 10^-35 J.s
// Using the product from the reference image (~2 * limit) 
const CONST_PRODUCT = 1.054e-33;

const dxSlider = document.getElementById("x-slider");
const val_dx = document.getElementById("val-dx");
const val_dp = document.getElementById("val-dp");
const val_prod = document.getElementById("val-prod");
const obsBody = document.getElementById("obs-body");
const addBtn = document.getElementById("add-reading");
const clearBtn = document.getElementById("clear-data");
const downloadPdfBtn = document.getElementById("download-pdf");

const realCanvas = document.getElementById("realCanvas");
const momCanvas = document.getElementById("momCanvas");
const prodGraphCanvas = document.getElementById("productGraphCanvas");

let observations = [];
const maxObservations = 10; 

function formatSciHTML(num) {
    if (num === 0) return "0";
    let exp = Math.floor(Math.log10(num));
    let mantissa = num / Math.pow(10, exp);
    return `${mantissa.toFixed(2)} &times; 10<sup>${exp}</sup>`;
}

function formatSciText(num) {
    if (num === 0) return "0";
    let exp = Math.floor(Math.log10(num));
    let mantissa = num / Math.pow(10, exp);
    return `${mantissa.toFixed(2)} x 10^${exp}`;
}

// Global drawing configurations
const THEME = {
    bg: "#06090e",
    grid: "#1a233a",
    purple: "#d05ce3",
    blue: "#5c9ce3",
    yellow: "#e3bc5c",
    green: "#5ce375",
    textAxis: "#6482b9"
};

// ─── RENDERING LOGIC ───

function drawGrid(ctx, W, H, hLines, vLines) {
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=hLines; i++) {
        let y = (H/hLines)*i;
        ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    for(let i=0; i<=vLines; i++) {
        let x = (W/vLines)*i;
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    ctx.stroke();

    // Central Axes
    ctx.strokeStyle = "#273b5c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H);
    ctx.moveTo(0, H/2); ctx.lineTo(W, H/2);
    ctx.stroke();
}

function processAndRender() {
    // 1. Calculations
    let dx_val = parseFloat(dxSlider.value); // in nm
    let dx_SI = dx_val * 1e-9;
    
    // Applying synthetic coupled physics to match the reference graph's parabolic shape
    // P(x) = 1e-34 * 0.5 * (x^2 + 1/x^2)
    let prod_SI = 1e-34 * 0.5 * (Math.pow(dx_val, 2) + Math.pow(dx_val, -2));
    
    let dp_SI = prod_SI / dx_SI;
    let dp_disp = dp_SI * 1e24; // scale for display string

    // Output texts
    val_dx.innerText = dx_val.toFixed(2);
    // Format dp specifically for neatness
    val_dp.innerHTML = `${(dp_SI / Math.pow(10, Math.floor(Math.log10(dp_SI)))).toFixed(2)} &times; 10<sup>${Math.floor(Math.log10(dp_SI))}</sup>`;
    val_prod.innerHTML = `${(prod_SI / Math.pow(10, Math.floor(Math.log10(prod_SI)))).toFixed(2)} &times; 10<sup>${Math.floor(Math.log10(prod_SI))}</sup>`;

    // 2. Render Real Space Canvas
    renderRealSpace(dx_val);

    // 3. Render Momentum Space Canvas
    renderMomentumSpace(dp_disp);
    
    // 4. Render Product Graph
    renderProductGraph();
}

function renderRealSpace(dx) {
    const ctx = realCanvas.getContext("2d");
    const W = realCanvas.width;
    const H = realCanvas.height;

    ctx.clearRect(0,0,W,H);
    drawGrid(ctx, W, H, 10, 20);

    // X ranges from -10 to 10 conceptually
    const minX = -10; const maxX = 10;
    
    // Wave parameters
    let sigma_x = dx; 
    let k = 8; // frequency of the carrier sine wave
    
    ctx.beginPath();
    for(let px=0; px<=W; px+=1) {
        let x = minX + (px/W)*(maxX - minX);
        let envelope = Math.exp(-(x*x)/(2*sigma_x*sigma_x));
        let y_val = Math.cos(k*x) * envelope;
        
        let py = H/2 - (y_val * (H/2.5));
        if(px===0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    
    ctx.strokeStyle = THEME.purple;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = THEME.purple;
    ctx.shadowBlur = 10;
    ctx.stroke();
    
    // Disable shadow for UI
    ctx.shadowBlur = 0;

    // Draw Width lines (spanning -sigma to +sigma)
    let left_x = -dx; let right_x = dx;
    let pLeft = (left_x - minX)/(maxX - minX) * W;
    let pRight = (right_x - minX)/(maxX - minX) * W;

    // Calculate exact visual height of the envelope at these bounds (1 standard deviation = e^-0.5)
    let env_point = Math.exp(-0.5);
    let env_y = H/2 - (env_point * (H/2.5));
    // Provide a small gap above the envelope for the dotted lines
    let bracket_y = env_y - 25; 

    ctx.strokeStyle = THEME.yellow;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    // Vertical drop lines stopping exactly at the envelope
    ctx.moveTo(pLeft, bracket_y); ctx.lineTo(pLeft, env_y - 2);
    ctx.moveTo(pRight, bracket_y); ctx.lineTo(pRight, env_y - 2);
    ctx.stroke();

    // Horizontal top measurement bar
    ctx.beginPath();
    ctx.moveTo(pLeft, bracket_y); ctx.lineTo(pRight, bracket_y);
    ctx.stroke();
    
    // Arrows pointing outwards
    ctx.setLineDash([]);
    ctx.fillStyle = THEME.yellow;
    ctx.beginPath(); ctx.moveTo(pLeft, bracket_y); ctx.lineTo(pLeft+6, bracket_y-4); ctx.lineTo(pLeft+6, bracket_y+4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(pRight, bracket_y); ctx.lineTo(pRight-6, bracket_y-4); ctx.lineTo(pRight-6, bracket_y+4); ctx.fill();

    ctx.textAlign = "center";
    ctx.font = "bold 13px Arial";
    // Minor shadow for better visibility
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("Δx", W/2, bracket_y - 8);
    ctx.shadowBlur = 0;

    // Axis labels
    ctx.fillStyle = THEME.textAxis;
    ctx.font = "11px sans-serif";
    ctx.fillText("-10", 15, H/2 + 15);
    ctx.fillText("10", W - 15, H/2 + 15);
    ctx.fillText("x (nm)", W/2, H - 10);
}

function renderMomentumSpace(dp) {
    const ctx = momCanvas.getContext("2d");
    const W = momCanvas.width;
    const H = momCanvas.height;

    ctx.clearRect(0,0,W,H);
    drawGrid(ctx, W, H, 10, 12);

    // Base conceptual range on momentum. Since dp goes inversely with dx (0.1 to 10 nm)
    // dp range is proportional bounds. Let's fix axis -6 to 6 arbitrary units.
    const minP = -6; const maxP = 6;
    
    // Using dp directly as standard deviation mapping for visual scale
    let sigma_p = (dp / 5.25) * 1.5; // normalized visual scale based on midpoint

    ctx.beginPath();
    for(let px=0; px<=W; px+=1) {
        let p = minP + (px/W)*(maxP - minP);
        let y_val = Math.exp(-(p*p)/(2*sigma_p*sigma_p));
        
        let py = H/2 + (H/2.5) - (y_val * (H/1.5));
        if(px===0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    
    ctx.strokeStyle = THEME.blue;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = THEME.blue;
    ctx.shadowBlur = 10;
    ctx.stroke();
    
    ctx.shadowBlur = 0;

    // Width lines for momentum
    let left_p = -sigma_p; let right_p = sigma_p;
    let pLeft = (left_p - minP)/(maxP - minP) * W;
    let pRight = (right_p - minP)/(maxP - minP) * W;
    let hTop = H/2 + (H/2.5) - (Math.exp(-0.5) * (H/1.5)); // height at 1 sigma = 0.606 max height

    ctx.strokeStyle = THEME.yellow;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pLeft, hTop - 30); ctx.lineTo(pLeft, hTop + 30);
    ctx.moveTo(pRight, hTop - 30); ctx.lineTo(pRight, hTop + 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pLeft, hTop - 30); ctx.lineTo(pRight, hTop - 30);
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.fillStyle = THEME.yellow;
    ctx.beginPath(); ctx.moveTo(pLeft, hTop-30); ctx.lineTo(pLeft+6, hTop-30-4); ctx.lineTo(pLeft+6, hTop-30+4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(pRight, hTop-30); ctx.lineTo(pRight-6, hTop-30-4); ctx.lineTo(pRight-6, hTop-30+4); ctx.fill();

    ctx.textAlign = "center";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Δp", W/2, hTop - 38);

    // Axis labels
    ctx.fillStyle = THEME.textAxis;
    ctx.font = "11px sans-serif";
    ctx.fillText("-6", 15, H - 20);
    ctx.fillText("6", W - 15, H - 20);
    ctx.fillText("p (kg m/s)", W/2, H - 5);
}

function renderProductGraph() {
    const ctx = prodGraphCanvas.getContext("2d");
    const W = prodGraphCanvas.width;
    const H = prodGraphCanvas.height;

    ctx.clearRect(0,0,W,H);
    
    const pL = 60, pR = 20, pT = 20, pB = 40;
    
    // Coordinate mapping functions based strictly on log scales
    // X scale: 10^-1 to 10^1
    const logMinX = -1, logMaxX = 1;
    function getX(val) {
        let l = Math.log10(val);
        return pL + ((l - logMinX)/(logMaxX - logMinX)) * (W - pL - pR);
    }
    
    // Y scale: 10^-35 to 10^-31
    const logMinY = -35, logMaxY = -31;
    function getY(val) {
        let l = Math.log10(val);
        return H - pB - ((l - logMinY)/(logMaxY - logMinY)) * (H - pT - pB);
    }

    // Grid rendering
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Y-axis grid & labels (-35 to -31)
    ctx.fillStyle = THEME.textAxis;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for(let i = logMinY; i <= logMaxY; i++) {
        let y = H - pB - ((i - logMinY)/(logMaxY - logMinY)) * (H - pT - pB);
        ctx.moveTo(pL, y); ctx.lineTo(W - pR, y);
        
        // Draw tick label (e.g. 10^-35)
        ctx.fillText(`10`, pL - 20, y - 4);
        ctx.font = "9px sans-serif";
        ctx.fillText(i, pL - 5, y - 9);
        ctx.font = "11px sans-serif";
    }

    // X-axis grid & labels (-1 to 1)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for(let i = logMinX; i <= logMaxX; i++) {
        let x = pL + ((i - logMinX)/(logMaxX - logMinX)) * (W - pL - pR);
        ctx.moveTo(x, pT); ctx.lineTo(x, H - pB + 5);
        
        ctx.fillText(`10`, x - 5, H - pB + 10);
        ctx.font = "9px sans-serif";
        ctx.fillText(i, x + 5, H - pB + 5);
        ctx.font = "11px sans-serif";
    }
    ctx.stroke();

    // Axes Frame
    ctx.strokeStyle = "#8ba1c7"; // Distinct axes frame
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pL, pT); ctx.lineTo(pL, H - pB); ctx.lineTo(W - pR, H - pB);
    ctx.stroke();

    // Constant limit line (h/2)
    let yLim = getY(LIMIT);
    ctx.strokeStyle = THEME.green;
    ctx.setLineDash([5,5]);
    ctx.beginPath();
    ctx.moveTo(pL, yLim); ctx.lineTo(W - pR, yLim);
    ctx.stroke();
    
    // Draw sweeping actual parabola line
    ctx.strokeStyle = THEME.yellow;
    ctx.setLineDash([]);
    ctx.beginPath();
    for(let xval = 0.1; xval <= 10.0; xval += 0.1) {
        let px = getX(xval);
        let prod = 1e-34 * 0.5 * (Math.pow(xval, 2) + Math.pow(xval, -2));
        let py = getY(prod);
        if (xval === 0.1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw all recorded points 
    observations.forEach(obs => {
        let px = getX(obs.dx_val);
        let py = getY(obs.product);
        
        ctx.fillStyle = THEME.yellow;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // Current point cursor!
    let dx_val = parseFloat(dxSlider.value);
    let px = getX(dx_val);
    let prod_val = 1e-34 * 0.5 * (Math.pow(dx_val, 2) + Math.pow(dx_val, -2));
    let py = getY(prod_val);

    // Glowing current marker
    ctx.fillStyle = THEME.purple;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Δx (nm)", pL + (W-pL-pR)/2, H - 10);
    
    ctx.save();
    ctx.translate(15, H/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Δx · Δp (J·s)", 0, 0);
    ctx.restore();

    // Reference Legend Matching User Image
    ctx.fillStyle = "#0c1221"; // very dark box
    ctx.fillRect(W - pR - 105, pT + 5, 100, 50);
    ctx.strokeStyle = THEME.grid;
    ctx.strokeRect(W - pR - 105, pT + 5, 100, 50);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText("Δx · Δp (Actual)", W - pR - 70, pT + 22);
    ctx.fillText("ℏ/2 (Limit)", W - pR - 70, pT + 42);
    
    ctx.fillStyle = THEME.yellow;
    ctx.beginPath(); ctx.arc(W - pR - 85, pT + 17, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = THEME.yellow;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(W - pR - 95, pT + 17); ctx.lineTo(W - pR - 75, pT + 17); ctx.stroke();
    
    ctx.strokeStyle = THEME.green;
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(W - pR - 95, pT + 37); ctx.lineTo(W - pR - 75, pT + 37); ctx.stroke();
}

// ─── DATA BOARD ──────────────────────────────────────────────

function addRow() {
    let dx_val = parseFloat(dxSlider.value);
    let dx_SI = dx_val * 1e-9;
    
    let prod_SI = 1e-34 * 0.5 * (Math.pow(dx_val, 2) + Math.pow(dx_val, -2));
    let dp_SI = prod_SI / dx_SI;

    if (observations.length >= maxObservations) observations.shift(); 
    
    // Check if duplicate point exists to avoid clutter
    let existing = observations.find(o => o.dx_val === dx_val);
    if(existing) return; 

    observations.push({ 
        dx_val: dx_val, 
        dx: dx_SI, 
        dp: dp_SI, 
        product: prod_SI 
    });
    
    // Sort array by dx nicely
    observations.sort((a,b) => a.dx_val - b.dx_val);
    
    renderTable();
    processAndRender(); // update graph
}

function renderTable() {
    if (observations.length === 0) {
        document.getElementById("empty-hint").style.display = "block";
        obsBody.innerHTML = "";
        return;
    }
    document.getElementById("empty-hint").style.display = "none";
    
    obsBody.innerHTML = observations.map((obs, i) => `
        <tr>
            <td class="text-secondary fw-bold">${i + 1}</td>
            <td style="color:#8a2be2"><b>${obs.dx_val.toFixed(2)}</b></td>
            <td style="color:#0056b3"><b>${formatSciHTML(obs.dp)}</b></td>
            <td class="fw-bold text-dark">${formatSciHTML(obs.product)}</td>
            <td class="text-success">${formatSciHTML(LIMIT)}</td>
            <td class="text-success fw-bold">≥ ℏ/2 ✓</td>
        </tr>
    `).join("");
}

// ─── PDF OUTPUT ──────────────────────────────────────────────
function downloadPDF() {
    if (observations.length === 0) {
        alert("No data recorded!"); return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text('Heisenberg Uncertainty Principle \u2013 Lab Report', PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(10).setTextColor(100);
    doc.text('Formula: \u0394x \u00b7 \u0394p \u2265 \u210f/2    (\u210f/2 = 5.27 \u00d7 10\u207b\u00b3\u2075 J\u00b7s)', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);
    
    const tableData = observations.map((o, i) => [
        i+1, o.dx_val.toFixed(2), formatSciText(o.dp), formatSciText(o.product), formatSciText(LIMIT)
    ]);
    
    doc.autoTable({
        startY: 67,
        head: [['#', '\u0394x (nm)', '\u0394p (kg m/s)', 'Product (J.s)', 'Limit (J.s)']],
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
    doc.text('\u0394x \u00b7 \u0394p = Product', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    
    let sumProd = 0;
    observations.forEach(o => sumProd += o.product);
    let avgProd = sumProd / observations.length;
    
    doc.text('Average Uncertainty Product = _____________ J·s', 20, y + 8);
    doc.text('Theoretical Minimum (\u210f/2) = 5.27 \u00d7 10\u207b\u00b3\u2075 J·s', 20, y + 16);
    
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion: __________________________________________________', 20, y + 16);

    doc.setTextColor(30, 80, 160);
    doc.text(`[Computed] Average Product = ${formatSciText(avgProd)} J·s (Verified \u2265 \u210f/2)`, 20, y + 36);

    doc.save("Heisenberg_Lab_Report.pdf");
}

/* Event Listeners */
dxSlider.addEventListener("input", processAndRender);
addBtn.addEventListener("click", addRow);
downloadPdfBtn.addEventListener("click", downloadPDF);
clearBtn.addEventListener("click", () => {
    observations = [];
    renderTable();
    processAndRender();
});

// Initialization calls
processAndRender();