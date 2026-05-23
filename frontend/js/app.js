const API = "http://127.0.0.1:5000";

let invoiceItems = [];

// Navigation
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');

    if (id === 'customers') loadCustomers();
    if (id === 'products') loadProducts();
    if (id === 'invoice') initInvoicePage();
}

// ------------------- DASHBOARD -------------------
function loadStats() {
    fetch(API + "/analytics/")
    .then(r => r.json())
    .then(d => {
        document.getElementById("stats").innerHTML =
        `Total Sales: ${d.total_sales} <br> Pending: ${d.pending}`;
    });
}

// ------------------- CUSTOMERS -------------------
function addCustomer() {
    fetch(API + "/customers/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            name: c_name.value,
            phone: c_phone.value,
            gstin: c_gstin.value
        })
    }).then(() => loadCustomers());
}

function loadCustomers() {
    fetch(API + "/customers/")
    .then(r => r.json())
    .then(data => {
        let table = "<tr><th>ID</th><th>Name</th><th>Balance</th></tr>";
        data.forEach(c => {
            table += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.balance}</td></tr>`;
        });
        document.getElementById("customerTable").innerHTML = table;
    });
}

// ------------------- PRODUCTS -------------------
function addProduct() {
    fetch(API + "/products/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            name: p_name.value,
            price: p_price.value,
            gst_percent: p_gst.value,
            quantity: p_qty.value
        })
    }).then(() => loadProducts());
}

function loadProducts() {
    fetch(API + "/products/")
    .then(r => r.json())
    .then(data => {
        let table = "<tr><th>ID</th><th>Name</th><th>Qty</th></tr>";
        data.forEach(p => {
            table += `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.quantity}</td></tr>`;
        });
        document.getElementById("productTable").innerHTML = table;
    });
}

// ------------------- INVOICE -------------------
function initInvoicePage() {
    fetch(API + "/customers/")
    .then(r => r.json())
    .then(data => {
        invoice_customer.innerHTML = data.map(c =>
            `<option value="${c.id}">${c.name}</option>`).join('');
    });

    fetch(API + "/products/")
    .then(r => r.json())
    .then(data => {
        product_select.innerHTML = data.map(p =>
            `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`).join('');
    });
}

function addItem() {
    let product = product_select.selectedOptions[0];
    invoiceItems.push({
        product_id: product.value,
        price: product.dataset.price,
        quantity: qty.value
    });

    document.getElementById("items").innerHTML =
        invoiceItems.map(i => `<li>${i.product_id} x ${i.quantity}</li>`).join('');
}

function createInvoice() {
    fetch(API + "/invoices/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            customer_id: invoice_customer.value,
            items: invoiceItems
        })
    }).then(r => r.json())
      .then(d => alert("Created: " + d.invoice_number));
}

// ------------------- PAYMENTS -------------------
function addPayment() {
    fetch(API + "/payments/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            customer_id: pay_customer.value,
            invoice_id: pay_invoice.value,
            amount: pay_amount.value
        })
    }).then(() => alert("Payment added"));
}