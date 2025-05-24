// modal.js – Steuerung für Auth-Modal (Login + Session Token)

import { login, signup } from "./auth.js";

let authModal, authModalClose, authModalTitle;
let authEmail, authPassword, authSubmitBtn, authError, authToggle;
let mode = "login"; // 'login' oder 'signup'

/**
 * Öffnet das Modal im Login-Modus.
 */
export function openLoginModal() {
  mode = "login";
  if (!authModal) setupModal();
  resetModal();
  authModal.classList.remove("hidden");
}

/**
 * Schließt das Modal.
 */
export function closeLoginModal() {
  if (!authModal) setupModal();
  authModal.classList.add("hidden");
}

/**
 * Initialisiert das Modal (DOM-Referenzen, Event-Handler).
 */
function setupModal() {
  authModal = document.getElementById("auth-modal");
  authModalClose = document.getElementById("auth-modal-close");
  authModalTitle = document.getElementById("auth-modal-title");
  authEmail = document.getElementById("auth-email");
  authPassword = document.getElementById("auth-password");
  authSubmitBtn = document.getElementById("auth-submit-btn");
  authError = document.getElementById("auth-error");
  authToggle = document.getElementById("auth-toggle");

  authModalClose.addEventListener("click", closeLoginModal);
  authSubmitBtn.addEventListener("click", handleAuthSubmit);
  authToggle.addEventListener("click", handleAuthToggle);
}

/**
 * Klick-Handler für den Submit-Button (Login oder Signup).
 */
async function handleAuthSubmit() {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    authError.textContent = "❌ Please fill out all fields.";
    return;
  }

  authSubmitBtn.disabled = true;
  authError.textContent = "";

  try {
    if (mode === "login") {
      await login(email, password);
    } else {
      await signup(email, password);
    }

    // Sobald erfolgreich: Modal schließen und UI benachrichtigen
    closeLoginModal();
    window.dispatchEvent(new Event("sessionStarted"));
  } catch (err) {
    console.error("Auth Error:", err.message);
    authError.textContent = "❌ " + (err.message || "Authentication failed.");
  } finally {
    authSubmitBtn.disabled = false;
  }
}

/**
 * Klick-Handler für den Link, um zwischen Login und Signup zu wechseln.
 */
function handleAuthToggle(event) {
  const targetId = event.target.id;
  if (targetId === "switch-to-signup") {
    mode = "signup";
    resetModal();
  } else if (targetId === "switch-to-login") {
    mode = "login";
    resetModal();
  }
}

/**
 * Setzt das Modal zurück auf den aktuellen Modus (Login oder Signup).
 */
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
