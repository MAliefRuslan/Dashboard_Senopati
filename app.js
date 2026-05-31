let rawData = [];
let chartHourInstance = null;
let chartDateInstance = null;
let chartMenuInstance = null;
let chartVisitInstance = null;
let chartPaymentInstance = null;
let chartCompareYearInstance = null;
let chartCompareDailyInstance = null;

// Currency Formatter
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value);
};

const formatShortCurrency = (value) => {
    if (value >= 1e9) {
        return 'Rp ' + (value / 1e9).toFixed(1).replace(/\.0$/, '') + ' M';
    }
    if (value >= 1e6) {
        return 'Rp ' + (value / 1e6).toFixed(1).replace(/\.0$/, '') + ' jt';
    }
    if (value >= 1e3) {
        return 'Rp ' + (value / 1e3).toFixed(1).replace(/\.0$/, '') + ' rb';
    }
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(value);
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
    const compare1 = document.getElementById('compareMonth1');
    const compare2 = document.getElementById('compareMonth2');
    const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    months.forEach(m => {
        let displayMonth = m;
        const idx = englishMonths.indexOf(m);
        if (idx !== -1) {
            displayMonth = monthNames[idx];
        } else if (Number.isInteger(Number(m)) && m >= 1 && m <= 12) {
            displayMonth = monthNames[m - 1];
        }

        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = displayMonth;
        monthSelect.appendChild(opt);

        const opt1 = document.createElement('option');
        opt1.value = m;
        opt1.textContent = displayMonth;
        compare1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = m;
        opt2.textContent = displayMonth;
        compare2.appendChild(opt2);
    });

    if (months.length > 0) compare1.value = months[0];
    if (months.length > 1) compare2.value = months[1];
    else if (months.length > 0) compare2.value = months[0];

    // Add event listeners for the new dropdowns
    compare1.addEventListener('change', updateCompareDailyChart);
    compare2.addEventListener('change', updateCompareDailyChart);
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

    // 2. KPI Total Bill & Rata-rata Transaksi
    const uniqueBills = new Set(filtered.map(d => d.SalesNumber).filter(Boolean));
    document.getElementById('totalBill').textContent = `${uniqueBills.size} Transaksi`;

    const avgTrans = uniqueBills.size > 0 ? totalSales / uniqueBills.size : 0;
    document.getElementById('avgTransaction').textContent = formatCurrency(avgTrans);

    // 3. Prepare Chart Data (Hour) - Rata-rata per hari
    const salesByHour = {};
    filtered.forEach(d => {
        if(d.Hour != null) {
            const h = String(d.Hour).padStart(2, '0') + ':00';
            salesByHour[h] = (salesByHour[h] || 0) + (Number(d.Total) || 0);
        }
    });

    // Count unique days for averaging
    const uniqueDaysSet = new Set();
    filtered.forEach(d => {
        if(d.Year != null && d.Month != null && d.Day != null) {
            uniqueDaysSet.add(`${d.Year}-${d.Month}-${d.Day}`);
        }
    });
    const totalUniqueDays = uniqueDaysSet.size || 1;

    const hourLabels = Object.keys(salesByHour).sort();
    const hourData = hourLabels.map(h => Math.round(salesByHour[h] / totalUniqueDays));

    // 4. Prepare Chart Data (Date/Day)
    const salesByDay = {};
    filtered.forEach(d => {
        if(d.Day != null) {
            const day = String(d.Day);
            salesByDay[day] = (salesByDay[day] || 0) + (Number(d.Total) || 0);
        }
    });

    const existingDays = Object.keys(salesByDay).map(Number);
    const maxDay = existingDays.length > 0 ? Math.max(...existingDays) : 31;
    const fullDayLabels = Array.from({length: maxDay}, (_, i) => String(i + 1));
    const fullDayData = fullDayLabels.map(d => salesByDay[d] || 0);

    // 5. Prepare Top 10 Menu
    const salesByMenu = {};
    filtered.forEach(d => {
        if(d.Menu) salesByMenu[d.Menu] = (salesByMenu[d.Menu] || 0) + (Number(d.Total) || 0);
    });
    const topMenu = Object.entries(salesByMenu)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10);
    const menuLabels = topMenu.map(t => t[0]);
    const menuData = topMenu.map(t => t[1]);

    // 6. Visit Purpose (Nominal / Revenue)
    const visitCounts = {};
    filtered.forEach(d => {
        if(d.VisitPurpose) {
            visitCounts[d.VisitPurpose] = (visitCounts[d.VisitPurpose] || 0) + (Number(d.Total) || 0);
        }
    });
    const visitLabels = Object.keys(visitCounts).sort((a,b) => visitCounts[b] - visitCounts[a]);
    const visitData = visitLabels.map(k => visitCounts[k]);

    // Populate Transaction Types Mini Cards
    const trxGrid = document.getElementById('transactionTypesGrid');
    trxGrid.innerHTML = '';
    const trxColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
    const totalVisits = visitData.reduce((a, b) => a + b, 0);

    visitLabels.forEach((label, index) => {
        const count = visitCounts[label];
        const percent = totalVisits > 0 ? ((count / totalVisits) * 100).toFixed(1) : 0;
        const color = trxColors[index % trxColors.length];
        
        const card = document.createElement('div');
        card.className = 'trx-mini-card';
        card.style.setProperty('--card-color', color);
        
        card.innerHTML = `
            <div class="trx-mini-title">${label}</div>
            <div class="trx-mini-count">${formatCurrency(count)}</div>
            <div class="trx-mini-percent">${percent}%</div>
        `;
        trxGrid.appendChild(card);
    });

    // 7. Payment Method (Revenue / Total)
    const paymentCounts = {};
    filtered.forEach(d => {
        if(d.PaymentMethod) {
            let method = d.PaymentMethod.replace(/\s*\([^)]*\)/g, '').trim();
            paymentCounts[method] = (paymentCounts[method] || 0) + (Number(d.Total) || 0);
        }
    });
    const sortedPayments = Object.entries(paymentCounts).sort((a,b) => b[1] - a[1]);
    const paymentLabels = sortedPayments.map(p => p[0]);
    const paymentData = sortedPayments.map(p => p[1]);

    // Update Charts
    updateHourChart(hourLabels, hourData);
    updateDateChart(fullDayLabels, fullDayData);
    updateMenuChart(menuLabels, menuData);
    updateVisitChart(visitLabels, visitData);
    updatePaymentChart(paymentLabels, paymentData);
    
    // Update Comparison Charts
    updateCompareYearChart();
    updateCompareDailyChart();
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
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: function(context) {
                    return 'Penjualan: ' + formatShortCurrency(context.raw);
                }
            }
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: { 
                color: 'inherit',
                callback: function(value) {
                    return formatShortCurrency(value);
                }
            },
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

    const dateChartOptions = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            x: {
                ...chartOptions.scales.x,
                ticks: {
                    ...chartOptions.scales.x.ticks,
                    autoSkip: false
                }
            }
        }
    };

    chartDateInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointHoverBorderColor: '#fff'
            }]
        },
        options: dateChartOptions
    });
}

