const form = document.getElementById("signupForm");
const message = document.getElementById("message");

// mark a field valid or invalid so bootstrap shows the feedback text
function setValid(input, isValid) {
  input.classList.toggle("is-invalid", !isValid);
  input.classList.toggle("is-valid", isValid);
  return isValid;
}

// check every field and return true only if all are valid
function validateForm() {
  const name = document.getElementById("name");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");
  const age = document.getElementById("age");
  const address = document.getElementById("address");

  const results = [
    setValid(name, name.value.trim().length > 0),
    setValid(email, EMAIL_PATTERN.test(email.value.trim())),
    // phone is optional so empty is allowed
    setValid(phone, phone.value.trim() === "" || PHONE_PATTERN.test(phone.value.trim())),
    setValid(age, isValidAge(age.value)),
    setValid(address, address.value.trim().length > 0)
  ];

  return results.every(Boolean);
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  message.classList.add("d-none");

  if (!validateForm()) {
    return;
  }

  const members = loadMembers();
  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim().toLowerCase();

  // block duplicate emails
  if (members.some(m => m.email === email)) {
    emailInput.classList.remove("is-valid");
    emailInput.classList.add("is-invalid");
    emailInput.nextElementSibling.textContent = "That email is already registered.";
    return;
  }

  members.push({
    id: Date.now(),
    name: document.getElementById("name").value.trim(),
    email: email,
    phone: document.getElementById("phone").value.trim(),
    age: Number(document.getElementById("age").value),
    address: document.getElementById("address").value.trim()
  });
  saveMembers(members);

  form.reset();
  form.querySelectorAll(".is-valid").forEach(el => el.classList.remove("is-valid"));
  emailInput.nextElementSibling.textContent = "Please enter a valid email address.";
  message.textContent = "Thanks for signing up! You can view your info on the Members page.";
  message.classList.remove("d-none");
});
