const lambdaMap = {
    "violet": { value: 404.7, color: "#9a47ff" },
    "green": { value: 546.1, color: "#1bd656" },
    "yellow1": { value: 577.0, color: "#ffd700" },
    "yellow2": { value: 579.1, color: "#ffb400" }
};

const D_slider = document.getElementById("d-slider");
const N_slider = document.getElementById("n-slider");
const colorSelect = document.getElementById("color-select");

const val_N = document.getElementById("val-N");
const val_D = document.getElementById("val-D");
const val_colorName = document.getElementById("val-colorName");
const val_y1 = document.getElementById("val-y1");

const slider_d_val = document.getElementById("slider-d-val");
const slider_n_val = document.getElementById("slider-n-val");

const obsBody = document.getElementById("obs-body");
const emptyHint = document.getElementById("empty-hint");

const canvas = document.getElementById("opticalCanvas");
const ctx = canvas.getContext("2d");

let observations = [];
let currentY1 = 0;
let currentTheta = 0;

function calculatePhysics() {
    let N_inch = parseFloat(N_slider.value); // Lines per inch
    let D_cm = parseFloat(D_slider.value); // Screen distance in cm
    
    // 1 inch = 0.0254 meters
    let N_m = N_inch / 0.0254; // Lines per meter
    let d = 1.0 / N_m; // Grating element in meters

    let selectedKey = colorSelect.value;
    let lambda_nm = lambdaMap[selectedKey].value;
    let lambda_m = lambda_nm * 1e-9;

    val_colorName.innerText = colorSelect.options[colorSelect.selectedIndex].text.split(" ")[0];
    val_colorName.style.color = lambdaMap[selectedKey].color;

    slider_d_val.innerText = D_cm;
    slider_n_val.innerText = N_inch;
    val_D.innerText = D_cm;
    val_N.innerText = N_inch;

    // m = 1 order
    let sinTheta = lambda_m / d;
    // Check if total internal reflection or invalid
    if (sinTheta > 1) {
        val_y1.innerText = "No Maxima";
        currentY1 = 0;
        return;
    }

    currentTheta = Math.asin(sinTheta);
    // y1 = D * tan(theta)
    currentY1 = D_cm * Math.tan(currentTheta); 
    
    val_y1.innerText = currentY1.toFixed(2);
}

function updateDrawing() {
    calculatePhysics();

    const W = canvas.width;
    const H = canvas.height;
    
    ctx.clearRect(0, 0, W, H);
    // Background already #06090e via CSS, but let's reinforce and draw grid
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#1a233a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < H; y += 50) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    for (let x = 0; x < W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    ctx.stroke();

    // Central Axis
    const axisY = H / 2 + 20;

    // Fixed Positions
    const posLamp = 120;
    const posSlit = 260;
    const posCollimator = 420;
    const posGrating = 620;
    const posScreen = 930;

    // Draw Source composite beam
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#e6f2ff";
    ctx.fillStyle = "rgba(230, 242, 255, 0.4)";
    ctx.beginPath();
    // Beam 1: Lamp to Slit (wide to narrow)
    ctx.moveTo(posLamp, axisY - 15); ctx.lineTo(posSlit - 10, axisY - 5);
    ctx.lineTo(posSlit - 10, axisY + 5); ctx.lineTo(posLamp, axisY + 15);
    ctx.fill();

    // Beam 2: Slit to Collimator (tight)
    ctx.beginPath();
    ctx.moveTo(posSlit + 10, axisY - 5); ctx.lineTo(posCollimator - 60, axisY - 5);
    ctx.lineTo(posCollimator - 60, axisY + 5); ctx.lineTo(posSlit + 10, axisY + 5);
    ctx.fill();

    // Beam 3: Collimator to Grating (perfect wide cylinder beam)
    ctx.beginPath();
    ctx.moveTo(posCollimator + 60, axisY - 10); ctx.lineTo(posGrating - 15, axisY - 10);
    ctx.lineTo(posGrating - 15, axisY + 10); ctx.lineTo(posCollimator + 60, axisY + 10);
    ctx.fill();

    // Beam 4: Central Maxima (m=0) White/Yellowish straight
    ctx.shadowColor = "#ffeb99";
    ctx.fillStyle = "rgba(255, 235, 153, 0.5)";
    ctx.beginPath();
    ctx.moveTo(posGrating + 15, axisY - 10); ctx.lineTo(posScreen, axisY - 10);
    ctx.lineTo(posScreen, axisY + 10); ctx.lineTo(posGrating + 15, axisY + 10);
    ctx.fill();

    ctx.shadowBlur = 0; // Turn off shadow for components

    // Draw Collimator
    drawCollimator(posCollimator, axisY);
    // Draw Slit
    drawSlit(posSlit, axisY);
    // Draw Lamp
    drawLamp(posLamp, axisY);
    
    // Draw Grating
    drawGrating(posGrating, axisY);

    // Draw Diffraction Rays to screen
    drawDiffractionRays(posGrating, posScreen, axisY);

    // Draw Screen
    drawScreen(posScreen, axisY);
}

