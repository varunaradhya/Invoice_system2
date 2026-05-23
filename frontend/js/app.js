const API = "http://127.0.0.1:5000";

let invoiceItems = [];
let quoteItemsDraft = [];
let productsById = new Map();
let currentPage = "dashboard";
let companySettings = {};
let currentUser = JSON.parse(localStorage.getItem("invoiceStudioUser") || "null");

function clearElement(element) {
    element.replaceChildren();
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function discountedPrice(item) {
    const discount = Math.min(Math.max(Number(item.discount || 0), 0), 100);
    return Number(item.price || 0) * (1 - discount / 100);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function fileToDataUrl(input) {
    return new Promise(resolve => {
        const file = input.files && input.files[0];
        if (!file) {
            resolve("");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
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
    if (!response.ok) throw new Error(data.error || data.msg || "Request failed");
    return data;
}

function makeStatus(status) {
    const span = document.createElement("span");
    const normalized = String(status || "Pending");
    span.className = "status " + (normalized === "Paid" ? "paid" : normalized === "Partially Paid" ? "partial" : "pending");
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
            if (value instanceof Node) cell.appendChild(value);
            else cell.textContent = value ?? "";
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

function applyPermissions() {
    if (!currentUser) return;
    const adminPermissions = "dashboard,customers,products,quotations,invoices,payments,reports,settings,users";
    const source = currentUser.role === "admin" ? adminPermissions : currentUser.permissions;
    const permissions = new Set(String(source || "").split(",").map(p => p.trim()));
    document.querySelectorAll(".nav-link").forEach(button => {
        button.style.display = permissions.has(button.dataset.page) ? "" : "none";
    });
    currentUserLabel.textContent = `${currentUser.name} (${currentUser.role})`;
    if (!permissions.has(currentPage)) {
        const first = document.querySelector(".nav-link:not([style*='none'])");
        if (first) currentPage = first.dataset.page;
    }
}

async function login(event) {
    event.preventDefault();
    try {
        currentUser = await requestJson("/users/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username: login_username.value, password: login_password.value})
        });
        localStorage.setItem("invoiceStudioUser", JSON.stringify(currentUser));
        loginModal.classList.add("hidden");
        applyPermissions();
        showPage(currentPage);
    } catch (error) {
        showToast(error.message, true);
    }
}

function logout() {
    localStorage.removeItem("invoiceStudioUser");
    currentUser = null;
    loginModal.classList.remove("hidden");
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
    if (currentPage === "quotations") initQuotationPage();
    if (currentPage === "invoice") initInvoicePage();
    if (currentPage === "payments") initPaymentPage();
    if (currentPage === "reports") loadReports();
    if (currentPage === "settings") loadSettings();
    if (currentPage === "users") loadUsers();
}

async function loadSettingsCache() {
    companySettings = await requestJson("/settings/");
    return companySettings;
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

// Dashboard
async function loadDashboard() {
    await Promise.all([loadSettingsCache(), loadStats(), loadInvoiceTable()]);
}

async function loadStats() {
    const d = await requestJson("/analytics/");
    const paidRatio = d.total_sales ? Math.round((d.paid / d.total_sales) * 100) : 0;
    stats.innerHTML = "";
    [
        ["Total Sales", money(d.total_sales), "Invoices raised"],
        ["Collected", money(d.paid), `${paidRatio}% collected`],
        ["Profit", money(d.profit), "Estimated gross profit"],
        ["Inventory", money(d.inventory_value), "Stock purchase value"]
    ].forEach(([label, value, note], index) => {
        const card = document.createElement("article");
        card.className = "stat-card";
        card.style.animationDelay = `${index * 70}ms`;
        card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div>`;
        stats.appendChild(card);
    });
    paidMeter.style.width = `${paidRatio}%`;
    lowStockCount.textContent = d.low_stock || 0;
    customerCount.textContent = d.customers || 0;
    productCount.textContent = d.products || 0;
    collectionSummary.textContent = d.total_sales
        ? `${money(d.paid)} collected, ${money(d.pending)} still pending.`
        : "Load demo data or create invoices to see collection progress.";
    drawChart([d.total_sales, d.paid, d.pending, d.profit], ["Sales", "Paid", "Pending", "Profit"]);
}

function drawChart(values, labels) {
    const canvas = salesChart;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(...values, 1);
    values.forEach((value, index) => {
        const x = 32 + index * 92;
        const height = (value / max) * 150;
        ctx.fillStyle = ["#0f766e", "#16a34a", "#b7791f", "#175cd3"][index];
        ctx.fillRect(x, 190 - height, 48, height);
        ctx.fillStyle = "#667085";
        ctx.font = "12px Segoe UI";
        ctx.fillText(labels[index], x - 2, 216);
    });
}

async function loadInvoiceTable() {
    const invoices = await requestJson("/invoices/");
    renderTable(invoiceTable, ["Invoice", "Customer", "Total", "Paid", "Due", "Status", "Action"], invoices.slice(0, 12).map(invoice => {
        const remove = document.createElement("button");
        remove.className = "secondary-btn";
        remove.textContent = "Remove";
        remove.onclick = () => deleteRecord(`/invoices/${invoice.id}`, loadDashboard, "Remove this invoice? Stock and customer ledger will be reversed.");
        return [
            invoice.invoice_number,
            invoice.customer_name,
            money(invoice.final_total),
            money(invoice.amount_paid),
            money(invoice.final_total - invoice.amount_paid),
            makeStatus(invoice.payment_status),
            remove
        ];
    }));
}

// Customers
async function addCustomer() {
    try {
        await requestJson("/customers/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name: c_name.value, phone: c_phone.value, gstin: c_gstin.value})
        });
        c_name.value = ""; c_phone.value = ""; c_gstin.value = "";
        showToast("Customer added");
        loadCustomers();
    } catch (error) { showToast(error.message, true); }
}

async function loadCustomers() {
    const data = await requestJson("/customers/");
    renderTable(customerTable, ["ID", "Name", "Phone", "GSTIN", "Balance", "Action"], data.map(c => {
        const remove = document.createElement("button");
        remove.className = "secondary-btn";
        remove.textContent = "Remove";
        remove.onclick = () => deleteRecord(`/customers/${c.id}`, loadCustomers, "Remove this customer?");
        return [c.id, c.name, c.phone, c.gstin, money(c.balance), remove];
    }));
}

// Products
async function addProduct() {
    try {
        await requestJson("/products/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                name: p_name.value,
                category: p_category.value,
                hsn_code: p_hsn.value,
                unit: p_unit.value,
                cost_price: p_cost.value,
                price: p_price.value,
                gst_percent: p_gst.value,
                quantity: p_qty.value,
                low_stock_alert: p_low_stock.value,
                photo: await fileToDataUrl(p_photo)
            })
        });
        [p_name, p_category, p_hsn, p_unit, p_cost, p_price, p_gst, p_qty, p_low_stock, p_photo].forEach(input => input.value = "");
        showToast("Product added");
        loadProducts();
    } catch (error) { showToast(error.message, true); }
}

async function loadProducts() {
    const data = await requestJson("/products/");
    renderTable(productTable, ["Photo", "ID", "Name", "Category", "HSN", "Unit", "Cost", "Sale Price", "GST %", "Qty", "Status", "Action"], data.map(p => {
        const img = document.createElement("img");
        img.className = "product-thumb";
        img.alt = "";
        if (p.photo) img.src = p.photo;
        const status = document.createElement("span");
        status.className = Number(p.quantity) <= Number(p.low_stock_alert || 0) ? "stock-low" : "";
        status.textContent = Number(p.quantity) <= Number(p.low_stock_alert || 0) ? "Low stock" : "In stock";
        const remove = document.createElement("button");
        remove.className = "secondary-btn";
        remove.textContent = "Remove";
        remove.onclick = () => deleteRecord(`/products/${p.id}`, loadProducts, "Remove this product?");
        return [img, p.id, p.name, p.category, p.hsn_code, p.unit, money(p.cost_price), money(p.price), p.gst_percent, p.quantity, status, remove];
    }));
}

async function fillCustomerAndProductSelects(customerSelect, productSelect) {
    const [customers, products] = await Promise.all([requestJson("/customers/"), requestJson("/products/")]);
    clearElement(customerSelect);
    customers.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        customerSelect.appendChild(option);
    });
    productsById = new Map(products.map(product => [String(product.id), product]));
    clearElement(productSelect);
    products.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.name} - ${p.category} - ${p.quantity} available - ${money(p.price)}`;
        productSelect.appendChild(option);
    });
}

// Quotations
async function initQuotationPage() {
    await fillCustomerAndProductSelects(quote_customer, quote_product);
    renderQuoteItems();
    loadQuotations();
}

function addQuoteItem() {
    const product = productsById.get(quote_product.value);
    const quantity = Number.parseInt(quote_qty.value, 10);
    if (!product || !quantity || quantity <= 0) {
        showMessage(quotationMessage, "Choose a product and quantity.", true);
        return;
    }
    quoteItemsDraft.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        gst_percent: product.gst_percent,
        hsn_code: product.hsn_code,
        unit: product.unit,
        discount: quote_show_discount.checked ? Number(quote_discount.value || 0) : 0,
        showDiscount: quote_show_discount.checked,
        quantity
    });
    quote_qty.value = "";
    renderQuoteItems();
}

function renderQuoteItems() {
    clearElement(quoteItems);
    if (!quoteItemsDraft.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "Quotation draft is empty.";
        quoteItems.appendChild(empty);
        return;
    }
    quoteItemsDraft.forEach((item, index) => {
        const li = document.createElement("li");
        const discountLabel = item.showDiscount ? ` | Discount ${item.discount || 0}%` : "";
        li.textContent = `${item.product_name} x ${item.quantity}${discountLabel} | ${money(discountedPrice(item) * item.quantity)}`;
        li.onclick = () => {
            quoteItemsDraft.splice(index, 1);
            renderQuoteItems();
        };
        quoteItems.appendChild(li);
    });
}

async function saveQuotation() {
    try {
        const id = quotation_id.value;
        const payload = {
            customer_id: quote_customer.value,
            generator_name: quote_generator.value,
            items: quoteItemsDraft.map(i => ({product_id: i.product_id, quantity: i.quantity, price: discountedPrice(i), gst_percent: i.gst_percent}))
        };
        const saved = await requestJson(id ? `/quotations/${id}` : "/quotations/", {
            method: id ? "PUT" : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        quotation_id.value = saved.id;
        showMessage(quotationMessage, `Saved ${saved.quotation_number}`);
        showToast("Quotation draft saved");
        loadQuotations();
    } catch (error) { showMessage(quotationMessage, error.message, true); }
}

async function loadQuotations() {
    const data = await requestJson("/quotations/");
    renderTable(quotationTable, ["Quotation", "Customer", "Total", "Status", "Action"], data.map(q => {
        const actions = document.createElement("div");
        actions.className = "action-row";
        const edit = document.createElement("button");
        edit.className = "secondary-btn";
        edit.textContent = "Edit";
        edit.onclick = () => editQuotation(q.id);
        const remove = document.createElement("button");
        remove.className = "secondary-btn";
        remove.textContent = "Remove";
        remove.onclick = () => deleteRecord(`/quotations/${q.id}`, loadQuotations, "Remove this quotation?");
        actions.append(edit, remove);
        return [q.quotation_number, q.customer_name, money(q.final_total), makeStatus(q.status), actions];
    }));
}

async function editQuotation(id) {
    const quote = await requestJson(`/quotations/${id}`);
    quotation_id.value = quote.id;
    quote_customer.value = quote.customer_id;
    quote_generator.value = quote.generator_name || "";
    quoteItemsDraft = quote.items.map(i => ({
        product_id: i.product_id, product_name: i.product_name, price: i.price, gst_percent: i.gst_percent, quantity: i.quantity, hsn_code: i.hsn_code, unit: i.unit, discount: 0, showDiscount: false
    }));
    renderQuoteItems();
    showMessage(quotationMessage, `Editing ${quote.quotation_number}`);
}

async function convertQuotation() {
    if (!quotation_id.value) {
        showMessage(quotationMessage, "Save the quotation before converting.", true);
        return;
    }
    try {
        const invoice = await requestJson(`/quotations/${quotation_id.value}/convert`, {method: "POST"});
        showToast(`Converted to ${invoice.invoice_number}`);
        quotation_id.value = "";
        quoteItemsDraft = [];
        refreshCurrentPage();
    } catch (error) { showMessage(quotationMessage, error.message, true); }
}

// Invoices
async function initInvoicePage() {
    invoiceItems = [];
    renderInvoiceItems();
    showMessage(invoiceMessage, "");
    await fillCustomerAndProductSelects(invoice_customer, product_select);
}

function addItem() {
    const product = productsById.get(product_select.value);
    const quantity = Number.parseInt(qty.value, 10);
    if (!product || !quantity || quantity <= 0) {
        showMessage(invoiceMessage, "Choose a product and enter a valid quantity.", true);
        return;
    }
    invoiceItems.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        gst_percent: product.gst_percent,
        hsn_code: product.hsn_code,
        unit: product.unit,
        discount: invoice_show_discount.checked ? Number(invoice_discount.value || 0) : 0,
        showDiscount: invoice_show_discount.checked,
        quantity
    });
    qty.value = "";
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
        const discountLabel = i.showDiscount ? ` | Discount ${i.discount || 0}%` : "";
        item.textContent = `${i.product_name} x ${i.quantity}${discountLabel} | ${money(discountedPrice(i) * i.quantity)} before GST`;
        items.appendChild(item);
    });
}

async function createInvoice() {
    try {
        const d = await requestJson("/invoices/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({customer_id: invoice_customer.value, items: invoiceItems.map(i => ({product_id: i.product_id, quantity: i.quantity}))})
        });
        showMessage(invoiceMessage, `Created ${d.invoice_number}. Total: ${money(d.final_total)}`);
        showToast("Invoice created");
        invoiceItems = [];
        renderInvoiceItems();
        initInvoicePage();
    } catch (error) { showMessage(invoiceMessage, error.message, true); }
}

// Payments
async function initPaymentPage() {
    showMessage(paymentMessage, "");
    const [customers, invoices] = await Promise.all([requestJson("/customers/"), requestJson("/invoices/")]);
    clearElement(pay_customer);
    customers.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        pay_customer.appendChild(option);
    });
    const openInvoices = invoices.filter(invoice => invoice.payment_status !== "Paid");
    clearElement(pay_invoice);
    openInvoices.forEach(invoice => {
        const option = document.createElement("option");
        option.value = invoice.id;
        option.textContent = `${invoice.invoice_number} - ${invoice.customer_name} - ${money(invoice.final_total - invoice.amount_paid)} due`;
        option.dataset.customerId = invoice.customer_id;
        pay_invoice.appendChild(option);
    });
    if (pay_invoice.selectedOptions[0]) pay_customer.value = pay_invoice.selectedOptions[0].dataset.customerId;
    renderTable(paymentInvoiceTable, ["Invoice", "Customer", "Due", "Status"], openInvoices.map(invoice => [
        invoice.invoice_number, invoice.customer_name, money(invoice.final_total - invoice.amount_paid), makeStatus(invoice.payment_status)
    ]));
}

