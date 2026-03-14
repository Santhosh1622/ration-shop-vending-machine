// ─────────────────── Toast ───────────────────
function showToast(message, type = "error") {
    const toast = document.getElementById("toast");
    const icon = document.getElementById("toastIcon");
    const msg = document.getElementById("toastMsg");
    if (!toast || !msg) return;

    toast.className = `toast ${type}`;
    icon.textContent = type === "success" ? "✓" : "✕";
    msg.textContent = message;
    toast.classList.add("visible");

    setTimeout(() => toast.classList.remove("visible"), 4000);
}

// ─────────────────── Loading state ───────────────────
function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.classList.add("loading");
        btn.disabled = true;
    } else {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

// ─────────────────── Toggle Password Visibility ───────────────────
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
    }
}

// ═══════════════════════════════════════════════════
//  LOGIN PAGE LOGIC
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
//  LOGIN PAGE LOGIC
// ═══════════════════════════════════════════════════
function toggleLoginMode(mode) {
    const credSection = document.getElementById("credentials-section");
    const otpSection = document.getElementById("otp-section");
    const statusMsg = document.getElementById("otp-status-msg");

    if (mode === "otp") {
        credSection.style.display = "none";
        otpSection.style.display = "block";
    } else {
        credSection.style.display = "block";
        otpSection.style.display = "none";
    }
    if (statusMsg) statusMsg.textContent = "";
}

