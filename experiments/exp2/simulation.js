/* Physics Constants & DOM Elements */
const HBAR = 1.0545718e-34; 
const LIMIT = HBAR / 2; 

const xSlider = document.getElementById("x-slider");
const pSlider = document.getElementById("p-slider");
const xMeter = document.getElementById("x-meter");
const pMeter = document.getElementById("p-meter");
const productVal = document.getElementById("product-val");
const warningText = document.getElementById("warning-text");
const obsBody = document.getElementById("obs-body");
const addBtn = document.getElementById("add-reading");
const clearBtn = document.getElementById("clear-data");
const downloadPdfBtn = document.getElementById("download-pdf");

let observations = [];
const maxObservations = 8; 

/* Helper: Format number to HTML scientific notation */
function formatSciHTML(num) {
    if (num === 0) return "0";
    let exp = Math.floor(Math.log10(num));
    let mantissa = num / Math.pow(10, exp);
    return `${mantissa.toFixed(2)} &times; 10<sup>${exp}</sup>`;
}

/* Helper: Format number to plain text scientific notation for the PDF */
function formatSciText(num) {
    if (num === 0) return "0";
    let exp = Math.floor(Math.log10(num));
    let mantissa = num / Math.pow(10, exp);
    return `${mantissa.toFixed(2)} x 10^${exp}`;
}

/* Chart.js Setup */
const ctx = document.getElementById('waveChart').getContext('2d');
const waveChart = new Chart(ctx, {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [
            { 
                label: 'Position |ψ(x)|²', 
                borderColor: '#0d6efd', 
                backgroundColor: 'rgba(13, 110, 253, 0.15)', 
                fill: true, data: [], tension: 0.4 
            },
            { 
                label: 'Momentum |Φ(p)|²', 
                borderColor: '#dc3545', 
                backgroundColor: 'rgba(220, 53, 69, 0.15)', 
                fill: true, data: [], tension: 0.4 
            }
        ] 
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 150 }, 
        elements: { point: { radius: 0 } }, 
        scales: { x: { display: false }, y: { display: false, min: 0, max: 1.1 } },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12 } } }
    }
});

function generateGaussianData(sigma) {
    let data = [], labels = [];
    for (let i = -10; i <= 10; i += 0.2) {
        labels.push(i.toFixed(1));
        data.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
    }
    return { labels, data };
}

function updateSimulation() {
    let dx_val = parseFloat(xSlider.value); 
    let dp_val = parseFloat(pSlider.value); 

    let dx_SI = dx_val * 1e-12; 
    let dp_SI = dp_val * 1e-24; 
    let product_SI = dx_SI * dp_SI;

    xMeter.innerText = dx_val.toFixed(1);
    pMeter.innerText = dp_val.toFixed(1);
    productVal.innerHTML = formatSciHTML(product_SI);

    const posData = generateGaussianData(dx_val / 20);
    const momData = generateGaussianData(dp_val / 3);
    
    waveChart.data.labels = posData.labels; 
    waveChart.data.datasets[0].data = posData.data; 
    waveChart.data.datasets[1].data = momData.data; 
    waveChart.update();

    if (product_SI < LIMIT) {
        document.getElementById("product-display").classList.add("text-danger");
        warningText.style.display = "block";
    } else {
        document.getElementById("product-display").classList.remove("text-danger");
        warningText.style.display = "none";
    }
}

function addRow() {
    let dx_val = parseFloat(xSlider.value);
    let dp_val = parseFloat(pSlider.value);
    
    let dx_SI = dx_val * 1e-12;
    let dp_SI = dp_val * 1e-24;
    let product_SI = dx_SI * dp_SI;

    if (observations.length >= maxObservations) observations.shift(); 

    observations.push({ dx: dx_SI, dp: dp_SI, product: product_SI });
    renderTable();
}

function renderTable() {
    obsBody.innerHTML = observations.map((obs, i) => `
        <tr class="${obs.product < LIMIT ? 'table-danger' : ''}">
            <td class="fw-bold text-muted">${i + 1}</td>
            <td>${formatSciHTML(obs.dx)}</td>
            <td>${formatSciHTML(obs.dp)}</td>
            <td class="fw-bold">${formatSciHTML(obs.product)}</td>
        </tr>
    `).join("");
}

