import { logout, getSessionToken, isLoggedIn } from "./auth.js";
import { openLoginModal, closeLoginModal } from "./modal.js";

// Proxy Endpoint
const PROXY_ENDPOINT = "https://snapchart-proxy.brightcompass.workers.dev";

window.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const logoutBtn = document.getElementById("logout-btn");
  const donateBtn = document.getElementById("donate-btn");
  const status = document.getElementById("status");
  const usageInfoEl = document.getElementById("usage-info");
  const remainingCountEl = document.getElementById("remaining-count");

  // Initial UI & Usage laden
  updateAuthUI();
  loadUsage();

  // Wenn das Panel wieder sichtbar wird → Usage neu laden
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadUsage();
    }
  });

  // Nach Login/Signup Usage neu holen
  window.addEventListener("sessionStarted", () => {
    // Modal schließen
    closeLoginModal();
    // UI und Usage updaten
    updateAuthUI();
    loadUsage();
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    logout();
    openLoginModal();
    updateAuthUI();
  });

  // Analyse starten
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

      // Session-Expired?
      if (response?.sessionExpired || response?.error === "SESSION_EXPIRED") {
        showSessionExpired();
        return;
      }

      // Erfolg
      if (response?.analysis) {
        resultEl.innerHTML = formatResponse(response.analysis);
        updateScreenshotTime();
      }
      // Limit erreicht
      else if (response?.error?.includes("limit reached")) {
        resultEl.innerHTML = `
          <div class="error">
            ❌ You've used all your free analyses.<br/>
            <button id="donate-now" class="secondary-btn">
              Buy more analyses
            </button>
          </div>
        `;
        document
          .getElementById("donate-now")
          .addEventListener("click", showDonateDialog);
      }
      // anderer Fehler
      else if (response?.error) {
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
      // ➤ sofortiger Reload nach jeder Analyse
      await loadUsage();
    }
  });

  // Donate
  donateBtn.addEventListener("click", showDonateDialog);

  // ─── Hilfsfunktionen ────────────────────────────────────────────────

  function updateAuthUI() {
    if (!isLoggedIn()) {
      openLoginModal();
      logoutBtn.style.display = "none";
    } else {
      logoutBtn.style.display = "inline-block";
    }
  }

  function showSessionExpired() {
    alert("⏳ Your session has expired – please log in again.");
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showDonateDialog() {
    window.open("https://buymeacoffee.com/brightcompass", "_blank");
  }

  async function loadUsage() {
    // UI zurücksetzen
    usageInfoEl.style.display = "none";
    remainingCountEl.textContent = "–";
    newAnalysisBtn.disabled = true;

    if (!isLoggedIn()) return;

    try {
      const token = getSessionToken();
      const res = await fetch(`${PROXY_ENDPOINT}/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch usage");

      const { analysesRemaining, waitMs } = await res.json();

      if (analysesRemaining > 0) {
        remainingCountEl.textContent = analysesRemaining;
        newAnalysisBtn.disabled = false;
        usageInfoEl.style.display = "block";
      } else {
        // Button deaktiviert, Null anzeigen
        remainingCountEl.textContent = "0";
        newAnalysisBtn.disabled = true;

        // Wartezeit in h/m
        const minutes = Math.ceil(waitMs / 60000);
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const waitText =
          (hrs > 0 ? hrs + "h " : "") + (mins > 0 ? mins + "m" : "");

        usageInfoEl.textContent = `Next reset in ${waitText || "0m"}`;
        usageInfoEl.style.display = "block";
      }
    } catch {
      remainingCountEl.textContent = "–";
    }
  }
});
