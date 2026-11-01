// js/events.js

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("eventsForm");
  const message = document.getElementById("message");

  if (!form) return;

  function setValid(input, isValid) {
    input.classList.toggle("is-invalid", !isValid);
    input.classList.toggle("is-valid", isValid);
    return isValid;
  }

  function validateForm() {
    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    
    const participationSelected = document.querySelector('input[name="participation"]:checked');
    const isParticipationValid = Boolean(participationSelected);
    
    const participationFeedback = document.getElementById("participation-feedback");
    if (participationFeedback) {
      const participationContainer = participationFeedback.parentElement;
      if (!isParticipationValid) {
        participationContainer.classList.add("is-invalid");
      } else {
        participationContainer.classList.remove("is-invalid");
      }
    }

    const results = [
      setValid(name, name.value.trim().length > 0),
      setValid(email, EMAIL_PATTERN.test(email.value.trim())),
      setValid(phone, phone.value.trim() === "" || PHONE_PATTERN.test(phone.value.trim())),
      isParticipationValid
    ];

    return results.every(Boolean);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.classList.add("d-none");

    if (!validateForm()) {
      return;
    }

    const participationSelected = document.querySelector('input[name="participation"]:checked');
    const emailInput = document.getElementById("email");
    const email = emailInput.value.trim().toLowerCase();

    // 1. Load ONLY existing event registrations from events.json
    const events = typeof loadEvents === "function" ? await loadEvents() : [];

    // Check duplicate email specifically within the event list
    if (events.some(e => e.email === email)) {
      emailInput.classList.remove("is-valid");
      emailInput.classList.add("is-invalid");
      emailInput.nextElementSibling.textContent = "This email is already registered for the event.";
      return;
    }

    // Build the registration object
    const newRegistration = {
      id: Date.now(),
      name: document.getElementById("name").value.trim(),
      email: email,
      phone: document.getElementById("phone").value.trim(),
      organization: document.getElementById("organization").value.trim(),
      job: document.getElementById("job").value.trim(),
      participation: participationSelected.value,
      sessions: Array.from(document.querySelectorAll('input[name="sessions"]:checked')).map(el => el.value)
    };

    // 2. Add to events array
    events.push(newRegistration);

    // 3. Save ONLY to events.json via AJAX PUT request (leaving members.json untouched)
    if (typeof saveEvents === "function") {
      await saveEvents(events);
    }

    // Reset form and show success message
    form.reset();
    form.querySelectorAll(".is-valid").forEach(el => el.classList.remove("is-valid"));
    emailInput.nextElementSibling.textContent = "Please enter a valid email address.";

    message.textContent = "Successfully registered! Your data has been saved to events.json.";
    message.classList.remove("d-none");
  });
});