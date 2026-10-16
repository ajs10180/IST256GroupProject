// choices for the dropdowns
const CATEGORIES = ["News", "Events", "Opinion", "Tutorial", "Community"];
const FORMATS = ["Article", "Photo Gallery", "Video", "Podcast"];

// the list of posts loaded from data/posts.json
let posts = [];

// id of the post being edited, empty when adding a new one
let editingId = "";

// fill a dropdown with options
function fillSelect(select, items, firstLabel) {
  select.append($("<option>").val("").text(firstLabel));
  items.forEach(item => select.append($("<option>").val(item).text(item)));
}

// send the whole post list to the server, which writes it to posts.json
function savePosts() {
  return $.ajax({
    url: "/api/posts",
    method: "PUT",
    contentType: "application/json",
    data: JSON.stringify(posts)
  }).fail(function () {
    alert("Could not save to posts.json. Is the server running (npm run dev)?");
  });
}

// show a green message for 8 seconds
function showMessage(text) {
  $("#message").text(text).removeClass("d-none");
  setTimeout(() => $("#message").addClass("d-none"), 8000);
}

// rebuild the table and the json preview from the posts list
function render() {
  const body = $("#postTable").empty();

  posts.forEach(function (p) {
    const row = $("<tr>").attr("data-category", p.category);
    // .text() keeps user input from being treated as html
    row.append($("<td>").text(p.id));
    row.append($("<td>").text(p.title));
    row.append($("<td>").text(p.category));
    row.append($("<td>").text(p.format));
    row.append($("<td>").text(p.readTime + " min"));
    row.append($("<td>").text(p.info || "-"));
    row.append($("<td>").append(
      $("<button>").addClass("btn btn-sm btn-primary me-1 edit-btn").attr("data-id", p.id).text("Edit"),
      $("<button>").addClass("btn btn-sm btn-danger delete-btn").attr("data-id", p.id).text("Delete")
    ));
    body.append(row);
  });

  $("#jsonView").text(JSON.stringify(posts, null, 2));
  applyFilters();
}

// jquery search and filter: hide rows that do not match the search text or category
function applyFilters() {
  const text = $("#search").val().toLowerCase();
  const category = $("#filterCategory").val();
  let shown = 0;

  $("#postTable tr").each(function () {
    const row = $(this);
    const matchesText = row.text().toLowerCase().includes(text);
    const matchesCategory = category === "" || row.attr("data-category") === category;
    row.toggle(matchesText && matchesCategory);
    if (matchesText && matchesCategory) shown++;
  });

  $("#emptyMsg").toggleClass("d-none", shown > 0);
}

// mark a field valid or invalid so bootstrap shows the feedback text
function setValid(input, isValid) {
  input.toggleClass("is-invalid", !isValid);
  input.toggleClass("is-valid", isValid);
  return isValid;
}

// check every field and return true only if all are valid
function validateForm() {
  const id = $("#postId").val().trim();
  const readTime = Number($("#readTime").val());
  const idTaken = editingId === "" && posts.some(p => p.id.toLowerCase() === id.toLowerCase());

  // swap the id error text if the id is already used
  $("#postId").next().text(idTaken ? "That ID is already used." : "Use 2-10 letters, numbers or dashes.");

  const results = [
    setValid($("#postId"), /^[A-Za-z0-9-]{2,10}$/.test(id) && !idTaken),
    setValid($("#title"), $("#title").val().trim().length > 0),
    setValid($("#category"), $("#category").val() !== ""),
    setValid($("#format"), $("#format").val() !== ""),
    setValid($("#readTime"), $("#readTime").val() !== "" && Number.isInteger(readTime) && readTime >= 1 && readTime <= 120)
  ];

  return results.every(Boolean);
}

// put the form back to add mode
function resetForm() {
  editingId = "";
  $("#postForm")[0].reset();
  $("#postForm .form-control, #postForm .form-select").removeClass("is-valid is-invalid");
  $("#postId").prop("disabled", false);
  $("#formTitle").text("Add a Post");
  $("#saveBtn").text("Add Post");
  $("#cancelBtn").addClass("d-none");
}

// add a new post or update the one being edited
$("#postForm").on("submit", function (event) {
  event.preventDefault();
  if (!validateForm()) return;

  const post = {
    id: editingId || $("#postId").val().trim().toUpperCase(),
    title: $("#title").val().trim(),
    category: $("#category").val(),
    format: $("#format").val(),
    readTime: Number($("#readTime").val()),
    info: $("#info").val().trim()
  };

  if (editingId) {
    const index = posts.findIndex(p => p.id === editingId);
    posts[index] = post;
  } else {
    posts.push(post);
  }

  savePosts().done(function () {
    showMessage(editingId ? "Post updated." : "Post added.");
    resetForm();
    render();
  });
});

// edit button: copy the post into the form
$("#postTable").on("click", ".edit-btn", function () {
  const post = posts.find(p => p.id === $(this).attr("data-id"));
  editingId = post.id;

  $("#postId").val(post.id).prop("disabled", true);
  $("#title").val(post.title);
  $("#category").val(post.category);
  $("#format").val(post.format);
  $("#readTime").val(post.readTime);
  $("#info").val(post.info);

  $("#postForm .form-control, #postForm .form-select").removeClass("is-valid is-invalid");
  $("#formTitle").text("Update Post " + post.id);
  $("#saveBtn").text("Update Post");
  $("#cancelBtn").removeClass("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// delete button: remove the post after confirming
$("#postTable").on("click", ".delete-btn", function () {
  const id = $(this).attr("data-id");
  if (!confirm("Delete post " + id + "?")) return;

  posts = posts.filter(p => p.id !== id);
  savePosts().done(function () {
    if (editingId === id) resetForm();
    showMessage("Post deleted.");
    render();
  });
});

$("#cancelBtn").on("click", resetForm);

// search and filter as the user types or changes the dropdown
$("#search").on("input", applyFilters);
$("#filterCategory").on("change", applyFilters);

// set up the dropdowns, then load the posts from posts.json
fillSelect($("#category"), CATEGORIES, "Choose...");
fillSelect($("#format"), FORMATS, "Choose...");
fillSelect($("#filterCategory"), CATEGORIES, "All categories");

$.getJSON("/api/posts", function (data) {
  posts = data;
  render();
});
