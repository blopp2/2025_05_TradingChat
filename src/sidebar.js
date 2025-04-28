// sidebar.js – SnapChart

document.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const loginBtn = document.getElementById("login-btn"); // Login/Logout Button

  // 📸 Screenshot aufnehmen
  newAnalysisBtn.addEventListener("click", async () => {
    if (typeof auth === "undefined" || !auth.currentUser) {
      alert("❌ Please login before using SnapChart!");
      return;
    }

    const originalButtonText = newAnalysisBtn.innerHTML;

    try {
      newAnalysisBtn.innerHTML = "⌛ Processing...";
      newAnalysisBtn.disabled = true;
      resultEl.innerHTML = "";

      const idToken = await getAuthToken(); // Firebase ID-Token holen

      const response = await chrome.runtime.sendMessage({
        action: "analyzeChart",
        idToken: idToken,
      });

      if (response?.analysis) {
        resultEl.innerHTML = formatResponse(response.analysis);
        updateScreenshotTime();
      } else if (response?.error) {
        resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(
          response.error
        )}</div>`;
      } else {
        resultEl.innerHTML = `<div class="error">❌ Unknown error</div>`;
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
      resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(
        error.message
      )}</div>`;
    } finally {
      newAnalysisBtn.innerHTML = originalButtonText;
      newAnalysisBtn.disabled = false;
    }
  });

  // 🔐 Login/Logout Button
  loginBtn.addEventListener("click", async () => {
    try {
      if (auth.currentUser) {
        await logout();
      } else {
        openLoginModal(); // Modernes Login-Modal statt prompt()
      }
    } catch (error) {
      console.error("❌ Auth error:", error.message);
      alert("Authentication failed: " + error.message);
    }
  });

  // 🔄 Login-Status aktualisieren
  auth.onAuthStateChanged((user) => {
    loginBtn.textContent = user ? "🚪 Logout" : "🔐 Login";
  });

  // 🛠 Hilfsfunktionen
  function updateScreenshotTime() {
    const now = new Date();
    screenshotInfo.innerHTML = `📋 Last Screenshot: ${now.toLocaleString()}`;
  }

  function formatResponse(text) {
    if (typeof text !== "string") return "Invalid response";
    return `<div class="response" style="white-space: pre-line;">${escapeHtml(
      text
    )}</div>`;
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#039;");
  }
});