function updateMenuChart(labels, data) {
    const ctx = document.getElementById('chartMenu').getContext('2d');
    if (chartMenuInstance) chartMenuInstance.destroy();

    const menuOptions = JSON.parse(JSON.stringify(chartOptions));
    menuOptions.indexAxis = 'y';
    menuOptions.scales = {
        x: {
            beginAtZero: true,
            ticks: { 
                color: 'inherit',
                callback: function(value) {
                    return formatShortCurrency(value);
                }
            },
            grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
            ticks: { color: 'inherit' },
            grid: { display: false }
        }
    };
    menuOptions.plugins = {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: function(context) {
                    return 'Penjualan: ' + formatShortCurrency(context.raw);
                }
            }
        }
    };

    chartMenuInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: data,
                backgroundColor: 'rgba(219, 39, 119, 0.8)',
                borderColor: 'rgba(219, 39, 119, 1)',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(219, 39, 119, 1)'
            }]
        },
        options: menuOptions
    });
}

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { color: 'inherit' } },
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed !== null) {
                        label += new Intl.NumberFormat('id-ID').format(context.parsed);
                    }
                    return label;
                }
            }
        }
    }
};

const pieColors = [
    'rgba(59, 130, 246, 0.7)',
    'rgba(16, 185, 129, 0.7)',
    'rgba(245, 158, 11, 0.7)',
    'rgba(239, 68, 68, 0.7)',
    'rgba(139, 92, 246, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(20, 184, 166, 0.7)',
    'rgba(244, 63, 94, 0.7)'
];

function updateVisitChart(labels, data) {
    const ctx = document.getElementById('chartVisit').getContext('2d');
    if (chartVisitInstance) chartVisitInstance.destroy();

    chartVisitInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: pieColors,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
            }]
        },
        options: doughnutOptions
    });
}

function updatePaymentChart(labels, data) {
    const ctx = document.getElementById('chartPayment').getContext('2d');
    if (chartPaymentInstance) chartPaymentInstance.destroy();

    const paymentOptions = JSON.parse(JSON.stringify(chartOptions));
    paymentOptions.indexAxis = 'y';
    paymentOptions.scales = {
        x: {
            beginAtZero: true,
            ticks: { 
                color: 'inherit',
                callback: function(value) {
                    return formatShortCurrency(value);
                }
            },
            grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
            ticks: { color: 'inherit' },
            grid: { display: false }
        }
    };
    paymentOptions.plugins = {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: function(context) {
                    return 'Total: ' + formatShortCurrency(context.raw);
                }
            }
        }
    };

    chartPaymentInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Penjualan',
                data: data,
                backgroundColor: 'rgba(219, 39, 119, 0.8)',
                borderColor: 'rgba(219, 39, 119, 1)',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(219, 39, 119, 1)'
            }]
        },
        options: paymentOptions
    });
}

