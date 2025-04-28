// auth.js – Extension (SnapChart)

// 🛡️ Firebase Projekt Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyAVfTqsFyNjaZwCEmnVWHIRUkPy_C6O1ws",
  authDomain: "snapchart-21fa7.firebaseapp.com",
  projectId: "snapchart-21fa7",
  storageBucket: "snapchart-21fa7.appspot.com", // 🛠️ Fix hier!
  messagingSenderId: "182191314631",
  appId: "1:182191314631:web:3d960001200dc65e5fd0e2",
};

// 🔥 Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ✅ Token holen (aktuell eingeloggter User)
async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) {
    console.warn("🚪 No user logged in when fetching token");
    throw new Error("User not logged in");
  }
  const token = await user.getIdToken();
  console.log("✅ Firebase token retrieved:", token);
  return token;
}

// 🔐 Login-Funktion
async function login(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    console.log("✅ Successfully logged in:", email);
  } catch (error) {
    console.error("❌ Login error:", error.message);
    throw error;
  }
}

// 🚪 Logout-Funktion
async function logout() {
  try {
    await auth.signOut();
    console.log("🚪 Successfully logged out");
  } catch (error) {
    console.error("❌ Logout error:", error.message);
    throw error;
  }
}

// 🔄 Auth-State Change Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("✅ Logged in as:", user.email);
    // Optional: Update UI (e.g., show "Logout" button)
  } else {
    console.log("🚪 No user logged in");
    // Optional: Update UI (e.g., show "Login" button)
  }
});

// ➕ Registrierung
async function signup(email, password) {
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    console.log("✅ Registrierung erfolgreich:", email);
  } catch (error) {
    console.error("❌ Registrierung-Fehler:", error.message);
    throw error;
  }
}