function drawLamp(x, y) {
    // Base
    ctx.fillStyle = "#222";
    ctx.fillRect(x - 30, y + 80, 60, 20);
    ctx.fillRect(x - 20, y + 60, 40, 20);

    // Glass tube shell
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.fillStyle = "rgba(200,220,255,0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 60);
    ctx.lineTo(x - 15, y - 60);
    ctx.arc(x, y - 60, 15, Math.PI, 0);
    ctx.lineTo(x + 15, y + 60);
    ctx.fill(); ctx.stroke();

    // Inner glowing tube (Mercury Plasma)
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#66b3ff";
    ctx.fillStyle = "#ccf2ff";
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 40, 12, 80, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.fillText("Mercury Lamp", x, y - 90);
}

function drawSlit(x, y) {
    // Stand
    ctx.fillStyle = "#333";
    ctx.fillRect(x - 15, y + 80, 30, 15);
    ctx.fillRect(x - 5, y + 20, 10, 60);

    // Jaw covers
    ctx.fillStyle = "#555";
    ctx.fillRect(x - 8, y - 60, 16, 50); // top jaw
    ctx.fillRect(x - 8, y + 10, 16, 50); // bottom jaw

    ctx.fillStyle = "#fff";
    ctx.fillText("Slit", x, y - 75);
}

function drawCollimator(x, y) {
    // Stand
    ctx.fillStyle = "#333";
    ctx.fillRect(x - 25, y + 80, 50, 15);
    ctx.fillRect(x - 8, y + 20, 16, 60);

    // Cylinder
    ctx.fillStyle = "#2a2d34";
    ctx.strokeStyle = "#5a6070";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 60, y - 25, 120, 50, 10);
    ctx.fill(); ctx.stroke();

    // Lenses tips
    ctx.fillStyle = "#66b3ff";
    ctx.beginPath(); ctx.ellipse(x - 60, y, 4, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 60, y, 4, 20, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillText("Collimator", x, y - 40);
}

function drawGrating(x, y) {
    // Stand
    ctx.fillStyle = "#333";
    ctx.fillRect(x - 20, y + 80, 40, 15);
    ctx.fillRect(x - 6, y + 40, 12, 40);

    // Frame
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 50);
    ctx.lineTo(x + 10, y - 55);
    ctx.lineTo(x + 10, y + 45);
    ctx.lineTo(x - 10, y + 50);
    ctx.fill();

    // The grating surface (lines)
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)";
    ctx.lineWidth = 1;
    for (let i = -40; i <= 40; i += 3) {
        ctx.beginPath();
        let yLine = y + i;
        ctx.moveTo(x - 6, yLine + 2);
        ctx.lineTo(x + 6, yLine - 2);
        ctx.stroke();
    }

    ctx.fillStyle = "#fff";
    ctx.fillText("Diffraction", x, y - 75);
    ctx.fillText("Grating", x, y - 60);
}

