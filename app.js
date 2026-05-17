// ==========================================
// 1. STORAGE DIAGNOSTICS & INITIALIZATION
// ==========================================
let db = [];

// Register Service Worker for Offline PWA Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Offline Mode Active'))
            .catch(err => console.log('SW Setup Failed', err));
    });
}

// Check if the browser is allowing us to save data
function isStorageEnabled() {
    try {
        localStorage.setItem('test_key', 'test_value');
        localStorage.removeItem('test_key');
        return true;
    } catch (e) {
        return false;
    }
}

// Initialize Database safely
if (!isStorageEnabled()) {
    alert("⚠️ Local Storage is disabled! Your browser is preventing the app from saving data. If you are in Incognito Mode, please switch to a normal window.");
} else {
    try {
        const legacyDb = localStorage.getItem('pg_db');
        if (legacyDb && !localStorage.getItem('ow_db')) {
            db = JSON.parse(legacyDb);
            localStorage.setItem('ow_db', JSON.stringify(db));
        } else {
            const stored = localStorage.getItem('ow_db');
            if (stored) db = JSON.parse(stored);
        }
    } catch (error) {
        console.error("Storage Error, starting fresh:", error);
        db = [];
    }
}

let chartRef = null;

// ==========================================
// 2. GLOBAL UTILITIES
// ==========================================
function initTheme() {
    const t = localStorage.getItem('ow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeBtn').innerHTML = t === 'light' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    if(isStorageEnabled()) localStorage.setItem('ow_theme', next);
    initTheme();
    render(); 
}

function editUserName() {
    const currentName = localStorage.getItem('ow_username') || "User";
    const newName = prompt("Enter your display name:", currentName);
    if (newName && newName.trim() !== "") {
        if(isStorageEnabled()) localStorage.setItem('ow_username', newName.trim());
        updateUserName();
    }
}

function updateUserName() {
    const userName = localStorage.getItem('ow_username') || "User";
    document.getElementById('userDisplay').textContent = `Hi, ${userName}`;
    const profileName = document.getElementById('profileName');
    if(profileName) profileName.textContent = userName;
}

function getSafeLocalDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ==========================================
// 3. SAVINGS GOAL MANAGEMENT
// ==========================================
function setGoal() {
    let currentGoal = null;
    try { currentGoal = JSON.parse(localStorage.getItem('ow_goal')); } catch(e){}
    
    const title = prompt("Enter goal title (e.g., MacBook, Emergency Fund):", currentGoal ? currentGoal.title : "");
    if (!title || title.trim() === "") return; // Cancelled or empty
    
    const targetStr = prompt("Enter target amount (e.g., 150000):", currentGoal ? currentGoal.target : "");
    const target = Number(targetStr);
    
    if (!target || target <= 0) {
        alert("Invalid amount. Please enter a valid number.");
        return;
    }
    
    const goal = { title: title.trim(), target: target };
    if (isStorageEnabled()) localStorage.setItem('ow_goal', JSON.stringify(goal));
    render();
}

function deleteGoal() {
    if(confirm("Are you sure you want to delete your current goal?")) {
        if (isStorageEnabled()) localStorage.removeItem('ow_goal');
        render();
    }
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    updateUserName();

    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
    
    const localDateStr = getSafeLocalDateString();
    document.getElementById('startDate').value = localDateStr;
    document.getElementById('endDate').value = localDateStr;
    
    // Form Submission Logic
    const form = document.getElementById('txForm');
    if(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); 
            
            if (!isStorageEnabled()) {
                alert("Cannot save! Please ensure you are not in Incognito Mode and cookies/storage are allowed.");
                return;
            }

            const rawDate = document.getElementById('txDate').value;
            let parsedDate = new Date();
            
            if (rawDate) {
                const parts = rawDate.split('-');
                if (parts.length === 3) {
                    parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                }
            }
            
            const newTransaction = {
                id: Date.now(),
                timestamp: parsedDate.getTime(),
                date: parsedDate.toLocaleDateString('en-US', {day:'numeric', month:'short', year: 'numeric'}),
                type: document.getElementById('txType').value,
                method: document.getElementById('txMethod').value,
                amt: document.getElementById('txAmt').value,
                desc: document.getElementById('txDesc').value,
                cat: document.getElementById('txCat').value
            };

            db.push(newTransaction);
            
            try {
                localStorage.setItem('ow_db', JSON.stringify(db));
            } catch (err) {
                alert("Error saving data! Your browser storage might be full or blocked.");
                console.error(err);
            }
            
            e.target.reset();
            setTab('expense'); 
            closeModal(); 
            render();
        });
    }

    render();
});

