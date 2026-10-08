// members are stored as a json string in the browser's localstorage
const STORAGE_KEY = "blogMembers";

// load the member list (an array of objects) from json
function loadMembers() {
  const json = localStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

// save the member list back as a json string
function saveMembers(members) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members, null, 2));
}

// shared validation rules used by the sign up and edit forms
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{3}-?\d{3}-?\d{4}$/;

function isValidAge(value) {
  const age = Number(value);
  return value !== "" && Number.isInteger(age) && age >= 13 && age <= 120;
}
