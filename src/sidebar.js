let chatHistory = [];

document.addEventListener("DOMContentLoaded", () => {
  // UI-Elemente
  const ui = {
    screenshotInfo: document.getElementById("screenshot-info"),
    newAnalysisBtn: document.getElementById("new-analysis-btn"),
    askQuestionBtn: document.getElementById("ask-question-btn"),
    textarea: document.getElementById("question"),
    resultEl: document.getElementById("result"),
    statusEl: document.getElementById("status"),
  };

  let chatHistory = [];
  let lastScreenshotUrl = null;
  let abortController = null;

  // Event Listener
  ui.newAnalysisBtn.addEventListener("click", handleNewAnalysis);
  ui.askQuestionBtn.addEventListener("click", handleQuestion);

  async function handleNewAnalysis() {
    try {
      await setLoadingState(true);
      ui.resultEl.textContent = "";

      // Reset History für neue Analyse
      chatHistory = [
        {
          role: "system",
          content:
            "Du bist ein Trading-Experte. Analysiere Charts technisch und gib Handelsempfehlungen.",
        },
      ];

      const screenshotUrl = await captureScreenshot();
      updateScreenshotTime();

      // User-Nachricht mit Screenshot
      chatHistory.push({
        role: "user",
        content: [
          { type: "text", text: "Analysiere diesen Chart:" },
          {
            type: "image_url",
            image_url: { url: screenshotUrl, detail: "auto" },
          },
        ],
      });

      const response = await sendToOpenAIVision(chatHistory);

      // Assistant-Antwort zur History hinzufügen
      chatHistory.push({
        role: "assistant",
        content: response,
      });

      showResponse(response);
    } catch (err) {
      showError(err.message);
    } finally {
      await setLoadingState(false);
    }
  }

  async function handleQuestion() {
    const questionText = ui.textarea.value.trim();
    if (!questionText) {
      showError("Bitte Frage eingeben");
      return;
    }

    try {
      await setLoadingState(true);
      ui.resultEl.textContent = "";

      // User-Frage zur History hinzufügen
      chatHistory.push({
        role: "user",
        content: [{ type: "text", text: questionText }],
      });

      const response = await sendToOpenAIVision(chatHistory);

      // Assistant-Antwort zur History hinzufügen
      chatHistory.push({
        role: "assistant",
        content: response,
      });

      showResponse(response);
      ui.textarea.value = ""; // Eingabefeld leeren
    } catch (err) {
      showError(err.message);
    } finally {
      await setLoadingState(false);
    }
  }

  // Verbesserte Hilfsfunktionen
  function updateScreenshotTime() {
    const now = new Date();
    ui.screenshotInfo.textContent = `📸 Letzter Screenshot: ${now.toLocaleString()}`;
  }

  function resetChatHistory() {
    chatHistory = [];
  }

  function addToChatHistory(message) {
    chatHistory.push(message);
    // Behalte nur die letzten 4 Nachrichten (wegen Token-Limit)
    if (chatHistory.length > 4) {
      chatHistory = chatHistory.slice(-4);
    }
  }

  async function setLoadingState(isLoading) {
    ui.newAnalysisBtn.disabled = isLoading;
    ui.askQuestionBtn.disabled = isLoading;
    ui.textarea.disabled = isLoading;
    ui.statusEl.style.display = isLoading ? "block" : "none";

    if (!isLoading && abortController) {
      abortController.abort();
    }
  }

  // Robuste showResponse Funktion
  function showResponse(response) {
    try {
      // Fallback für undefined/null
      if (response === undefined || response === null) {
        ui.resultEl.innerHTML =
          '<div class="error">Keine Antwort erhalten</div>';
        return;
      }

      // Handhabung von Objektantworten (z.B. von API)
      if (typeof response === "object") {
        response = JSON.stringify(response, null, 2);
      }

      ui.resultEl.innerHTML = `<div class="response">${formatResponse(
        response
      )}</div>`;
    } catch (error) {
      console.error("Error showing response:", error);
      ui.resultEl.innerHTML =
        '<div class="error">Fehler beim Anzeigen der Antwort</div>';
    }
  }

  function showError(message) {
    ui.resultEl.innerHTML = `<div class="error">❌ ${escapeHtml(
      message
    )}</div>`;
  }

  // Verbesserte escapeHtml Funktion
  function escapeHtml(unsafe) {
    if (typeof unsafe !== "string") {
      console.warn("escapeHtml received non-string input:", unsafe);
      unsafe = String(unsafe);
    }

    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatResponse(text) {
    try {
      // 1. Sicherstellen, dass der Input ein String ist
      if (typeof text !== "string") {
        console.warn("formatResponse received non-string input:", text);
        text = String(text); // Fallback Konvertierung
      }

      // 2. HTML-Escaping zuerst
      let safeText = escapeHtml(text);

      // 3. Markdown-Formatierung
      return safeText
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
        .replace(/\*(.*?)\*/g, "<em>$1</em>") // *italic*
        .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>") // ```code blocks```
        .replace(/\n\n+/g, "</p><p>") // paragraphs
        .replace(/\n/g, "<br>"); // line breaks
    } catch (error) {
      console.error("Error formatting response:", error);
      return "Antwort konnte nicht formatiert werden";
    }
  }

  async function captureScreenshot() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "captureScreenshot",
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.dataUrl;
    } catch (error) {
      console.error("Screenshot fehlgeschlagen:", error);
      throw error;
    }
  }

  function optimizeHistory(history) {
    // Sicherstellen, dass history ein Array ist
    if (!Array.isArray(history)) {
      console.error("History is not an array:", history);
      return []; // oder return [history] falls es ein einzelnes Nachrichtenobjekt ist
    }

    // Letzte 6 Nachrichten behalten (inkl. System-Prompt)
    const recentHistory = history.slice(Math.max(history.length - 6, 0));

    // System-Prompt immer an erste Position
    const systemPrompt = history.find((m) => m.role === "system");
    const otherMessages = recentHistory.filter((m) => m.role !== "system");

    return systemPrompt ? [systemPrompt, ...otherMessages] : recentHistory;
  }

  async function sendToOpenAIVision(history) {
    const { OPENAI_KEY } = await chrome.storage.sync.get("OPENAI_KEY");
    if (!OPENAI_KEY) throw new Error("API-Key nicht gefunden");

    // 1. History validieren und bereinigen
    const validatedMessages = history
      .filter((msg) => msg?.role && msg?.content) // Nur gültige Nachrichten
      .map((msg) => ({
        role: msg.role,
        content: Array.isArray(msg.content)
          ? msg.content.map((contentItem) => {
              if (contentItem.type === "image_url") {
                return {
                  type: "image_url",
                  image_url: {
                    url: contentItem.image_url?.url || contentItem.image_url,
                    detail: contentItem.image_url?.detail || "auto",
                  },
                };
              }
              return {
                type: "text",
                text: String(contentItem.text || contentItem),
              };
            })
          : [{ type: "text", text: String(msg.content) }],
      }));

    // 2. Mindestens eine Nachricht sicherstellen
    if (validatedMessages.length === 0) {
      throw new Error("Keine gültigen Nachrichten für die API");
    }

    // 3. Payload mit korrekter Struktur
    const payload = {
      model: "gpt-4-turbo", // Standardmodell
      messages: validatedMessages,
      max_tokens: 1000,
    };

    // 4. Automatische Modellauswahl für Bilder
    if (
      history.some((msg) =>
        msg.content?.some?.((item) => item.type === "image_url")
      )
    ) {
      payload.model = "gpt-4.1-mini";
      payload.max_tokens = 2000; // Mehr Tokens für Bildanalyse
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Fehlerdetails:", errorData);
        throw new Error(
          errorData.error?.message || "API-Anfrage fehlgeschlagen"
        );
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "Keine Antwort erhalten";
    } catch (error) {
      console.error("API Kommunikationsfehler:", {
        error: error.message,
        payload: validatedMessages,
      });
      throw error;
    }
  }
});
