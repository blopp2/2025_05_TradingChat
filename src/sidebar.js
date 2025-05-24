import { logout, getSessionToken, isLoggedIn } from "./auth.js";
import { openLoginModal, closeLoginModal } from "./modal.js";

const PROXY_ENDPOINT = "https://snapchart-proxy.brightcompass.workers.dev";

/**
 * Wrap chrome.runtime.sendMessage in a Promise
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(response);
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const logoutBtn = document.getElementById("logout-btn");
  const donateBtn = document.getElementById("donate-btn");
  const status = document.getElementById("status");

  let countdownInterval = null;

  // Initial UI & Usage laden
  updateAuthUI();
  loadUsage();

  document.addEventListener("sessionStarted", () => {
    closeLoginModal();
    updateAuthUI();
    loadUsage();
  });

  logoutBtn.addEventListener("click", () => {
    logout();
    openLoginModal();
    updateAuthUI();
  });

  newAnalysisBtn.addEventListener("click", async () => {
    newAnalysisBtn.disabled = true;
    updateStatus("Analyzing...");
    // Nur hier löschen, nicht in loadUsage
    resultEl.innerHTML = "";

    try {
      const token = getSessionToken();
      const response = await sendMessage({
        action: "analyzeChart",
        sessionToken: token,
      });

      if (response?.sessionExpired || response?.error === "SESSION_EXPIRED") {
        showSessionExpired();
        return;
      }

      if (response?.analysis) {
        resultEl.innerHTML = formatResponse(response.analysis);
        updateScreenshotTime();
      } else if (response?.error?.includes("limit reached")) {
        showError("❌ You've used all your free analyses.");
      } else if (response?.error) {
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
      await loadUsage(); // Button-Text updaten
    }
  });

  donateBtn.addEventListener("click", showDonateDialog);

  // ─── Funktionen ───────────────────────────────────────────────────

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

  function updateStatus(msg) {
    status.textContent = `⌛️ ${msg}`;
    status.style.display = "block";
  }

  function clearStatus() {
    status.style.display = "none";
  }

  function showError(msg) {
    resultEl.innerHTML = `<div class="error">${msg}</div>`;
  }

  function formatResponse(text) {
    return `<div class="response">${escapeHtml(text)}</div>`;
  }

  function escapeHtml(str) {
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

  /**
   * Live-Countdown im Button starten (grau, disabled)
   */
  function startButtonCountdown(waitMs) {
    clearInterval(countdownInterval);
    let remaining = waitMs;
    newAnalysisBtn.disabled = true;

    countdownInterval = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        resetAnalysisButton();
        loadUsage();
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        newAnalysisBtn.textContent = `Next in ${mins}m ${secs}s`;
      }
    }, 1000);
  }

  function resetAnalysisButton() {
    newAnalysisBtn.disabled = false;
    newAnalysisBtn.textContent = "Analyze this chart";
  }

  /**
   * Lädt Usage und aktualisiert den Button-Text oder startet den Countdown
   */
  async function loadUsage() {
    clearStatus();
    // Button in Lade-Zustand
    newAnalysisBtn.disabled = true;
    newAnalysisBtn.textContent = "Loading…";

    if (!isLoggedIn()) {
      newAnalysisBtn.textContent = "Analyze this chart";
      return;
    }

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
        newAnalysisBtn.disabled = false;
        newAnalysisBtn.textContent = `Analyze this chart (${analysesRemaining} left)`;
      } else {
        startButtonCountdown(waitMs);
      }
    } catch {
      // Fallback
      newAnalysisBtn.disabled = false;
      newAnalysisBtn.textContent = "Analyze this chart";
    }
  }
});
