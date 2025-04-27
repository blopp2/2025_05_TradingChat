// sidebar.js – Variante A (OpenAI‑Calls laufen nur im Background)
// ============================================================
// Dieses Panel ist jetzt ein reines UI‑Frontend: Es sendet
// Messages an den Service‑Worker und zeigt dessen Antworten an.

// -----------------------------------------------------------------------------
// DOM Ready
// -----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // ⚙️ UI‑Elemente sammeln
  const ui = {
    screenshotInfo: document.getElementById("screenshot-info"),
    newAnalysisBtn: document.getElementById("new-analysis-btn"),
    askQuestionBtn: document.getElementById("ask-question-btn"),
    textarea: document.getElementById("question"),
    resultEl: document.getElementById("result"),
    statusEl: document.getElementById("status"),
  };

  // ---------------------------------------------------------------------------
  // Event‑Listener
  // ---------------------------------------------------------------------------

  ui.newAnalysisBtn.addEventListener("click", handleNewAnalysis);
  ui.askQuestionBtn.addEventListener("click", handleQuestion);

  // ---------------------------------------------------------------------------
  // 1) Screenshot + Analyse anfordern
  // ---------------------------------------------------------------------------
  async function handleNewAnalysis() {
    await setLoadingState(true);
    try {
      ui.resultEl.textContent = "";

      // Service‑Worker erledigt Screenshot, History & OpenAI‑Call
      const { analysis, error } = await chrome.runtime.sendMessage({
        action: "analyzeChart",
      });

      if (error) throw new Error(error);
      updateScreenshotTime();
      showResponse(analysis);
    } catch (err) {
      showError(err.message);
    } finally {
      await setLoadingState(false);
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Freitext‑Frage stellen (wird ebenfalls im Background beantwortet)
  // ---------------------------------------------------------------------------
  async function handleQuestion() {
    const questionText = ui.textarea.value.trim();
    if (!questionText) {
      showError("Bitte Frage eingeben");
      return;
    }

    await setLoadingState(true);
    try {
      ui.resultEl.textContent = "";

      const { answer, error } = await chrome.runtime.sendMessage({
        action: "askQuestion",
        text: questionText,
      });

      if (error) throw new Error(error);
      showResponse(answer);
      ui.textarea.value = "";
    } catch (err) {
      showError(err.message);
    } finally {
      await setLoadingState(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------

  function updateScreenshotTime() {
    const now = new Date();
    ui.screenshotInfo.textContent = `📸 Letzter Screenshot: ${now.toLocaleString()}`;
  }

  async function setLoadingState(isLoading) {
    ui.newAnalysisBtn.disabled = isLoading;
    ui.askQuestionBtn.disabled = isLoading;
    ui.textarea.disabled = isLoading;
    ui.statusEl.style.display = isLoading ? "block" : "none";
  }

  function showResponse(response) {
    if (response === undefined || response === null) {
      ui.resultEl.innerHTML = '<div class="error">Keine Antwort erhalten</div>';
      return;
    }
    if (typeof response === "object") response = JSON.stringify(response, null, 2);
    ui.resultEl.innerHTML = `<div class="response">${formatResponse(response)}</div>`;
  }

  function showError(message) {
    ui.resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(message)}</div>`;
  }

  function escapeHtml(unsafe) {
    if (typeof unsafe !== "string") unsafe = String(unsafe);
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatResponse(text) {
    const safe = escapeHtml(String(text));
    return safe
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
      .replace(/\n\n+/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }
});