function calculateUncertainty() {
    if (observations.length == 0) {
        alert("Please record observations first.");
        return;
    }

    let last = observations[observations.length - 1];
    let satisfied = last.product >= LIMIT;
    let alertClass = satisfied ? "alert-success" : "alert-danger";
    let icon = satisfied ? "✅ Principle Satisfied" : "❌ Principle Violated";

    document.getElementById("calculation-output").innerHTML = `
        <div class="card p-4 border-0 shadow-sm mt-2">
            <h5 class="border-bottom pb-2 mb-3">Verification of Final Reading</h5>
            <div class="row align-items-center">
                <div class="col-md-6 math-text">
                    <p class="mb-1"><b>Measured $\Delta x$:</b> ${formatSciHTML(last.dx)} m</p>
                    <p class="mb-1"><b>Measured $\Delta p$:</b> ${formatSciHTML(last.dp)} kg·m/s</p>
                    <p class="mb-0 text-primary fs-5 mt-2"><b>Your Product:</b> ${formatSciHTML(last.product)} J·s</p>
                </div>
                <div class="col-md-6 mt-3 mt-md-0">
                    <div class="alert ${alertClass} text-center mb-0 py-3">
                        <h5 class="mb-1 fw-bold">${icon}</h5>
                        <span class="small">Theoretical Limit: $\\ge 5.27 \\times 10^{-35}$ J·s</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.MathJax) MathJax.typesetPromise();
    document.getElementById("calculation-output").scrollIntoView({ behavior: 'smooth' });
}

/* --- PDF GENERATION LOGIC --- */
function downloadPDF() {
    if (observations.length === 0) {
        alert("No data to download. Please record some observations first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PICT Quantum Physics Virtual Lab", 14, 20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Heisenberg Uncertainty Principle - Lab Report", 14, 28);

    // Student Info Blank Fields
    doc.setFontSize(11);
    doc.text("Name: _________________________________", 14, 45);
    doc.text("Roll No: __________________", 120, 45);
    doc.text("Date: __________________", 14, 55);

    // Theoretical Context
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Theoretical Limit: dx * dp >= hbar / 2 (approx 5.27 x 10^-35 J s)", 14, 70);

    // Prepare Table Data
    const tableColumn = ["Reading #", "Position Uncert. dx (m)", "Momentum Uncert. dp (kg m/s)", "Product dx*dp (J s)"];
    const tableRows = [];

    observations.forEach((obs, index) => {
        const rowData = [
            index + 1,
            formatSciText(obs.dx),
            formatSciText(obs.dp),
            formatSciText(obs.product)
        ];
        tableRows.push(rowData);
    });

    // Generate Table
    doc.autoTable({
        startY: 75,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [13, 110, 253] }, // Bootstrap primary blue
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' }
    });

    // Verification Section at the bottom
    let lastY = doc.lastAutoTable.finalY + 15;
    let last = observations[observations.length - 1];
    let satisfied = last.product >= LIMIT;
    let resultText = satisfied ? "Principle Satisfied." : "Principle Violated.";

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Final Reading Verification:", 14, lastY);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Calculated Product: ${formatSciText(last.product)} J s`, 14, lastY + 8);
    
    if(satisfied) {
        doc.setTextColor(25, 135, 84); // Bootstrap success green
    } else {
        doc.setTextColor(220, 53, 69); // Bootstrap danger red
    }
    doc.text(`Conclusion: ${resultText}`, 14, lastY + 16);

    // Save PDF
    doc.save("Heisenberg_Lab_Report.pdf");
}

/* Listeners */
xSlider.addEventListener("input", updateSimulation);
pSlider.addEventListener("input", updateSimulation);
addBtn.addEventListener("click", addRow);
downloadPdfBtn.addEventListener("click", downloadPDF);
clearBtn.addEventListener("click", () => {
    observations = [];
    renderTable();
    document.getElementById("calculation-output").innerHTML = "";
});

// Init
updateSimulation();