pay_invoice.addEventListener("change", () => {
    const selected = pay_invoice.selectedOptions[0];
    if (selected) pay_customer.value = selected.dataset.customerId;
});

async function addPayment() {
    try {
        const d = await requestJson("/payments/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({customer_id: pay_customer.value, invoice_id: pay_invoice.value, amount: pay_amount.value})
        });
        pay_amount.value = "";
        showMessage(paymentMessage, `Payment added. Status: ${d.payment_status}`);
        showToast("Payment recorded");
        initPaymentPage();
    } catch (error) { showMessage(paymentMessage, error.message, true); }
}

// Reports
async function loadReports() {
    const [analytics, products, invoices] = await Promise.all([
        requestJson("/analytics/"),
        requestJson("/products/"),
        requestJson("/invoices/")
    ]);
    drawReportChart([analytics.total_sales, analytics.paid, analytics.pending, analytics.profit, analytics.inventory_value], ["Sales", "Paid", "Pending", "Profit", "Stock"]);
    renderTable(stockReportTable, ["Product", "Category", "HSN", "Stock", "Alert", "Value", "Status"], products.map(p => {
        const status = document.createElement("span");
        status.className = Number(p.quantity) <= Number(p.low_stock_alert || 0) ? "stock-low" : "";
        status.textContent = Number(p.quantity) <= Number(p.low_stock_alert || 0) ? "Reorder" : "Healthy";
        return [p.name, p.category, p.hsn_code, p.quantity, p.low_stock_alert, money(Number(p.cost_price) * Number(p.quantity)), status];
    }));
    window.reportRows = invoices.map(invoice => ({
        invoice: invoice.invoice_number,
        customer: invoice.customer_name,
        total: invoice.final_total,
        paid: invoice.amount_paid,
        due: invoice.final_total - invoice.amount_paid,
        status: invoice.payment_status
    }));
}

