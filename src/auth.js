// auth.js – SnapChart Extension Frontend Auth via Proxy

const API_BASE = "https://snapchart-proxy.brightcompass.workers.dev";
const SESSION_KEY = "sessionToken";

/**
 * Sendet eine JSON-Anfrage an den Proxy und wertet die Antwort aus.
 * @param {string} path  Endpunktpfad, z.B. "/login" oder "/signup"
 * @param {Object} body  Request-Body
 * @returns {Promise<Object>} Parsed JSON
 * @throws {Error} bei Netzwerk- oder API-Fehlern
 */
async function requestJson(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`Netzwerkfehler: ${networkErr.message}`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ungültige JSON-Antwort vom Server");
  }

  if (!res.ok) {
    const msg = data.error || data.message || "Anfrage fehlgeschlagen";
    throw new Error(msg);
  }

  return data;
}

/**
 * Login – sendet Login-Credentials an den Proxy und speichert das Session-Token.
 * @param {string} email
 * @param {string} password
 * @throws {Error} bei Fehlern
 */
export async function login(email, password) {
  try {
    const { sessionToken } = await requestJson("/login", { email, password });
    if (!sessionToken) {
      throw new Error("Kein Session-Token erhalten");
    }
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem("userEmail", email);
    window.dispatchEvent(new Event("sessionStarted"));
    console.log("✅ Login erfolgreich");
  } catch (err) {
    clearSessionToken();
    window.dispatchEvent(new Event("sessionEnded"));
    console.error("❌ Login-Fehler:", err.message);
    throw err;
  }
}

/**
 * Signup – registriert den Benutzer via Proxy und speichert das Session-Token.
 * @param {string} email
 * @param {string} password
 * @throws {Error} bei Fehlern
 */
export async function signup(email, password) {
  try {
    const { sessionToken } = await requestJson("/signup", { email, password });
    if (!sessionToken) {
      throw new Error("Kein Session-Token erhalten");
    }
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem("userEmail", email);
    window.dispatchEvent(new Event("sessionStarted"));
    console.log("✅ Registrierung erfolgreich");
  } catch (err) {
    clearSessionToken();
    window.dispatchEvent(new Event("sessionEnded"));
    console.error("❌ Signup-Fehler:", err.message);
    throw err;
  }
}

/**
 * Logout – entfernt das gespeicherte Session-Token.
 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("userEmail");
  window.dispatchEvent(new Event("sessionEnded"));
  console.log("🚪 Logout durchgeführt");
}

/**
 * Liest das aktuelle Session-Token aus oder wirft einen Fehler.
 * @returns {string} sessionToken
 * @throws {Error} wenn kein Token vorhanden
 */
export function getSessionToken() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    console.warn("🚫 Kein Session-Token gefunden");
    throw new Error("SESSION_EXPIRED");
  }
  return token;
}

/**
 * Prüft, ob ein Session-Token gespeichert ist.
 * @returns {boolean}
 */
export function isLoggedIn() {
  return Boolean(localStorage.getItem(SESSION_KEY));
}

/**
 * Entfernt das Session-Token.
 */
export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("sessionEnded"));
}
