// background.js – Clean Version (via Server-Proxy)
// ================================================================

console.log("🔧 Service‑Worker initialisiert");

// -----------------------------------------------------------------------------
// 1  Konstanten
// -----------------------------------------------------------------------------

const PROXY_ENDPOINT = "https://snapchart-proxy.brightcompass.workers.dev";
const MAX_HISTORY = 3;
const chatHistories = new Map(); // key = tabId, value = Array<ChatMessage>

// -----------------------------------------------------------------------------
// 2  Screenshot-Service
// -----------------------------------------------------------------------------

function captureTradingViewChart() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 85 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          return reject(
            new Error(
              `Screenshot fehlgeschlagen: ${chrome.runtime.lastError.message}`
            )
          );
        }
        if (!dataUrl)
          return reject(new Error("Keine Screenshot-Daten erhalten"));
        resolve(dataUrl);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// 3  Kommunikation mit Worker (Proxy)
// -----------------------------------------------------------------------------

async function queryProxy(tabId, contentFragments, idToken) {
  const hasImage = contentFragments.some((c) => c.type === "image_url");
  const action = hasImage ? "analyze" : "ask";

  const bodyPayload = {
    action,
    dataUrl: contentFragments.find((c) => c.type === "image_url")?.image_url
      ?.url,
    text: contentFragments.find((c) => c.type === "text")?.text,
  };

  console.log("📤 Sende Request an Proxy:", bodyPayload);

  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}), // 🛡 Token anhängen wenn vorhanden
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorResponse = await res.text();
      console.error(
        "❌ Proxy-Fehler: HTTP Status",
        res.status,
        "-",
        errorResponse
      );
      throw new Error(`Proxy-Fehler: ${res.status}`);
    }

    const jsonData = await res.json();
    console.log("✅ Proxy-Antwort erhalten:", jsonData);

    if (!jsonData.answer) {
      throw new Error("Proxy-Antwort leer oder unvollständig.");
    }

    return jsonData.answer;
  } catch (error) {
    console.error("❌ Proxy-Request fehlgeschlagen:", error.message);
    throw new Error("Proxy-Anfrage fehlgeschlagen");
  }
}

// -----------------------------------------------------------------------------
// 4  Message-Router (Runtime)
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let tabId = sender.tab?.id;

  if (!tabId) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      tabId = tab?.id;
      route();
    });
    return true;
  }
  return route();

  function route() {
    const handlers = {
      async analyzeChart() {
        const screenshotUrl = await captureTradingViewChart();
        const answer = await queryProxy(
          tabId,
          [
            {
              type: "text",
              text: "Bitte analysiere diesen TradingView-Chart:",
            },
            {
              type: "image_url",
              image_url: { url: screenshotUrl, detail: "high" },
            },
          ],
          request.idToken
        ); // <<< idToken übergeben
        return { analysis: answer };
      },

      async askQuestion() {
        const text = request.text?.trim();
        if (!text) throw new Error("Frage ist leer");
        const answer = await queryProxy(
          tabId,
          [{ type: "text", text }],
          request.idToken
        ); // <<< idToken übergeben
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

    return true;
  }
});

// -----------------------------------------------------------------------------
// 5  Side-Panel Steuerung
// -----------------------------------------------------------------------------

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((err) => console.error("Side-Panel öffnen fehlgeschlagen", err));

  chrome.sidePanel.setOptions({
    tabId: tab.id,
    enabled: true,
    path: "src/sidebar.html",
  });
});

// -----------------------------------------------------------------------------
// 6  Auto-Aktivierung für TradingView
// -----------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.includes("tradingview.com")
  ) {
    chrome.sidePanel
      .setOptions({ tabId, enabled: true, path: "src/sidebar.html" })
      .catch((err) =>
        console.error("❌ Fehler beim SidePanel setzen:", err.message)
      );
  }
});
