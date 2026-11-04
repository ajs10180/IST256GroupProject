(function () {
    "use strict";

angular.module("billingApp", [])
    .controller("BillingController", function ($scope, $http) {
        $scope.form = {
            fullName: "",
            address: {
                street: "",
                city: "",
                state: "",
                zipCode: ""
            },
            cardNumber: "",
            expirationDate: "",
            cvv: "" 
        };

        $scope.items = [];
        $scope.subtotal = 0;
        $scope.total = 0;

        const cart = JSON.parse(localStorage.getItem("cart") || "[]");

        $http.get("/api/products").then(function (response) {
            const products = response.data || [];

            $scope.items = cart.map(function (cartItem) {
                const product = products.find(function (p) {
                    return p.id === cartItem.id;
                });

            if (!product) return null;

            return {
                id: product.id,
                description: product.description,
                price: Number(product.price),
                quantity: cartItem.quantity
            };
         }).filter(Boolean);

        $scope.subtotal = $scope.items.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);

        $scope.subtotal = Number($scope.subtotal.toFixed(2));
        $scope.total = $scope.subtotal;
    });
            $scope.placeOrder = function (form) {
            const cardDigits = String($scope.form.cardNumber || "").replace(/\D/g, "");
            const expiration = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(
                $scope.form.expirationDate || ""
            );

            let expirationIsFuture = false;

            if (expiration) {
                const month = Number(expiration[1]);
                const year = 2000 + Number(expiration[2]);
                const now = new Date();

                expirationIsFuture =
                    year > now.getFullYear() ||
                    (year === now.getFullYear() && month >= now.getMonth() + 1);
            }

            if (
                form.$invalid ||
                cardDigits.length < 13 ||
                cardDigits.length > 19 ||
                !expirationIsFuture ||
                !$scope.items.length
            ) {
                alert("Check the required fields, card number, and expiration date.");
                return;
            }

            const order = {
                items: $scope.items.map(function (item) {
                    return { id: item.id, quantity: item.quantity };
                }),
                billing: {
                    fullName: $scope.form.fullName.trim(),
                    address: {
                        street: $scope.form.address.street.trim(),
                        city: $scope.form.address.city.trim(),
                        state: $scope.form.address.state.trim().toUpperCase(),
                        zipCode: $scope.form.address.zipCode.trim()
                    },
                    paymentMethod: "Credit Card"
                }
            };

            // sends billing details, but leaves card number, expiration, and CVV out.
            $http.post("/api/orders", order).then(function (response) {
                alert("Order received. Total: $" +
                    Number(response.data.total).toFixed(2));

                localStorage.removeItem("cart");
                $scope.items = [];
                $scope.subtotal = 0;
                $scope.total = 0;
                $scope.form.cardNumber = "";
                $scope.form.expirationDate = "";
                $scope.form.cvv = "";
            }, function (response) {
                const message = response.data && response.data.error
                    ? response.data.error
                    : "The order could not be submitted.";

                alert(message);
            });
        };
});
}());