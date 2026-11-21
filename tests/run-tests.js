// end to end tests for the storefront rest api. run the server first (npm run dev), then in another terminal:
//
//   npm test -- --tester "Your Name"
//
// every case sends real requests to the running server, so each one also checks that MongoDB saved (or removed) the data.
// the results are printed and written to tests/test-plan.csv with the columns the test plan spreadsheet needs.
// cases marked Manual are browser steps nobody can run from a script, fill in their results by hand.
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "test-plan.csv");
const testerFlag = process.argv.indexOf("--tester");
const TESTER = process.env.TESTER || (testerFlag > -1 && process.argv[testerFlag + 1]) || "";
const TODAY = new Date().toISOString().slice(0, 10);

const COLUMNS = ["Test ID", "Test Date", "Tester", "Area Tested", "Testing Actions Performed", "Expected Results", "Actual Results", "Pass/Fail", "Comments", "Bug Fixed On Date"];

// send a request and return { status, body }. a body that is not json comes back as text
async function api(method, url, body, rawBody) {
  const options = { method: method, headers: {} };
  if (rawBody !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = rawBody;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(BASE + url, options);
  const text = await response.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (e) { /* keep the text */ }
  return { status: response.status, body: parsed };
}

// throws when the check fails, so the case is marked Fail with this message as the actual result
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(res, status, what) {
  expect(res.status === status, what + ": expected " + status + " but got " + res.status + " " + JSON.stringify(res.body));
}

const goodMember = (n) => ({ name: "Test Member " + n, email: "member" + n + "@test.example.com", phone: "814-555-0100", age: 30, address: "1 Test Lane, State College, PA" });
const goodProduct = (id) => ({ id: id, description: "Test Product", category: "Tools", unit: "Each", price: 12.5, weight: 3, color: "Blue" });
const goodBilling = () => ({ fullName: "Test Buyer", paymentMethod: "Credit Card", address: { street: "1 Test Lane", city: "State College", state: "PA", zipCode: "16801" } });
const goodReturn = (email) => ({ name: "Test Returner", email: email, orderNumber: "ORD-1001", resolution: "Refund", comments: "", items: [{ id: "TEST-P1", quantity: 2, reason: "Defective or damaged", condition: "Damaged" }] });

const cases = [];
function test(id, area, action, expected, run) {
  cases.push({ id, area, action, expected, run });
}
// browser steps the group runs by hand, the result columns stay empty
function manual(id, area, action, expected) {
  cases.push({ id, area, action, expected, manual: true });
}

// ---------- server and database ----------
test("SYS-01", "Server / Database", "GET /api/health", "200 with status ok and the ist256 database name", async function () {
  const res = await api("GET", "/api/health");
  expectStatus(res, 200, "health");
  expect(res.body.status === "ok" && res.body.database === "ist256", "unexpected body " + JSON.stringify(res.body));
  return "200, status ok, database " + res.body.database;
});

test("SYS-02", "Server / Database", "PUT /api/health (wrong method)", "405 with an Allow header message", async function () {
  const res = await api("PUT", "/api/health", {});
  expectStatus(res, 405, "wrong method");
  return "405 " + res.body.error;
});

test("SYS-03", "Server / Database", "GET /api/unknown-collection", "404, not a database error", async function () {
  const res = await api("GET", "/api/unknown-collection");
  expectStatus(res, 404, "unknown route");
  return "404 Not found";
});

// ---------- members (the shoppers) ----------
test("MEM-01", "Members (Shoppers) - Create", "POST /api/members with a valid member", "201, server adds a numeric id and lowercases the email", async function (ctx) {
  const res = await api("POST", "/api/members", Object.assign(goodMember(1), { email: "Member1@Test.Example.com" }));
  expectStatus(res, 201, "create member");
  expect(typeof res.body.id === "number", "id should be a number, got " + res.body.id);
  expect(res.body.email === "member1@test.example.com", "email was not lowercased: " + res.body.email);
  ctx.memberId = res.body.id;
  return "201, id " + res.body.id + ", email " + res.body.email;
});

test("MEM-02", "Members (Shoppers) - Read", "GET /api/members and GET /api/members/:id", "the new member is in the list and can be read by id", async function (ctx) {
  const list = await api("GET", "/api/members");
  expectStatus(list, 200, "list members");
  expect(list.body.some(m => m.id === ctx.memberId), "new member is not in the list");
  const one = await api("GET", "/api/members/" + ctx.memberId);
  expectStatus(one, 200, "read member");
  expect(one.body.name === "Test Member 1", "wrong member " + JSON.stringify(one.body));
  return "listed (" + list.body.length + " members) and read by id";
});

test("MEM-03", "Members (Shoppers) - Update", "PUT /api/members/:id with a new age and address, then GET it again", "200 and the change is still there on the next read", async function (ctx) {
  const res = await api("PUT", "/api/members/" + ctx.memberId, Object.assign(goodMember(1), { age: 41, address: "9 New Road, Erie, PA" }));
  expectStatus(res, 200, "update member");
  const again = await api("GET", "/api/members/" + ctx.memberId);
  expect(again.body.age === 41 && again.body.address === "9 New Road, Erie, PA", "update was not saved: " + JSON.stringify(again.body));
  expect(again.body.id === ctx.memberId, "id changed to " + again.body.id);
  return "200, age 41 and new address saved, id unchanged";
});

test("MEM-04", "Members (Shoppers) - Negative", "POST /api/members with the same email as an existing member", "409 duplicate email", async function () {
  const res = await api("POST", "/api/members", goodMember(1));
  expectStatus(res, 409, "duplicate email");
  return "409 " + res.body.error;
});

test("MEM-05", "Members (Shoppers) - Negative", "PUT /api/members/:id using another member's email", "409 duplicate email, the member is not changed", async function (ctx) {
  const other = await api("POST", "/api/members", goodMember(2));
  expectStatus(other, 201, "create second member");
  ctx.otherMemberId = other.body.id;
  const res = await api("PUT", "/api/members/" + ctx.otherMemberId, goodMember(1));
  expectStatus(res, 409, "duplicate email on update");
  return "409 " + res.body.error;
});

test("MEM-06", "Members (Shoppers) - Negative", "POST /api/members with a bad email, a 12 year old, no address and a short phone", "422 with a message for each bad field", async function () {
  const res = await api("POST", "/api/members", { name: "Bad", email: "not-an-email", phone: "123", age: 12, address: "" });
  expectStatus(res, 422, "invalid member");
  const fields = Object.keys(res.body.details || {}).sort().join(",");
  expect(fields === "address,age,email,phone", "expected errors on address,age,email,phone but got " + fields);
  return "422, errors on " + fields;
});

test("MEM-07", "Members (Shoppers) - Edge", "POST members aged 13 and 120 (allowed) and 121 (too old)", "13 and 120 return 201, 121 returns 422", async function () {
  const young = await api("POST", "/api/members", Object.assign(goodMember(3), { age: 13 }));
  const old = await api("POST", "/api/members", Object.assign(goodMember(4), { age: 120 }));
  const tooOld = await api("POST", "/api/members", Object.assign(goodMember(5), { age: 121 }));
  expectStatus(young, 201, "age 13");
  expectStatus(old, 201, "age 120");
  expectStatus(tooOld, 422, "age 121");
  await api("DELETE", "/api/members/" + young.body.id);
  await api("DELETE", "/api/members/" + old.body.id);
  return "13 -> 201, 120 -> 201, 121 -> 422";
});

test("MEM-08", "Members (Shoppers) - Negative", "POST /api/members with a body that is not valid JSON", "400 and nothing is saved", async function () {
  const res = await api("POST", "/api/members", undefined, "{ this is not json");
  expectStatus(res, 400, "bad json");
  return "400 " + res.body.error;
});

test("MEM-09", "Members (Shoppers) - Delete", "DELETE /api/members/:id, then GET it again", "204, then 404", async function (ctx) {
  const del = await api("DELETE", "/api/members/" + ctx.memberId);
  expectStatus(del, 204, "delete member");
  const again = await api("GET", "/api/members/" + ctx.memberId);
  expectStatus(again, 404, "read deleted member");
  await api("DELETE", "/api/members/" + ctx.otherMemberId);
  return "204, then 404 on the next read";
});

test("MEM-10", "Members (Shoppers) - Negative", "GET, PUT and DELETE /api/members/0 (no such member)", "404 for all three", async function () {
  const get = await api("GET", "/api/members/0");
  const put = await api("PUT", "/api/members/0", goodMember(6));
  const del = await api("DELETE", "/api/members/0");
  expect(get.status === 404 && put.status === 404 && del.status === 404, "got " + [get.status, put.status, del.status].join(", "));
  return "404, 404, 404";
});

// ---------- products ----------
test("PRO-01", "Products - Create", "POST /api/products with a lowercase id test-p1", "201, the id is saved in capitals and the price rounded to cents", async function (ctx) {
  await api("DELETE", "/api/products/TEST-P1");
  const res = await api("POST", "/api/products", Object.assign(goodProduct("test-p1"), { price: 9.999 }));
  expectStatus(res, 201, "create product");
  expect(res.body.id === "TEST-P1", "id was " + res.body.id);
  expect(res.body.price === 10, "price was " + res.body.price);
  return "201, id " + res.body.id + ", price " + res.body.price;
});

test("PRO-02", "Products - Read", "GET /api/products and GET /api/products/TEST-P1", "the new product is in the list and can be read by id", async function () {
  const list = await api("GET", "/api/products");
  expectStatus(list, 200, "list products");
  expect(list.body.some(p => p.id === "TEST-P1"), "TEST-P1 is not in the list");
  const one = await api("GET", "/api/products/TEST-P1");
  expectStatus(one, 200, "read product");
  return "listed (" + list.body.length + " products) and read by id";
});

test("PRO-03", "Products - Update", "PUT /api/products/TEST-P1 with a new price and color, then GET it again", "200 and the new values are saved", async function () {
  const res = await api("PUT", "/api/products/TEST-P1", Object.assign(goodProduct("TEST-P1"), { price: 15.75, color: "Green" }));
  expectStatus(res, 200, "update product");
  const again = await api("GET", "/api/products/TEST-P1");
  expect(again.body.price === 15.75 && again.body.color === "Green", "update was not saved: " + JSON.stringify(again.body));
  return "200, price 15.75 and color Green saved";
});

test("PRO-04", "Products - Negative", "POST /api/products with an id that already exists", "409 duplicate id", async function () {
  const res = await api("POST", "/api/products", goodProduct("TEST-P1"));
  expectStatus(res, 409, "duplicate product id");
  return "409 " + res.body.error;
});

test("PRO-05", "Products - Negative", "POST /api/products with price 0, an unknown category, unit Crate and a negative weight", "422 with a message for each bad field", async function () {
  const res = await api("POST", "/api/products", { id: "TEST-P2", description: "Bad", category: "Toys", unit: "Crate", price: 0, weight: -1 });
  expectStatus(res, 422, "invalid product");
  const fields = Object.keys(res.body.details || {}).sort().join(",");
  expect(fields === "category,price,unit,weight", "expected errors on category,price,unit,weight but got " + fields);
  return "422, errors on " + fields;
});

test("PRO-06", "Products - Edge", "POST /api/products with the price sent as the text \"12.50\" and with an empty weight", "text price is rejected with 422, empty weight is allowed with 201", async function () {
  const text = await api("POST", "/api/products", Object.assign(goodProduct("TEST-P3"), { price: "12.50" }));
  expectStatus(text, 422, "price as text");
  const empty = await api("POST", "/api/products", Object.assign(goodProduct("TEST-P3"), { weight: "" }));
  expectStatus(empty, 201, "empty weight");
  await api("DELETE", "/api/products/TEST-P3");
  return "text price -> 422, empty weight -> 201";
});

test("PRO-07", "Products - Update", "PUT /api/products (whole list) with the list that was just read", "200 and the number of products does not change", async function () {
  const before = await api("GET", "/api/products");
  const put = await api("PUT", "/api/products", before.body);
  expectStatus(put, 200, "replace product list");
  const after = await api("GET", "/api/products");
  expect(after.body.length === before.body.length, "count went from " + before.body.length + " to " + after.body.length);
  return "200, still " + after.body.length + " products";
});

test("PRO-08", "Products - Negative", "PUT /api/products with something that is not a list", "400 and the saved products are untouched", async function () {
  const before = await api("GET", "/api/products");
  const put = await api("PUT", "/api/products", { not: "a list" });
  expectStatus(put, 400, "bad product list");
  const after = await api("GET", "/api/products");
  expect(after.body.length === before.body.length, "products changed");
  return "400 " + put.body.error;
});

// the product stays until the order and return tests are done, PRO-99 deletes it
// ---------- shopping cart ----------
test("CRT-01", "Shopping Cart - Create", "PUT /api/carts/test-cart-1 for a cart that does not exist yet", "200, the cart is created in the carts collection", async function () {
  await api("DELETE", "/api/carts/test-cart-1");
  const res = await api("PUT", "/api/carts/test-cart-1", { items: [{ id: "TEST-P1", quantity: 2 }] });
  expectStatus(res, 200, "create cart");
  expect(res.body.id === "test-cart-1" && res.body.items.length === 1, "unexpected cart " + JSON.stringify(res.body));
  return "200, cart test-cart-1 saved with 1 item";
});

test("CRT-02", "Shopping Cart - Read", "GET /api/carts/test-cart-1", "200 with the saved items", async function () {
  const res = await api("GET", "/api/carts/test-cart-1");
  expectStatus(res, 200, "read cart");
  expect(res.body.items[0].id === "TEST-P1" && res.body.items[0].quantity === 2, "wrong items " + JSON.stringify(res.body.items));
  return "200, TEST-P1 x 2";
});

test("CRT-03", "Shopping Cart - Update", "PUT /api/carts/test-cart-1 with quantity 5 and a second item", "200 and the cart has the new items, createdAt does not change", async function () {
  const before = await api("GET", "/api/carts/test-cart-1");
  const res = await api("PUT", "/api/carts/test-cart-1", { items: [{ id: "TEST-P1", quantity: 5 }, { id: "PROD01", quantity: 1 }] });
  expectStatus(res, 200, "update cart");
  const after = await api("GET", "/api/carts/test-cart-1");
  expect(after.body.items.length === 2 && after.body.items[0].quantity === 5, "update was not saved " + JSON.stringify(after.body.items));
  expect(after.body.createdAt === before.body.createdAt, "createdAt changed");
  return "200, 2 items, TEST-P1 quantity 5";
});

test("CRT-04", "Shopping Cart - Edge", "PUT /api/carts/test-cart-1 with an empty items list (the Clear Cart button)", "200 and the cart is empty", async function () {
  const res = await api("PUT", "/api/carts/test-cart-1", { items: [] });
  expectStatus(res, 200, "empty cart");
  const after = await api("GET", "/api/carts/test-cart-1");
  expect(after.body.items.length === 0, "cart still has items");
  return "200, 0 items";
});

test("CRT-05", "Shopping Cart - Negative", "PUT /api/carts/test-cart-1 with quantity 0, quantity 1.5 and quantity 100", "422 for each, the saved cart is not changed", async function () {
  for (const quantity of [0, 1.5, 100]) {
    const res = await api("PUT", "/api/carts/test-cart-1", { items: [{ id: "TEST-P1", quantity: quantity }] });
    expectStatus(res, 422, "quantity " + quantity);
  }
  const after = await api("GET", "/api/carts/test-cart-1");
  expect(after.body.items.length === 0, "cart was changed");
  return "422 for 0, 1.5 and 100";
});

test("CRT-06", "Shopping Cart - Delete", "DELETE /api/carts/test-cart-1, then GET it again", "204, then 404", async function () {
  const del = await api("DELETE", "/api/carts/test-cart-1");
  expectStatus(del, 204, "delete cart");
  const again = await api("GET", "/api/carts/test-cart-1");
  expectStatus(again, 404, "read deleted cart");
  return "204, then 404";
});

// ---------- orders, billing and shipping ----------
test("ORD-01", "Orders / Billing / Shipping - Create", "POST /api/orders for 3 x TEST-P1 and a client price of $0.01", "201, the total uses the database price (3 x 15.75), billing card details are not saved", async function (ctx) {
  const billing = Object.assign(goodBilling(), { cardNumber: "4111111111111111", cvv: "123" });
  const res = await api("POST", "/api/orders", { items: [{ id: "TEST-P1", quantity: 3, price: 0.01 }], billing: billing });
  expectStatus(res, 201, "create order");
  expect(res.body.total === 47.25, "total was " + res.body.total);
  expect(res.body.status === "Received", "status was " + res.body.status);
  expect(!JSON.stringify(res.body).includes("4111"), "card number was saved");
  ctx.orderId = res.body.id;
  return "201, order " + res.body.id + ", total $" + res.body.total.toFixed(2);
});

test("ORD-02", "Orders / Billing / Shipping - Read", "GET /api/orders/:id, /api/billings/:id and /api/shippings/:id", "all three records exist and belong to the order", async function (ctx) {
  const order = await api("GET", "/api/orders/" + ctx.orderId);
  const billing = await api("GET", "/api/billings/" + ctx.orderId);
  const shipping = await api("GET", "/api/shippings/" + ctx.orderId);
  expectStatus(order, 200, "read order");
  expectStatus(billing, 200, "read billing");
  expectStatus(shipping, 200, "read shipping");
  expect(billing.body.fullName === "Test Buyer" && billing.body.orderId === ctx.orderId, "wrong billing " + JSON.stringify(billing.body));
  expect(shipping.body.address.city === "State College", "wrong shipping " + JSON.stringify(shipping.body));
  return "order, billing and shipping found for " + ctx.orderId;
});

test("ORD-03", "Orders / Billing / Shipping - Update", "PUT /api/orders/:id with a new billing name and state", "200, and the billing and shipping records show the change", async function (ctx) {
  const billing = goodBilling();
  billing.fullName = "Changed Buyer";
  billing.address.state = "NY";
  const res = await api("PUT", "/api/orders/" + ctx.orderId, { items: [{ id: "TEST-P1", quantity: 1 }], billing: billing });
  expectStatus(res, 200, "update order");
  const bill = await api("GET", "/api/billings/" + ctx.orderId);
  const ship = await api("GET", "/api/shippings/" + ctx.orderId);
  expect(bill.body.fullName === "Changed Buyer", "billing name is " + bill.body.fullName);
  expect(ship.body.address.state === "NY", "shipping state is " + ship.body.address.state);
  expect(res.body.total === 15.75, "total was " + res.body.total);
  return "200, billing name and shipping state updated, total recalculated to $15.75";
});

test("ORD-04", "Orders / Billing / Shipping - Negative", "POST /api/orders with no items, an unknown product, quantity 0 and no billing", "422 each time and nothing is saved", async function () {
  const before = (await api("GET", "/api/orders")).body.length;
  const bodies = [
    { items: [], billing: goodBilling() },
    { items: [{ id: "NOPE", quantity: 1 }], billing: goodBilling() },
    { items: [{ id: "TEST-P1", quantity: 0 }], billing: goodBilling() },
    { items: [{ id: "TEST-P1", quantity: 1 }] }
  ];
  for (const body of bodies) expectStatus(await api("POST", "/api/orders", body), 422, "invalid order");
  const after = (await api("GET", "/api/orders")).body.length;
  expect(after === before, "order count went from " + before + " to " + after);
  return "422 x 4, order count unchanged at " + after;
});

test("ORD-05", "Orders / Billing / Shipping - Negative", "POST /api/orders with a bad name, state XX, ZIP 00000, ZIP 1234 and a Paypal payment method", "422 with a message for each bad field", async function () {
  const bad = { fullName: "R2D2 99", paymentMethod: "Paypal", address: { street: "1 Test Lane", city: "State College", state: "XX", zipCode: "00000" } };
  const res = await api("POST", "/api/orders", { items: [{ id: "TEST-P1", quantity: 1 }], billing: bad });
  expectStatus(res, 422, "invalid billing");
  const fields = Object.keys(res.body.details).sort().join(",");
  expect(fields === "fullName,paymentMethod,state,zipCode", "got errors on " + fields);
  const zip = await api("POST", "/api/orders", { items: [{ id: "TEST-P1", quantity: 1 }], billing: Object.assign(goodBilling(), { address: { street: "1 Test Lane", city: "State College", state: "PA", zipCode: "1234" } }) });
  expectStatus(zip, 422, "short zip");
  return "422, errors on " + fields + "; ZIP 1234 -> 422";
});

test("ORD-06", "Orders / Billing / Shipping - Negative", "POST /api/billings and DELETE /api/shippings/:id (read only collections)", "405 for both", async function (ctx) {
  const post = await api("POST", "/api/billings", { fullName: "x" });
  const del = await api("DELETE", "/api/shippings/" + ctx.orderId);
  expect(post.status === 405 && del.status === 405, "got " + post.status + " and " + del.status);
  return "405 and 405";
});

test("ORD-07", "Orders / Billing / Shipping - Delete", "DELETE /api/orders/:id, then read the order, billing and shipping", "204, then 404 for all three", async function (ctx) {
  const del = await api("DELETE", "/api/orders/" + ctx.orderId);
  expectStatus(del, 204, "delete order");
  for (const name of ["orders", "billings", "shippings"]) expectStatus(await api("GET", "/api/" + name + "/" + ctx.orderId), 404, name + " after delete");
  return "204, then 404 for orders, billings and shippings";
});

// ---------- returns ----------
const RETURN_EMAIL = "returner@test.example.com";

test("RET-01", "Returns - Create", "POST /api/returns for 2 x TEST-P1 with the status set to Approved by the client", "201, status is Pending Review, refund is 2 x the database price", async function (ctx) {
  const res = await api("POST", "/api/returns", Object.assign(goodReturn("Returner@Test.Example.com"), { status: "Approved", refundTotal: 1 }));
  expectStatus(res, 201, "create return");
  expect(res.body.status === "Pending Review", "status was " + res.body.status);
  expect(res.body.refundTotal === 31.5, "refund was " + res.body.refundTotal);
  expect(res.body.email === RETURN_EMAIL, "email was " + res.body.email);
  ctx.returnId = res.body.id;
  return "201, return " + res.body.id + ", status " + res.body.status + ", refund $" + res.body.refundTotal.toFixed(2);
});

test("RET-02", "Returns - Read", "GET /api/returns?email=..., GET /api/returns/:id and a lookup for an email with no returns", "the return is found by email and by id, the other email returns an empty list", async function (ctx) {
  const byEmail = await api("GET", "/api/returns?email=" + encodeURIComponent(RETURN_EMAIL));
  expectStatus(byEmail, 200, "lookup by email");
  expect(byEmail.body.length === 1 && byEmail.body[0].id === ctx.returnId, "lookup returned " + JSON.stringify(byEmail.body.map(r => r.id)));
  const one = await api("GET", "/api/returns/" + ctx.returnId);
  expectStatus(one, 200, "read return");
  const none = await api("GET", "/api/returns?email=nobody@test.example.com");
  expect(Array.isArray(none.body) && none.body.length === 0, "expected an empty list");
  return "found by email and id, unknown email returned []";
});

test("RET-03", "Returns - Update", "PUT /api/returns/:id changing the resolution to Exchange, then GET it again", "200 and the resolution is saved, createdAt does not change", async function (ctx) {
  const before = await api("GET", "/api/returns/" + ctx.returnId);
  const res = await api("PUT", "/api/returns/" + ctx.returnId, Object.assign(goodReturn(RETURN_EMAIL), { resolution: "Exchange" }));
  expectStatus(res, 200, "update return");
  const after = await api("GET", "/api/returns/" + ctx.returnId);
  expect(after.body.resolution === "Exchange", "resolution is " + after.body.resolution);
  expect(after.body.createdAt === before.body.createdAt, "createdAt changed");
  return "200, resolution is now Exchange";
});

test("RET-04", "Returns - Negative", "POST /api/returns with no items, an unknown product, a repeated product and quantity 100", "422 each time", async function () {
  const base = goodReturn(RETURN_EMAIL);
  const line = base.items[0];
  const bodies = [
    Object.assign({}, base, { items: [] }),
    Object.assign({}, base, { items: [Object.assign({}, line, { id: "NOPE" })] }),
    Object.assign({}, base, { items: [line, line] }),
    Object.assign({}, base, { items: [Object.assign({}, line, { quantity: 100 })] })
  ];
  for (const body of bodies) expectStatus(await api("POST", "/api/returns", body), 422, "invalid return");
  return "422 x 4";
});

test("RET-05", "Returns - Negative", "POST /api/returns with a bad email, bad name, bad order number, unknown resolution and 501 characters of comments", "422 with a message for each bad field", async function () {
  const res = await api("POST", "/api/returns", Object.assign(goodReturn("nope"), { name: "R2D2 99", orderNumber: "!!", resolution: "Free stuff", comments: "x".repeat(501) }));
  expectStatus(res, 422, "invalid return details");
  const fields = Object.keys(res.body.details).sort().join(",");
  expect(fields === "comments,email,name,orderNumber,resolution", "got errors on " + fields);
  return "422, errors on " + fields;
});

test("RET-06", "Returns - Edge", "POST /api/returns where the reason is Other and the comments are empty, then with comments", "empty comments -> 422, with comments -> 201", async function () {
  const line = { id: "TEST-P1", quantity: 1, reason: "Other", condition: "Used" };
  const empty = await api("POST", "/api/returns", Object.assign(goodReturn(RETURN_EMAIL), { items: [line], comments: "" }));
  expectStatus(empty, 422, "Other without comments");
  const ok = await api("POST", "/api/returns", Object.assign(goodReturn(RETURN_EMAIL), { items: [line], comments: "It arrived late." }));
  expectStatus(ok, 201, "Other with comments");
  await api("DELETE", "/api/returns/" + ok.body.id);
  return "without comments -> 422, with comments -> 201";
});

test("RET-07", "Returns - Delete", "DELETE /api/returns/:id, then GET it and look it up by email", "204, then 404 and an empty lookup", async function (ctx) {
  const del = await api("DELETE", "/api/returns/" + ctx.returnId);
  expectStatus(del, 204, "delete return");
  expectStatus(await api("GET", "/api/returns/" + ctx.returnId), 404, "read deleted return");
  const lookup = await api("GET", "/api/returns?email=" + encodeURIComponent(RETURN_EMAIL));
  expect(lookup.body.length === 0, "lookup still finds " + lookup.body.length + " return(s)");
  return "204, then 404 and an empty lookup";
});

// ---------- event registrations ----------
test("REG-01", "Event Registrations - Create, Read, Update, Delete", "POST, GET, PUT and DELETE /api/registrations/:id for one registration", "201, 200, 200 with the new participation, 204", async function () {
  const doc = { name: "Test Attendee", email: "attendee@test.example.com", phone: "814-555-0111", participation: "Virtual", sessions: ["Keynote Address"] };
  const created = await api("POST", "/api/registrations", doc);
  expectStatus(created, 201, "create registration");
  const id = created.body.id;
  expectStatus(await api("GET", "/api/registrations/" + id), 200, "read registration");
  const updated = await api("PUT", "/api/registrations/" + id, Object.assign({}, doc, { participation: "VIP" }));
  expectStatus(updated, 200, "update registration");
  expect((await api("GET", "/api/registrations/" + id)).body.participation === "VIP", "participation was not saved");
  const dup = await api("POST", "/api/registrations", doc);
  expectStatus(dup, 409, "duplicate registration");
  expectStatus(await api("DELETE", "/api/registrations/" + id), 204, "delete registration");
  return "created, read, updated to VIP, duplicate email -> 409, deleted";
});

test("REG-02", "Event Registrations - Negative", "POST /api/registrations with no name, a bad email and participation Spectator", "422 with a message for each bad field", async function () {
  const res = await api("POST", "/api/registrations", { name: "", email: "x", participation: "Spectator" });
  expectStatus(res, 422, "invalid registration");
  const fields = Object.keys(res.body.details).sort().join(",");
  expect(fields === "email,name,participation", "got errors on " + fields);
  return "422, errors on " + fields;
});

// ---------- clean up ----------
test("PRO-99", "Products - Delete", "DELETE /api/products/TEST-P1, then GET it again", "204, then 404", async function () {
  const del = await api("DELETE", "/api/products/TEST-P1");
  expectStatus(del, 204, "delete product");
  expectStatus(await api("GET", "/api/products/TEST-P1"), 404, "read deleted product");
  return "204, then 404";
});

// ---------- browser steps (run by hand, then fill in the result columns) ----------
manual("UI-01", "Frontend -> Database: Members", "Open signup.html, fill in every field with a new member and submit. Open members.html?debug=1", "Success message, the member is in the table and in the members panel, and in MongoDB Compass (ist256.members)");
manual("UI-02", "Frontend -> Database: Members", "On signup.html submit an empty form, then an email that is already registered", "Red field messages, no new document in MongoDB");
manual("UI-03", "Frontend -> Database: Members", "On members.html click Edit on a member, change the address and save. Reload the page", "The new address is shown after the reload and in Compass");
manual("UI-04", "Frontend -> Database: Members", "On members.html click Delete on a member and confirm. Reload the page", "The member is gone from the table and from Compass");
manual("UI-05", "Frontend -> Database: Products", "Open products.html, add a product, edit its price, then delete it", "Each step shows its green message and ist256.products matches after each one");
manual("UI-06", "Frontend -> Database: Products", "On products.html add a product with an id that already exists, and one with price 0", "Red field messages and no change in ist256.products");
manual("UI-07", "Frontend -> Database: Shopping Cart", "On products.html add 2 items to the cart, open cart.html?debug=1, change a quantity, remove one item and press Clear", "The cart table and the carts panel match at every step, ist256.carts has one document for this browser");
manual("UI-08", "Frontend -> Database: Shopping Cart", "On cart.html search for a product, add it and press Checkout. Complete billing.html", "Order is placed, ist256.orders, billing and shipping each have a new document, the cart is empty");
manual("UI-09", "Frontend -> Database: Billing", "On billing.html submit with a bad ZIP code and an empty name", "Red field messages and no new document in ist256.billing");
manual("UI-10", "Frontend -> Database: Returns", "On returns.html search for a product, add it, fill in the details and submit", "Success message with the return id, the return shows under My Return Requests and in ist256.returns");
manual("UI-11", "Frontend -> Database: Returns", "In My Return Requests change the resolution to Exchange and press Update", "Green message, Compass shows resolution Exchange for that return");
manual("UI-12", "Frontend -> Database: Returns", "In My Return Requests press Delete and confirm", "The return disappears from the list and from ist256.returns");
manual("UI-13", "Frontend -> Database: Returns", "On returns.html submit with no items, then with reason Other and no comments", "Red field messages, nothing saved");
manual("UI-14", "Server / Database", "Stop the server with Ctrl+C and start it again with npm run dev. Reload members.html and products.html", "The data is still there (it was saved in data/db, not in the page or in memory)");
manual("UI-15", "Server / Database", "Add ?debug=1 to the end of members.html, cart.html and returns.html, then take it off again", "JSON panels only show with debug, and the panels show what MongoDB holds");

// ---------- run everything ----------
function csvCell(value) {
  const text = String(value === undefined ? "" : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// remove anything an earlier, interrupted run left behind
async function sweep() {
  for (const m of (await api("GET", "/api/members")).body) if (/@test\.example\.com$/.test(m.email)) await api("DELETE", "/api/members/" + m.id);
  for (const r of (await api("GET", "/api/returns?email=" + encodeURIComponent(RETURN_EMAIL))).body) await api("DELETE", "/api/returns/" + r.id);
  for (const r of (await api("GET", "/api/registrations")).body) if (/@test\.example\.com$/.test(r.email)) await api("DELETE", "/api/registrations/" + r.id);
  for (const o of (await api("GET", "/api/orders")).body) if (o.billing && o.billing.fullName.includes("Buyer") && o.items.some(i => i.id === "TEST-P1")) await api("DELETE", "/api/orders/" + o.id);
  for (const id of ["TEST-P1", "TEST-P2", "TEST-P3"]) await api("DELETE", "/api/products/" + id);
  await api("DELETE", "/api/carts/test-cart-1");
}

async function main() {
  try {
    const health = await api("GET", "/api/health");
    if (health.status !== 200) throw new Error("health check returned " + health.status);
  } catch (e) {
    console.error("\nCould not reach the server at " + BASE + " (" + e.message + ").\nStart it first with: npm run dev\n");
    process.exit(1);
  }

  await sweep();

  const ctx = {};
  const rows = [];
  let passed = 0, failed = 0;

  for (const c of cases) {
    const row = { "Test ID": c.id, "Test Date": "", "Tester": "", "Area Tested": c.area, "Testing Actions Performed": c.action, "Expected Results": c.expected, "Actual Results": "", "Pass/Fail": "", "Comments": "", "Bug Fixed On Date": "" };
    if (c.manual) {
      row.Comments = "Manual browser test, fill in the result columns";
      rows.push(row);
      continue;
    }
    row["Test Date"] = TODAY;
    row.Tester = TESTER;
    try {
      row["Actual Results"] = await c.run(ctx);
      row["Pass/Fail"] = "Pass";
      passed++;
      console.log("\x1b[32mPASS\x1b[0m " + c.id + "  " + c.action);
    } catch (e) {
      row["Actual Results"] = e.message;
      row["Pass/Fail"] = "Fail";
      row.Comments = "Needs a fix";
      failed++;
      console.log("\x1b[31mFAIL\x1b[0m " + c.id + "  " + c.action + "\n       " + e.message);
    }
    rows.push(row);
  }

  await sweep();

  const csv = [COLUMNS.join(",")].concat(rows.map(row => COLUMNS.map(name => csvCell(row[name])).join(","))).join("\n") + "\n";
  fs.writeFileSync(OUT, csv);

  const manualCount = cases.filter(c => c.manual).length;
  console.log("\n" + passed + " passed, " + failed + " failed, " + manualCount + " manual cases left to run by hand.");
  console.log("Test plan written to " + path.relative(process.cwd(), OUT));
  if (!TESTER) console.log("Tip: add --tester \"Your Name\" so the Tester column is filled in.");
  process.exit(failed ? 1 : 0);
}

main();
