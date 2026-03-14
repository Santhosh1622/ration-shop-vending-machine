// ─────────────────── Toast ───────────────────
function showToast(message, type = "error") {
    const toast = document.getElementById("toast");
    const icon  = document.getElementById("toastIcon");
    const msg   = document.getElementById("toastMsg");
    if (!toast || !msg) return;

    toast.className = `toast ${type}`;
    icon.textContent = type === "success" ? "✓" : "✕";
    msg.textContent = message;
    toast.classList.add("visible");

    setTimeout(() => toast.classList.remove("visible"), 4000);
}

// ─────────────────── Auth guard ───────────────────
(function checkAuth() {
    const raw = sessionStorage.getItem("vm_auth");
    if (!raw) {
        window.location.href = "/login.html";
        return;
    }

    try {
        const auth = JSON.parse(raw);
        if (!auth.username) throw new Error("no username");

        // Populate UI with username
        const userNameEl = document.getElementById("userName");
        const avatarEl = document.getElementById("avatarInitial");
        const avatarImgEl = document.getElementById("avatarImage");
        const loginTimeEl = document.getElementById("loginTime");

        if (userNameEl) userNameEl.textContent = auth.username;

        // Profile image or initial
        if (auth.profileImage && avatarImgEl) {
            avatarImgEl.src = auth.profileImage;
            avatarImgEl.style.display = "block";
            if (avatarEl) avatarEl.style.display = "none";
        } else if (avatarEl) {
            avatarEl.textContent = auth.username.charAt(0).toUpperCase();
        }

        // Login time
        if (auth.loggedInAt && loginTimeEl) {
            const d = new Date(auth.loggedInAt);
            loginTimeEl.textContent =
                d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " today";
        }
    } catch {
        sessionStorage.removeItem("vm_auth");
        window.location.href = "/login.html";
    }
})();

// ─────────────────── Logout ───────────────────
function handleLogout() {
    sessionStorage.removeItem("vm_auth");
    window.location.href = "/login.html";
}

// ─────────────────── Mobile sidebar toggle ───────────────────
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("visible");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("visible");
}

// ─────────────────── Tab Switching ───────────────────
function switchTab(viewId, btnElement) {
    // Hide all views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active-view');
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show the selected view
    const selectedView = document.getElementById(viewId);
    if (selectedView) {
        selectedView.style.display = 'block';
        selectedView.classList.add('active-view');
    }

    // Add active class back to clicked button
    if (btnElement) {
        btnElement.classList.add('active');
    }

    // Programmer Portal specific check
    if (viewId === 'programmer-view') {
        updateProgrammerView();
    }

    // E-Smart Card specific check
    if (viewId === 'smartcard-view') {
        renderSmartCardView();
    }
    
    // Allocated Grains specific check
    if (viewId === 'allocated-view') {
        updateGrainsStatus();
    }

    // Update Page Title
    const titleElement = document.getElementById('pageTitle');
    if (titleElement && btnElement) {
        // Remove emoji and trim
        const rawText = btnElement.textContent || btnElement.innerText;
        titleElement.textContent = rawText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    }

    // Close sidebar on mobile after click
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}
// ─────────────────── Admin Mode Logic ───────────────────
let isAdminMode = false;

function showAdminLogin() {
    document.getElementById("adminModal").classList.add("active");
}

function closeAdminModal() {
    document.getElementById("adminModal").classList.remove("active");
    // Clear inputs
    document.getElementById("adminUser").value = "";
    document.getElementById("adminPass").value = "";
}

function processAdminLogin() {
    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    // Standard admin check as per plan
    if (user === "admin" && pass === "admin123") {
        enterAdminMode();
        closeAdminModal();
        showToast("Logged in as Administrator", "success");
    } else {
        showToast("Invalid admin credentials", "error");
    }
}