// ==========================================
// 5. RENDERING LOGIC
// ==========================================
const fmt = (n) => '₹' + n.toLocaleString('en-IN');

function render() {
    let inc=0, exp=0, saved=0, cash=0, bank=0;

    db.sort((a, b) => (a.timestamp || a.id) - (b.timestamp || b.id));

    db.forEach(tx => {
        let v = Number(tx.amt);
        if(tx.type === 'income') {
            inc += v;
            if(tx.method === 'bank') bank += v; else cash += v;
        } else if(tx.type === 'expense') {
            exp += v;
            if(tx.method === 'bank') bank -= v; else cash -= v;
        } else if(tx.type === 'saving') {
            saved += v;
            if(tx.method === 'bank') bank -= v; else cash -= v;
        } else if(tx.type === 'transfer') {
            if(tx.method === 'cash') { cash -= v; bank += v; } 
            else { bank -= v; cash += v; }
        }
    });

    document.getElementById('disp-net').textContent = fmt(cash + bank + saved);
    document.getElementById('disp-inc').textContent = fmt(inc);
    document.getElementById('disp-exp').textContent = fmt(exp);
    document.getElementById('disp-sav').textContent = fmt(saved);
    document.getElementById('disp-cash').textContent = fmt(cash);
    document.getElementById('disp-bank').textContent = fmt(bank);

    const recList = document.getElementById('recentList');
    const fullList = document.getElementById('fullList');
    const searchEl = document.getElementById('searchInp');
    const term = searchEl ? searchEl.value.toLowerCase() : '';
    
    if(recList) recList.innerHTML = ''; 
    if(fullList) fullList.innerHTML = '';
    
    [...db].reverse().forEach((tx, i) => {
        if(term && !tx.desc.toLowerCase().includes(term)) return;

        let icon = 'bi-stars', col = 't-exp', sign = '-';
        
        if(tx.type === 'income') { icon='bi-arrow-down-left'; col='t-inc'; sign='+'; }
        else if(tx.type === 'saving') { icon='bi-piggy-bank'; col='t-sav'; sign=''; }
        else if(tx.type === 'transfer') { icon='bi-arrow-left-right'; col='t-sav'; sign=''; } 
        
        const cats = {'Food':'bi-cup-hot','Transport':'bi-car-front','Shopping':'bi-bag','Bills':'bi-receipt','Health':'bi-heart-pulse'};
        if(cats[tx.cat]) icon = cats[tx.cat];

        const html = `
        <div class="tx-item" onclick="delTx(${tx.id})">
            <div class="tx-l">
                <div class="tx-ico"><i class="bi ${icon}"></i></div>
                <div class="tx-meta">
                    <h3>${tx.desc}</h3>
                    <p>${tx.date} • ${tx.method}</p>
                </div>
            </div>
            <div class="tx-amt ${col}">${sign}₹${Number(tx.amt).toLocaleString('en-IN')}</div>
        </div>`;
        
        if(fullList) fullList.innerHTML += html;
        if(recList && i < 4) recList.innerHTML += html;
    });

    renderChart(inc, exp, saved);
    renderAnalysis();

    // ==========================================
    // DYNAMIC GOAL RENDERING
    // ==========================================
    const goalBtn = document.getElementById('goalActionBtn');
    const goalContent = document.getElementById('goalCardContent');
    
    if (goalBtn && goalContent) {
        let currentGoal = null;
        try { currentGoal = JSON.parse(localStorage.getItem('ow_goal')); } catch(e){}

        if (currentGoal) {
            goalBtn.textContent = "Edit Goal";
            goalBtn.setAttribute("onclick", "setGoal()");
            
            let goalPercentage = (saved / currentGoal.target) * 100;
            if (goalPercentage > 100) goalPercentage = 100;
            if (goalPercentage < 0) goalPercentage = 0;

            goalContent.innerHTML = `
                <div class="goal-header">
                    <div>
                        <h4 style="margin: 0; font-size: 1.1rem;">${currentGoal.title}</h4>
                        <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-sec);">Target: ${fmt(currentGoal.target)}</p>
                    </div>
                    <i class="bi bi-trash3" style="font-size: 1.2rem; cursor: pointer; color: var(--danger); padding: 5px; transition: 0.2s;" onclick="deleteGoal()" title="Delete Goal"></i>
                </div>
                <div class="progress-wrap">
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${goalPercentage}%;"></div>
                    </div>
                    <div class="progress-text">
                        <span>${fmt(saved)} saved</span>
                        <span>${goalPercentage.toFixed(1)}%</span>
                    </div>
                </div>
            `;
        } else {
            goalBtn.textContent = "Add Goal";
            goalBtn.setAttribute("onclick", "setGoal()");
            goalContent.innerHTML = `
                <div style="text-align: center; color: var(--text-sec); padding: 10px 0;">
                    <i class="bi bi-bullseye" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 12px; display: inline-block;"></i>
                    <p style="margin: 0 0 16px; font-weight: 500;">No active goal set.</p>
                    <button class="btn-submit" style="padding: 10px 24px; font-size: 0.95rem; width: auto; border-radius: 20px; display: inline-block;" onclick="setGoal()">Create a Goal</button>
                </div>
            `;
        }
    }
}

