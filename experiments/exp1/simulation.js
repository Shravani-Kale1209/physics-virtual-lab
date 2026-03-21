const voltSlider = document.getElementById('volt-slider');
const vMeter = document.getElementById('v-meter');
const aMeter = document.getElementById('a-meter');
const voltLabel = document.getElementById('volt-label');
const ledBulb = document.getElementById('led-bulb');
const ledSelector = document.getElementById('led-selector');
const obsBody = document.getElementById('obs-body');
const addBtn = document.getElementById('add-reading');
const clearBtn = document.getElementById('clear-data');

let observations = [];
const e = 1.602e-19;
const c = 2.998e8;

function updateSimulation() {
    const v = parseFloat(voltSlider.value);
    const selectedOption = ledSelector.options[ledSelector.selectedIndex];
    const kneeVoltage = parseFloat(selectedOption.getAttribute('data-knee'));
    const colorCode = selectedOption.getAttribute('data-color');

    // Update meter displays
    vMeter.innerText = v.toFixed(2);
    voltLabel.innerText = v.toFixed(2);

    // Realistic Physics Logic with Jitter
    let current = 0;
    if (v > 0) {
        let baseCurrent = 0.01 * (Math.exp((v / kneeVoltage) * 5) - 1);
        // Small random noise (±0.02mA)
        let noise = (Math.random() - 0.5) * 0.04;
        current = baseCurrent > 0.05 ? baseCurrent + noise : 0;
    }

    current = Math.min(Math.max(current, 0), 25.0).toFixed(2);
    aMeter.innerText = current;

    // Visual Feedback: LED Glow
    if (v >= kneeVoltage) {
        const intensity = Math.min((v - kneeVoltage) * 30, 60);
        ledBulb.style.backgroundColor = colorCode;
        ledBulb.style.boxShadow = `0 0 ${intensity}px ${colorCode}, 0 0 ${intensity / 2}px white`;
    } else {
        ledBulb.style.backgroundColor = "#555";
        ledBulb.style.boxShadow = "none";
    }
}

function addRow() {
    observations.push({ v: vMeter.innerText, i: aMeter.innerText });
    renderTable();
}

function renderTable() {
    obsBody.innerHTML = observations.map((obs, index) => `
        <tr><td>${index + 1}</td><td>${obs.v}</td><td>${obs.i}</td></tr>
    `).join('');
}

function formatScientific(value) {
    const exp = value.toExponential(4);
    const [mantissa, exponent] = exp.split('e');
    // Ensure negative sign for powers of 10 is clear
    const power = exponent.replace('+', '');
    return `${mantissa} \\times 10^{${power}} \\text{ J·s}`;
}

function calculatePlanck() {
    if (observations.length < 3) {
        alert("Please record at least 3-5 readings near the threshold voltage!");
        return;
    }

    const lambda = parseFloat(ledSelector.value) * 1e-9;
    // Find experimental knee voltage (where current first exceeds 0.1mA)
    const kneeReading = observations.find(obs => parseFloat(obs.i) > 0.1);
    const v0 = kneeReading ? parseFloat(kneeReading.v) : 0;

    const h = (e * v0 * lambda) / c;
    const formattedH = formatScientific(h);

    document.getElementById('calculation-output').innerHTML = `
        <hr class="my-5">
        <div class="card shadow p-4 bg-white rounded border-primary">
            <h3 class="text-primary border-bottom pb-2 mb-4">Final Lab Report</h3>
            <div class="row">
                <div class="col-md-6">
                    <h5>Governing Formula</h5>
                    <p class="fs-4">$$h = \\frac{e \\cdot V_0 \\cdot \\lambda}{c}$$</p>
                    <ul class="text-muted small">
                        <li>$e = 1.602 \\times 10^{-19} \\text{ C}$</li>
                        <li>$c = 2.998 \\times 10^{8} \\text{ m/s}$</li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-info py-4 text-center">
                        <h4 class="alert-heading">Calculated Value</h4>
                        <p class="fs-2 mb-0 fw-bold">$h = ${formattedH}$</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 p-3 bg-light rounded">
                <h5>Conclusion:</h5>
                <p>Using a wavelength of <b>${(lambda * 1e9).toFixed(0)} nm</b>, the threshold voltage was observed at <b>${v0} V</b>. 
                The experimental value of Planck's constant was found to be $h = ${formattedH}$. 
                This result confirms the quantization of energy in light-emitting semiconductors.</p>
            </div>
        </div>
    `;

    // Re-render MathJax
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

// Event Listeners
voltSlider.addEventListener('input', updateSimulation);
ledSelector.addEventListener('change', () => {
    voltSlider.value = 0;
    observations = [];
    renderTable();
    updateSimulation();
    document.getElementById('calculation-output').innerHTML = "";
});
addBtn.addEventListener('click', addRow);
clearBtn.addEventListener('click', () => {
    observations = [];
    renderTable();
    document.getElementById('calculation-output').innerHTML = "";
});
document.getElementById('download-pdf').addEventListener('click', async function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- 1. Header ---
    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text("PICT Physics Virtual Lab", pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12).setFont("helvetica", "normal");
    doc.text("Determination of Planck's Constant - Lab Report", pageWidth / 2, 22, { align: 'center' });
    doc.line(20, 25, pageWidth - 20, 25);

    // --- 2. Student Info ---
    doc.text("Name: ____________________________________", 20, 35);
    doc.text("Roll No: __________________", 130, 35);
    doc.text("Date: ____________________", 20, 43);

    // --- 3. Circuit Diagram ---
    doc.setFont("helvetica", "bold").text("1. Experimental Setup:", 20, 55);
    const circuitArea = document.querySelector('.circuit-container');
    const circuitCanvas = await html2canvas(circuitArea, { scale: 2 });
    doc.addImage(circuitCanvas.toDataURL('image/png'), 'PNG', 40, 58, 130, 65);

    // --- 4. Observations ---
    doc.text("2. Observations:", 20, 135);
    doc.autoTable({
        html: '#obs-table',
        startY: 140,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { halign: 'center' },
        margin: { left: 20, right: 20 }
    });

    // --- 5. Blank Section for Formula & Calculations ---
    let currentY = doc.lastAutoTable.finalY + 12;
    doc.setFont("helvetica", "bold").text("3. Governing Formula:", 20, currentY);
    doc.setFont("helvetica", "normal");
    // Space for student to write the formula
    doc.text("__________________________________________________________________________", 20, currentY + 10);

    currentY += 25;
    doc.setFont("helvetica", "bold").text("4. Calculations:", 20, currentY);
    doc.setFont("helvetica", "normal");
    // Multiple lines for manual calculation steps
    doc.text("__________________________________________________________________________", 20, currentY + 10);
    doc.text("__________________________________________________________________________", 20, currentY + 18);
    doc.text("__________________________________________________________________________", 20, currentY + 26);

    // --- 6. Final Result ---
    currentY += 40;
    doc.setFont("helvetica", "bold").text("5. Final Result:", 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("Calculated Planck's Constant (h): ____________________ J.s", 20, currentY + 10);
    doc.text("Standard Value of h: 6.626 x 10^-34 J.s", 20, currentY + 18);

    doc.setFont("helvetica", "bold");
    doc.text("Conclusion: ________________________________________________________", 20, currentY + 32);

    doc.save("Plancks_Constant_Manual_Report.pdf");
});
// Init
updateSimulation();