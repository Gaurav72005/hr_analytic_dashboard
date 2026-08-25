// HR Analytics Light Theme Dashboard JavaScript Application

// Global Chart Instances Store
const chartInstances = {};

// Filter State Objects for Overview and Retention
const overviewFilterState = { dept: 'All', gender: 'All', overtime: 'All', role: 'All', hire_year: 'All' };
const retentionFilterState = { dept: 'All', reason_cat: 'All', attempted: 'All', action_taken: 'All', retained: 'All' };

// Single Click Global Filter State
let globalClickFilter = { column: null, value: null };

// ----------------------------------------------------
// CHART.JS V4 LIGHT THEME GLOBAL CONFIGURATION
// ----------------------------------------------------
if (window.Chart) {
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.color = '#475569';
    Chart.defaults.plugins.tooltip.backgroundColor = '#ffffff';
    Chart.defaults.plugins.tooltip.borderColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = '#0f172a';
    Chart.defaults.plugins.tooltip.bodyColor = '#2563eb';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.shadowOffsetX = 0;
}

// Light Theme Color Palette
const themeColors = {
    blue: '#2563eb',
    blueAlpha: 'rgba(37, 99, 235, 0.15)',
    purple: '#7c3aed',
    purpleAlpha: 'rgba(124, 58, 237, 0.15)',
    rose: '#e11d48',
    roseAlpha: 'rgba(225, 29, 72, 0.15)',
    emerald: '#059669',
    emeraldAlpha: 'rgba(5, 150, 105, 0.15)',
    amber: '#d97706',
    amberAlpha: 'rgba(217, 119, 6, 0.15)',
    sky: '#0284c7',
    palette: [
        '#2563eb', '#7c3aed', '#059669', '#e11d48', '#d97706',
        '#0284c7', '#db2777', '#4f46e5', '#0d9488', '#ea580c'
    ]
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    populateAllFilterDropdowns();
    loadOverviewData();
    loadRetentionData();
    initExplorerColumns();
});

// Populate Filter Options dynamically
async function populateAllFilterDropdowns() {
    try {
        const response = await fetch('/api/columns');
        const data = await response.json();
        const opts = data.options || {};

        const fillSelect = (id, list, placeholder) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = `<option value="All" selected>${placeholder}</option>`;
            (list || []).forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                el.appendChild(opt);
            });
        };

        fillSelect('ov-filter-dept', opts['Department'], 'All Departments');
        fillSelect('ov-filter-gender', opts['Gender'], 'All Genders');
        fillSelect('ov-filter-overtime', opts['OverTime'], 'All OverTime');
        fillSelect('ov-filter-role', opts['JobRole'], 'All Roles');
        fillSelect('ov-filter-hireyear', opts['HireYear'], 'All Hire Years');

        fillSelect('ret-filter-dept', opts['Department'], 'All Departments');
        fillSelect('ret-filter-reason', opts['Reason_Category'], 'All Reasons');
        fillSelect('ret-filter-attempt', opts['Retention_Attempted'], 'All Attempts');
        fillSelect('ret-filter-action', opts['Retention_Action_Taken'], 'All Actions');
        fillSelect('ret-filter-retained', opts['Retained'], 'All Outcomes');

    } catch (err) {
        console.error("Error populating filter options:", err);
    }
}

// Overview Filter Handlers
function onOverviewFilterChange() {
    overviewFilterState.dept = document.getElementById('ov-filter-dept').value;
    overviewFilterState.gender = document.getElementById('ov-filter-gender').value;
    overviewFilterState.overtime = document.getElementById('ov-filter-overtime').value;
    overviewFilterState.role = document.getElementById('ov-filter-role').value;
    overviewFilterState.hire_year = document.getElementById('ov-filter-hireyear').value;

    loadOverviewData();
}

