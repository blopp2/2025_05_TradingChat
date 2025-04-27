// sidebar.js – SnapChart

document.addEventListener("DOMContentLoaded", () => {
  const newAnalysisBtn = document.getElementById("new-analysis-btn");
  const screenshotInfo = document.getElementById("screenshot-info");
  const resultEl = document.getElementById("result");

  newAnalysisBtn.addEventListener("click", async () => {
    const originalButtonText = newAnalysisBtn.innerHTML;

    try {
      newAnalysisBtn.innerHTML = "⌛️ Verarbeitung läuft...";
      newAnalysisBtn.disabled = true;
      resultEl.innerHTML = "";

      const response = await chrome.runtime.sendMessage({
        action: "analyzeChart",
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
