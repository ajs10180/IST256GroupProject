let products = [];

// Rebuild the table and the JSON preview
function render() {
  const body = $("#productTable").empty();

  products.forEach(function (p) {
    const row = $("<tr>");
    row.append($("<td>").text(p.id));
    row.append($("<td>").text(p.name));
    row.append($("<td>").text("$" + Number(p.price).toFixed(2)));
    row.append($("<td>").append(
      $("<button>").addClass("btn btn-sm btn-success add-cart-btn").attr("data-id", p.id).text("Add to Cart")
    ));
    body.append(row);
  });

  $("#jsonView").text(JSON.stringify(products, null, 2));
  applyFilters();
}

// Live jQuery search filter
function applyFilters() {
  const text = $("#search").val().toLowerCase();
  let shown = 0;

  $("#productTable tr").each(function () {
    const row = $(this);
    const matchesText = row.text().toLowerCase().includes(text);
    row.toggle(matchesText);
    if (matchesText) shown++;
  });

  $("#emptyMsg").toggleClass("d-none", shown > 0);
}

// Add to cart functionality
$("#productTable").on("click", ".add-cart-btn", function () {
  const id = $(this).attr("data-id");
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const existing = cart.find(item => item.id === id);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: id, quantity: 1 });
  }
  
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Added product " + id + " to your cart!");
});

// Search input handler
$("#search").on("input", applyFilters);

// Load products directly from data/products.json
$.getJSON("data/products.json", function (data) {
  products = data;
  render();
});