function resetOverviewFilters() {
    ['ov-filter-dept', 'ov-filter-gender', 'ov-filter-overtime', 'ov-filter-role', 'ov-filter-hireyear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'All';
    });
    onOverviewFilterChange();
}

// Retention Filter Handlers
function onRetentionFilterChange() {
    retentionFilterState.dept = document.getElementById('ret-filter-dept').value;
    retentionFilterState.reason_cat = document.getElementById('ret-filter-reason').value;
    retentionFilterState.attempted = document.getElementById('ret-filter-attempt').value;
    retentionFilterState.action_taken = document.getElementById('ret-filter-action').value;
    retentionFilterState.retained = document.getElementById('ret-filter-retained').value;

    loadRetentionData();
}

function resetRetentionFilters() {
    ['ret-filter-dept', 'ret-filter-reason', 'ret-filter-attempt', 'ret-filter-action', 'ret-filter-retained'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'All';
    });
    onRetentionFilterChange();
}

// Chart Click Global Filter Handler
function setGlobalFilter(column, value) {
    if (globalClickFilter.column === column && globalClickFilter.value === value) {
        resetGlobalFilter();
        return;
    }

    globalClickFilter = { column: column, value: value };
    updateFilterUI();
    loadOverviewData();
    loadRetentionData();
}

function resetGlobalFilter() {
    globalClickFilter = { column: null, value: null };
    updateFilterUI();
    loadOverviewData();
    loadRetentionData();
}

