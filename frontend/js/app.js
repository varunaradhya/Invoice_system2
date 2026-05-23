const API = "http://127.0.0.1:5000";

let invoiceItems = [];
let productsById = new Map();
let currentPage = "dashboard";

function clearElement(element) {
    element.replaceChildren();
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.background = isError ? "#b42318" : "#111827";
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = `message ${isError ? "error" : "success"}`;
}

async function requestJson(path, options) {
    const response = await fetch(API + path, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.msg || "Request failed");
    }
    return data;
}

function makeStatus(status) {
    const span = document.createElement("span");
    const normalized = String(status || "Pending");
    span.className = "status ";
    if (normalized === "Paid") {
        span.className += "paid";
    } else if (normalized === "Partially Paid") {
        span.className += "partial";
    } else {
        span.className += "pending";
    }
    span.textContent = normalized;
    return span;
}

function renderTable(table, headers, rows) {
    clearElement(table);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    if (!rows.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = headers.length;
        cell.className = "empty-state";
        cell.textContent = "No records yet. Add one or load demo data.";
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    rows.forEach(rowValues => {
        const row = document.createElement("tr");
        rowValues.forEach(value => {
            const cell = document.createElement("td");
            if (value instanceof Node) {
                cell.appendChild(value);
            } else {
                cell.textContent = value ?? "";
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
}

function setActiveNav(id) {
    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle("active", button.dataset.page === id);
    });
    pageTitle.textContent = document.querySelector(`[data-page="${id}"]`).textContent;
}

function showPage(id) {
    currentPage = id;
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    setActiveNav(id);
    refreshCurrentPage();
}

function refreshCurrentPage() {
    if (currentPage === "dashboard") loadDashboard();
    if (currentPage === "customers") loadCustomers();
    if (currentPage === "products") loadProducts();
    if (currentPage === "invoice") initInvoicePage();
    if (currentPage === "payments") initPaymentPage();
}

async function seedDemoData() {
    try {
        const result = await requestJson("/demo/seed", {method: "POST"});
        showToast(result.msg);
        refreshCurrentPage();
    } catch (error) {
        showToast(error.message, true);
    }
}

// ------------------- DASHBOARD -------------------
async function loadDashboard() {
    await Promise.all([loadStats(), loadInvoiceTable()]);
}

async function loadStats() {
    const d = await requestJson("/analytics/");
    const paidRatio = d.total_sales ? Math.round((d.paid / d.total_sales) * 100) : 0;

    stats.innerHTML = "";
    [
        ["Total Sales", money(d.total_sales), "All invoices raised"],
        ["Collected", money(d.paid), `${paidRatio}% collected`],
        ["Pending", money(d.pending), "Outstanding balance"],
        ["Invoices", d.invoice_count, "Created records"]
    ].forEach(([label, value, note], index) => {
        const card = document.createElement("article");
        card.className = "stat-card";
        card.style.animationDelay = `${index * 70}ms`;

        const labelNode = document.createElement("div");
        labelNode.className = "stat-label";
        labelNode.textContent = label;

        const valueNode = document.createElement("div");
        valueNode.className = "stat-value";
        valueNode.textContent = value;

        const noteNode = document.createElement("div");
        noteNode.className = "stat-note";
        noteNode.textContent = note;

        card.append(labelNode, valueNode, noteNode);
        stats.appendChild(card);
    });

    paidMeter.style.width = `${paidRatio}%`;
    collectionSummary.textContent = d.total_sales
        ? `${money(d.paid)} collected out of ${money(d.total_sales)} total billed.`
        : "Load demo data or create invoices to see collection progress.";
}

async function loadInvoiceTable() {
    const invoices = await requestJson("/invoices/");
    renderTable(
        invoiceTable,
        ["Invoice", "Customer", "Total", "Paid", "Due", "Status"],
        invoices.slice(0, 8).map(invoice => [
            invoice.invoice_number,
            invoice.customer_name,
            money(invoice.final_total),
            money(invoice.amount_paid),
            money(invoice.final_total - invoice.amount_paid),
            makeStatus(invoice.payment_status)
        ])
    );
}

// ------------------- CUSTOMERS -------------------
async function addCustomer() {
    try {
        await requestJson("/customers/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                name: c_name.value,
                phone: c_phone.value,
                gstin: c_gstin.value
            })
        });
        c_name.value = "";
        c_phone.value = "";
        c_gstin.value = "";
        showToast("Customer added");
        loadCustomers();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function loadCustomers() {
    const data = await requestJson("/customers/");
    renderTable(
        customerTable,
        ["ID", "Name", "Phone", "GSTIN", "Balance"],
        data.map(c => [c.id, c.name, c.phone, c.gstin, money(c.balance)])
    );
}

// ------------------- PRODUCTS -------------------
async function addProduct() {
    try {
        await requestJson("/products/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                name: p_name.value,
                price: p_price.value,
                gst_percent: p_gst.value,
                quantity: p_qty.value
            })
        });
        p_name.value = "";
        p_price.value = "";
        p_gst.value = "";
        p_qty.value = "";
        showToast("Product added");
        loadProducts();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function loadProducts() {
    const data = await requestJson("/products/");
    renderTable(
        productTable,
        ["ID", "Name", "Price", "GST %", "Qty"],
        data.map(p => [p.id, p.name, money(p.price), p.gst_percent, p.quantity])
    );
}

// ------------------- INVOICE -------------------
async function initInvoicePage() {
    invoiceItems = [];
    renderInvoiceItems();
    showMessage(invoiceMessage, "");

    const customers = await requestJson("/customers/");
    clearElement(invoice_customer);
    customers.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        invoice_customer.appendChild(option);
    });

    const products = await requestJson("/products/");
    productsById = new Map(products.map(product => [String(product.id), product]));
    clearElement(product_select);
    products.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.name} - ${p.quantity} available - ${money(p.price)}`;
        product_select.appendChild(option);
    });
}

function addItem() {
    const product = productsById.get(product_select.value);
    const quantity = Number.parseInt(qty.value, 10);
    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
        showMessage(invoiceMessage, "Choose a product and enter a valid quantity.", true);
        return;
    }

    invoiceItems.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        gst_percent: product.gst_percent,
        quantity
    });
    qty.value = "";
    showMessage(invoiceMessage, "");
    renderInvoiceItems();
}

function renderInvoiceItems() {
    clearElement(items);
    if (!invoiceItems.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Your invoice draft is empty.";
        items.appendChild(empty);
        return;
    }

    invoiceItems.forEach(i => {
        const item = document.createElement("li");
        const subtotal = Number(i.price) * Number(i.quantity);
        item.textContent = `${i.product_name} x ${i.quantity} | ${money(subtotal)} before GST`;
        items.appendChild(item);
    });
}

async function createInvoice() {
    try {
        const d = await requestJson("/invoices/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                customer_id: invoice_customer.value,
                items: invoiceItems.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity
                }))
            })
        });
        showMessage(invoiceMessage, `Created ${d.invoice_number}. Total: ${money(d.final_total)}`);
        showToast("Invoice created");
        invoiceItems = [];
        renderInvoiceItems();
        initInvoicePage();
    } catch (error) {
        showMessage(invoiceMessage, error.message, true);
    }
}

// ------------------- PAYMENTS -------------------
async function initPaymentPage() {
    showMessage(paymentMessage, "");

    const customers = await requestJson("/customers/");
    clearElement(pay_customer);
    customers.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        pay_customer.appendChild(option);
    });

    const invoices = await requestJson("/invoices/");
    const openInvoices = invoices.filter(invoice => invoice.payment_status !== "Paid");
    clearElement(pay_invoice);
    openInvoices.forEach(invoice => {
        const option = document.createElement("option");
        option.value = invoice.id;
        option.textContent = `${invoice.invoice_number} - ${invoice.customer_name} - ${money(invoice.final_total - invoice.amount_paid)} due`;
        option.dataset.customerId = invoice.customer_id;
        pay_invoice.appendChild(option);
    });

    if (pay_invoice.selectedOptions[0]) {
        pay_customer.value = pay_invoice.selectedOptions[0].dataset.customerId;
    }

    renderTable(
        paymentInvoiceTable,
        ["Invoice", "Customer", "Due", "Status"],
        openInvoices.map(invoice => [
            invoice.invoice_number,
            invoice.customer_name,
            money(invoice.final_total - invoice.amount_paid),
            makeStatus(invoice.payment_status)
        ])
    );
}

pay_invoice.addEventListener("change", () => {
    const selected = pay_invoice.selectedOptions[0];
    if (selected) {
        pay_customer.value = selected.dataset.customerId;
    }
});

async function addPayment() {
    try {
        const d = await requestJson("/payments/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                customer_id: pay_customer.value,
                invoice_id: pay_invoice.value,
                amount: pay_amount.value
            })
        });
        pay_amount.value = "";
        showMessage(paymentMessage, `Payment added. Status: ${d.payment_status}`);
        showToast("Payment recorded");
        initPaymentPage();
    } catch (error) {
        showMessage(paymentMessage, error.message, true);
    }
}

loadDashboard().catch(error => showToast(error.message, true));
