let rawData = [];
let chartHourInstance = null;
let chartDateInstance = null;

// Currency Formatter
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value);
};

// Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
    extractLogoColor();
    await loadData();
    populateFilters();
    updateDashboard();

    // Event Listeners for Filters
    document.getElementById('yearFilter').addEventListener('change', updateDashboard);
    document.getElementById('monthFilter').addEventListener('change', updateDashboard);
});

// Extract Dominant Color from Logo
function extractLogoColor() {
    const img = document.getElementById('brand-logo');
    
    // Only extract when image loads
    if (img.complete) {
        processImg(img);
    } else {
        img.addEventListener('load', () => processImg(img));
    }
}

function processImg(img) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 100;
        canvas.height = img.height || 100;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get pixel at top-left (assumed background)
        const pixelData = ctx.getImageData(10, 10, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const a = pixelData[3];
        
        if (a > 0) {
            document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            
            // Adjust text color based on brightness
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness > 180) {
                document.body.style.color = '#1a1a2e';
                document.documentElement.style.setProperty('--glass-bg', 'rgba(0, 0, 0, 0.05)');
                document.documentElement.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
                // update text colors for select inputs and charts
            }
        }
    } catch(e) {
        console.log("Could not extract logo color due to CORS or other issue", e);
    }
}

// Load Data
async function loadData() {
    try {
        const res = await fetch('data.json');
        rawData = await res.json();
    } catch (err) {
        console.error("Error loading data:", err);
        alert("Gagal memuat data.json. Pastikan server lokal berjalan.");
    }
}

// Populate Filters Dynamically
function populateFilters() {
    const years = [...new Set(rawData.map(d => d.Year))].filter(Boolean).sort((a,b)=>b-a);
    const months = [...new Set(rawData.map(d => d.Month))].filter(Boolean);

    const yearSelect = document.getElementById('yearFilter');
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    const monthSelect = document.getElementById('monthFilter');
    months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSelect.appendChild(opt);
    });
}

// Update Dashboard
function updateDashboard() {
    const selectedYear = document.getElementById('yearFilter').value;
    const selectedMonth = document.getElementById('monthFilter').value;

    let filtered = rawData;
    if (selectedYear !== 'ALL') {
        filtered = filtered.filter(d => String(d.Year) === String(selectedYear));
    }
    if (selectedMonth !== 'ALL') {
        filtered = filtered.filter(d => String(d.Month) === String(selectedMonth));
    }

    // 1. KPI Total Sales
    const totalSales = filtered.reduce((sum, curr) => sum + (Number(curr.Total) || 0), 0);
    document.getElementById('totalSales').textContent = formatCurrency(totalSales);

    // 2. KPI Total Bill (Unique Sales Numbers)
    const uniqueBills = new Set(filtered.map(d => d.SalesNumber).filter(Boolean));
    document.getElementById('totalBill').textContent = `${uniqueBills.size} Transaksi`;

    // 3. Prepare Chart Data (Hour)
    const salesByHour = {};
    filtered.forEach(d => {
        if(d.Hour != null) {
            const h = String(d.Hour).padStart(2, '0') + ':00';
            salesByHour[h] = (salesByHour[h] || 0) + (Number(d.Total) || 0);
        }
    });

    const hourLabels = Object.keys(salesByHour).sort();
    const hourData = hourLabels.map(h => salesByHour[h]);

    // 4. Prepare Chart Data (Date/Day)
    const salesByDay = {};
    filtered.forEach(d => {
        if(d.Day != null) {
            const day = String(d.Day);
            salesByDay[day] = (salesByDay[day] || 0) + (Number(d.Total) || 0);
        }
    });

    // sort numerically
    const dayLabels = Object.keys(salesByDay).sort((a,b) => Number(a) - Number(b));
    const dayData = dayLabels.map(d => salesByDay[d]);

    // Update Charts
    updateHourChart(hourLabels, hourData);
    updateDateChart(dayLabels, dayData);
}

// Common Chart config colors
const chartColors = {
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
    borderColor: 'rgba(59, 130, 246, 1)',
    borderWidth: 2,
    hoverBackgroundColor: 'rgba(96, 165, 250, 0.8)'
};
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: { color: 'inherit' },
            grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
            ticks: { color: 'inherit' },
            grid: { color: 'rgba(255,255,255,0.1)' }
        }
    }
};

function updateHourChart(labels, data) {
    const ctx = document.getElementById('chartHour').getContext('2d');
    
    if (chartHourInstance) {
        chartHourInstance.destroy();
    }

    Chart.defaults.color = document.body.style.color || '#ffffff';

    chartHourInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: data,
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
                borderWidth: chartColors.borderWidth,
                borderRadius: 4,
                hoverBackgroundColor: chartColors.hoverBackgroundColor
            }]
        },
        options: chartOptions
    });
}

function updateDateChart(labels, data) {
    const ctx = document.getElementById('chartDate').getContext('2d');
    
    if (chartDateInstance) {
        chartDateInstance.destroy();
    }

    chartDateInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 3,
                tension: 0.3, // smooth curves
                fill: true,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointRadius: 4
            }]
        },
        options: chartOptions
    });
}
