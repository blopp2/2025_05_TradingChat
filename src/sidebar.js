// sidebar.js – SnapChart

document.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");
  const loginBtn = document.getElementById("login-btn"); // ← Button fürs Login/Logout

  // 📸 Screenshot-Button
  newAnalysisBtn.addEventListener("click", async () => {
    const originalButtonText = newAnalysisBtn.innerHTML;

    try {
      newAnalysisBtn.innerHTML = "⌛️ Verarbeitung läuft...";
      newAnalysisBtn.disabled = true;
      resultEl.innerHTML = "";

      const idToken = await getAuthToken(); // ← Firebase ID-Token holen

      const response = await chrome.runtime.sendMessage({
        action: "analyzeChart",
        idToken: idToken, // ← ID-Token mitsenden
      });

      if (response?.analysis) {
        resultEl.innerHTML = formatResponse(response.analysis);
        updateScreenshotTime();
      } else if (response?.error) {
        resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(
          response.error
        )}</div>`;
      } else {
        resultEl.innerHTML = `<div class="error">❌ Unbekannter Fehler</div>`;
      }
    } catch (error) {
      resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(
        error.message
      )}</div>`;
    } finally {
      newAnalysisBtn.innerHTML = originalButtonText;
      newAnalysisBtn.disabled = false;
    }
  });

  // 🔐 Login/Logout-Button
  loginBtn.addEventListener("click", async () => {
    try {
      if (auth.currentUser) {
        await logout();
      } else {
        const email = prompt("E-Mail eingeben:");
        const password = prompt("Passwort eingeben:");
        if (email && password) {
          await login(email, password);
        }
      }
    } catch (error) {
      console.error("❌ Auth Fehler:", error.message);
      alert("Anmeldung fehlgeschlagen: " + error.message);
    }
  });

  // 🔄 Dynamischer Button-Text je nach Login-Status
  auth.onAuthStateChanged((user) => {
    if (user) {
      loginBtn.textContent = "🚪 Logout";
    } else {
      loginBtn.textContent = "🔐 Login";
    }
  });

  // 🛠 Hilfsfunktionen
  function updateScreenshotTime() {
    const now = new Date();
    screenshotInfo.innerHTML = `📋 Letzter Screenshot: ${now.toLocaleString()}`;
  }

  function formatResponse(text) {
    if (typeof text !== "string") return "Ungültige Antwort";
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
