// feedback.js
import { getSessionToken, isLoggedIn } from "../auth.js";

const PROXY = "https://snapchart-proxy.brightcompass.workers.dev";

const fbBtn = document.getElementById("feedback-btn");
const fbModal = document.getElementById("feedback-modal");
const fbClose = document.getElementById("feedback-close");
const fbText = document.getElementById("feedback-text");
const fbSubmit = document.getElementById("feedback-submit-btn");
const fbError = document.getElementById("feedback-error");

// open modal
fbBtn.addEventListener("click", () => {
  if (!isLoggedIn()) {
    alert("Please log in first to submit feedback.");
    return;
  }
  fbText.value = "";
  fbError.textContent = "";
  fbModal.classList.remove("hidden");
});

// close modal
fbClose.addEventListener("click", () => fbModal.classList.add("hidden"));

// submit
fbSubmit.addEventListener("click", async () => {
  const text = fbText.value.trim();
  if (!text) {
    fbError.textContent = "Feedback cannot be empty.";
    return;
  }

  try {
    const token = getSessionToken();
    const res = await fetch(`${PROXY}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to send feedback");
    }
    alert("Thanks for your input!");
    fbModal.classList.add("hidden");
  } catch (e) {
    fbError.textContent = e.message;
  }
});
