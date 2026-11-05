(function () {
    "use strict";

    // same list the server accepts (server/resources.js)
    const STATES = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
        "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
        "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "AS", "GU", "MP", "PR", "VI", "AA", "AE", "AP"
    ];

    // fields the server can send an error for, they match the input names on the form
    const FIELDS = ["fullName", "street", "city", "state", "zipCode"];

    const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u; // letters, spaces, periods, apostrophes and hyphens

    function digitsOnly(value) {
        return String(value || "").replace(/\D/g, "");
    }

    // american express cards start with 34 or 37, have 15 digits and a 4 digit security code
    function isAmex(digits) {
        return /^3[47]/.test(digits);
    }

    // luhn check: the last digit of every real card number is a checksum of the others
    function passesLuhn(digits) {
        let sum = 0;
        let double = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let n = Number(digits[i]);
            if (double) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            double = !double;
        }
        return sum % 10 === 0;
    }

    // what the user typed gets cleaned up as they type, so 4111111111111111 becomes 4111 1111 1111 1111
    const FORMATTERS = {
        card: function (value) {
            const digits = digitsOnly(value).slice(0, isAmex(digitsOnly(value)) ? 15 : 19);
            const groups = isAmex(digits) ? [4, 6, 5] : [4, 4, 4, 4, 3];
            const parts = [];
            let start = 0;

            groups.forEach(function (size) {
                if (digits.length > start) parts.push(digits.slice(start, start + size));
                start += size;
            });
            return parts.join(" ");
        },

        // 0428 becomes 04/28, 4 becomes 04, and a pasted 04/2028 becomes 04/28
        expiry: function (value) {
            let digits = digitsOnly(value);

            if (digits.length === 6) digits = digits.slice(0, 2) + digits.slice(4);
            // a month starting with 2-9 can only be a one digit month, so add the 0
            if (digits.length && digits[0] > "1") digits = "0" + digits;
            digits = digits.slice(0, 4);
            return digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
        },

        cvv: function (value) {
            return digitsOnly(value).slice(0, 4);
        },

        // 168021234 becomes 16802-1234
        zip: function (value) {
            const digits = digitsOnly(value).slice(0, 9);
            return digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits;
        },

        state: function (value) {
            return String(value || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
        }
    };

    // checks that run on every keystroke. each one returns true when the value is fine (empty is
    // fine here because "required" reports that). the key is the name used in MESSAGES below.
    const VALIDATORS = {
        card: {
            cardLength: function (value) {
                const digits = digitsOnly(value);
                return isAmex(digits) ? digits.length === 15 : digits.length >= 13 && digits.length <= 19;
            },
            luhn: function (value) {
                return passesLuhn(digitsOnly(value));
            }
        },
        expiry: {
            // an expiration date is good through the end of that month
            expired: function (value) {
                const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
                if (!match) return true; // the pattern check reports a badly formed date
                const now = new Date();
                const year = 2000 + Number(match[2]);
                return year > now.getFullYear() || (year === now.getFullYear() && Number(match[1]) >= now.getMonth() + 1);
            },
            tooFar: function (value) {
                const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
                return !match || 2000 + Number(match[2]) <= new Date().getFullYear() + 20;
            }
        },
        state: {
            usState: function (value) {
                return STATES.includes(String(value).toUpperCase());
            }
        },
        zip: {
            realZip: function (value) {
                return !/^0{5}/.test(value);
            }
        }
    };

    // text shown under a field for each kind of error (a function can work out the text when it needs to)
    const MESSAGES = {
        fullName: {
            required: "Please enter your full name.",
            pattern: "Names can only use letters, spaces, periods, apostrophes and hyphens.",
            minlength: "Please enter your full name.",
            maxlength: "That name is too long (100 characters at most)."
        },
        street: {
            required: "Please enter your street address.",
            minlength: "Please enter your full street address.",
            maxlength: "That address is too long (100 characters at most)."
        },
        city: {
            required: "Please enter your city.",
            pattern: "City names can only use letters, spaces, periods, apostrophes and hyphens.",
            minlength: "Please enter your city.",
            maxlength: "That city name is too long (60 characters at most)."
        },
        state: {
            required: "Please enter your state.",
            usState: "That isn't a US state code. Use two letters, like PA."
        },
        zipCode: {
            required: "Please enter your ZIP code.",
            pattern: "ZIP codes look like 16802 or 16802-1234.",
            realZip: "Please enter a real ZIP code."
        },
        cardNumber: {
            required: "Please enter your card number.",
            cardLength: "That card number is the wrong length.",
            luhn: "That card number doesn't look right. Check each digit."
        },
        expirationDate: {
            required: "Please enter the expiration date.",
            pattern: "Use month and year, like 04/28.",
            expired: "That card has expired.",
            tooFar: "That expiration date is too far in the future."
        },
        cvv: {
            required: "Please enter the security code (CVV).",
            pattern: "The security code is 3 or 4 digits.",
            cvvLength: function (card) {
                return "This card's security code is " + (isAmex(digitsOnly(card)) ? 4 : 3) + " digits.";
            }
        }
    };

    angular.module("billingApp", [])

        // add pay-field="card" (or expiry, cvv, zip, state) to an input to format it as the user types
        // and add that kind's checks to the field
        .directive("payField", function () {
            return {
                require: "ngModel",
                link: function (scope, element, attrs, ctrl) {
                    const kind = attrs.payField;
                    const format = FORMATTERS[kind];

                    if (format) {
                        ctrl.$parsers.unshift(function (value) {
                            const formatted = format(value);
                            if (formatted !== value) {
                                ctrl.$setViewValue(formatted);
                                ctrl.$render();
                            }
                            return formatted;
                        });
                    }

                    Object.keys(VALIDATORS[kind] || {}).forEach(function (key) {
                        ctrl.$validators[key] = function (modelValue, viewValue) {
                            const value = viewValue || "";
                            return value === "" || VALIDATORS[kind][key](value);
                        };
                    });

                    // the security code length depends on the card number (4 digits for amex, 3 for the rest)
                    if (kind === "cvv") {
                        ctrl.$validators.cvvLength = function (modelValue, viewValue) {
                            const card = scope.billingForm && scope.billingForm.cardNumber;
                            const digits = digitsOnly(viewValue);
                            if (!digits || !card || !card.$viewValue) return true;
                            return digits.length === (isAmex(digitsOnly(card.$viewValue)) ? 4 : 3);
                        };
                        scope.$watch("billingForm.cardNumber.$viewValue", function () {
                            ctrl.$validate();
                        });
                    }
                }
            };
        })

        .controller("BillingController", function ($scope, $http, $filter, $timeout) {
            $scope.patterns = {
                name: NAME_PATTERN,
                zip: /^\d{5}(?:-\d{4})?$/,
                expiry: /^(0[1-9]|1[0-2])\/\d{2}$/,
                cvv: /^\d{3,4}$/
            };

            function emptyForm() {
                return {
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
            }

            $scope.form = emptyForm();

            $scope.items = [];
            $scope.subtotal = 0;
            $scope.total = 0;
            $scope.loaded = false;      // true once the cart has been matched to the products
            $scope.submitted = false;   // fields show errors after the first submit, or after leaving a field
            $scope.saving = false;      // true while the order is being sent
            $scope.orderPlaced = false;
            $scope.notice = null;       // { type: "success" | "danger", text } shown above the form
            $scope.serverErrors = {};   // messages the server sent for a field, kept until that field changes

            function readCart() {
                try {
                    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
                    return Array.isArray(cart) ? cart : [];
                } catch (e) {
                    return [];
                }
            }

            const cart = readCart();

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
            }, function () {
                $scope.notice = { type: "danger", text: "Could not load the products. Is the server running (npm run dev)?" };
            }).finally(function () {
                $scope.loaded = true;
            });

            // the input name is also the key used in MESSAGES and in the server's error details
            function field(name) {
                return $scope.billingForm && $scope.billingForm[name];
            }

            // the message to show under a field, or "" when it is fine
            $scope.fieldError = function (name) {
                const ctrl = field(name);
                if (!ctrl) return "";

                // a server message stays only while the value is the one the server rejected
                const fromServer = $scope.serverErrors[name];
                if (fromServer && fromServer.value === ctrl.$viewValue) return fromServer.message;

                if (!Object.keys(ctrl.$error).length) return "";

                // the first problem in the order MESSAGES lists them (required first, then the more basic checks)
                const messages = MESSAGES[name] || {};
                const key = Object.keys(messages).find(function (k) { return ctrl.$error[k]; });
                const message = messages[key] || "Please check this field.";
                // a message that is a function works out its text from the card number
                return typeof message === "function" ? message((field("cardNumber") || {}).$viewValue) : message;
            };

            // bootstrap class for a field: nothing until it has been left or the form was submitted
            $scope.fieldClass = function (name) {
                const ctrl = field(name);
                if (!ctrl) return "";

                const fromServer = $scope.serverErrors[name];
                const serverRejected = Boolean(fromServer) && fromServer.value === ctrl.$viewValue;

                if (!$scope.submitted && !ctrl.$touched && !serverRejected) return "";
                return $scope.fieldError(name) ? "is-invalid" : "is-valid";
            };

            function showServerErrors(response, form) {
                const data = response.data || {};
                const details = data.details;

                if (response.status === -1) {
                    $scope.notice = { type: "danger", text: "Could not reach the server. Is it running (npm run dev)?" };
                    return;
                }

                if (!details || !Object.keys(details).length) {
                    $scope.notice = { type: "danger", text: data.error || "The order could not be submitted." };
                    return;
                }

                // errors for a form field go under that field, anything else (items, payment method) goes in the banner
                const other = [];
                Object.keys(details).forEach(function (key) {
                    if (FIELDS.indexOf(key) !== -1 && form[key]) {
                        $scope.serverErrors[key] = { message: details[key], value: form[key].$viewValue };
                    } else {
                        other.push(details[key]);
                    }
                });

                $scope.notice = {
                    type: "danger",
                    text: other.length ? other.join(" ") : "The server could not accept some of your details. Please check the highlighted fields."
                };
            }

            $scope.placeOrder = function (form) {
                $scope.submitted = true;
                $scope.notice = null;

                if ($scope.saving || !$scope.items.length) return;

                if (form.$invalid) {
                    $scope.notice = { type: "danger", text: "Please fix the highlighted fields and try again." };
                    // move to the first field with a problem once the page has updated
                    $timeout(function () {
                        const bad = document.querySelector("#billingForm .is-invalid");
                        if (bad) bad.focus();
                    });
                    return;
                }

                // sends billing details, but leaves card number, expiration, and CVV out.
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

                $scope.saving = true;

                $http.post("/api/orders", order).then(function (response) {
                    localStorage.removeItem("cart");
                    $scope.notice = {
                        type: "success",
                        text: "Order " + response.data.id + " received. Total: " + $filter("currency")(response.data.total) + ". Thank you!"
                    };

                    $scope.orderPlaced = true;
                    $scope.items = [];
                    $scope.subtotal = 0;
                    $scope.total = 0;

                    // clear the whole form, not just the card details
                    $scope.form = emptyForm();
                    $scope.serverErrors = {};
                    $scope.submitted = false;
                    form.$setPristine();
                    form.$setUntouched();
                }, function (response) {
                    showServerErrors(response, form);
                }).finally(function () {
                    $scope.saving = false;
                });
            };
        });
}());