function drawReportChart(values, labels) {
    const canvas = reportChart;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(...values, 1);
    values.forEach((value, index) => {
        const x = 28 + index * 86;
        const height = (value / max) * 180;
        ctx.fillStyle = ["#0f766e", "#16a34a", "#b7791f", "#175cd3", "#7c3aed"][index];
        ctx.fillRect(x, 220 - height, 48, height);
        ctx.fillStyle = "#667085";
        ctx.font = "12px Segoe UI";
        ctx.fillText(labels[index], x - 2, 248);
    });
}

function rowsToCsv(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return [headers.join(","), ...rows.map(row => headers.map(key => escape(row[key])).join(","))].join("\n");
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], {type});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function deleteRecord(path, refresh, message) {
    if (!window.confirm(message || "Delete this record?")) return;
    try {
        const result = await requestJson(path, {method: "DELETE"});
        showToast(result.msg || "Deleted");
        refresh();
    } catch (error) {
        showToast(error.message, true);
    }
}

function downloadReport(format) {
    const rows = window.reportRows || [];
    const csv = rowsToCsv(rows);
    if (format === "excel") {
        downloadBlob(csv, `sales-report-${Date.now()}.xls`, "application/vnd.ms-excel");
    } else {
        downloadBlob(csv, `sales-report-${Date.now()}.csv`, "text/csv");
    }
}

