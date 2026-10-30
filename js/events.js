// js/events.js

document.addEventListener("DOMContentLoaded", function () {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/; // Matches 814-555-0123

  const form = document.getElementById("eventsForm");
  const message = document.getElementById("message");

  // Safety check if form is missing on the page
  if (!form) return;

  // Helper to toggle Bootstrap valid/invalid states
  function setValid(input, isValid) {
    input.classList.toggle("is-invalid", !isValid);
    input.classList.toggle("is-valid", isValid);
    return isValid;
  }

  function validateForm() {
    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    
    // Check if at least one participation radio button is selected
    const participationSelected = document.querySelector('input[name="participation"]:checked');
    const isParticipationValid = Boolean(participationSelected);
    
    // Handle radio group error styling manually
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
      // Phone is optional: empty is allowed, otherwise must match pattern
      setValid(phone, phone.value.trim() === "" || PHONE_PATTERN.test(phone.value.trim())),
      isParticipationValid
    ];

    return results.every(Boolean);
  }

  form.addEventListener("submit", async function (event) {
    // CRITICAL: Stops the page from refreshing
    event.preventDefault();
    message.classList.add("d-none");

    if (!validateForm()) {
      return;
    }

    // Retrieve the selected participation radio safely here
    const participationSelected = document.querySelector('input[name="participation"]:checked');

    // Load existing members/registrations from storage.js
    const registrations = typeof loadMembers === "function" ? await loadMembers() : [];
    const emailInput = document.getElementById("email");
    const email = emailInput.value.trim().toLowerCase();

    // Prevent duplicate email registrations
    if (registrations.some(r => r.email === email)) {
      emailInput.classList.remove("is-valid");
      emailInput.classList.add("is-invalid");
      emailInput.nextElementSibling.textContent = "This email is already registered for the event.";
      return;
    }

    // Gather all form inputs into an object
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

    registrations.push(newRegistration);

    // Save back using your storage helper
    if (typeof saveMembers === "function") {
      await saveMembers(registrations);
    }

    // Reset form state and display success message
    form.reset();
    form.querySelectorAll(".is-valid").forEach(el => el.classList.remove("is-valid"));
    emailInput.nextElementSibling.textContent = "Please enter a valid email address.";

    message.textContent = "Successfully registered for the event! We look forward to seeing you.";
    message.classList.remove("d-none");
  });
});