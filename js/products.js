// choices for the dropdowns
const CATEGORIES = ["Lawn & Garden", "Building Materials", "Tools", "Outdoor Living"];
const UNITS = ["Each", "Pack", "Bag", "Pallet"];

// the list of products loaded from data/products.json
let products = [];

// id of the product being edited, empty when adding a new one
let editingId = "";

// fill a dropdown with options
function fillSelect(select, items, firstLabel) {
  select.append($("<option>").val("").text(firstLabel));
  items.forEach(item => select.append($("<option>").val(item).text(item)));
}

// send the whole product list to the server, which writes it to products.json
function saveProducts() {
  return $.ajax({
    url: "/api/products",
    method: "PUT",
    contentType: "application/json",
    data: JSON.stringify(products)
  }).fail(function () {
    alert("Could not save to products.json. Is the server running (npm run dev)?");
  });
}

// show a green message for a few seconds
function showMessage(text) {
  $("#message").text(text).removeClass("d-none");
  setTimeout(() => $("#message").addClass("d-none"), 3000);
}

// rebuild the table and the json preview from the products list
function render() {
  const body = $("#productTable").empty();

  products.forEach(function (p) {
    const row = $("<tr>").attr("data-category", p.category);
    // .text() keeps user input from being treated as html
    row.append($("<td>").text(p.id));
    row.append($("<td>").text(p.description));
    row.append($("<td>").text(p.category));
    row.append($("<td>").text(p.unit));
    row.append($("<td>").text("$" + Number(p.price).toFixed(2)));
    row.append($("<td>").text(p.weight === "" ? "-" : p.weight + " lbs"));
    row.append($("<td>").text(p.color || "-"));
    row.append($("<td>").append(
      $("<button>").addClass("btn btn-sm btn-success me-1 add-cart-btn").attr("data-id", p.id).text("Add to Cart"),
      $("<button>").addClass("btn btn-sm btn-primary me-1 edit-btn").attr("data-id", p.id).text("Edit"),
      $("<button>").addClass("btn btn-sm btn-danger delete-btn").attr("data-id", p.id).text("Delete")
    ));
    body.append(row);
  });

  $("#jsonView").text(JSON.stringify(products, null, 2));
  applyFilters();
}

// jquery search and filter: hide rows that do not match the search text or category
function applyFilters() {
  const text = $("#search").val().toLowerCase();
  const category = $("#filterCategory").val();
  let shown = 0;

  $("#productTable tr").each(function () {
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
  const id = $("#productId").val().trim();
  const price = Number($("#price").val());
  const weight = $("#weight").val();
  const idTaken = editingId === "" && products.some(p => p.id.toLowerCase() === id.toLowerCase());

  // swap the id error text if the id is already used
  $("#productId").next().text(idTaken ? "That ID is already used." : "Use 2-10 letters, numbers or dashes.");

  const results = [
    setValid($("#productId"), /^[A-Za-z0-9-]{2,10}$/.test(id) && !idTaken),
    setValid($("#description"), $("#description").val().trim().length > 0),
    setValid($("#category"), $("#category").val() !== ""),
    setValid($("#unit"), $("#unit").val() !== ""),
    setValid($("#price"), $("#price").val() !== "" && price > 0),
    // weight is optional so empty is allowed
    setValid($("#weight"), weight === "" || Number(weight) >= 0)
  ];

  return results.every(Boolean);
}

// put the form back to add mode
function resetForm() {
  editingId = "";
  $("#productForm")[0].reset();
  $("#productForm .form-control, #productForm .form-select").removeClass("is-valid is-invalid");
  $("#productId").prop("disabled", false);
  $("#formTitle").text("Add a Product");
  $("#saveBtn").text("Add Product");
  $("#cancelBtn").addClass("d-none");
}

// add a new product or update the one being edited
$("#productForm").on("submit", function (event) {
  event.preventDefault();
  if (!validateForm()) return;

  const product = {
    id: editingId || $("#productId").val().trim().toUpperCase(),
    description: $("#description").val().trim(),
    category: $("#category").val(),
    unit: $("#unit").val(),
    price: Number(Number($("#price").val()).toFixed(2)),
    weight: $("#weight").val() === "" ? "" : Number($("#weight").val()),
    color: $("#color").val().trim()
  };

  if (editingId) {
    const index = products.findIndex(p => p.id === editingId);
    products[index] = product;
  } else {
    products.push(product);
  }

  saveProducts().done(function () {
    showMessage(editingId ? "Product updated." : "Product added.");
    resetForm();
    render();
  });
});

// edit button: copy the product into the form
$("#productTable").on("click", ".edit-btn", function () {
  const product = products.find(p => p.id === $(this).attr("data-id"));
  editingId = product.id;

  $("#productId").val(product.id).prop("disabled", true);
  $("#description").val(product.description);
  $("#category").val(product.category);
  $("#unit").val(product.unit);
  $("#price").val(product.price);
  $("#weight").val(product.weight);
  $("#color").val(product.color);

  $("#productForm .form-control, #productForm .form-select").removeClass("is-valid is-invalid");
  $("#formTitle").text("Update Product " + product.id);
  $("#saveBtn").text("Update Product");
  $("#cancelBtn").removeClass("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// delete button: remove the product after confirming
$("#productTable").on("click", ".delete-btn", function () {
  const id = $(this).attr("data-id");
  if (!confirm("Delete product " + id + "?")) return;

  products = products.filter(p => p.id !== id);
  saveProducts().done(function () {
    if (editingId === id) resetForm();
    showMessage("Product deleted.");
    render();
  });
});

// add to cart button: the cart is kept in the browser until it is sent to the api (see cart.js)
$("#productTable").on("click", ".add-cart-btn", function () {
  const id = $(this).attr("data-id");
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: id, quantity: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  showMessage("Added " + id + " to your cart.");
});

$("#cancelBtn").on("click", resetForm);

// search and filter as the user types or changes the dropdown
$("#search").on("input", applyFilters);
$("#filterCategory").on("change", applyFilters);

// set up the dropdowns, then load the products from products.json
fillSelect($("#category"), CATEGORIES, "Choose...");
fillSelect($("#unit"), UNITS, "Choose...");
fillSelect($("#filterCategory"), CATEGORIES, "All categories");

$.getJSON("/api/products", function (data) {
  products = data;
  render();
});