function enterAdminMode() {
    isAdminMode = true;
    document.body.classList.add("admin-mode");
    document.getElementById("adminLoginBtn").innerHTML = '<span class="nav-icon">🔓</span> Exit Admin';
    document.getElementById("adminLoginBtn").onclick = exitAdminMode;
    document.getElementById("adminLoginBtn").style.color = "var(--success)";
    
    // Enable table editing
    document.querySelectorAll(".editable-cell").forEach(cell => {
        cell.contentEditable = "true";
    });
}

function exitAdminMode() {
    isAdminMode = false;
    document.body.classList.remove("admin-mode");
    document.getElementById("adminLoginBtn").innerHTML = '<span class="nav-icon">🛡️</span> Admin Login';
    document.getElementById("adminLoginBtn").onclick = showAdminLogin;
    document.getElementById("adminLoginBtn").style.color = "var(--warning)";
    
    // Disable table editing
    document.querySelectorAll(".editable-cell").forEach(cell => {
        cell.contentEditable = "false";
    });
    
    showToast("Exited Admin Mode", "info");
}

// ─────────────────── Data Management ───────────────────
// Load saved values on init
document.addEventListener("DOMContentLoaded", () => {
    loadLiveValues();
});

async function loadLiveValues() {
    try {
        // Load Chamber weights from server
        const stockRes = await fetch("/api/stock");
        const stock = await stockRes.json();
        
        if (stock) {
            const weights = { rice: stock.rice + " KG", wheat: stock.wheat + " KG", sugar: stock.sugar + " KG" };
            Object.keys(weights).forEach(id => {
                const span = document.querySelector(`[data-chamber="${id}"]`);
                if (span) span.textContent = weights[id];
                const input = span ? span.parentElement.querySelector('.edit-input') : null;
                if (input) input.value = weights[id];
            });
        }

        // Render logs and collections
        renderStockHistory();
        renderUserCollections();
        
        if (typeof updateGrainsStatus === "function") {
            updateGrainsStatus();
        }
    } catch (err) { console.error("Load Error:", err); }
}

async function saveChamberValue(id, value) {
    try {
        const numValue = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
        const res = await fetch("/api/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [id]: numValue })
        });
        
        if (res.ok) {
            const span = document.querySelector(`[data-chamber="${id}"]`);
            if (span) span.textContent = numValue + " KG";
            showToast(`Updated ${id} availability`, "success");
        }
    } catch (err) { showToast("Update Failed", "error"); }
}

