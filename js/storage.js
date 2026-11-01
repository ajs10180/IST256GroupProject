// --- Members API (Untouched & Safe) ---
async function loadMembers() {
  const response = await fetch("/api/members");
  return response.json();
}

async function saveMembers(members) {
  const response = await fetch("/api/members", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(members)
  });
  if (!response.ok) {
    alert("Could not save to members.json. Is the server running (npm run dev)?");
  }
}

// --- Events API (Dedicated to events.json) ---
async function loadEvents() {
  const response = await fetch("/api/events");
  return response.json();
}

async function saveEvents(events) {
  const response = await fetch("/api/events", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events)
  });
  if (!response.ok) {
    alert("Could not save to events.json. Is the server running (npm run dev)?");
  }
}

// Shared validation rules
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{3}-?\d{3}-?\d{4}$/;

function isValidAge(value) {
  const age = Number(value);
  return value !== "" && Number.isInteger(age) && age >= 13 && age <= 120;
}
