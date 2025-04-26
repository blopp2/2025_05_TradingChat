// background.js - Vollständig überarbeitete Version

// System Prompt für TradingView Analyse
const SYSTEM_PROMPT = `
Du erhältst aufeinanderfolgende Screenshots von Handelscharts (1h, 4h, evtl. Tages-Chart) und Trades.
Deine Aufgabe:
1. Technische Analyse:
   - Trendrichtung (Aufwärts/Abwärts/Seitwärts)
   - Schlüssel-Levels (Support/Resistance)
   - Candlestick-Muster
   - Indikatoren (RSI, MACD, gleitende Durchschnitte)

2. Handlungsempfehlung:
   - [✓] Klare Einstieg/Exit-Signale
   - [✓] Stop-Loss und Take-Profit Levels
   - [✓] Risikomanagement-Hinweise

3. Präsentation:
   - Maximal 5 prägnante Bulletpoints
   - Priorisierte Aktionsliste (1. Sofort, 2. Beobachten, 3. Langfristig)
   - Warnhinweise deutlich markieren
`;

// Initialisierung
console.log("Service Worker initialisiert");

// 1. SCREENSHOT SERVICE
async function captureTradingViewChart() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 85 }, // Optimierte Qualität
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `Screenshot fehlgeschlagen: ${chrome.runtime.lastError.message}`
            )
          );
        } else if (!dataUrl) {
          reject(new Error("Keine Screenshot-Daten erhalten"));
        } else {
          console.log("Screenshot erfolgreich");
          resolve(dataUrl);
        }
      }
    );
  });
}

// 2. API-KOMMUNIKATION
async function fetchOpenAIAnalysis(screenshotUrl) {
  const { OPENAI_KEY } = await chrome.storage.sync.get("OPENAI_KEY");
  if (!OPENAI_KEY) {
    throw new Error(
      "API-Key nicht konfiguriert. Bitte in den Einstellungen eingeben."
    );
  }

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Bitte analysiere diesen TradingView-Chart:" },
          {
            type: "image_url",
            image_url: {
              url: screenshotUrl,
              detail: "high", // Für detaillierte Chart-Analyse
            },
          },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.3, // Für präzisere Analysen
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s Timeout
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "API-Anfrage fehlgeschlagen");
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Keine Analyse erhalten";
  } catch (error) {
    console.error("API-Fehler:", error);
    throw new Error(`Analyse fehlgeschlagen: ${error.message}`);
  }
}

// 3. MESSAGE HANDLER
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    async analyzeChart() {
      try {
        const screenshotUrl = await captureTradingViewChart();
        const analysis = await fetchOpenAIAnalysis(screenshotUrl);
        return { analysis };
      } catch (error) {
        return { error: error.message };
      }
    },

    async captureScreenshot() {
      try {
        const dataUrl = await captureTradingViewChart();
        return { dataUrl };
      } catch (error) {
        return { error: error.message };
      }
    },
  };

  if (request.action && handlers[request.action]) {
    handlers[request.action]().then(sendResponse);
    return true; // Asynchrone Antwort behalten
  }
});

// 4. SIDE PANEL STEUERUNG
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: true,
      path: "src/sidebar.html",
    });

    await chrome.sidePanel.open({ tabId: tab.id });
    console.log("Side Panel für Tab", tab.id, "geöffnet");
  } catch (error) {
    console.error("Side Panel Fehler:", error);
  }
});

// 5. AUTOMATISCHE AKTIVIERUNG FÜR TRADINGVIEW
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.match(/tradingview\.com/)) {
    try {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: true,
        path: "src/sidebar.html",
      });
      console.log("Auto-aktiviert für TradingView");
    } catch (error) {
      console.error("Auto-Aktivierung fehlgeschlagen:", error);
    }
  }
});