// Company and users
async function loadSettings() {
    const s = await loadSettingsCache();
    company_name.value = s.company_name || "";
    company_address.value = s.address || "";
    company_gst.value = s.gst_number || "";
    company_phone.value = s.phone || "";
    company_email.value = s.email || "";
    companyLogoPreview.src = s.logo || "";
}

async function saveSettings() {
    const logo = await fileToDataUrl(company_logo) || companySettings.logo || "";
    await requestJson("/settings/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            company_name: company_name.value,
            address: company_address.value,
            gst_number: company_gst.value,
            phone: company_phone.value,
            email: company_email.value,
            logo
        })
    });
    showToast("Company profile saved");
    loadSettings();
}

async function loadUsers() {
    if (currentUser?.role !== "admin") {
        renderTable(userTable, ["Access"], [["Only admin users can manage access."]]);
        return;
    }
    const users = await requestJson("/users/");
    renderTable(userTable, ["Name", "Username", "Role", "Permissions"], users.map(u => [u.name, u.username, u.role, u.permissions]));
}

async function addUser() {
    try {
        await requestJson("/users/", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name: u_name.value, username: u_username.value, password: u_password.value, role: u_role.value, permissions: u_permissions.value})
        });
        showToast("User added");
        loadUsers();
    } catch (error) { showToast(error.message, true); }
}

