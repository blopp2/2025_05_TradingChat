// auth.js – SnapChart Frontend Auth via Proxy

const API_BASE = "https://snapchart-proxy.brightcompass.workers.dev"; // ⬅️ Deine Proxy-URL hier eintragen

/**
 * Login – sendet Login-Credentials an den Proxy (/login) und speichert Session-Token.
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Login failed");
  }

  const { sessionToken } = await res.json();
  if (!sessionToken) throw new Error("Invalid login response");

  localStorage.setItem("sessionToken", sessionToken);
  console.log("✅ Login erfolgreich – Session-Token gespeichert");
}

/**
 * (Optional) Signup – Benutzer registrieren, sofern vom Proxy unterstützt.
 * @param {string} email
 * @param {string} password
 */
export async function signup(email, password) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Signup failed");
  }

  const { sessionToken } = await res.json();
  if (!sessionToken) throw new Error("Invalid signup response");

  localStorage.setItem("sessionToken", sessionToken);
  console.log("✅ Registrierung erfolgreich – Session-Token gespeichert");
}

/**
 * Logout – entfernt den gespeicherten Token.
 */
export function logout() {
  localStorage.removeItem("sessionToken");
  console.log("🚪 Logout – Session-Token entfernt");
}

/**
 * Gibt den Session-Token zurück oder wirft einen Fehler.
 * @returns {string} sessionToken
 */
export function getSessionToken() {
  const token = localStorage.getItem("sessionToken");
  if (!token) {
    console.warn("🚫 Kein Session-Token vorhanden");
    throw new Error("No session token");
  }
  return token;
}

/**
 * Prüft, ob ein gültiger Token gespeichert ist.
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!localStorage.getItem("sessionToken");
}