function updateFilterUI() {
    const badge = document.getElementById('active-filter-badge');
    const text = document.getElementById('filter-text');
    
    if (globalClickFilter.column && globalClickFilter.value) {
        text.innerText = `${globalClickFilter.column} = "${globalClickFilter.value}"`;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Tab Switching Navigation
function switchTab(tabName) {
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabName}`);
    const targetBtn = document.getElementById(`btn-${tabName}`);

    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    const titleMap = {
        'overview': 'Overview Dashboard',
        'retention': 'Retention & Action Analysis',
        'explorer': 'Dynamic Chart Explorer',
        'prediction': 'Prediction Workspace'
    };
    document.getElementById('current-view-title').innerText = titleMap[tabName] || 'HR Analytics';

    if (tabName === 'explorer' && !chartInstances['customChart']) {
        generateCustomChart();
    }
}

// ----------------------------------------------------
// 1. OVERVIEW VIEW DATA & CHARTS
// ----------------------------------------------------
async function loadOverviewData() {
    try {
        const params = new URLSearchParams();

        if (overviewFilterState.dept !== 'All') params.append('dept', overviewFilterState.dept);
        if (overviewFilterState.gender !== 'All') params.append('gender', overviewFilterState.gender);
        if (overviewFilterState.overtime !== 'All') params.append('overtime', overviewFilterState.overtime);
        if (overviewFilterState.role !== 'All') params.append('role', overviewFilterState.role);
        if (overviewFilterState.hire_year !== 'All') params.append('hire_year', overviewFilterState.hire_year);

        if (globalClickFilter.column && globalClickFilter.value) {
            params.append('filter_col', globalClickFilter.column);
            params.append('filter_val', globalClickFilter.value);
        }

        const response = await fetch(`/api/overview?${params.toString()}`);
        const data = await response.json();

        // Update KPIs
        document.getElementById('kpi-total-emp').innerText = data.kpis.total_employees.toLocaleString();
        document.getElementById('kpi-attrition-rate').innerText = `${data.kpis.attrition_rate}%`;
        document.getElementById('kpi-resigned-count').innerText = `${data.kpis.total_resigned.toLocaleString()} Total Resigned`;
        document.getElementById('kpi-avg-income').innerText = `$${Math.round(data.kpis.avg_income).toLocaleString()}`;
        document.getElementById('kpi-avg-satisfaction').innerText = `${data.kpis.avg_satisfaction} / 4`;
        document.getElementById('kpi-avg-worklife').innerText = `${data.kpis.avg_work_life} / 4`;

        // Render Charts
        renderHireYearChart(data.hire_years || []);
        renderDeptAttritionChart(data.departments || []);
        renderDeptIncomeChart(data.departments || []);
        renderGenderAttritionChart(data.genders || []);
        renderOvertimeAttritionChart(data.overtime || []);
        renderRolesAttritionChart(data.roles || []);
    } catch (err) {
        console.error("Error loading overview data:", err);
    }
}

function renderHireYearChart(hireYears) {
    const ctx = document.getElementById('chart-hireyear-attrition').getContext('2d');
    if (chartInstances['hireYearAttrition']) chartInstances['hireYearAttrition'].destroy();

    const labels = hireYears.map(h => h.year);
    const resignationCounts = hireYears.map(h => h.resigned);
    const attritionRates = hireYears.map(h => h.attrition_rate);

    chartInstances['hireYearAttrition'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Resigned Count',
                    data: resignationCounts,
                    borderColor: themeColors.rose,
                    backgroundColor: themeColors.roseAlpha,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Attrition Rate (%)',
                    data: attritionRates,
                    borderColor: themeColors.amber,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointStyle: 'circle',
                    pointRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#475569', font: { family: 'Inter' } } }
            },
            scales: {
                x: { grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#475569' } },
                y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#e11d48' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#d97706' } }
            },
            onClick: (evt, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    setGlobalFilter('HireYear', labels[idx]);
                }
            }
        }
    });
}

function renderDeptAttritionChart(departments) {
    const ctx = document.getElementById('chart-dept-attrition').getContext('2d');
    if (chartInstances['deptAttrition']) chartInstances['deptAttrition'].destroy();

    const labels = departments.map(d => d.department);
    const values = departments.map(d => d.attrition_rate);

    chartInstances['deptAttrition'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attrition Rate (%)',
                data: values,
                backgroundColor: themeColors.roseAlpha,
                borderColor: themeColors.rose,
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: getFilterableChartOptions('Department', 'Attrition Rate (%)', (label) => {
            setGlobalFilter('Department', label);
        })
    });
}

function renderDeptIncomeChart(departments) {
    const ctx = document.getElementById('chart-dept-income').getContext('2d');
    if (chartInstances['deptIncome']) chartInstances['deptIncome'].destroy();

    const labels = departments.map(d => d.department);
    const values = departments.map(d => d.avg_income);

    chartInstances['deptIncome'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Monthly Income ($)',
                data: values,
                backgroundColor: themeColors.blueAlpha,
                borderColor: themeColors.blue,
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: getFilterableChartOptions('Department', 'Avg Monthly Income ($)', (label) => {
            setGlobalFilter('Department', label);
        })
    });
}

function renderGenderAttritionChart(genders) {
    const ctx = document.getElementById('chart-gender-attrition').getContext('2d');
    if (chartInstances['genderAttrition']) chartInstances['genderAttrition'].destroy();

    const labels = genders.map(g => g.gender);
    const values = genders.map(g => g.resigned);

    chartInstances['genderAttrition'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [themeColors.blue, themeColors.purple, themeColors.emerald],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#475569' } }
            },
            onClick: (evt, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    setGlobalFilter('Gender', labels[idx]);
                }
            }
        }
    });
}

function renderOvertimeAttritionChart(overtimeData) {
    const ctx = document.getElementById('chart-overtime-attrition').getContext('2d');
    if (chartInstances['overtimeAttrition']) chartInstances['overtimeAttrition'].destroy();

    const labels = overtimeData.map(o => `OverTime: ${o.overtime}`);
    const values = overtimeData.map(o => o.attrition_rate);

    chartInstances['overtimeAttrition'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attrition Rate (%)',
                data: values,
                backgroundColor: [themeColors.roseAlpha, themeColors.emeraldAlpha],
                borderColor: [themeColors.rose, themeColors.emerald],
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: getFilterableChartOptions('', 'Attrition Rate (%)', (label) => {
            const cleanVal = label.replace('OverTime: ', '').trim();
            setGlobalFilter('OverTime', cleanVal);
        })
    });
}

function renderRolesAttritionChart(roles) {
    const ctx = document.getElementById('chart-roles-attrition').getContext('2d');
    if (chartInstances['rolesAttrition']) chartInstances['rolesAttrition'].destroy();

    const labels = roles.map(r => r.role);
    const values = roles.map(r => r.attrition_rate);

    chartInstances['rolesAttrition'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attrition Rate (%)',
                data: values,
                backgroundColor: themeColors.purpleAlpha,
                borderColor: themeColors.purple,
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#475569' } },
                y: { grid: { display: false }, ticks: { color: '#475569' } }
            },
            onClick: (evt, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    setGlobalFilter('JobRole', labels[idx]);
                }
            }
        }
    });
}

// ----------------------------------------------------
// 2. RETENTION & ACTION VIEW DATA & CHARTS
// ----------------------------------------------------
async function loadRetentionData() {
    try {
        const params = new URLSearchParams();

        if (retentionFilterState.dept !== 'All') params.append('dept', retentionFilterState.dept);
        if (retentionFilterState.reason_cat !== 'All') params.append('reason_cat', retentionFilterState.reason_cat);
        if (retentionFilterState.attempted !== 'All') params.append('attempted', retentionFilterState.attempted);
        if (retentionFilterState.action_taken !== 'All') params.append('action_taken', retentionFilterState.action_taken);
        if (retentionFilterState.retained !== 'All') params.append('retained', retentionFilterState.retained);

        if (globalClickFilter.column && globalClickFilter.value) {
            params.append('filter_col', globalClickFilter.column);
            params.append('filter_val', globalClickFilter.value);
        }

        const response = await fetch(`/api/retention?${params.toString()}`);
        const data = await response.json();

        // Update Retention KPIs
        document.getElementById('ret-kpi-total').innerText = data.kpis.total_resigned.toLocaleString();
        document.getElementById('ret-kpi-attempt-rate').innerText = `${data.kpis.attempt_rate}%`;
        document.getElementById('ret-kpi-attempt-count').innerText = `${data.kpis.attempted_yes} Retention Attempts`;
        document.getElementById('ret-kpi-success-rate').innerText = `${data.kpis.retention_success_rate}%`;
        document.getElementById('ret-kpi-retained-count').innerText = `${data.kpis.retained_yes} Successfully Retained`;

        renderReasonCategoriesChart(data.reason_categories || []);
        renderActionEffectivenessChart(data.action_effectiveness || []);
        renderExitTable(data.exit_records || []);
    } catch (err) {
        console.error("Error loading retention data:", err);
    }
}

function renderReasonCategoriesChart(categories) {
    const ctx = document.getElementById('chart-reason-categories').getContext('2d');
    if (chartInstances['reasonCategories']) chartInstances['reasonCategories'].destroy();

    const labels = categories.map(c => c.category);
    const values = categories.map(c => c.count);

    chartInstances['reasonCategories'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Exits Recorded',
                data: values,
                backgroundColor: themeColors.palette.slice(0, labels.length).map(c => c + '30'),
                borderColor: themeColors.palette.slice(0, labels.length),
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: getFilterableChartOptions('Reason Category', 'Count of Exits', (label) => {
            setGlobalFilter('Reason_Category', label);
        })
    });
}

function renderActionEffectivenessChart(actions) {
    const ctx = document.getElementById('chart-action-effectiveness').getContext('2d');
    if (chartInstances['actionEffectiveness']) chartInstances['actionEffectiveness'].destroy();

    const labels = actions.map(a => a.action);
    const values = actions.map(a => a.success_rate);

    chartInstances['actionEffectiveness'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Retention Success Rate (%)',
                data: values,
                backgroundColor: themeColors.emeraldAlpha,
                borderColor: themeColors.emerald,
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: getFilterableChartOptions('Retention Action', 'Success Rate (%)', (label) => {
            setGlobalFilter('Retention_Action_Taken', label);
        })
    });
}

function renderExitTable(exitRecords) {
    const tbody = document.getElementById('exit-table-body');
    tbody.innerHTML = '';

    exitRecords.forEach(rec => {
        const tr = document.createElement('tr');

        const attemptBadge = rec.retention_attempted === 'Yes' 
            ? `<span class="badge badge-yes">Yes</span>` 
            : `<span class="badge badge-no">No</span>`;

        const retainedBadge = rec.retained === 'Yes' 
            ? `<span class="badge badge-no">Retained</span>` 
            : `<span class="badge badge-yes">Left</span>`;

        tr.innerHTML = `
            <td><strong>${rec.employee_id}</strong></td>
            <td>${rec.department}</td>
            <td>${rec.job_role}</td>
            <td>$${rec.monthly_income.toLocaleString()}</td>
            <td><span class="badge badge-action">${rec.reason_category}</span></td>
            <td style="max-width: 260px; font-size: 0.8rem; color: #475569;">${rec.hr_recorded_reason}</td>
            <td>${attemptBadge}</td>
            <td>${rec.action_taken || 'N/A'}</td>
            <td>${retainedBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// 3. DYNAMIC EXPLORER VIEW (CHANGABLE BUTTON)
// ----------------------------------------------------
async function initExplorerColumns() {
    try {
        const response = await fetch('/api/columns');
        const data = await response.json();

        const xSelect = document.getElementById('select-x-axis');
        xSelect.innerHTML = '';

        const xOptions = [
            'Department', 'JobRole', 'Gender', 'MaritalStatus', 
            'EducationField', 'BusinessTravel', 'OverTime', 'Education',
            'JobSatisfaction', 'WorkLifeBalance', 'EnvironmentSatisfaction', 'PerformanceRating', 'HireYear'
        ];

        xOptions.forEach(col => {
            if (data.all.includes(col)) {
                const opt = document.createElement('option');
                opt.value = col;
                opt.innerText = col;
                if (col === 'Department') opt.selected = true;
                xSelect.appendChild(opt);
            }
        });
    } catch (err) {
        console.error("Error initializing columns:", err);
    }
}

function onChartTypeChange() {
    const yVal = document.getElementById('select-y-axis').value;
    const aggGroup = document.getElementById('group-agg-func');

    if (yVal === '__COUNT__' || yVal === '__ATTRITION_RATE__') {
        aggGroup.style.opacity = '0.5';
        document.getElementById('select-agg-func').disabled = true;
    } else {
        aggGroup.style.opacity = '1';
        document.getElementById('select-agg-func').disabled = false;
    }
}

document.getElementById('select-y-axis')?.addEventListener('change', onChartTypeChange);

async function generateCustomChart() {
    const chartType = document.getElementById('select-chart-type').value;
    const xAxis = document.getElementById('select-x-axis').value;
    const yAxis = document.getElementById('select-y-axis').value;
    const aggFunc = document.getElementById('select-agg-func').value;
    const filterDept = document.getElementById('filter-dept').value;
    const filterAttrition = document.getElementById('filter-attrition').value;

    const payload = {
        chart_type: chartType,
        x_axis: xAxis,
        y_axis: yAxis,
        agg_func: aggFunc,
        filter_dept: filterDept,
        filter_attrition: filterAttrition
    };

    if (globalClickFilter.column && globalClickFilter.value) {
        payload.filter_col = globalClickFilter.column;
        payload.filter_val = globalClickFilter.value;
    }

    try {
        const response = await fetch('/api/custom-chart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return;
        }

        const yTitle = yAxis === '__COUNT__' ? 'Employee Count' : (yAxis === '__ATTRITION_RATE__' ? 'Attrition Rate (%)' : `${aggFunc.toUpperCase()} of ${yAxis}`);
        const chartTitleName = `${yTitle} by ${xAxis}`;
        document.getElementById('custom-chart-title').innerText = chartTitleName;
        document.getElementById('custom-chart-subtitle').innerText = chartTitleName;

        renderCustomCanvasChart(data);

        document.getElementById('custom-stat-cat').innerText = data.total_categories;
        document.getElementById('custom-stat-avg').innerText = data.avg_value.toLocaleString();
        document.getElementById('custom-stat-max').innerText = data.max_value.toLocaleString();
        document.getElementById('custom-stat-min').innerText = data.min_value.toLocaleString();

    } catch (err) {
        console.error("Error generating custom chart:", err);
    }
}

function renderCustomCanvasChart(chartData) {
    const ctx = document.getElementById('canvas-custom-chart').getContext('2d');
    if (chartInstances['customChart']) chartInstances['customChart'].destroy();

    const chartType = chartData.chart_type;
    const isPieOrDoughnut = ['pie', 'doughnut', 'polarArea'].includes(chartType);
    const isHorizontal = chartType === 'horizontalBar';
    const actualChartType = isHorizontal ? 'bar' : chartType;

    const bgColors = isPieOrDoughnut 
        ? themeColors.palette.slice(0, chartData.labels.length)
        : themeColors.blueAlpha;
    
    const borderColors = isPieOrDoughnut 
        ? '#ffffff'
        : themeColors.blue;

    const config = {
        type: actualChartType,
        data: {
            labels: chartData.labels,
            datasets: [{
                label: chartData.y_axis === '__COUNT__' ? 'Employee Count' : chartData.y_axis,
                data: chartData.values,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: isPieOrDoughnut ? 2 : 1.5,
                borderRadius: isPieOrDoughnut ? 0 : 4,
                fill: chartType === 'line' ? true : false
            }]
        },
        options: {
            indexAxis: isHorizontal ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: isPieOrDoughnut || chartType === 'radar',
                    position: 'bottom',
                    labels: { color: '#475569' }
                }
            },
            scales: isPieOrDoughnut || chartType === 'radar' ? {} : {
                x: { grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#475569' } },
                y: { grid: { color: 'rgba(0, 0, 0, 0.04)' }, ticks: { color: '#475569' } }
            },
            onClick: (evt, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    const clickedLabel = chartData.labels[idx];
                    setGlobalFilter(chartData.x_axis, clickedLabel);
                }
            }
        }
    };

    chartInstances['customChart'] = new Chart(ctx, config);
}

// Chart Options Helper with Click Cross-Filtering Handler
function getFilterableChartOptions(xTitle, yTitle, onClickHandler) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { color: '#475569' },
                title: xTitle ? { display: true, text: xTitle, color: '#64748b' } : {}
            },
            y: {
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { color: '#475569' },
                title: yTitle ? { display: true, text: yTitle, color: '#64748b' } : {}
            }
        },
        onClick: (evt, activeElements, chart) => {
            if (activeElements.length > 0) {
                const idx = activeElements[0].index;
                const clickedLabel = chart.data.labels[idx];
                if (onClickHandler) onClickHandler(clickedLabel);
            }
        }
    };
}