async function renderStockHistory() {
    const tableBody = document.querySelector("#stockHistoryTable tbody");
    if (!tableBody) return;
    
    try {
        const res = await fetch("/api/logs");
        const logs = await res.json();
        const history = logs.filter(l => l.type === "STOCK_UPDATE");
        
        tableBody.innerHTML = "";
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">No entries yet.</td></tr>';
            return;
        }
        
        history.forEach(entry => {
            const d = new Date(entry.timestamp);
            const timeStr = d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${timeStr}</td>
                <td class="font-bold" style="color: var(--success);">${entry.details.rice !== undefined ? entry.details.rice + ' KG' : '-'}</td>
                <td class="font-bold" style="color: var(--warning);">${entry.details.wheat !== undefined ? entry.details.wheat + ' KG' : '-'}</td>
                <td class="font-bold" style="color: var(--accent);">${entry.details.sugar !== undefined ? entry.details.sugar + ' KG' : '-'}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) { console.error("Load History Error:", err); }
}

async function addStockEntry() {
    const riceAdd = parseFloat(document.getElementById("entryRice")?.value) || 0;
    const wheatAdd = parseFloat(document.getElementById("entryWheat")?.value) || 0;
    const sugarAdd = parseFloat(document.getElementById("entrySugar")?.value) || 0;
    
    if (riceAdd === 0 && wheatAdd === 0 && sugarAdd === 0) {
        showToast("Please enter at least one value", "warning");
        return;
    }

    try {
        // Get current stock
        const stockRes = await fetch("/api/stock");
        const current = await stockRes.json();
        
        const payload = {
            rice: (current.rice || 0) + riceAdd,
            wheat: (current.wheat || 0) + wheatAdd,
            sugar: (current.sugar || 0) + sugarAdd
        };

        const res = await fetch("/api/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            loadLiveValues(); // Refresh UI
            // Clear inputs
            if(document.getElementById("entryRice")) document.getElementById("entryRice").value = "";
            if(document.getElementById("entryWheat")) document.getElementById("entryWheat").value = "";
            if(document.getElementById("entrySugar")) document.getElementById("entrySugar").value = "";
            showToast("Stock levels updated successfully!", "success");
        }
    } catch (err) { showToast("Update Failed", "error"); }
}

// ─────────────────── User Collection Log ───────────────────
async function renderUserCollections() {
    const tableBody = document.querySelector("#userCollectionTable tbody");
    if (!tableBody) return;
    
    try {
        const res = await fetch("/api/logs");
        const logs = await res.json();
        const collections = logs.filter(l => l.type === "COLLECTION");
        
        tableBody.innerHTML = "";
        if (collections.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px;">No collections recorded today.</td></tr>';
            return;
        }
        
        collections.forEach(entry => {
            const d = new Date(entry.timestamp);
            const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${timeStr}</td>
                <td class="font-bold">${entry.details.name || '-'}</td>
                <td>${entry.details.rationId || '-'}</td>
                <td style="color: var(--success); font-weight: 600;">${entry.details.rice || 0} Kg</td>
                <td style="color: var(--warning); font-weight: 600;">${entry.details.wheat || 0} Kg</td>
                <td style="color: var(--accent); font-weight: 600;">${entry.details.sugar || 0} Kg</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) { console.error("Load Collections Error:", err); }
}

async function downloadCollectionExcel() {
    try {
        const res = await fetch("/api/logs");
        const logs = await res.json();
        const collections = logs.filter(l => l.type === "COLLECTION");
        
        if (collections.length === 0) {
            showToast("No data to download", "warning");
            return;
        }
        
        // CSV Header
        let csvContent = "Time,Name,Ration ID,Rice Collected,Wheat Collected,Sugar Collected\n";
        
        // CSV Rows
        collections.forEach(entry => {
            const d = new Date(entry.timestamp);
            const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            let r = [
                `"${timeStr}"`,
                `"${entry.details.name || ''}"`,
                `"${entry.details.rationId || ''}"`,
                `"${entry.details.rice || 0}"`,
                `"${entry.details.wheat || 0}"`,
                `"${entry.details.sugar || 0}"`
            ];
            csvContent += r.join(",") + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `RVSM_Collections_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Download started", "success");
    } catch (err) { showToast("Download Failed", "error"); }
}

// ─────────────────── Storage Sync ───────────────────
// Listen for cross-tab updates (e.g. User Website modifying collection log)
window.addEventListener("storage", (e) => {
    if (e.key === "rvsm_user_collections") {
        renderUserCollections();
    }
});

// ─────────────────── Helper: Toast ───────────────────
function showToast(msg, type = "info") {
    // Check if generic toast exists or use dashboard specific one if available
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.className = `toast visible ${type}`;
    setTimeout(() => toast.classList.remove("visible"), 3000);
}

// ─────────────────── Programmer Portal: Auth Logic ───────────────────
let isProgrammerAuth = sessionStorage.getItem("prog_auth") === "true";

function updateProgrammerView() {
    const loginScreen = document.getElementById("programmer-login-screen");
    const mainContent = document.getElementById("programmer-main-content");
    
    if (isProgrammerAuth) {
        if (loginScreen) loginScreen.style.display = "none";
        if (mainContent) mainContent.style.display = "block";
    } else {
        if (loginScreen) loginScreen.style.display = "block";
        if (mainContent) mainContent.style.display = "none";
        resetProgrammerLogin();
    }
}

function resetProgrammerLogin() {
    const step1 = document.getElementById("prog_login_step1");
    const step2 = document.getElementById("prog_login_step2");
    const msg = document.getElementById("prog_auth_msg");
    
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
    if (msg) msg.textContent = "";
}

async function requestWhatsAppOTP() {
    const mobileField = document.getElementById("prog_auth_mobile");
    const mobile = mobileField ? mobileField.value.trim() : "";
    const msgEl = document.getElementById("prog_auth_msg");
    
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        if (msgEl) {
            msgEl.textContent = "Enter valid 10-digit number";
            msgEl.style.color = "var(--error)";
        }
        return;
    }

    if (msgEl) {
        msgEl.textContent = "Generating code...";
        msgEl.style.color = "var(--text-primary)";
    }

    try {
        const res = await fetch("/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mobile })
        });
        const data = await res.json();
        
        if (res.ok) {
            // Simulate WhatsApp auto-generation with the UNIQUE code from server
            const otpCode = data.otp || "123456"; 
            const waMsg = `Hello! Your RVSM Programmer Portal authentication code is: ${otpCode}. Please use this to unlock the portal. (Valid for 5 mins)`;
            const waUrl = `https://wa.me/91${mobile}?text=${encodeURIComponent(waMsg)}`;
            
            if (msgEl) {
                msgEl.innerHTML = `Code generated! <a href="${waUrl}" target="_blank" style="color:var(--accent); text-decoration:underline;">Send from 9361892848</a><br><small style="color:var(--warning);">Expires in 5 minutes</small>`;
                msgEl.style.color = "var(--success)";
            }
            
            // Move to step 2
            document.getElementById("prog_login_step1").style.display = "none";
            document.getElementById("prog_login_step2").style.display = "block";
        } else {
            if (msgEl) {
                msgEl.textContent = data.message;
                msgEl.style.color = "var(--error)";
            }
        }
    } catch {
        if (msgEl) {
            msgEl.textContent = "Server Connection Error";
            msgEl.style.color = "var(--error)";
        }
    }
}

async function verifyProgrammerAccess() {
    const mobileEl = document.getElementById("prog_auth_mobile");
    const otpEl = document.getElementById("prog_auth_otp");
    const mobile = mobileEl ? mobileEl.value.trim() : "";
    const otp = otpEl ? otpEl.value.trim() : "";
    const msgEl = document.getElementById("prog_auth_msg");

    try {
        const res = await fetch("/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mobile, otp })
        });
        
        if (res.ok) {
            isProgrammerAuth = true;
            sessionStorage.setItem("prog_auth", "true");
            showToast("Programmer Portal Unlocked", "success");
            updateProgrammerView();
        } else {
            if (msgEl) {
                msgEl.textContent = "Invalid Code. Try again.";
                msgEl.style.color = "var(--error)";
            }
        }
    } catch {
        if (msgEl) {
            msgEl.textContent = "Verification Failed";
            msgEl.style.color = "var(--error)";
        }
    }
}

function logoutProgrammer() {
    isProgrammerAuth = false;
    sessionStorage.removeItem("prog_auth");
    showToast("Portal Locked", "info");
    updateProgrammerView();
}

// Ensure view is correct on load
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("programmer-view")) {
        updateProgrammerView();
    }
});

