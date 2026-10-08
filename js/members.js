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
function render() {
  const members = loadMembers();
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
function openEdit(id) {
  const member = loadMembers().find(m => m.id === id);
  document.getElementById("editId").value = member.id;
  document.getElementById("editName").value = member.name;
  document.getElementById("editEmail").value = member.email;
  document.getElementById("editPhone").value = member.phone;
  document.getElementById("editAge").value = member.age;
  document.getElementById("editAddress").value = member.address;
  editForm.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
  editModal.show();
}

function deleteMember(id) {
  if (confirm("Delete this member?")) {
    saveMembers(loadMembers().filter(m => m.id !== id));
    render();
  }
}

// validate the edit form, then save the updated member
editForm.addEventListener("submit", function (event) {
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
  const members = loadMembers();
  const member = members.find(m => m.id === id);
  member.name = name.value.trim();
  member.email = email.value.trim().toLowerCase();
  member.phone = phone.value.trim();
  member.age = Number(age.value);
  member.address = address.value.trim();

  saveMembers(members);
  editModal.hide();
  render();
});

// let the user save the stored data as the members.json file
document.getElementById("downloadBtn").addEventListener("click", function () {
  const blob = new Blob([JSON.stringify(loadMembers(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "members.json";
  link.click();
});

render();