function renderChart(i, e, s) {
    if (typeof Chart === 'undefined') return; 

    const canvas = document.getElementById('mainChart');
    if(!canvas) return;

    const ctx = canvas.getContext('2d');
    if(chartRef) chartRef.destroy();
    
    Chart.defaults.color = document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b';
    Chart.defaults.font.family = 'Outfit';
    
    let remaining = Math.max(0, i - e - s);
    
    chartRef = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Expenses', 'Savings', 'Remaining'],
            datasets: [{
                data: [e, s, remaining],
                backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '78%',
            plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' } } }
        }
    });
}

function renderAnalysis() {
    const el = document.getElementById('catBars');
    const insightText = document.getElementById('aiInsightText');
    if(!el) return;
    el.innerHTML = '';
    
    let map = {}, totExp = 0, totInc = 0;
    
    db.forEach(t => {
        const amt = Number(t.amt);
        if (t.type === 'expense') {
            map[t.cat] = (map[t.cat] || 0) + amt;
            totExp += amt;
        }
        if (t.type === 'income') {
            totInc += amt;
        }
    });
    
    if(totExp === 0) { 
        el.innerHTML = '<div style="text-align:center; color:var(--text-sec); padding:10px;">No expenses to analyze</div>'; 
        if(insightText) insightText.innerHTML = "Log some expenses to get smart AI financial insights.";
        return; 
    }

    const sortedCats = Object.entries(map).sort((a,b)=>b[1]-a[1]);
    sortedCats.forEach(([k, v]) => {
        let p = ((v/totExp)*100).toFixed(0);
        el.innerHTML += `
        <div class="bar-wrap">
            <div class="bar-top"><span>${k}</span><span>${p}%</span></div>
            <div class="bar-track"><div class="bar-val" style="width:${p}%"></div></div>
        </div>`;
    });

    if(insightText) {
        const topCat = sortedCats[0][0];
        const topCatPct = ((sortedCats[0][1] / totExp) * 100).toFixed(0);
        const expToIncRatio = totInc > 0 ? ((totExp / totInc) * 100).toFixed(0) : 100;

        let insightMessage = `Your highest expense category is <strong>${topCat}</strong>, making up ${topCatPct}% of your total spending. `;
        
        if (expToIncRatio > 80 && totInc > 0) {
            insightMessage += `<br><br><span style="color: var(--danger);"><i class="bi bi-exclamation-triangle-fill"></i> Warning:</span> You have spent ${expToIncRatio}% of your income. Consider pausing non-essential purchases.`;
        } else if (totInc > 0 && expToIncRatio < 40) {
            insightMessage += `<br><br><span style="color: var(--success);"><i class="bi bi-check-circle-fill"></i> Great job!</span> You are keeping expenses well below your income. Consider moving excess cash to savings.`;
        }

        insightText.innerHTML = insightMessage;
    }
}

// ==========================================
// 6. UI INTERACTIONS
// ==========================================
function openModal() { 
    const modal = document.getElementById('addModal');
    if(!modal) return;
    modal.classList.add('open'); 
    document.getElementById('txDate').value = getSafeLocalDateString();
    setTimeout(() => {
        const amtInput = document.getElementById('txAmt');
        if(amtInput) amtInput.focus();
    }, 100); 
}

function closeModal(e) { 
    const modal = document.getElementById('addModal');
    if(!modal) return;
    if(!e || e.target === modal) modal.classList.remove('open'); 
}

