// the list of products loaded from data/products.json
let products = [];

// the cart is a list of ids and quantities kept in the browser, like [{ id: "PROD01", quantity: 2 }]
function loadCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// look up the full product details for an id
function findProduct(id) {
  return products.find(p => p.id === id);
}

// rebuild the table, the total and the json preview from the cart
function render() {
  // drop any items whose product was deleted from products.json
  const cart = loadCart().filter(item => findProduct(item.id));
  saveCart(cart);

  const body = $("#cartTable").empty();
  let total = 0;

  cart.forEach(function (item) {
    const product = findProduct(item.id);
    const subtotal = product.price * item.quantity;
    total += subtotal;

    const row = $("<tr>");
    // .text() keeps product data from being treated as html
    row.append($("<td>").text(product.id));
    row.append($("<td>").text(product.description));
    row.append($("<td>").text(product.unit));
    row.append($("<td>").text("$" + product.price.toFixed(2)));
    row.append($("<td>").append(
      $("<button>").addClass("btn btn-sm btn-outline-secondary minus-btn").attr("data-id", item.id).text("-"),
      $("<span>").addClass("mx-2").text(item.quantity),
      $("<button>").addClass("btn btn-sm btn-outline-secondary plus-btn").attr("data-id", item.id).text("+")
    ));
    row.append($("<td>").text("$" + subtotal.toFixed(2)));
    row.append($("<td>").append(
      $("<button>").addClass("btn btn-sm btn-danger remove-btn").attr("data-id", item.id).text("Remove")
    ));
    body.append(row);
  });

  $("#total").text("$" + total.toFixed(2));
  $("#emptyMsg").toggleClass("d-none", cart.length > 0);
  $("#clearBtn").prop("disabled", cart.length === 0);
  $("#jsonView").text(JSON.stringify(cart, null, 2));
}

// plus and minus buttons change the quantity, minus removes the item at 1
$("#cartTable").on("click", ".plus-btn, .minus-btn", function () {
  const cart = loadCart();
  const item = cart.find(i => i.id === $(this).attr("data-id"));
  item.quantity += $(this).hasClass("plus-btn") ? 1 : -1;

  saveCart(cart.filter(i => i.quantity > 0));
  render();
});

// remove button takes the whole item out of the cart
$("#cartTable").on("click", ".remove-btn", function () {
  const id = $(this).attr("data-id");
  saveCart(loadCart().filter(i => i.id !== id));
  render();
});

// clear button empties the cart after confirming
$("#clearBtn").on("click", function () {
  if (!confirm("Remove everything from your cart?")) return;
  saveCart([]);
  render();
});

// jquery search: find products in the json by any word and list them with add buttons
function searchProducts() {
  const text = $("#search").val().trim().toLowerCase();
  const list = $("#searchResults").empty();
  $("#noResults").addClass("d-none");
  if (text === "") return;

  const matches = $.grep(products, p => Object.values(p).join(" ").toLowerCase().includes(text));

  matches.forEach(function (p) {
    const item = $("<li>").addClass("list-group-item d-flex justify-content-between align-items-center");
    item.append($("<span>").text(p.description + " (" + p.category + ") - $" + p.price.toFixed(2)));
    item.append($("<button>").addClass("btn btn-sm btn-success add-btn").attr("data-id", p.id).text("Add to Cart"));
    list.append(item);
  });

  $("#noResults").toggleClass("d-none", matches.length > 0);
}

$("#search").on("input", searchProducts);

// add button puts the product in the cart, or raises the quantity if it is already there
$("#searchResults").on("click", ".add-btn", function () {
  const id = $(this).attr("data-id");
  const cart = loadCart();
  const existing = cart.find(i => i.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: id, quantity: 1 });
  }

  saveCart(cart);
  render();
});

// load the products first so the cart can show descriptions and prices
$.getJSON("/api/products", function (data) {
  products = data;
  render();
});