// ==========================================
// AI PREDICTION MODULE LOGIC
// ==========================================
let samplePresets = [];

async function fetchPredictionSamples() {
    try {
        const res = await fetch('/api/predict-samples');
        if (res.ok) {
            samplePresets = await res.json();
        }
    } catch (e) {
        console.error('Error fetching sample presets:', e);
    }
}

function loadSamplePreset(categoryName) {
    const sample = samplePresets.find(s => s.category.includes(categoryName) || categoryName.includes(s.category));
    const textInput = document.getElementById('feedbackText');
    if (sample && textInput) {
        textInput.value = sample.text;
    } else if (textInput) {
        if (categoryName.includes('Compensation')) {
            textInput.value = 'Employee felt underpaid compared to market standards and requested a salary review after taking on additional responsibilities.';
        } else if (categoryName.includes('Work-Life')) {
            textInput.value = 'Reported severe burnout due to high workload, mandatory weekend shifts, and continuous long working hours over the past 6 months.';
        } else if (categoryName.includes('Manager')) {
            textInput.value = 'Cited lack of support, poor communication, and recognition issues with the direct team manager.';
        } else if (categoryName.includes('Career')) {
            textInput.value = 'Felt there were no growth opportunities or title promotions available within the current project team.';
        }
    }
}