function setTab(t) {
    document.getElementById('txType').value = t;
    document.querySelectorAll('.ts-btn').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector(`.ts-btn[data-val="${t}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    const cat = document.getElementById('txCat');
    const desc = document.getElementById('txDesc');

    if(t === 'transfer') {
        cat.innerHTML = '<option value="Transfer">Internal Transfer</option>';
        desc.value = "Account Transfer";
    } else {
        desc.value = "";
        if(t === 'saving') cat.innerHTML = '<option>Goal Deposit</option><option>Emergency Fund</option><option>Investment</option>';
        else cat.innerHTML = '<option>General</option><option>Food</option><option>Transport</option><option>Shopping</option><option>Bills</option><option>Entertainment</option><option>Health</option>';
    }
}

function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewTarget = document.getElementById('view-'+id);
    if(viewTarget) viewTarget.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${id}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function delTx(id) { 
    if(confirm('Delete this transaction?')) { 
        db = db.filter(x => x.id !== id); 
        if(isStorageEnabled()) localStorage.setItem('ow_db', JSON.stringify(db)); 
        render(); 
    } 
}

function resetData() { 
    if(confirm('Wipe all data? This cannot be undone.')) { 
        if(isStorageEnabled()) localStorage.removeItem('ow_db'); 
        if(isStorageEnabled()) localStorage.removeItem('ow_goal'); 
        location.reload(); 
    } 
}

function logoutUser() {
    if(confirm("Are you sure you want to logout?")) {
        window.location.href = "dashboard.html";
    }
}

// ==========================================
// 7. EXPORT / IMPORT
// ==========================================
function exportJSON() {
    if(db.length === 0) { alert("No data to backup."); return; }
    
    // Include goal data in backup if it exists
    let goalData = null;
    if (isStorageEnabled()) goalData = localStorage.getItem('ow_goal');
    
    const backupObj = {
        transactions: db,
        goal: goalData ? JSON.parse(goalData) : null
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `OpenWallet_Backup_${getSafeLocalDateString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Check if it's the new format (with goal) or the old format (just an array)
            let importedDb = Array.isArray(importedData) ? importedData : importedData.transactions;
            let importedGoal = Array.isArray(importedData) ? null : importedData.goal;
            
            if (Array.isArray(importedDb)) {
                if(confirm('Merge backup with current data?')) {
                    const merged = [...db, ...importedDb];
                    db = Array.from(new Map(merged.map(item => [item.id, item])).values()).sort((a, b) => (a.timestamp || a.id) - (b.timestamp || b.id));
                    if(isStorageEnabled()) localStorage.setItem('ow_db', JSON.stringify(db));
                    
                    if(importedGoal && isStorageEnabled()) {
                        localStorage.setItem('ow_goal', JSON.stringify(importedGoal));
                    }
                    
                    render(); alert("Data restored successfully!");
                }
            } else throw new Error();
        } catch(err) { alert("Error reading the .json file. Data may be corrupted."); }
    };
    reader.readAsText(file);
    event.target.value = ""; 
}

function exportData(type, isCustom) {
    let dataToExport = db;
    let reportTitle = "OpenWallet_Report";
    let sVal = null, eVal = null;

    if (isCustom) {
        sVal = document.getElementById('startDate').value;
        eVal = document.getElementById('endDate').value;
        if(!sVal || !eVal) { alert("Select both dates."); return; }
        
        const startParts = sVal.split('-');
        const endParts = eVal.split('-');
        const start = new Date(startParts[0], startParts[1] - 1, startParts[2]).setHours(0,0,0,0);
        const end = new Date(endParts[0], endParts[1] - 1, endParts[2]).setHours(23,59,59,999);
        
        dataToExport = db.filter(tx => {
            const txTime = tx.timestamp || tx.id;
            return txTime >= start && txTime <= end;
        });
        if(dataToExport.length === 0) { alert("No transactions found in this range."); return; }
        reportTitle += `_${sVal}_to_${eVal}`;
    }

    if(dataToExport.length === 0) { alert("No data to export!"); return; }

    if(type === 'excel') {
        if(typeof XLSX === 'undefined') { alert("Excel export library failed to load. Check your internet connection."); return; }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Data");
        XLSX.writeFile(wb, reportTitle + ".xlsx");
    } else if(type === 'pdf') {
        if(typeof window.jspdf === 'undefined') { alert("PDF export library failed to load. Check your internet connection."); return; }
        generatePremiumPDF(dataToExport, isCustom, sVal, eVal, reportTitle);
    }
}

