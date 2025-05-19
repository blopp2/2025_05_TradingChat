// modal.js – Steuerung für Auth-Modal (Login + Session Token)
import { login, signup, getSessionToken } from "./auth.js";

let authModal, authModalClose, authModalTitle;
let authEmail, authPassword, authSubmitBtn, authError, authToggle;
let mode = "login"; // 'login' oder 'signup'

export function openLoginModal() {
  mode = "login";
  if (!authModal) setupModal();
  resetModal();
  authModal.classList.remove("hidden");
}

// Initialisiere das Modal erst beim ersten Aufruf
function setupModal() {
  authModal = document.getElementById("auth-modal");
  authModalClose = document.getElementById("auth-modal-close");
  authModalTitle = document.getElementById("auth-modal-title");
  authEmail = document.getElementById("auth-email");
  authPassword = document.getElementById("auth-password");
  authSubmitBtn = document.getElementById("auth-submit-btn");
  authError = document.getElementById("auth-error");
  authToggle = document.getElementById("auth-toggle");

  authModalClose.addEventListener("click", () => {
    authModal.classList.add("hidden");
  });

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

      getSessionToken(); // Token validieren
      authModal.classList.add("hidden");
    } catch (error) {
      console.error("Auth Error:", error.message);
      authError.textContent =
        "❌ " + (error.message || "Authentication failed.");
    }
  });

  authToggle.addEventListener("click", (event) => {
    if (event.target.id === "switch-to-signup") {
      mode = "signup";
      resetModal();
    } else if (event.target.id === "switch-to-login") {
      mode = "login";
      resetModal();
    }
  });
}

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
