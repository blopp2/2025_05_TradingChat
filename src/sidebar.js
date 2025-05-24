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
  // ─── Grab all the elements ────────────────────────────────────────────
  const userEmailEl = document.getElementById("user-email");
  const docLinkEl = document.getElementById("doc-link");
  const feedbackBtn = document.getElementById("feedback-btn");
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackClose = document.getElementById("feedback-close");
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const logoutBtn = document.getElementById("logout-btn");
  const donateBtn = document.getElementById("donate-btn");
  const status = document.getElementById("status");

  let countdownInterval = null;

  // ─── Initialization ─────────────────────────────────────────────────
  updateAuthUI();
  updateUserUI();
  loadUsage();

  // After login/signup
  window.addEventListener("sessionStarted", () => {
    closeLoginModal();
    updateAuthUI();
    updateUserUI();
    loadUsage();
  });

  // ─── Logout ─────────────────────────────────────────────────────────
  logoutBtn.addEventListener("click", () => {
    logout();
    openLoginModal();
    updateAuthUI();
    updateUserUI();
  });

  // ─── Analyze Button ─────────────────────────────────────────────────
  newAnalysisBtn.addEventListener("click", async () => {
    newAnalysisBtn.disabled = true;
    updateStatus("Analyzing…");
    resultEl.innerHTML = "";
    try {
      const token = getSessionToken();
      const resp = await sendMessage({
        action: "analyzeChart",
        sessionToken: token,
      });

      if (resp?.sessionExpired || resp?.error === "SESSION_EXPIRED") {
        return showSessionExpired();
      }
      if (resp.analysis) {
        resultEl.innerHTML = formatResponse(resp.analysis);
        updateScreenshotTime();
      } else if (resp.error?.includes("limit reached")) {
        showError("❌ You've used all your free analyses.");
      } else {
        showError(resp.error || "Unknown error");
      }
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        return showSessionExpired();
      }
      showError(err.message || "Proxy request failed");
    } finally {
      clearStatus();
      await loadUsage();
    }
  });

  // ─── Donate Button ──────────────────────────────────────────────────
  donateBtn.addEventListener("click", showDonateDialog);

  // ─── Feedback Button opens in-page modal ────────────────────────────
  feedbackBtn.addEventListener("click", () => {
    if (!isLoggedIn()) {
      return alert("Please log in to send feedback.");
    }
    feedbackModal.classList.remove("hidden");
  });
  feedbackClose.addEventListener("click", () => {
    feedbackModal.classList.add("hidden");
  });

  // ─── Helpers ────────────────────────────────────────────────────────
  function updateUserUI() {
    const email = localStorage.getItem("userEmail");
    if (email) {
      userEmailEl.textContent = email;
      userEmailEl.style.display = "inline";
      docLinkEl.style.display = "inline";
      feedbackBtn.style.display = "inline-block";
    } else {
      userEmailEl.style.display = "none";
      docLinkEl.style.display = "none";
      feedbackBtn.style.display = "none";
    }
  }

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
    updateUserUI();
  }

  function updateScreenshotTime() {
    screenshotInfo.textContent = `📋 Last Screenshot: ${new Date().toLocaleString()}`;
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
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        newAnalysisBtn.textContent = `Next in ${m}m ${s}s`;
      }
    }, 1000);
  }

  function resetAnalysisButton() {
    newAnalysisBtn.disabled = false;
    newAnalysisBtn.textContent = "Analyze this chart";
  }

  async function loadUsage() {
    clearStatus();
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
      if (!res.ok) throw new Error();

      const { analysesRemaining, waitMs } = await res.json();
      if (analysesRemaining > 0) {
        newAnalysisBtn.disabled = false;
        newAnalysisBtn.textContent = `Analyze this chart (${analysesRemaining} left)`;
      } else {
        startButtonCountdown(waitMs);
      }
    } catch {
      newAnalysisBtn.disabled = false;
      newAnalysisBtn.textContent = "Analyze this chart";
    }
  }
});