function clearPredictionInput() {
    const textInput = document.getElementById('feedbackText');
    if (textInput) textInput.value = '';
    document.getElementById('predEmptyState').style.display = 'block';
    document.getElementById('predLoader').style.display = 'none';
    document.getElementById('predResultsContent').style.display = 'none';
}

async function handlePredictionSubmit(e) {
    e.preventDefault();
    const textInput = document.getElementById('feedbackText').value.trim();
    if (!textInput) return;

    const emptyState = document.getElementById('predEmptyState');
    const loader = document.getElementById('predLoader');
    const resultsContent = document.getElementById('predResultsContent');
    const predictBtn = document.getElementById('predictBtn');

    emptyState.style.display = 'none';
    resultsContent.style.display = 'none';
    loader.style.display = 'block';
    predictBtn.disabled = true;

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textInput })
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            alert(data.error || 'Prediction failed.');
            emptyState.style.display = 'block';
        } else {
            renderPredictionData(data);
        }
    } catch (err) {
        console.error('Prediction request error:', err);
        alert('Error communicating with prediction server.');
        emptyState.style.display = 'block';
    } finally {
        loader.style.display = 'none';
        predictBtn.disabled = false;
    }
}

function renderPredictionData(data) {
    const resultsContent = document.getElementById('predResultsContent');
    const actionTitle = document.getElementById('predActionTitle');
    const urgencyBadge = document.getElementById('predUrgencyBadge');
    const confidenceVal = document.getElementById('predConfidenceVal');
    const confidenceBar = document.getElementById('predConfidenceBar');
    const strategyHeading = document.getElementById('predStrategyHeading');
    const strategyBody = document.getElementById('predStrategyBody');
    const probabilityList = document.getElementById('predProbabilityList');

    const prediction = data.prediction;
    const strategy = data.strategy_info || {};
    const confidence = data.confidence || 0;

    actionTitle.innerText = prediction;
    urgencyBadge.innerText = `Urgency Level: ${strategy.urgency || 'High'}`;
    
    if (strategy.urgency === 'High') {
        urgencyBadge.style.color = '#e11d48';
    } else if (strategy.urgency === 'Medium') {
        urgencyBadge.style.color = '#d97706';
    } else {
        urgencyBadge.style.color = '#059669';
    }

    confidenceVal.innerText = `${confidence}%`;
    confidenceBar.style.width = `${confidence}%`;

    strategyHeading.innerText = strategy.title || 'Recommended Strategy';
    strategyBody.innerText = strategy.strategy || 'No detailed strategy available.';

    if (probabilityList && data.probabilities && Array.isArray(data.probabilities)) {
        probabilityList.innerHTML = data.probabilities.map(item => `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-primary);">
                    <span style="font-weight: ${item.action === prediction ? '700' : '500'}">${item.action}</span>
                    <span style="font-weight: 600; color: ${item.action === prediction ? '#a855f7' : 'var(--text-secondary)'}">${item.probability}%</span>
                </div>
                <div style="height: 6px; width: 100%; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${item.probability}%; background: ${item.action === prediction ? 'linear-gradient(90deg, #6366f1, #a855f7)' : '#cbd5e1'}; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `).join('');
    }

    resultsContent.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPredictionSamples();
});