// Documents
function buildDraftDocument(type) {
    const isQuote = type === "quotation";
    const rows = isQuote ? quoteItemsDraft : invoiceItems;
    const customerSelect = isQuote ? quote_customer : invoice_customer;
    const generator = isQuote ? quote_generator.value : "Invoice Generator";
    const title = isQuote ? "Quotation" : "Tax Invoice";
    const number = isQuote ? (quotation_id.value ? `Quotation Draft #${quotation_id.value}` : "Draft Quotation") : "Draft Invoice";
    const showDiscountColumn = rows.some(item => item.showDiscount && Number(item.discount || 0) > 0);
    let total = 0;
    let gst = 0;
    const itemRows = rows.map(item => {
        const rate = discountedPrice(item);
        const line = rate * Number(item.quantity);
        const tax = line * Number(item.gst_percent) / 100;
        const cgst = tax / 2;
        const sgst = tax / 2;
        total += line;
        gst += tax;
        const discountCell = showDiscountColumn ? `<td>${item.discount || 0}%</td>` : "";
        return `<tr>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${escapeHtml(item.hsn_code || "")}</td>
            <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || "")}</td>
            <td>${money(item.price)}</td>
            ${discountCell}
            <td>${money(line)}</td>
            <td>${money(cgst)}</td>
            <td>${money(sgst)}</td>
            <td>${money(line + tax)}</td>
        </tr>`;
    }).join("");
    const discountHeader = showDiscountColumn ? "<th>Disc</th>" : "";
    const totalColSpan = showDiscountColumn ? 5 : 4;
    return `
        <div class="document branded-document">
            <div class="doc-ribbon"></div>
            <div class="doc-head">
                <div>
                    ${companySettings.logo ? `<img class="doc-logo" src="${companySettings.logo}" alt="">` : ""}
                    <h2>${escapeHtml(companySettings.company_name || "Your Company Name")}</h2>
                    <p>${escapeHtml(companySettings.address || "")}</p>
                    <p>GST: ${escapeHtml(companySettings.gst_number || "")}</p>
                    <p>${escapeHtml(companySettings.phone || "")} ${escapeHtml(companySettings.email || "")}</p>
                </div>
                <div class="doc-title">
                    <h2>${title}</h2>
                    <p>${escapeHtml(number)}</p>
                    <p>Date: ${new Date().toLocaleDateString("en-IN")}</p>
                    <p>Generated By: ${escapeHtml(generator)}</p>
                </div>
            </div>
            <div class="doc-grid">
                <div><strong>Bill To</strong><p>${escapeHtml(customerSelect.selectedOptions[0]?.textContent || "")}</p></div>
                <div><strong>Terms</strong><p>Prices are in INR. GST extra as shown. Valid for 15 days.</p></div>
            </div>
            <table class="doc-table">
                <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th>${discountHeader}<th>Taxable</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
                <tbody>${itemRows}</tbody>
                <tfoot>
                    <tr><td colspan="${totalColSpan}">Subtotal</td><td>${money(total)}</td><td>${money(gst / 2)}</td><td>${money(gst / 2)}</td><td>${money(total + gst)}</td></tr>
                    <tr><td colspan="${totalColSpan + 3}">Grand Total</td><td>${money(total + gst)}</td></tr>
                </tfoot>
            </table>
            <div class="doc-grid">
                <div><strong>Bank / UPI</strong><p>Add UPI QR or bank details in company notes.</p></div>
                <div><strong>Summary</strong><p>Taxable: ${money(total)}<br>GST: ${money(gst)}<br>Grand Total: ${money(total + gst)}</p></div>
            </div>
            <div class="sign-row single"><div class="sign-box">Company Seal & Authorized Signature</div></div>
        </div>`;
}