// ==========================================
// 8. PREMIUM PDF GENERATOR
// ==========================================
function generatePremiumPDF(transactions, isCustomRange, startDate, endDate, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4'); 
    
    const primaryColor = [14, 165, 233]; 
    const darkText = [15, 23, 42];       
    const grayText = [100, 116, 139];    
    const successGreen = [16, 185, 129]; 
    const dangerRed = [244, 63, 94];     
    const bgSurface = [248, 250, 252];   
    
    doc.setFontSize(26);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text("OpenWallet", 40, 55);
    
    doc.setFontSize(12);
    doc.setTextColor(...grayText);
    doc.setFont('helvetica', 'normal');
    doc.text("Premium Financial Statement", 40, 75);
    
    doc.setFontSize(10);
    doc.setTextColor(...darkText);
    const dateStr = isCustomRange ? `${startDate}  to  ${endDate}` : 'All Time History';
    doc.text(`Period: ${dateStr}`, 555, 55, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 555, 70, { align: 'right' });
    
    let totalInc = 0, totalExp = 0, netBal = 0;
    transactions.forEach(t => {
        const amt = Number(t.amt) || 0;
        if(t.type === 'income') totalInc += amt;
        if(t.type === 'expense') totalExp += amt;
    });
    netBal = totalInc - totalExp;
    
    doc.setDrawColor(226, 232, 240); 
    doc.setFillColor(...bgSurface);
    doc.roundedRect(40, 100, 515, 70, 8, 8, 'FD'); 
    
    doc.setFontSize(10);
    doc.setTextColor(...grayText);
    doc.text("Total Income", 70, 125);
    doc.text("Total Expenses", 250, 125);
    doc.text("Net Balance", 430, 125);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    
    doc.setTextColor(...successGreen);
    doc.text(`+ Rs. ${totalInc.toLocaleString('en-IN')}`, 70, 150);
    
    doc.setTextColor(...dangerRed);
    doc.text(`- Rs. ${totalExp.toLocaleString('en-IN')}`, 250, 150);
    
    doc.setTextColor(...(netBal >= 0 ? primaryColor : dangerRed));
    doc.text(`Rs. ${netBal.toLocaleString('en-IN')}`, 430, 150);
    
    const tableData = transactions.map(t => [
        t.date,
        t.desc,
        t.cat || 'General',
        t.type.toUpperCase(),
        `${t.type === 'expense' ? '-' : (t.type === 'income' ? '+' : '')} Rs. ${Number(t.amt).toLocaleString('en-IN')}`
    ]);
    
    doc.autoTable({
        startY: 195,
        head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
            halign: 'left'
        },
        bodyStyles: {
            fontSize: 10,
            textColor: darkText,
        },
        columnStyles: {
            0: { cellWidth: 75 }, 
            1: { cellWidth: 'auto' }, 
            2: { cellWidth: 80 }, 
            3: { cellWidth: 70, halign: 'center', fontStyle: 'bold' }, 
            4: { cellWidth: 90, halign: 'right', fontStyle: 'bold' } 
        },
        alternateRowStyles: { fillColor: bgSurface },
        didParseCell: function(data) {
            if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
                const txType = data.row.raw[3]; 
                if (txType === 'INCOME') data.cell.styles.textColor = successGreen;
                else if (txType === 'EXPENSE') data.cell.styles.textColor = dangerRed;
            }
        },
        margin: { top: 40, left: 40, right: 40 }
    });
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(...grayText);
        doc.setFont('helvetica', 'normal');
        
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setDrawColor(226, 232, 240);
        doc.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
        
        doc.text("OpenWallet Dashboard - Confidential & Private", 40, pageHeight - 25);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, pageHeight - 25, { align: 'right' });
    }
    
    doc.save(`${filename}.pdf`);
}

function closeModal(e) { 
    const modal = document.getElementById('addModal');
    if (!modal) return;
    
    // The modal will close if:
    // 1. Called programmatically (no 'e' provided)
    // 2. The user clicks the dark background overlay
    // 3. The user clicks the new close button (or the icon inside it)
    if (!e || e.target === modal || e.target.closest('.close-modal-btn')) {
        modal.classList.remove('open'); 
    }
}

// LOGOUT FUNCTIONALITY (Redirects to index.html)
function logoutUser() {
    if(confirm("Are you sure you want to logout?")) {
        // You can add logic here to clear session storage if you are using it for auth:
        // sessionStorage.clear();
        window.location.href = "index.html";
    }
}