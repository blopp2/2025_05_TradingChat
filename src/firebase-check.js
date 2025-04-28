window.addEventListener("load", () => {
  if (typeof firebase === "undefined") {
    console.error("❌ Firebase SDK not loaded!");
    const authSection = document.getElementById("auth-section");
    if (authSection) {
      authSection.innerHTML = `
        <div class="auth-error">
          🚫 Login service unavailable.
        `;
    }
  }
});
