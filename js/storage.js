// members are saved in data/members.json through the dev server api (see dev.js)
async function loadMembers() {
  const response = await fetch("/api/members");
  return response.json();
}

// send the whole member list to the server, which writes it to members.json
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

// shared validation rules used by the sign up and edit forms
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{3}-?\d{3}-?\d{4}$/;

function isValidAge(value) {
  const age = Number(value);
  return value !== "" && Number.isInteger(age) && age >= 13 && age <= 120;
}
