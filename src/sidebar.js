import { logout, getSessionToken, isLoggedIn } from "./auth.js";
import { openLoginModal } from "./modal.js";

window.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const logoutBtn = document.getElementById("logout-btn");
  const donateBtn = document.getElementById("donate-btn"); // <-- NEU
  const status = document.getElementById("status");

  // Auth-Init
  updateAuthUI();

  // ---- SESSION EXPIRED GLOBAL HANDLER ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "sessionExpired") {
      showSessionExpired();
      return true;
    }
  });

  // Logout handler
  logoutBtn.addEventListener("click", () => {
    logout();
    openLoginModal();
    updateAuthUI();
  });

  // Analyze this chart
  newAnalysisBtn.addEventListener("click", async () => {
    newAnalysisBtn.disabled = true;
    updateStatus("Analyzing...");
    resultEl.innerHTML = "";
    try {
      const token = getSessionToken();
      const response = await chrome.runtime.sendMessage({
        action: "analyzeChart",
        sessionToken: token,
      });

      if (response?.sessionExpired) {
        showSessionExpired();
        return;
      }

      if (response?.analysis) {
        resultEl.innerHTML = formatResponse(response.analysis);
        updateScreenshotTime();
      } else if (response?.error) {
        if (response.error === "SESSION_EXPIRED") {
          showSessionExpired();
          return;
        }
        showError(response.error);
      } else {
        showError("Unknown error");
      }
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") {
        showSessionExpired();
        return;
      }
      showError(err.message || "Proxy-Anfrage fehlgeschlagen");
    } finally {
      clearStatus();
      newAnalysisBtn.disabled = false;
    }
  });

  // ---- NEU: Donate-Button ----
  donateBtn.addEventListener("click", showDonateDialog);

  // ---- Hilfsfunktionen ----

  function updateAuthUI() {
    if (!isLoggedIn()) {
      openLoginModal();
      logoutBtn.style.display = "none";
    } else {
      logoutBtn.style.display = "inline-block";
    }
  }

  function showSessionExpired() {
    alert("⏳ Deine Sitzung ist abgelaufen – bitte erneut anmelden.");
    logout();
    openLoginModal();
    updateAuthUI();
  }

  function updateScreenshotTime() {
    const now = new Date();
    screenshotInfo.textContent = `📋 Last Screenshot: ${now.toLocaleString()}`;
  }

  function updateStatus(message) {
    status.textContent = `⌛️ ${message}`;
    status.style.display = "block";
  }

  function clearStatus() {
    status.style.display = "none";
  }

  function showError(msg) {
    resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(msg)}</div>`;
  }

  function formatResponse(text) {
    return `<div class="response">${escapeHtml(text)}</div>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ------ SPENDEN Dialog ------
  function showDonateDialog() {
    // Einfach: PayPal, Stripe-Link oder beliebige Seite öffnen
    // Ersetze den Link durch deine echte Spendenseite!
    window.open("https://buymeacoffee.com/brightcompass", "_blank");
    // Alternativ:
    // alert("Vielen Dank für deine Unterstützung! Du kannst über ... spenden.");
  }
});
