// modal.js – Steuerung für Auth-Modal (Login + Registrierung)

document.addEventListener("DOMContentLoaded", () => {
  const authModal = document.getElementById("auth-modal");
  const authModalClose = document.getElementById("auth-modal-close");
  const authModalTitle = document.getElementById("auth-modal-title");
  const authEmail = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const authToggle = document.getElementById("auth-toggle");
  const authError = document.getElementById("auth-error");
  const switchToSignup = document.getElementById("switch-to-signup");

  let mode = "login"; // 'login' oder 'signup'

  // 🧩 Modal öffnen (aufrufen aus sidebar.js)
  window.openLoginModal = function () {
    mode = "login";
    resetModal();
    authModal.classList.remove("hidden");
  };

  // ✏️ Modal zurücksetzen
  function resetModal() {
    authEmail.value = "";
    authPassword.value = "";
    authError.textContent = "";
    authModalTitle.textContent = mode === "login" ? "Login" : "Sign Up";
    authSubmitBtn.textContent = mode === "login" ? "Login" : "Register";
    authToggle.innerHTML =
      mode === "login"
        ? `➡️ Need an account? <a href="#" id="switch-to-signup">Sign up</a>`
        : `⬅️ Already have an account? <a href="#" id="switch-to-login">Login</a>`;
  }

  // 🚪 Modal schließen
  authModalClose.addEventListener("click", () => {
    authModal.classList.add("hidden");
  });

  // ✅ Absenden (Login oder Signup)
  authSubmitBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) {
      authError.textContent = "❌ Please fill out all fields.";
      return;
    }

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      authModal.classList.add("hidden"); // Erfolg -> Modal schließen
    } catch (error) {
      console.error("Auth Error:", error.message);
      authError.textContent =
        "❌ " + (error.message || "Authentication failed.");
    }
  });

  // 🔄 Login <--> Signup wechseln
  authToggle.addEventListener("click", (event) => {
    if (event.target.id === "switch-to-signup") {
      mode = "signup";
    } else if (event.target.id === "switch-to-login") {
      mode = "login";
    }
    resetModal();
  });
});