function updateCompareYearChart() {
    const selectedYear = document.getElementById('yearFilter').value;
    const ctx = document.getElementById('chartCompareYear').getContext('2d');
    if (chartCompareYearInstance) chartCompareYearInstance.destroy();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    let yearsToPlot = [];
    if (selectedYear === 'ALL') {
        yearsToPlot = [...new Set(rawData.map(d => d.Year))].filter(Boolean).sort((a,b)=>a-b);
    } else {
        yearsToPlot = [Number(selectedYear)];
    }

    const datasets = [];
    const colorPalette = [
        'rgba(59, 130, 246, 1)',   // Blue
        'rgba(232, 62, 140, 1)',   // Pink
        'rgba(16, 185, 129, 1)',   // Green
        'rgba(245, 158, 11, 1)'    // Yellow
    ];

    yearsToPlot.forEach((year, index) => {
        const monthlySales = Array(12).fill(0);
        rawData.forEach(d => {
            if (Number(d.Year) === year && d.Month != null) {
                let mIdx = -1;
                const engIdx = englishMonths.indexOf(d.Month);
                if (engIdx !== -1) {
                    mIdx = engIdx;
                } else if (Number.isInteger(Number(d.Month)) && d.Month >= 1 && d.Month <= 12) {
                    mIdx = d.Month - 1;
                }
                
                if (mIdx !== -1) {
                    monthlySales[mIdx] += (Number(d.Total) || 0);
                }
            }
        });

        const color = colorPalette[index % colorPalette.length];
        
        datasets.push({
            label: String(year),
            data: monthlySales,
            backgroundColor: color.replace('1)', '0.15)'),
            borderColor: color,
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        });
    });

    const compareYearOptions = JSON.parse(JSON.stringify(chartOptions));
    compareYearOptions.plugins.legend = { display: true, position: 'top', labels: { color: 'inherit' } };
    compareYearOptions.scales.x.ticks.autoSkip = false;
    compareYearOptions.scales.y.ticks.callback = function(value) { return formatShortCurrency(value); };
    compareYearOptions.plugins.tooltip.callbacks.label = function(context) { return 'Penjualan: ' + formatShortCurrency(context.raw); };
    
    chartCompareYearInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: datasets
        },
        options: compareYearOptions
    });
}

function updateCompareDailyChart() {
    const selectedYear = document.getElementById('yearFilter').value;
    const m1 = document.getElementById('compareMonth1').value;
    const m2 = document.getElementById('compareMonth2').value;

    if (!m1 || !m2) return;

    const ctx = document.getElementById('chartCompareDaily').getContext('2d');
    if (chartCompareDailyInstance) chartCompareDailyInstance.destroy();

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const days = Array.from({length: 31}, (_, i) => String(i + 1));
    const salesM1 = Array(31).fill(0);
    const salesM2 = Array(31).fill(0);

    rawData.forEach(d => {
        if (selectedYear !== 'ALL' && String(d.Year) !== String(selectedYear)) return;
        
        if (d.Day != null && d.Day >= 1 && d.Day <= 31) {
            const dayIdx = d.Day - 1;
            if (String(d.Month) === String(m1)) {
                salesM1[dayIdx] += (Number(d.Total) || 0);
            }
            if (String(d.Month) === String(m2)) {
                salesM2[dayIdx] += (Number(d.Total) || 0);
            }
        }
    });

    const getDisplayName = (mStr) => {
        const idx = englishMonths.indexOf(mStr);
        if (idx !== -1) return monthNames[idx];
        if (Number.isInteger(Number(mStr)) && mStr >= 1 && mStr <= 12) return monthNames[mStr - 1];
        return mStr;
    };

    const label1 = getDisplayName(m1);
    const label2 = getDisplayName(m2);

    const color1 = 'rgba(232, 62, 140, 1)'; // Pink
    const color2 = 'rgba(59, 130, 246, 1)'; // Blue

    const datasets = [];
    datasets.push({
        label: label1,
        data: salesM1,
        backgroundColor: color1.replace('1)', '0.15)'),
        borderColor: color1,
        borderWidth: 2,
        tension: 0.1,
        fill: true,
        pointBackgroundColor: color1,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5
    });
    
    if (m1 !== m2) {
        datasets.push({
            label: label2,
            data: salesM2,
            backgroundColor: color2.replace('1)', '0.15)'),
            borderColor: color2,
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointBackgroundColor: color2,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5
        });
    }

    const compareDailyOptions = JSON.parse(JSON.stringify(chartOptions));
    compareDailyOptions.plugins.legend = { display: true, position: 'top', labels: { color: 'inherit' } };
    compareDailyOptions.scales.y.ticks.callback = function(value) { return formatShortCurrency(value); };
    compareDailyOptions.plugins.tooltip.callbacks.label = function(context) { return 'Penjualan: ' + formatShortCurrency(context.raw); };

    chartCompareDailyInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: datasets
        },
        options: compareDailyOptions
    });
}