// ─────────────────── Ration Card Logic ───────────────────

function generateRationId() {
    const prefix = "TN";
    const random = Math.floor(1000 + Math.random() * 9000); // 4 digits
    const id = `${prefix}-${random}`;
    
    // Ensure uniqueness
    const rations = JSON.parse(localStorage.getItem("rvsm_rations") || "{}");
    if (rations[id]) return generateRationId();
    return id;
}

async function createRationCard() {
    const name = document.getElementById("reg_name").value.trim();
    const parent = document.getElementById("reg_parent").value.trim();
    const dob = document.getElementById("reg_dob").value;
    const mobile = document.getElementById("reg_mobile").value.trim();
    const address = document.getElementById("reg_address").value.trim();
    const membersRaw = document.getElementById("reg_members").value;
    const members = membersRaw ? membersRaw.split(",").map(m => m.trim()).filter(m => m !== "") : [];
    const rice = parseFloat(document.getElementById("reg_rice").value) || 0;
    const wheat = parseFloat(document.getElementById("reg_wheat").value) || 0;
    const sugar = parseFloat(document.getElementById("reg_sugar").value) || 0;

    if (!name || !mobile || !dob || !address) {
        showToast("Please fill all mandatory fields", "error");
        return;
    }

    if (!/^\d{10}$/.test(mobile)) {
        showToast("Enter valid 10-digit mobile number", "error");
        return;
    }

    const id = generateRationId();
    const rationData = {
        rationId: id,
        name,
        parentName: parent || "N/A",
        dob,
        mobile,
        address,
        members,
        quota: { rice, wheat, sugar }
    };

    try {
        const res = await fetch("/api/rations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rationData)
        });

        if (res.ok) {
            showToast(`Ration Card ${id} created for ${name}`, "success");
            // Clear form
            ["reg_name", "reg_parent", "reg_dob", "reg_mobile", "reg_address", "reg_members", "reg_rice", "reg_wheat", "reg_sugar"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
        } else {
            const err = await res.json();
            showToast(err.message || "Failed to create Ration Card", "error");
        }
    } catch (err) { showToast("Network Error", "error"); }
}

