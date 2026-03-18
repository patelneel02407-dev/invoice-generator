// App State
let state = {
    view: 'home', // 'home' or 'editor'
    invoices: [],
    currentInvoice: null
};

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    await loadInvoices();
    showView('home');
});

// Navigation & View Logic
function showView(viewName) {
    state.view = viewName;
    document.getElementById('view-home').classList.toggle('hidden', viewName !== 'home');
    document.getElementById('view-editor').classList.toggle('hidden', viewName !== 'editor');
    
    if (viewName === 'home') {
        renderDashboard();
    }
}

function createNewInvoice() {
    state.currentInvoice = {
        id: 'INV-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        companyName: document.getElementById('companyName').innerText || 'Your Company Name',
        companyAddress: document.getElementById('companyAddress').innerText || 'Ahmedabad, India',
        customerName: '',
        phone: '',
        items: [{ description: '', price: 0, qty: 1 }],
        subtotal: 0,
        gstRate: 18,
        gst: 0,
        grandTotal: 0
    };
    
    applyInvoiceToEditor(state.currentInvoice);
    showView('editor');
    document.getElementById('delete-invoice-btn').classList.add('hidden');
    document.getElementById('editor-heading').innerText = 'New Invoice';
}

function openInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv) {
        state.currentInvoice = JSON.parse(JSON.stringify(inv)); // Deep clone
        applyInvoiceToEditor(state.currentInvoice);
        showView('editor');
        document.getElementById('delete-invoice-btn').classList.remove('hidden');
        document.getElementById('editor-heading').innerText = 'Edit Invoice';
    }
}

// Editor Logic
function applyInvoiceToEditor(inv) {
    document.getElementById('invoiceNumber').innerText = inv.id;
    document.getElementById('date').value = inv.date;
    document.getElementById('companyName').innerText = inv.companyName;
    document.getElementById('companyAddress').innerText = inv.companyAddress;
    document.getElementById('customerName').value = inv.customerName;
    document.getElementById('phone').value = inv.phone;
    document.getElementById('gstRate').value = inv.gstRate || 18;
    
    // Clear and fill table
    const tbody = document.querySelector("#items tbody");
    tbody.innerHTML = '';
    inv.items.forEach(item => addItemRow(item));
}

