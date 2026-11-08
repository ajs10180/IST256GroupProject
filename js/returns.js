(function () {
    "use strict";

    // dropdown choices, the server checks the same lists (server/resources.js)
    const REASONS = ["Defective or damaged", "Wrong item received", "Not as described", "No longer needed", "Found a better price", "Other"];
    const CONDITIONS = ["Unopened", "Opened, like new", "Used", "Damaged"];
    const RESOLUTIONS = ["Refund", "Exchange", "Store Credit"];

    const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u; // letters, spaces, periods, apostrophes and hyphens
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
    const MAX_QUANTITY = 99;
    const MAX_COMMENTS = 500;

    // the products in products.json have no photos, so each category gets a google material symbols icon
    // (names from fonts.google.com/icons)
    const CATEGORY_ICONS = {
        "Lawn & Garden": "yard",
        "Building Materials": "foundation",
        "Tools": "build",
        "Outdoor Living": "deck"
    };

    function iconFor(product) {
        return CATEGORY_ICONS[product.category] || "inventory_2";
    }

    // true when the quantity is a whole number the server will accept
    function validQuantity(quantity) {
        return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
    }

    angular.module("returnsApp", [])
        .controller("ReturnsController", function ($scope, $http, $filter, $timeout) {
            $scope.reasons = REASONS;
            $scope.conditions = CONDITIONS;
            $scope.resolutions = RESOLUTIONS;
            $scope.iconFor = iconFor;

            function emptyForm() {
                return {
                    name: "",
                    email: "",
                    orderNumber: "",
                    resolution: RESOLUTIONS[0],
                    comments: ""
                };
            }

            $scope.form = emptyForm();

            $scope.products = [];       // everything in products.json, searched by the jquery search below
            $scope.items = [];          // the products the customer is returning
            $scope.submitted = false;   // fields show errors after the first submit
            $scope.saving = false;      // true while the return is being sent
            $scope.notice = null;       // { type: "success" | "danger", text } shown above the form
            $scope.errors = { item: {} };

            $http.get("/api/products").then(function (response) {
                $scope.products = response.data || [];
                searchProducts(); // in case something was typed before the products arrived
            }, function () {
                $scope.notice = { type: "danger", text: "Could not load the products. Is the server running (npm run dev)?" };
            });

            // ---- jquery search of the products json (same idea as the cart page) ----

            function searchProducts() {
                const text = $("#search").val().trim().toLowerCase();
                const list = $("#searchResults").empty();
                $("#noResults").addClass("d-none");
                if (text === "") return;

                const matches = $.grep($scope.products, p => Object.values(p).join(" ").toLowerCase().includes(text));

                matches.forEach(function (p) {
                    const row = $("<li>").addClass("list-group-item d-flex align-items-center gap-3");
                    // .text() and .attr() keep product data from being treated as html
                    row.append($("<span>").addClass("material-symbols-outlined product-thumb-sm").attr("aria-hidden", "true").text(iconFor(p)));

                    const info = $("<div>").addClass("flex-grow-1");
                    info.append($("<div>").addClass("fw-semibold").text(p.description));
                    info.append($("<div>").addClass("small text-muted").text(p.category + " - $" + Number(p.price).toFixed(2)));
                    row.append(info);

                    row.append($("<button>").attr({ type: "button", "data-id": p.id }).addClass("btn btn-sm btn-success add-btn").text("Add to Return"));
                    list.append(row);
                });

                $("#noResults").toggleClass("d-none", matches.length > 0);
            }

            $("#search").on("input", searchProducts);

            // add button puts the product in the return, or raises the quantity if it is already there.
            // this click is jquery, so angular has to be told the page changed ($apply)
            $("#searchResults").on("click", ".add-btn", function () {
                const button = $(this);
                $scope.$apply(function () {
                    $scope.addProduct(button.attr("data-id"));
                });

                button.text("Added");
                setTimeout(() => button.text("Add to Return"), 1000);
            });

            $scope.addProduct = function (id) {
                const existing = $scope.items.find(item => item.id === id);
                if (existing) {
                    if (validQuantity(existing.quantity) && existing.quantity < MAX_QUANTITY) existing.quantity += 1;
                    return;
                }

                const product = $scope.products.find(p => p.id === id);
                if (!product) return;

                $scope.items.push({
                    id: product.id,
                    description: product.description,
                    category: product.category,
                    price: Number(product.price),
                    quantity: 1,
                    reason: "",
                    condition: ""
                });
            };

            $scope.removeItem = function (item) {
                $scope.items = $scope.items.filter(i => i.id !== item.id);
            };

            // ---- totals shown in the summary ----

            $scope.lineTotal = function (item) {
                return validQuantity(item.quantity) ? item.price * item.quantity : 0;
            };

            $scope.itemCount = function () {
                return $scope.items.reduce((sum, item) => sum + (validQuantity(item.quantity) ? item.quantity : 0), 0);
            };

            $scope.refundTotal = function () {
                const total = $scope.items.reduce((sum, item) => sum + $scope.lineTotal(item), 0);
                return Math.round(total * 100) / 100;
            };

            // ---- the json document that is sent to the server ----

            // the server looks up the price and name again from products.json, they are here so the json is easy to read
            $scope.buildDocument = function () {
                return {
                    name: ($scope.form.name || "").trim(),
                    email: ($scope.form.email || "").trim().toLowerCase(),
                    orderNumber: ($scope.form.orderNumber || "").trim(),
                    resolution: $scope.form.resolution,
                    comments: ($scope.form.comments || "").trim(),
                    items: $scope.items.map(function (item) {
                        return {
                            id: item.id,
                            description: item.description,
                            price: item.price,
                            quantity: item.quantity,
                            reason: item.reason,
                            condition: item.condition
                        };
                    })
                };
            };

            // ---- validation ----

            $scope.validate = function () {
                const doc = $scope.buildDocument();
                const errors = { item: {} };

                if (!doc.items.length) errors.items = "Search for a product above and add at least one item to return.";

                doc.items.forEach(function (item) {
                    const problems = {};
                    if (!validQuantity(item.quantity)) problems.quantity = "Enter a quantity from 1 to " + MAX_QUANTITY + ".";
                    if (!item.reason) problems.reason = "Please choose a reason.";
                    if (!item.condition) problems.condition = "Please choose the condition.";
                    if (Object.keys(problems).length) errors.item[item.id] = problems;
                });

                if (doc.name === "") errors.name = "Please enter your full name.";
                else if (doc.name.length < 2 || doc.name.length > 100 || !NAME_PATTERN.test(doc.name)) {
                    errors.name = "Names can only use letters, spaces, periods, apostrophes and hyphens.";
                }

                if (!EMAIL_PATTERN.test(doc.email)) errors.email = "Please enter a valid email address.";

                if (doc.orderNumber !== "" && !ORDER_NUMBER_PATTERN.test(doc.orderNumber)) {
                    errors.orderNumber = "Order numbers use letters, numbers and dashes (4 to 20 characters).";
                }

                if (doc.comments.length > MAX_COMMENTS) {
                    errors.comments = "Comments can be " + MAX_COMMENTS + " characters at most.";
                } else if (doc.comments === "" && doc.items.some(item => item.reason === "Other")) {
                    // "Other" is not a reason by itself
                    errors.comments = "Please describe the reason for your return.";
                }

                $scope.errors = errors;
                return !errors.items && !errors.name && !errors.email && !errors.orderNumber && !errors.comments &&
                    Object.keys(errors.item).length === 0;
            };

            // after the first submit, check again as the customer fixes things (this also clears the server's messages)
            $scope.$watch(function () { return $scope.buildDocument(); }, function () {
                if ($scope.submitted) $scope.validate();
            }, true);

            // bootstrap class for a field: nothing until the first submit, then red or green
            $scope.fieldClass = function (name) {
                if (!$scope.submitted) return "";
                if ($scope.errors[name]) return "is-invalid";
                return $scope.form[name] ? "is-valid" : "";
            };

            $scope.itemError = function (item, field) {
                const problems = $scope.errors.item[item.id];
                return problems ? problems[field] : "";
            };

            $scope.itemClass = function (item, field) {
                if (!$scope.submitted) return "";
                return $scope.itemError(item, field) ? "is-invalid" : "is-valid";
            };

            // ---- sending the return to the server ----

            // put the server's messages under the fields they belong to, anything else goes in the banner
            function showServerErrors(response) {
                const data = response.data || {};
                const details = data.details;

                if (response.status === -1) {
                    $scope.notice = { type: "danger", text: "Could not reach the server. Is it running (npm run dev)?" };
                    return;
                }

                if (!details || !Object.keys(details).length) {
                    $scope.notice = { type: "danger", text: data.error || "The return could not be submitted." };
                    return;
                }

                const errors = { item: {} };
                const other = [];

                Object.keys(details).forEach(function (key) {
                    // item errors come as items[0].reason, items[0].condition, items[0] and so on
                    const match = /^items\[(\d+)\](?:\.(\w+))?$/.exec(key);

                    if (match) {
                        const item = $scope.items[Number(match[1])];
                        if (!item) return other.push(details[key]);
                        errors.item[item.id] = errors.item[item.id] || {};
                        errors.item[item.id][match[2] || "product"] = details[key];
                    } else if (key in $scope.form || key === "items") {
                        errors[key] = details[key];
                    } else {
                        other.push(details[key]);
                    }
                });

                $scope.errors = errors;
                $scope.notice = {
                    type: "danger",
                    text: other.length ? other.join(" ") : "The server could not accept some of your details. Please check the highlighted fields."
                };
            }

            $scope.submitReturn = function () {
                $scope.submitted = true;
                $scope.notice = null;

                if ($scope.saving) return;

                if (!$scope.validate()) {
                    $scope.notice = { type: "danger", text: "Please fix the highlighted fields and try again." };
                    // move to the first problem once the page has updated
                    $timeout(function () {
                        const bad = document.querySelector("#returnForm .is-invalid");
                        if (bad) bad.focus();
                        else $("#search").focus();
                    });
                    return;
                }

                $scope.saving = true;

                $http.post("/api/returns", $scope.buildDocument()).then(function (response) {
                    const saved = response.data;
                    $scope.notice = {
                        type: "success",
                        text: "Return request " + saved.id + " received (" + saved.status + "). Estimated refund: " +
                            $filter("currency")(saved.refundTotal) + ". Thank you!"
                    };

                    // start over, including the search box
                    $scope.items = [];
                    $scope.form = emptyForm();
                    $scope.errors = { item: {} };
                    $scope.submitted = false;
                    $("#search").val("");
                    searchProducts();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }, showServerErrors).finally(function () {
                    $scope.saving = false;
                });
            };
        });
}());
