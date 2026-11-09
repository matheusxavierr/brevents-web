(() => {
  const EVENT_DATE = new Date("2026-11-25T10:00:00-03:00").getTime();
  const pad = (value) => String(value).padStart(2, "0");

  function updateCountdown() {
    const boxes = document.querySelectorAll(".tabular-nums");
    if (boxes.length < 4) return;
    const seconds = Math.floor(Math.max(0, EVENT_DATE - Date.now()) / 1000);
    [Math.floor(seconds / 86400), Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
      .forEach((value, index) => { boxes[index].textContent = pad(value); });
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  for (const form of document.querySelectorAll(".beauty-signup-form")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      const feedback = form.querySelector(".beauty-signup-feedback");
      const fields = new FormData(form);
      button.disabled = true;
      button.textContent = button.dataset.sending;
      feedback.textContent = "";
      feedback.dataset.state = "";
      try {
        const response = await fetch("/api/backend/public/beauty-bridge/signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fields.get("name"),
            company: fields.get("company"),
            email: fields.get("email"),
            website: fields.get("website"),
            language: form.dataset.language,
          }),
        });
        if (!response.ok) throw new Error(`Registration request failed: ${response.status}`);
        form.reset();
        feedback.textContent = feedback.dataset.success;
      } catch (error) {
        console.error("Beauty Bridge registration failed", error);
        feedback.textContent = feedback.dataset.error;
        feedback.dataset.state = "error";
      } finally {
        button.disabled = false;
        button.textContent = button.dataset.idle;
      }
    });
  }
})();