function addItemRow(item = { description: '', price: 0, qty: 1 }) {
    const tbody = document.querySelector("#items tbody");
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><input type="text" placeholder="Service or product" value="${item.description}"></td>
        <td><input type="number" placeholder="0.00" value="${item.price}"></td>
        <td><input type="number" placeholder="1" value="${item.qty}"></td>
        <td class="total-cell">${(item.price * item.qty).toFixed(2)}</td>
        <td class="no-print"><button class="delete-row" onclick="removeRow(this)">×</button></td>
    `;
    tbody.appendChild(row);
    calculate();
}

function addItem() {
    addItemRow();
}

function removeRow(btn) {
    const row = btn.closest('tr');
    if (document.querySelectorAll("#items tbody tr").length > 1) {
        row.remove();
        calculate();
    }
}

// Calculation Logic
document.addEventListener("input", (e) => {
    if (e.target.closest('#items') || e.target.closest('.customer-section') || e.target.closest('.header')) {
        calculate();
    }
});

function calculate() {
    const rows = document.querySelectorAll("#items tbody tr");
    let subtotal = 0;
    let items = [];

    rows.forEach(row => {
        const desc = row.cells[0].querySelector("input").value;
        const price = parseFloat(row.cells[1].querySelector("input").value) || 0;
        const qty = parseFloat(row.cells[2].querySelector("input").value) || 0;
        const total = price * qty;
        
        row.cells[3].innerText = total.toFixed(2);
        subtotal += total;
        
        items.push({ description: desc, price: price, qty: qty });
    });

    const gstRate = parseFloat(document.getElementById("gstRate").value) || 0;
    const gst = subtotal * (gstRate / 100);
    const grand = subtotal + gst;

    document.getElementById("subtotal").innerText = subtotal.toFixed(2);
    document.getElementById("gst").innerText = gst.toFixed(2);
    document.getElementById("grandTotal").innerText = grand.toFixed(2);

    // Update state
    if (state.currentInvoice) {
        state.currentInvoice.items = items;
        state.currentInvoice.subtotal = subtotal;
        state.currentInvoice.gstRate = gstRate;
        state.currentInvoice.gst = gst;
        state.currentInvoice.grandTotal = grand;
        state.currentInvoice.customerName = document.getElementById('customerName').value;
        state.currentInvoice.phone = document.getElementById('phone').value;
        state.currentInvoice.date = document.getElementById('date').value;
        state.currentInvoice.companyName = document.getElementById('companyName').innerText;
        state.currentInvoice.companyAddress = document.getElementById('companyAddress').innerText;
    }
}

// Data Persistence
async function saveAndExit() {
    calculate();
    
    // Save to IndexedDB
    await window.invoiceDB.saveInvoice(state.currentInvoice);
    
    // Update local state and UI
    const existingIndex = state.invoices.findIndex(i => i.id === state.currentInvoice.id);
    if (existingIndex > -1) {
        state.invoices[existingIndex] = state.currentInvoice;
    } else {
        state.invoices.unshift(state.currentInvoice);
    }
    
    showView('home');
}

async function loadInvoices() {
    // 1. Try to load from IndexedDB
    let invoices = await window.invoiceDB.getAllInvoices();
    
    // 2. Migration logic: Check if we have old data in localStorage
    const oldData = localStorage.getItem('invoices_v2');
    if (oldData) {
        try {
            const oldInvoices = JSON.parse(oldData);
            if (oldInvoices && oldInvoices.length > 0) {
                console.log("Migrating data from localStorage to IndexedDB...");
                // Save all old invoices to IndexedDB
                for (const inv of oldInvoices) {
                    await window.invoiceDB.saveInvoice(inv);
                }
                // Fetch again to get the merged list
                invoices = await window.invoiceDB.getAllInvoices();
                // Clear old data
                localStorage.removeItem('invoices_v2');
                console.log("Migration complete.");
            }
        } catch (e) {
            console.error("Migration failed", e);
        }
    }
    
    // Sort by ID (decreasing) or date as needed, assuming unshift behavior for new ones
    // We'll sort by ID (INV-TIMESTAMP) to match previous behavior
    state.invoices = invoices.sort((a, b) => b.id.localeCompare(a.id));
}

async function deleteCurrentInvoice() {
    if (confirm('Are you sure you want to delete this invoice?')) {
        await window.invoiceDB.deleteInvoice(state.currentInvoice.id);
        state.invoices = state.invoices.filter(i => i.id !== state.currentInvoice.id);
        showView('home');
    }
}

// Dashboard Rendering
function renderDashboard() {
    const grid = document.getElementById('invoice-grid');
    const empty = document.getElementById('empty-state');
    const statCount = document.getElementById('stat-count');
    const statTotal = document.getElementById('stat-total');
    
    grid.innerHTML = '';
    
    let totalValue = 0;
    state.invoices.forEach(inv => {
        totalValue += inv.grandTotal;
        const card = document.createElement('div');
        card.className = 'invoice-card';
        card.onclick = () => openInvoice(inv.id);
        card.innerHTML = `
            <div class="card-header">
                <span class="inv-num">${inv.id}</span>
                <span class="inv-date">${inv.date}</span>
            </div>
            <div class="card-body">
                <h3>${inv.customerName || 'No Name'}</h3>
                <p>${inv.items.length} item(s)</p>
            </div>
            <div class="card-footer">
                <span class="inv-amount">₹ ${inv.grandTotal.toFixed(2)}</span>
            </div>
        `;
        grid.appendChild(card);
    });
    
    statCount.innerText = state.invoices.length;
    statTotal.innerText = `₹ ${totalValue.toFixed(2)}`;
    
    empty.classList.toggle('hidden', state.invoices.length > 0);
    grid.classList.toggle('hidden', state.invoices.length === 0);
}

// Download PDF Fix
function downloadPDF() {
    const element = document.getElementById("invoice");
    const invId = document.getElementById("invoiceNumber").innerText;
    const downloadBtn = document.querySelector('.download-btn');
    
    // Add visual feedback
    const originalBtnText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = "Generating Professional PDF...";
    downloadBtn.disabled = true;

    // Apply PDF-only styles temporarily
    element.classList.add('pdf-mode');
    
    const opt = {
        margin: [0.5, 0.5],
        filename: `Invoice_${invId}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
            scale: 3, 
            useCORS: true,
            logging: false,
            letterRendering: true,
            windowWidth: 800 
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Robust download call
    html2pdf().set(opt).from(element).save()
        .then(() => {
            console.log("PDF generated successfully");
            element.classList.remove('pdf-mode');
            downloadBtn.innerHTML = originalBtnText;
            downloadBtn.disabled = false;
        })
        .catch(err => {
            console.error("PDF generation failed:", err);
            element.classList.remove('pdf-mode');
            downloadBtn.innerHTML = originalBtnText;
            downloadBtn.disabled = false;
            alert("Error generating PDF. Try using Ctrl+P (Print) as a workaround.");
        });
}