function drawScreen(x, y) {
    // A slightly angled vertical board
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 130);
    ctx.lineTo(x, y + 130);
    ctx.stroke();
    
    // Base
    ctx.fillStyle = "#333";
    ctx.fillRect(x - 15, y + 130, 30, 15);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText("Screen", x + 10, y - 130);
    ctx.textAlign = "center";
}

function drawDiffractionRays(xStart, xEnd, yAxis) {
    // Generate colors physically
    let N_inch = parseFloat(N_slider.value);
    let N_m = N_inch / 0.0254;
    let d = 1.0 / N_m;

    let selectedKey = colorSelect.value;
    let D_cm = parseFloat(D_slider.value);

    // Visual scale factor: to make it fit on screen beautifully
    // If D = 100cm, screen x-dist is ~300 pixels. 
    // y_px = theta_scaled * 300
    // To match reference image proportions:
    const pxScaleY = 250; 

    const W = canvas.width;

    ctx.globalCompositeOperation = "screen";

    ["violet", "green", "yellow1", "yellow2"].forEach(key => {
        let isSelected = (key === selectedKey);
        let lambda_m = lambdaMap[key].value * 1e-9;
        let color = lambdaMap[key].color;
        
        let sinTh = lambda_m / d;
        if (sinTh > 1.0) return; // Disappears

        let th = Math.asin(sinTh);
        
        // y on screen in physical simulation relative to max screen draw width
        let y_px_offset = Math.tan(th) * pxScaleY;

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.shadowBlur = isSelected ? 10 : 2;
        ctx.shadowColor = color;
        
        // m=+1
        ctx.beginPath();
        ctx.moveTo(xStart + 10, yAxis);
        ctx.lineTo(xEnd, yAxis - y_px_offset);
        ctx.stroke();

        // draw max point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xEnd, yAxis - y_px_offset, isSelected ? 5 : 3, 0, Math.PI*2);
        ctx.fill();

        // label m=+1
        if (isSelected) {
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 0;
            ctx.fillText("m = +1", xEnd - 30, yAxis - y_px_offset - 10);
        }

        // m=-1
        ctx.beginPath();
        ctx.moveTo(xStart + 10, yAxis);
        ctx.lineTo(xEnd, yAxis + y_px_offset);
        ctx.stroke();
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xEnd, yAxis + y_px_offset, isSelected ? 5 : 3, 0, Math.PI*2);
        ctx.fill();
        
        // label m=-1
        if (isSelected) {
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 0;
            ctx.fillText("m = -1", xEnd - 30, yAxis + y_px_offset + 15);
            
            // Draw Measurement bracket connecting m=0 and m=+1
            drawMeasurementBracket(xEnd - 50, yAxis, yAxis - y_px_offset);
        }
    });

    // Label m=0
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.fillText("m = 0", xEnd - 30, yAxis - 15);

    ctx.globalCompositeOperation = "source-over";
}

function drawMeasurementBracket(x, y0, y1) {
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    
    // vertical line
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    
    // horizontal ticks
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - 5, y0); ctx.lineTo(x + 5, y0);
    ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    // Center it
    ctx.fillText("y₁", x - 15, y0 - ((y0 - y1)/2));
}

// ─── DATA TABLE LOGIC ───

