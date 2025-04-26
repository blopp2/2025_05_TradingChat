// src/content_script.js
console.log("TradingView Analyzer: Content Script gestartet!");

// Scraping-Funktionen
function getCurrentPrice() {
  const el = document.querySelector('[data-name="legend-price-value"]');
  return el ? el.textContent.trim() : "unbekannt";
}

function getCurrentVolume() {
  const volLabel = document.querySelector('[data-name="legend-source-title"]');
  const volValue = volLabel?.nextElementSibling;
  return volValue ? volValue.textContent.trim() : "unbekannt";
}

function getCurrentSMA() {
  const indicators = document.querySelectorAll(
    '[data-name="legend-indicator-title"]'
  );
  for (let indicator of indicators) {
    if (/MA|SMA/i.test(indicator.textContent)) {
      const val = indicator.nextElementSibling;
      return val ? val.textContent.trim() : "unbekannt";
    }
  }
  return "unbekannt";
}

function collectChartData() {
  return {
    price: getCurrentPrice(),
    volume: getCurrentVolume(),
    sma: getCurrentSMA(),
  };
}

// Wichtig: Listener für Nachrichten von Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Nachricht erhalten:", msg);
  if (msg.type === "GET_CHART_DATA") {
    const data = collectChartData();
    console.log("Sende Chartdaten zurück:", data);
    sendResponse(data);
  }
});
