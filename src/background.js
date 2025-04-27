// background.js – Option A: Zentrale OpenAI‑Logik im Service‑Worker
// ================================================================

/*  Inhaltsverzeichnis
    1  Konstanten & State
    2  Screenshot‑Service
    3  OpenAI‑Kommunikation (Vision + Text)
    4  Runtime‑Message‑Router  (analyzeChart | askQuestion | captureScreenshot)
    5  Side‑Panel‑Steuerung
    6  Auto‑Aktivierung für TradingView
*/

// -----------------------------------------------------------------------------
// 1  Konstanten & State
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT =
`Du erhältst aufeinanderfolgende Screenshots von Handelscharts (1h, 4h, evtl. Tages‑Chart). Grüne Pfeile sind eingegangene Long-Position, rote pfeile eingegangene short-position.\n
Kurze prägnante Antworten!\n'
// Deine Aufgabe:\n Candlestick‑Muster\n   • Entscheidungsrelevante Indikatoren (RSI, MACD, gleitende Durchschnitte)\n2. Handlungsempfehlung für Long und short (Einstieg/Exit, Stop‑Loss, Take‑Profit, Risiko)\n3. Präsentation: max. 3 Bulletpoints, priorisierte Aktionsliste (1 Sofort / 2 Beobachten), Warnhinweise deutlich.`

const MAX_HISTORY = 3;           // + System‑Prompt  → ~6 Nachrichten pro Call
const chatHistories = new Map(); // key = tabId, value = Array<ChatMessage>

console.log("🔧 Service‑Worker initialisiert");

// -----------------------------------------------------------------------------
// 2  Screenshot‑Service
// -----------------------------------------------------------------------------

function captureTradingViewChart() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 85 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(`Screenshot fehlgeschlagen: ${chrome.runtime.lastError.message}`));
        }
        if (!dataUrl) return reject(new Error("Keine Screenshot‑Daten erhalten"));
        resolve(dataUrl);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// 3  OpenAI‑Kommunikation
// -----------------------------------------------------------------------------

/**
 * @param {number}   tabId             – Browser‑Tab, dem der Verlauf gehört
 * @param {object[]} contentFragments  – Array von {type:"text"|"image_url", ...}
 * @return {Promise<string>}           – Antwort‑Text des Assistant
 */
async function queryOpenAI(tabId, contentFragments) {
  const { OPENAI_KEY } = await chrome.storage.sync.get("OPENAI_KEY");
  if (!OPENAI_KEY) throw new Error("API‑Key nicht konfiguriert.");

  const history = chatHistories.get(tabId) ?? [];
  const userMessage = { role: "user", content: contentFragments };

  // Payload aufbauen
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-MAX_HISTORY),
    userMessage,
  ];

  // Modellwahl: Vision, wenn mindestens ein Image enthalten ist
  const hasImage = contentFragments.some((c) => c.type === "image_url");
  const model = hasImage ? "gpt-4.1-mini" : "gpt-4o-mini"; // Textmodell ggf. anpassen

  const body = {
    model,
    messages,
    max_tokens: hasImage ? 1500 : 800,
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error?.message || "API‑Anfrage fehlgeschlagen");
  }

  const answerMsg = (await res.json()).choices?.[0]?.message;
  if (!answerMsg) throw new Error("Keine Analyse erhalten");

  // Verlauf aktualisieren
  const newHistory = [...history.slice(-MAX_HISTORY), userMessage, answerMsg];
  chatHistories.set(tabId, newHistory);

  return answerMsg.content;
}

// -----------------------------------------------------------------------------
// 4  Runtime‑Message‑Router
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Tab‑ID ermitteln (Popup‑Fallback)
  let tabId = sender.tab?.id;
  if (!tabId) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      tabId = tab?.id;
      route();
    });
    return true; // asynchrone Fortsetzung
  }
  return route();

  function route() {
    const handlers = {
      async analyzeChart() {
        const screenshotUrl = await captureTradingViewChart();
        const answer = await queryOpenAI(tabId, [
          { type: "text",  text: "Bitte analysiere diesen TradingView‑Chart:" },
          { type: "image_url", image_url: { url: screenshotUrl, detail: "high" } },
        ]);
        return { analysis: answer };
      },

      async askQuestion() {
        const text = request.text?.trim();
        if (!text) throw new Error("Frage ist leer");
        const compactPrompt = SYSTEM_PROMPT + "\\nAntwortformat: Maximal 2 kurze Sätze, keine Wiederholungen.";
        const answer = await queryOpenAI(tabId, [{ type: "text", text }], { systemPrompt: compactPrompt, maxTokens: 200 });
        return { answer };
      },

      async captureScreenshot() {
        const dataUrl = await captureTradingViewChart();
        return { dataUrl };
      },
    };

    const fn = handlers[request.action];
    if (!fn) {
      sendResponse({ error: "Unbekannte Aktion" });
      return false;
    }

    fn()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));

    return true; // Port offen lassen
  }
});

// -----------------------------------------------------------------------------
// 5  Side‑Panel‑Steuerung
// -----------------------------------------------------------------------------

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  // Panel synchron öffnen (User‑Gesture)
  chrome.sidePanel.open({ tabId: tab.id }).catch((err) =>
    console.error("Side‑Panel öffnen fehlgeschlagen", err)
  );

  // Optionen nachreichen
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    enabled: true,
    path: "src/sidebar.html",
  });
});

// -----------------------------------------------------------------------------
// 6  Auto‑Aktivierung für TradingView
// -----------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && /tradingview\.com/.test(tab.url)) {
    chrome.sidePanel.setOptions({ tabId, enabled: true, path: "src/sidebar.html" }).catch(() => {});
  }
});
