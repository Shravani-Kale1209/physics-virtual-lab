// simulation.js
const voltSlider = document.getElementById('volt-slider');
const vMeter = document.getElementById('v-meter');
const aMeter = document.getElementById('a-meter');
const ledBulb = document.getElementById('led-bulb');
const ledSelector = document.getElementById('led-selector');
const obsBody = document.getElementById('obs-body');
const addBtn = document.getElementById('add-reading');
const clearBtn = document.getElementById('clear-data');

let observations = [];

// Physics Constants
const e = 1.602e-19;
const c = 3e8;

function updateSimulation() {
    const v = parseFloat(voltSlider.value);
    const selectedOption = ledSelector.options[ledSelector.selectedIndex];
    const kneeVoltage = parseFloat(selectedOption.getAttribute('data-knee'));
    const colorCode = selectedOption.getAttribute('data-color');

    vMeter.innerText = v.toFixed(2);

    // Physics Logic: Simplified Shockley Equation
    let current = 0;
    if (v > 0) {
        current = 0.01 * (Math.exp((v / kneeVoltage) * 5) - 1);
    }
    current = Math.min(current, 25.0).toFixed(2);
    aMeter.innerText = current;

    // Visual Feedback
    if (v >= kneeVoltage) {
        const intensity = Math.min((v - kneeVoltage) * 20, 40);
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
        <tr>
            <td>${index + 1}</td>
            <td>${obs.v}</td>
            <td>${obs.i}</td>
        </tr>
    `).join('');
}

// Function to convert 6.24e-34 to 6.24 x 10^-34
function formatScientific(value) {
    const exp = value.toExponential(4);
    const [mantissa, exponent] = exp.split('e');
    return `${mantissa} &times; 10<sup>${exponent}</sup> J&middot;s`;
}

function calculatePlanck() {
    if (observations.length < 2) {
        alert("Please record readings across the knee voltage first!");
        return;
    }

    const selectedOption = ledSelector.options[ledSelector.selectedIndex];
    const lambda = parseFloat(selectedOption.value) * 1e-9;

    // Find the experimental knee voltage (where current first spikes)
    const kneeReading = observations.find(obs => parseFloat(obs.i) > 0.1);
    const v0 = kneeReading ? parseFloat(kneeReading.v) : 0;

    const h = (e * v0 * lambda) / c;

    displayResults(v0, lambda, h);
}

function displayResults(v0, lambda, h) {
    const formattedH = formatScientific(h);
    const resultsSection = `
        <div class="col-12 card shadow-sm p-4 mb-5 bg-white rounded">
            <h3 class="border-bottom pb-2">Experimental Results</h3>
            <div class="row">
                <div class="col-md-6">
                    <h5>Formula</h5>
                    <p class="fs-5">$$h = \\frac{e \\cdot V_0 \\cdot \\lambda}{c}$$</p>
                    
                    <h5>Calculations</h5>
                    <ul>
                        <li><b>Knee Voltage ($V_0$):</b> ${v0} V</li>
                        <li><b>Wavelength ($\lambda$):</b> ${lambda * 1e9} nm</li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-primary">
                        <h4 class="alert-heading">Result:</h4>
                        <p class="fs-4 mb-0"><b>$h =$</b> ${formattedH}</p>
                    </div>
                </div>
            </div>
            <div class="mt-3">
                <h5>Conclusion:</h5>
                <p>The experimental value of Planck's constant was determined to be <b>${formattedH}</b>. 
                This results from the threshold voltage $V_0$ required for photon emission in a 
                semiconductor LED of wavelength ${lambda * 1e9} nm.</p>
            </div>
        </div>
    `;

    document.getElementById('calculation-output').innerHTML = resultsSection;

    // Trigger MathJax to re-scan the page for new formulas
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

// Listeners
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
});

updateSimulation();