async function renderSmartCardView() {
    const noCardMsg = document.getElementById("noCardMsg");
    const cardDetailsContainer = document.getElementById("cardDetailsContainer");
    
    // Show loading or clear old
    if (cardDetailsContainer) cardDetailsContainer.style.display = "none";
    if (noCardMsg) noCardMsg.style.display = "none";

    if (!data) {
        if (noCardMsg) {
            const auth = JSON.parse(sessionStorage.getItem("vm_auth") || "{}");
            const mobile = auth.phone || "Unknown";
            noCardMsg.innerHTML = `
                <p style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 10px;">No ration card linked to: <b>${mobile}</b></p>
                <p style="font-size: 0.9rem; margin-bottom: 25px;">Please verify this matches the number used during registration.</p>
                <button class="btn-outline admin-only" onclick="switchTab('ration-registration', document.querySelector('[onclick*=\\\'ration-registration\\\']'))" style="margin-top: 20px; border-color: var(--warning); color: var(--warning);">Register Ration Card</button>
            `;
            noCardMsg.style.display = "block";
        }
        return;
    }

    if (cardDetailsContainer) cardDetailsContainer.style.display = "block";

    // Update Hidden Template
    if (document.getElementById("card_head")) document.getElementById("card_head").textContent = data.name;
    if (document.getElementById("card_parent")) document.getElementById("card_parent").textContent = data.parentName || "N/A";
    if (document.getElementById("card_dob")) document.getElementById("card_dob").textContent = data.dob || "N/A";
    if (document.getElementById("card_addr")) document.getElementById("card_addr").textContent = data.address || "N/A";
    if (document.getElementById("card_ration_id")) document.getElementById("card_ration_id").textContent = data.rationId;

    const membersList = document.getElementById("card_members_list");
    if (membersList) {
        membersList.innerHTML = "";
        (data.members || []).forEach((m, idx) => {
            const li = document.createElement("li");
            li.textContent = `Member ${idx + 1}: ${m}`;
            membersList.appendChild(li);
        });
    }

    // Generate QR in template
    const qrEl = document.getElementById("card_qrcode");
    if (qrEl) {
        qrEl.innerHTML = "";
        new QRCode(qrEl, {
            text: data.rationId,
            width: 85,
            height: 85,
            colorDark : "#2e7d32",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }

    // Mirror to visual preview (slightly delayed to ensure QR is rendered)
    setTimeout(() => {
        const preview = document.getElementById("visualCardPreview");
        if (preview) {
            preview.innerHTML = "";
            const designTemplate = document.getElementById("smartCardDesign");
            if (designTemplate) {
                const clone = designTemplate.cloneNode(true);
                preview.appendChild(clone);
            }
        }
    }, 200);
}

async function fetchUserRationData() {
    const auth = JSON.parse(sessionStorage.getItem("vm_auth") || "{}");
    const mobile = auth.phone ? auth.phone.toString().trim() : "";
    console.log(`[CLIENT-DEBUG] Attempting to fetch ration for mobile: "${mobile}"`);
    
    if (!mobile) {
        console.warn("[CLIENT-DEBUG] No mobile found in session!");
        return null;
    }

    try {
        const res = await fetch(`/api/rations/mobile/${mobile}`);
        if (res.ok) {
            const data = await res.json();
            console.log("[CLIENT-DEBUG] Ration data received:", data);
            return data;
        } else {
            console.warn(`[CLIENT-DEBUG] Server returned ${res.status} for ${mobile}`);
        }
    } catch (err) { console.error("[CLIENT-DEBUG] Fetch Error:", err); }
    return null;
}

async function updateGrainsStatus() {
    const data = await fetchUserRationData();
    const tableBody = document.querySelector("#allocated-view .grains-table tbody");
    if (!tableBody || !data) return;

    const quota = data.quota || { rice: 0, wheat: 0, sugar: 0 };
    const coll = data.collected || { rice: 0, wheat: 0, sugar: 0 };
    
    const pend = {
        rice: Math.max(0, quota.rice - coll.rice),
        wheat: Math.max(0, quota.wheat - coll.wheat),
        sugar: Math.max(0, quota.sugar - coll.sugar)
    };

    const fmt = (n) => (n % 1 === 0 ? n.toString() : n.toFixed(1)) + " Kg";

    tableBody.innerHTML = `
        <tr>
            <td class="font-bold">Allocated</td>
            <td>${fmt(quota.rice)}</td>
            <td>${fmt(quota.wheat)}</td>
            <td>${fmt(quota.sugar)}</td>
        </tr>
        <tr>
            <td class="font-bold border-bottom">Collected</td>
            <td class="border-bottom">${fmt(coll.rice)}</td>
            <td class="border-bottom">${fmt(coll.wheat)}</td>
            <td class="border-bottom">${fmt(coll.sugar)}</td>
        </tr>
        <tr>
            <td class="font-bold">Pending</td>
            <td style="color:var(--accent); font-weight:700;">${fmt(pend.rice)}</td>
            <td style="color:var(--accent); font-weight:700;">${fmt(pend.wheat)}</td>
            <td style="color:var(--accent); font-weight:700;">${fmt(pend.sugar)}</td>
        </tr>
    `;
    
    // Update legend highlights
    const totalAlloc = quota.rice + quota.wheat + quota.sugar;
    const totalColl = coll.rice + coll.wheat + coll.sugar;
    
    const elCollected = document.getElementById("statusCollected");
    const elPartial = document.getElementById("statusPartial");
    const elNotCollected = document.getElementById("statusNotCollected");
    
    [elCollected, elPartial, elNotCollected].forEach(el => { if(el) { el.style.opacity = "0.4"; el.style.fontWeight = "normal"; } });

    if (totalColl >= totalAlloc && totalAlloc > 0) {
        if(elCollected) { elCollected.style.opacity = "1"; elCollected.style.fontWeight = "bold"; }
    } else if (totalColl > 0) {
        if(elPartial) { elPartial.style.opacity = "1"; elPartial.style.fontWeight = "bold"; }
    } else {
        if(elNotCollected) { elNotCollected.style.opacity = "1"; elNotCollected.style.fontWeight = "bold"; }
    }
}

/** Bulletproof Iframe Export System v7.0 (2026-03-14) **/
function triggerDownload(base64Data, filename, contentType) {
    // 1. Ensure hidden iframe exists for download target
    let downloadIframe = document.getElementById("hiddenDownloadIframe");
    if (!downloadIframe) {
        downloadIframe = document.createElement("iframe");
        downloadIframe.id = "hiddenDownloadIframe";
        downloadIframe.name = "hiddenDownloadIframe";
        downloadIframe.style.display = "none";
        document.body.appendChild(downloadIframe);
    }

    // 2. Clear old form and create a fresh one
    const oldForm = document.getElementById("hiddenDownloadForm");
    if (oldForm) oldForm.parentNode.removeChild(oldForm);

    const form = document.createElement("form");
    form.id = "hiddenDownloadForm";
    form.method = "POST";
    form.action = "/api/download-helper";
    form.target = "hiddenDownloadIframe";
    form.style.display = "none";

    // 3. Add fields
    const data = { filename, base64Data, contentType };
    for (const key in data) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = data[key];
        form.appendChild(input);
    }

    // 4. Submit
    document.body.appendChild(form);
    form.submit();
    
    return true; 
}

async function downloadSmartCardPDF() {
    const preview = document.getElementById("visualCardPreview");
    const rationIdEl = document.getElementById("card_ration_id");
    const rationId = rationIdEl ? rationIdEl.textContent.trim() : "TN-XXXX";

    if (!preview || !preview.firstElementChild) {
        showToast("Card data not ready. Please refresh.", "error");
        return;
    }

    const card = preview.firstElementChild;
    const safeName = `Ration_Card_${rationId.replace("-", "_")}.pdf`;
    showToast("Preparing Official PDF...", "info");

    try {
        const canvas = await html2canvas(card, {
            scale: 1.5, 
            useCORS: true,
            backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        pdf.setFillColor(46, 125, 50);
        pdf.rect(0, 0, pageWidth, 40, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(22); pdf.setFont("helvetica", "bold");
        pdf.text("E-SMART FAMILY CARD", pageWidth / 2, 18, { align: "center" });
        pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
        pdf.text("CIVIL SUPPLIES AND CONSUMER PROTECTION DEPARTMENT", pageWidth / 2, 26, { align: "center" });
        pdf.text("GOVERNMENT OF TAMIL NADU", pageWidth / 2, 31, { align: "center" });

        const margin = 20;
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (card.offsetHeight * imgWidth) / card.offsetWidth;
        pdf.addImage(imgData, 'JPEG', margin, 60, imgWidth, imgHeight);

        const lineY = 60 + imgHeight + 20;
        pdf.setDrawColor(46, 125, 50); pdf.setLineWidth(0.5);
        pdf.line(margin, lineY, pageWidth - margin, lineY);
        pdf.setTextColor(0); pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
        pdf.text("OFFICIAL VERIFICATION", margin, lineY + 10);
        pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
        pdf.text(`Ration Card Number : ${rationId}`, margin, lineY + 18);
        pdf.text(`Generated On        : ${new Date().toLocaleString()}`, margin, lineY + 24);
        
        pdf.setFontSize(8); pdf.setTextColor(100);
        pdf.text("Note: This is an electronically generated official document.", pageWidth / 2, 280, { align: "center" });

        const pdfBase64 = pdf.output('datauristring');
        const success = await triggerDownload(pdfBase64, safeName, "application/pdf");
        
        if (success) {
            showToast("Official PDF Saved!", "success");
        } else {
            pdf.save(safeName); 
            showToast("Saved (Client Fallback)", "info");
        }
    } catch (err) {
        console.error("PDF Export Error:", err);
        showToast("Error generating PDF", "error");
    }
}

async function downloadSmartCardImage() {
    const preview = document.getElementById("visualCardPreview");
    const rationIdEl = document.getElementById("card_ration_id");
    const rationId = rationIdEl ? rationIdEl.textContent.trim() : "TN-XXXX";

    if (!preview || !preview.firstElementChild) {
        showToast("Card data not ready.", "error");
        return;
    }

    const card = preview.firstElementChild;
    const safeName = `Ration_Card_${rationId.replace("-", "_")}.jpg`;
    showToast("Preparing Card Image...", "info");

    try {
        const canvas = await html2canvas(card, { 
            scale: 1.5, 
            useCORS: true, 
            backgroundColor: "#ffffff" 
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const success = await triggerDownload(imgData, safeName, "image/jpeg");
        
        if (success) {
            showToast("Card Image Saved!", "success");
        } else {
            const link = document.createElement('a');
            link.href = imgData;
            link.download = safeName;
            link.click();
            showToast("Saved (Client Fallback)", "info");
        }
    } catch (err) {
        console.error("Image Export Error:", err);
        showToast("Error creating image", "error");
    }
}


