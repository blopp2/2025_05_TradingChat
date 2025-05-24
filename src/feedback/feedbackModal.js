// src/feedback/feedbackModal.js

let feedbackModal,
  feedbackClose,
  feedbackText,
  feedbackSubmitBtn,
  feedbackMessage;

/**
 * Öffnet das Feedback-Modal
 */
export function openFeedbackModal() {
  if (!feedbackModal) setupFeedbackModal();
  resetFeedbackModal();
  feedbackModal.classList.remove("hidden");
}

/**
 * Schließt das Feedback-Modal
 */
export function closeFeedbackModal() {
  if (!feedbackModal) setupFeedbackModal();
  feedbackModal.classList.add("hidden");
}

/**
 * Setup/Init einmalig (DOM-Referenzen, Events)
 */
function setupFeedbackModal() {
  feedbackModal = document.getElementById("feedback-modal");
  feedbackClose = document.getElementById("feedback-close");
  feedbackText = document.getElementById("feedback-text");
  feedbackSubmitBtn = document.getElementById("feedback-submit-btn");
  feedbackMessage = document.getElementById("feedback-message");

  feedbackClose.addEventListener("click", closeFeedbackModal);
  feedbackSubmitBtn.addEventListener("click", handleFeedbackSubmit);
}

/**
 * Absenden/Verarbeiten Feedback
 */
async function handleFeedbackSubmit() {
  const text = feedbackText.value.trim();

  if (!text) {
    feedbackMessage.textContent = "❌ Please enter your feedback.";
    return;
  }

  feedbackSubmitBtn.disabled = true;
  feedbackMessage.textContent = "";

  try {
    // TODO: Hier eigene API/Firestore/Backend callen!
    // await sendFeedbackToBackend(text);
    await new Promise((resolve) => setTimeout(resolve, 600)); // Demo

    feedbackMessage.textContent = "✅ Thank you for your feedback!";
    feedbackText.value = "";
    setTimeout(() => closeFeedbackModal(), 1200);
  } catch (err) {
    feedbackMessage.textContent = "❌ Failed to send feedback. Try again.";
  } finally {
    feedbackSubmitBtn.disabled = false;
  }
}

/**
 * Reset nach Öffnen
 */
function resetFeedbackModal() {
  feedbackText.value = "";
  feedbackMessage.textContent = "";
  feedbackSubmitBtn.disabled = false;
}