async function requestMainLoginOTP() {
    const phoneInput = document.getElementById("loginPhone");
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const msgEl = document.getElementById("otp-status-msg");
    const sendBtn = document.getElementById("sendOtpBtn");

    if (!/^[6-9]\d{9}$/.test(phone)) {
        showToast("Enter a valid 10-digit phone number");
        return;
    }

    /* Local check removed - server will handle this */

    setLoading(sendBtn, true);
    if (msgEl) {
        msgEl.textContent = "Generating secure code...";
        msgEl.style.color = "var(--text-primary)";
    }

    try {
        const res = await fetch("/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mobile: phone })
        });
        const data = await res.json();

        if (res.ok) {
            const otpCode = data.otp || "123456";
            const userName = data.username || "User";
            const waMsg = `RVSM Login Verification code is : ${otpCode}. (Phone: ${phone})`;
            const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(waMsg)}`;

            if (msgEl) {
                msgEl.innerHTML = `Code generated! <a href="${waUrl}" target="_blank" style="color:var(--accent); text-decoration:underline; font-weight:600;">Open WhatsApp to send code</a><br><small style="color:var(--warning);">Valid for 5 minutes</small>`;
                msgEl.style.color = "var(--success)";
            }

            document.getElementById("otp-verify-group").style.display = "block";
            setLoading(sendBtn, false);
            sendBtn.innerHTML = "Resend OTP";
        } else {
            showToast(data.message);
            setLoading(sendBtn, false);
        }
    } catch {
        showToast("Server connection failed");
        setLoading(sendBtn, false);
    }
}

async function verifyMainLoginOTP() {
    const phone = document.getElementById("loginPhone").value.trim();
    const otp = document.getElementById("loginOtp").value.trim().replace(/\s/g, '');
    const verifyBtn = document.getElementById("verifyOtpBtn");

    if (!otp) {
        showToast("Please enter the verification code");
        return;
    }

    setLoading(verifyBtn, true);

    try {
        const res = await fetch("/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mobile: phone, otp })
        });
        const data = await res.json();

        if (res.ok) {
            sessionStorage.setItem("vm_auth", JSON.stringify({
                username: data.user.username,
                phone: data.user.phone,
                profileImage: data.user.profileImage || "",
                loggedInAt: new Date().toISOString()
            }));

            showToast("Login Successful! Welcome, " + data.user.username, "success");
            setTimeout(() => {
                window.location.href = "/dashboard.html";
            }, 800);
        } else {
            showToast(data.message);
            setLoading(verifyBtn, false);
        }
    } catch {
        showToast("Verification failed. Check your internet.");
        setLoading(verifyBtn, false);
    }
}

// Removed findUserByPhone (now handled server-side)

async function handleLogin() {
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const loginBtn = document.getElementById("loginBtn");
    const loginCard = document.getElementById("loginCard");

    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username) {
        loginCard.classList.add("shake");
        setTimeout(() => loginCard.classList.remove("shake"), 500);
        showToast("Please enter your username");
        usernameInput.focus();
        return;
    }

    if (!password) {
        loginCard.classList.add("shake");
        setTimeout(() => loginCard.classList.remove("shake"), 500);
        showToast("Please enter your password");
        passwordInput.focus();
        return;
    }

    setLoading(loginBtn, true);

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            // Success — save session (keep sessionStorage for non-persistent UI state)
            sessionStorage.setItem("vm_auth", JSON.stringify({
                username: data.user.username,
                phone: data.user.phone,
                profileImage: data.user.profileImage || "",
                loggedInAt: new Date().toISOString()
            }));

            showToast("Welcome back, " + data.user.username + "!", "success");

            setTimeout(() => {
                window.location.href = "/dashboard.html";
            }, 800);
        } else {
            showToast(data.message || "Login failed");
            setLoading(loginBtn, false);
            if (data.message.includes("password")) {
                passwordInput.value = "";
                passwordInput.focus();
            }
        }
    } catch (err) {
        showToast("Server connection failed");
        setLoading(loginBtn, false);
    }
}

// ═══════════════════════════════════════════════════
//  SIGNUP PAGE LOGIC
// ═══════════════════════════════════════════════════
let profileImageData = "";

function handleProfileImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Limit size to 500KB
    if (file.size > 500 * 1024) {
        showToast("Image too large. Please use an image under 500KB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        profileImageData = e.target.result;
        const img = document.getElementById("profileImg");
        const placeholder = document.getElementById("profilePlaceholder");
        if (img) {
            img.src = profileImageData;
            img.style.display = "block";
        }
        if (placeholder) {
            placeholder.style.display = "none";
        }
    };
    reader.readAsDataURL(file);
}

async function handleSignup() {
    const usernameInput = document.getElementById("signupUsername");
    const phoneInput = document.getElementById("signupPhone");
    const passwordInput = document.getElementById("signupPassword");
    const confirmInput = document.getElementById("signupConfirmPassword");
    const signupBtn = document.getElementById("signupBtn");
    const loginCard = document.getElementById("loginCard");

    if (!usernameInput || !phoneInput || !passwordInput || !confirmInput) return;

    const username = usernameInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    // Validations
    if (!username) {
        showToast("Please enter your name");
        usernameInput.focus();
        return;
    }

    if (username.length < 2) {
        showToast("Name must be at least 2 characters");
        usernameInput.focus();
        return;
    }

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        loginCard.classList.add("shake");
        setTimeout(() => loginCard.classList.remove("shake"), 500);
        showToast("Enter a valid 10-digit Indian mobile number");
        phoneInput.focus();
        return;
    }

    if (!password) {
        showToast("Please create a password");
        passwordInput.focus();
        return;
    }

    if (password.length < 4) {
        showToast("Password must be at least 4 characters");
        passwordInput.focus();
        return;
    }

    if (password !== confirmPassword) {
        loginCard.classList.add("shake");
        setTimeout(() => loginCard.classList.remove("shake"), 500);
        showToast("Passwords do not match");
        confirmInput.value = "";
        confirmInput.focus();
        return;
    }

    /* Local uniqueness check removed - server will handle this */

    setLoading(signupBtn, true);

    try {
        const res = await fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                phone,
                password,
                profileImage: profileImageData
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast("Account created! Redirecting to login…", "success");
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 1200);
        } else {
            showToast(data.message || "Signup failed");
            setLoading(signupBtn, false);
        }
    } catch (err) {
        showToast("Server connection failed");
        setLoading(signupBtn, false);
    }
}

// ─────────────────── Enter key support ───────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Login page enter key
    const loginPassword = document.getElementById("loginPassword");
    const loginUsername = document.getElementById("loginUsername");
    if (loginPassword) {
        loginPassword.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleLogin();
        });
    }
    if (loginUsername) {
        loginUsername.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                if (loginPassword) loginPassword.focus();
            }
        });
    }

    // Signup page enter key
    const signupConfirm = document.getElementById("signupConfirmPassword");
    if (signupConfirm) {
        signupConfirm.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleSignup();
        });
    }

    // Phone input — digits only
    const phoneInput = document.getElementById("signupPhone");
    if (phoneInput) {
        phoneInput.addEventListener("input", () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
        });
    }
});