document.getElementById("add-reading").addEventListener("click", () => {
    let N_inch = parseFloat(N_slider.value);
    let D_cm = parseFloat(D_slider.value);
    let name = colorSelect.options[colorSelect.selectedIndex].text.split(" ")[0];
    
    let N_m = N_inch / 0.0254; 
    let d = 1.0 / N_m; 
    
    let y1_cm = parseFloat(val_y1.innerText);
    if(isNaN(y1_cm) || y1_cm === 0) {
        alert("Invalid reading / No Maxima!"); return;
    }

    // Reverse Calculate lambda to verify
    // tan(th) = y1 / D
    let th = Math.atan(y1_cm / D_cm);
    let lambda_nm = (d * Math.sin(th)) * 1e9;
    
    observations.push({
        name: name,
        n: N_inch,
        d_dist: D_cm,
        y1: y1_cm,
        lambda: lambda_nm
    });

    renderTable();
});

function renderTable() {
    if (observations.length === 0) {
        emptyHint.style.display = "block";
        obsBody.innerHTML = "";
        return;
    }
    emptyHint.style.display = "none";
    
    obsBody.innerHTML = observations.map((obs, i) => `
        <tr>
            <td class="text-secondary fw-bold">${i + 1}</td>
            <td class="fw-bold">${obs.name}</td>
            <td>${obs.n}</td>
            <td>${obs.d_dist.toFixed(1)}</td>
            <td class="text-primary fw-bold">${obs.y1.toFixed(2)}</td>
            <td class="text-success fw-bold">${obs.lambda.toFixed(1)}</td>
        </tr>
    `).join("");
}

document.getElementById("clear-data").addEventListener("click", () => {
    observations = [];
    renderTable();
});

document.getElementById("download-pdf").addEventListener("click", () => {
    if (observations.length === 0) { alert("Record data first!"); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold').setFontSize(18);
    doc.text('PICT Physics Virtual Lab', PW / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont('helvetica', 'normal');
    doc.text('Mercury Spectral Line via Diffraction \u2013 Lab Report', PW / 2, 22, { align: 'center' });
    doc.line(20, 25, PW - 20, 25);

    doc.setFontSize(11);
    doc.text('Name: ____________________________________', 20, 35);
    doc.text('Roll No: __________________', 130, 35);
    doc.text('Date: ____________________', 20, 43);

    doc.setFontSize(10).setTextColor(100);
    // Formula lambda = d * sin(theta) where tan(theta) = y1/D -> lambda = d * y1 / sqrt(D^2 + y1^2)
    doc.text('Formula: \u03bb = (d \u00d7 y\u2081) / \u221A(D\u00B2 + y\u2081\u00B2)    [Derived from d\u00B7sin(\u03B8) = m\u00B7\u03bb for m=1]', 20, 53);
    doc.setTextColor(0);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Observations:', 20, 63);
    
    const tableData = observations.map((o, i) => [
        i+1, o.name, o.n, o.d_dist.toFixed(1), o.y1.toFixed(2), o.lambda.toFixed(1)
    ]);
    
    doc.autoTable({
        startY: 67,
        head: [['#', 'Line Color', 'N (LPI)', 'D (cm)', 'y\u2081 (cm)', 'Wavelength (nm)']],
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
    doc.text('\u03bb = d \u00d7 sin( arctan(y\u2081 / D) )', 20, y + 8);
    doc.text('______________________________________', 20, y + 18);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Calculated Spectral Wavelength (\u03bb) = _____________ nm', 20, y + 8);
    doc.text('Known Wavelengths: Violet(404.7), Green(546.1), Yellow(577/579)', 20, y + 16);
    
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion: __________________________________________________', 20, y + 16);

    let sumL = 0;
    observations.forEach(o => { sumL += o.lambda; });
    let avg_l = sumL / observations.length;

    doc.setTextColor(30, 80, 160);
    doc.text(`[Computed] Average Calculated Wavelength = ${avg_l.toFixed(2)} nm`, 20, y + 36);

    doc.save("Exp7_Diffraction_Report.pdf");
});

window.onload = () => {
    N_slider.addEventListener("input", updateDrawing);
    D_slider.addEventListener("input", updateDrawing);
    colorSelect.addEventListener("change", updateDrawing);
    updateDrawing();
};
