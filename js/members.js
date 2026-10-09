const tableBody = document.getElementById("memberTable");
const emptyMsg = document.getElementById("emptyMsg");
const jsonView = document.getElementById("jsonView");
const editModal = new bootstrap.Modal(document.getElementById("editModal"));
const editForm = document.getElementById("editForm");

// escape text so user input cannot inject html into the table
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// rebuild the table and the json preview from stored data
async function render() {
  const members = await loadMembers();
  tableBody.innerHTML = "";

  members.forEach(function (m) {
    const row = document.createElement("tr");
    row.innerHTML =
      "<td>" + escapeHtml(m.name) + "</td>" +
      "<td>" + escapeHtml(m.email) + "</td>" +
      "<td>" + escapeHtml(m.phone || "-") + "</td>" +
      "<td>" + m.age + "</td>" +
      "<td>" + escapeHtml(m.address) + "</td>" +
      "<td>" +
        '<button class="btn btn-sm btn-primary me-1" onclick="openEdit(' + m.id + ')">Edit</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteMember(' + m.id + ')">Delete</button>' +
      "</td>";
    tableBody.appendChild(row);
  });

  emptyMsg.classList.toggle("d-none", members.length > 0);
  jsonView.textContent = JSON.stringify(members, null, 2);
}

// fill the edit form with the chosen member and show it
async function openEdit(id) {
  const member = (await loadMembers()).find(m => m.id === id);
  document.getElementById("editId").value = member.id;
  document.getElementById("editName").value = member.name;
  document.getElementById("editEmail").value = member.email;
  document.getElementById("editPhone").value = member.phone;
  document.getElementById("editAge").value = member.age;
  document.getElementById("editAddress").value = member.address;
  editForm.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
  editModal.show();
}

async function deleteMember(id) {
  if (confirm("Delete this member?")) {
    await saveMembers((await loadMembers()).filter(m => m.id !== id));
    await render();
  }
}

// validate the edit form, then save the updated member
editForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const name = document.getElementById("editName");
  const email = document.getElementById("editEmail");
  const phone = document.getElementById("editPhone");
  const age = document.getElementById("editAge");
  const address = document.getElementById("editAddress");

  const checks = [
    [name, name.value.trim().length > 0],
    [email, EMAIL_PATTERN.test(email.value.trim())],
    [phone, phone.value.trim() === "" || PHONE_PATTERN.test(phone.value.trim())],
    [age, isValidAge(age.value)],
    [address, address.value.trim().length > 0]
  ];

  let allValid = true;
  checks.forEach(function (check) {
    check[0].classList.toggle("is-invalid", !check[1]);
    if (!check[1]) allValid = false;
  });
  if (!allValid) return;

  const id = Number(document.getElementById("editId").value);
  const members = await loadMembers();
  const member = members.find(m => m.id === id);
  member.name = name.value.trim();
  member.email = email.value.trim().toLowerCase();
  member.phone = phone.value.trim();
  member.age = Number(age.value);
  member.address = address.value.trim();

  await saveMembers(members);
  editModal.hide();
  await render();
});

render();
