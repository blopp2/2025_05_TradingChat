// background.js – Clean Version (via Server-Proxy)
// ================================================================

console.log("🔧 Service‑Worker initialisiert");

// -----------------------------------------------------------------------------
// 1  Konstanten
// -----------------------------------------------------------------------------

const PROXY_ENDPOINT =
  "https://snapchart-proxy.brightcompass.workers.dev/analyze";
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
              `not a valid chart URL: ${chrome.runtime.lastError.message}`
            )
          );
        }
        if (!dataUrl) return reject(new Error("No Data recieved"));
        resolve(dataUrl);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// 3  Kommunikation mit Worker (Proxy)
// -----------------------------------------------------------------------------

async function queryProxy(tabId, contentFragments, sessionToken) {
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
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    // ---- Neuer Code: Session abgelaufen erkennen ----
    if (res.status === 401) {
      const errorObj = await res.json().catch(() => ({}));
      const reason = errorObj?.error || "";
      if (reason === "SESSION_EXPIRED") {
        // Spezial-Fehler werfen, damit UI gezielt reagieren kann
        throw new Error("SESSION_EXPIRED");
      } else {
        throw new Error("Nicht autorisiert");
      }
    }

    // ---- Sonstige Fehler ----
    if (!res.ok) {
      const errorResponse = await res.text();
      console.error(
        "❌ Proxy-Error: HTTP Status",
        res.status,
        "-",
        errorResponse
      );
      throw new Error(`Proxy-Error: ${res.status}`);
    }

    const jsonData = await res.json();
    console.log("✅ Proxy-Feedback:", jsonData);

    if (!jsonData.answer) {
      throw new Error("Proxy-Feedback empty.");
    }

    return jsonData.answer;
  } catch (error) {
    // ---- SESSION_EXPIRED wird nach außen geworfen, alle anderen als allgemeiner Proxy-Fehler ----
    if (error.message === "SESSION_EXPIRED") {
      throw error; // UI kann dann gezielt re-login auslösen
    }
    console.error("❌ Proxy-Request failed:", error.message);
    throw new Error("Proxy-Anfrage failed");
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
          request.sessionToken // 🟢 Jetzt sessionToken statt idToken
        );
        return { analysis: answer };
      },

      async askQuestion() {
        const text = request.text?.trim();
        if (!text) throw new Error("Frage ist leer");
        const answer = await queryProxy(
          tabId,
          [{ type: "text", text }],
          request.sessionToken // 🟢 ebenfalls hier
        );
        return { answer };
      },

      async captureScreenshot() {
        const dataUrl = await captureTradingViewChart();
        return { dataUrl };
      },
    };

    const fn = handlers[request.action];
    if (!fn) {
      sendResponse({ error: "Unknown Action" });
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
