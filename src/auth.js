// auth.js – Extension-Seite (Browser)

// 🛡️ Firebase Projekt Konfiguration einfügen
const firebaseConfig = {
  apiKey: "DEIN_FIREBASE_API_KEY",
  authDomain: "DEIN_PROJECT_ID.firebaseapp.com",
  projectId: "DEIN_PROJECT_ID",
  storageBucket: "DEIN_PROJECT_ID.appspot.com",
  messagingSenderId: "DEIN_SENDER_ID",
  appId: "DEIN_APP_ID",
};

// 🔥 Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ✅ Hole das aktuelle ID-Token
async function getAuthToken() {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    console.log("✅ Firebase Token geholt:", token);
    return token;
  } else {
    console.warn("🚪 Kein eingeloggter User gefunden beim Token holen");
    throw new Error("Nicht eingeloggt");
  }
}

// 🧩 Optional: Manuelles Login
async function login(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    console.log("✅ Erfolgreich eingeloggt:", email);
  } catch (error) {
    console.error("❌ Login-Fehler:", error.message);
    throw error;
  }
}

// 🧹 Optional: Logout-Funktion
async function logout() {
  try {
    await auth.signOut();
    console.log("🚪 Erfolgreich ausgeloggt");
  } catch (error) {
    console.error("❌ Logout-Fehler:", error.message);
    throw error;
  }
}

// 📣 Auth-State-Überwachung (kannst du später schön für UI nutzen)
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("✅ Eingeloggt als:", user.email);
    // TODO: Hier könntest du z.B. UI-Update triggern
  } else {
    console.log("🚪 Kein Benutzer eingeloggt");
    // TODO: Hier könntest du z.B. Login-Button anzeigen
  }
});