function currentDocumentRows(type) {
    const rows = type === "quotation" ? quoteItemsDraft : invoiceItems;
    return rows.map(item => {
        const taxable = discountedPrice(item) * Number(item.quantity);
        const gstAmount = taxable * Number(item.gst_percent) / 100;
        return {
            item: item.product_name,
            hsn: item.hsn_code || "",
            quantity: item.quantity,
            unit: item.unit || "",
            rate: item.price,
            discount_percent: item.discount || 0,
            taxable,
            gst_percent: item.gst_percent,
            total: taxable + gstAmount
        };
    });
}

async function previewDocument(type) {
    await loadSettingsCache();
    previewContent.innerHTML = buildDraftDocument(type);
    documentPreview.classList.remove("hidden");
}

function closePreview() {
    documentPreview.classList.add("hidden");
}

async function downloadDocument(type, format) {
    await loadSettingsCache();
    const html = buildDraftDocument(type);
    if (format === "pdf") {
        const win = window.open("", "_blank");
        win.document.write(`<html><head><title>${type}</title><link rel="stylesheet" href="css/style.css"></head><body>${html}<script>window.print()</script></body></html>`);
        win.document.close();
        return;
    }
    if (format === "word") {
        downloadBlob(`<html><body>${html}</body></html>`, `${type}-${Date.now()}.doc`, "application/msword");
        return;
    }
    if (format === "html") {
        downloadBlob(`<html><body>${html}</body></html>`, `${type}-${Date.now()}.html`, "text/html");
        return;
    }
    const rows = currentDocumentRows(type);
    if (format === "json") {
        downloadBlob(JSON.stringify(rows, null, 2), `${type}-${Date.now()}.json`, "application/json");
        return;
    }
    const csv = rowsToCsv(rows);
    if (format === "excel") {
        downloadBlob(csv, `${type}-${Date.now()}.xls`, "application/vnd.ms-excel");
        return;
    }
    downloadBlob(csv, `${type}-${Date.now()}.csv`, "text/csv");
}

if (currentUser) {
    loginModal.classList.add("hidden");
    applyPermissions();
    loadDashboard().catch(error => showToast(error.message, true));
} else {
    loginModal.classList.remove("hidden");
}

quote_show_discount.addEventListener("change", () => {
    quote_discount_wrap.classList.toggle("hidden", !quote_show_discount.checked);
});

invoice_show_discount.addEventListener("change", () => {
    invoice_discount_wrap.classList.toggle("hidden", !invoice_show_discount.checked);
});
