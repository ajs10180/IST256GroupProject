// the rest resources server/api.js serves. each one says where it is saved, how to check incoming json
// (validate returns { field: message } for anything wrong) and how to clean it before saving.
const fs = require("fs");
const path = require("path");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{3}-?\d{3}-?\d{4}$/;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// ---- registrations: events.html (options / finalization page) ----
const PARTICIPATION_TYPES = ["In-Person", "Virtual", "VIP"];

const registrations = {
  label: "Registration",
  file: "registrations.json",
  unique: "email",
  duplicateMessage: "This email is already registered for the event.",
  validate: function (data) {
    const errors = {};
    if (text(data.name) === "") errors.name = "Full name is required";
    if (!EMAIL_PATTERN.test(text(data.email))) errors.email = "A valid email is required";
    if (data.phone && !PHONE_PATTERN.test(text(data.phone))) errors.phone = "Phone must be 10 digits, like 814-555-0123";
    if (!PARTICIPATION_TYPES.includes(data.participation)) errors.participation = "Participation must be one of: " + PARTICIPATION_TYPES.join(", ");
    if (data.sessions !== undefined && (!Array.isArray(data.sessions) || !data.sessions.every(s => typeof s === "string"))) {
      errors.sessions = "Sessions must be a list of session names";
    }
    
    return errors;
  },
  clean: function (data) {
    return Object.assign({}, data, { name: text(data.name), email: text(data.email).toLowerCase() });
  }
};

// ---- orders: cart.html checkout ----
// prices always come from data/products.json so a changed price in the browser can't change the total
function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "products.json"), "utf8"));
  } catch (e) {
    return [];
  }
}

// two-letter codes the billing form accepts: the states, DC, territories and military mail
// (js/billing.js keeps the same list so the form and the server agree)
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "AS", "GU", "MP", "PR", "VI", "AA", "AE", "AP"
];
const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u; // letters, spaces, periods, apostrophes and hyphens
const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

const orders = {
  label: "Order",
  file: "orders.json",
  validate: function (data) {
    const errors = {};

    if (!Array.isArray(data.items) || data.items.length === 0) {
      errors.items = "An order needs at least one item";
    } else if (data.items.length > MAX_ITEMS) {
      errors.items = "An order can have at most " + MAX_ITEMS + " different items";
    } else {
      const products = loadProducts();
      data.items.forEach(function (item, i) {
        if (!item || !products.some(p => p.id === item.id)) errors["items[" + i + "]"] = "Unknown product " + (item && item.id);
        else if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) errors["items[" + i + "]"] = "Quantity must be a whole number from 1 to " + MAX_QUANTITY;
      });
    }

    const billing = data.billing;
    if (!billing || typeof billing !== "object" || Array.isArray(billing)) {
      errors.billing = "Billing details are required";
      return errors;
    }

    const fullName = text(billing.fullName);
    if (fullName === "") errors.fullName = "Full name is required";
    else if (fullName.length < 2 || fullName.length > 100 || !NAME_PATTERN.test(fullName)) {
      errors.fullName = "Name must be 2 to 100 characters, using letters, spaces, periods, apostrophes and hyphens";
    }

    if (billing.paymentMethod !== "Credit Card") errors.paymentMethod = "Only Credit Card payments are accepted";

    const address = billing.address;
    if (!address || typeof address !== "object" || Array.isArray(address)) {
      errors.address = "Billing address is required";
      return errors;
    }

    const street = text(address.street);
    if (street === "") errors.street = "Street address is required";
    else if (street.length < 3 || street.length > 100) errors.street = "Street address must be 3 to 100 characters";

    const city = text(address.city);
    if (city === "") errors.city = "City is required";
    else if (city.length < 2 || city.length > 60 || !NAME_PATTERN.test(city)) {
      errors.city = "City must be 2 to 60 characters, using letters, spaces, periods, apostrophes and hyphens";
    }

    const state = text(address.state);
    if (state === "") errors.state = "State is required";
    else if (!US_STATES.includes(state.toUpperCase())) errors.state = "State must be a valid 2-letter US state code, like PA";

    const zipCode = text(address.zipCode);
    if (!ZIP_PATTERN.test(zipCode) || /^0{5}/.test(zipCode)) errors.zipCode = "ZIP code must be a real 5-digit or ZIP+4 code, like 16802";

    return errors;
  },
  clean: function (data) {
    const products = loadProducts();
    const items = data.items.map(function (item) {
      const p = products.find(p => p.id === item.id);
      return { id: p.id, description: p.description, category: p.category, unit: p.unit, price: p.price, quantity: item.quantity };
    });
    const total = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
    const address = data.billing.address;
    const cleanAddress = {
      street: text(address.street),
      city: text(address.city),
      state: text(address.state).toUpperCase(),
      zipCode: text(address.zipCode)
    };
    // card number, expiration and CVV are never sent or saved, only the payment method
    return {
      items: items,
      total: total,
      status: "Received",
      billing: { fullName: text(data.billing.fullName), paymentMethod: data.billing.paymentMethod, address: cleanAddress },
      shipping: { method: "Standard shipping", address: cleanAddress, cost: 0 }
    };
  }
};

// ---- artworks: art.html submissions ----
// saved to their own file so the sample gallery in data/artworks.json is never changed
const ART_CATEGORIES = ["Painting", "Drawing", "Photography", "Digital Art", "Sculpture"];
const VISIBILITY = ["Public Gallery", "Members Only", "Private Review"];

function isWebUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch (e) {
    return false;
  }
}

const artworks = {
  label: "Artwork submission",
  file: "artwork-submissions.json",
  validate: function (data) {
    const errors = {};
    if (text(data.artistName) === "") errors.artistName = "Artist name is required.";
    if (!EMAIL_PATTERN.test(text(data.email))) errors.email = "Enter a valid email address.";
    if (text(data.artworkTitle) === "") errors.artworkTitle = "Artwork title is required.";
    if (!ART_CATEGORIES.includes(data.category)) errors.category = "Please select an art category.";
    if (text(data.imageUrl) !== "" && !isWebUrl(text(data.imageUrl))) errors.imageUrl = "Artwork image URL must be a valid HTTP or HTTPS link.";
    if (!VISIBILITY.includes(data.visibility)) errors.visibility = "Display preference must be one of: " + VISIBILITY.join(", ");
    if (data.permission !== true) errors.permission = "You must confirm that you have permission to share this artwork.";
    return errors;
  },
  clean: function (data) {
    return {
      artistName: text(data.artistName),
      email: text(data.email).toLowerCase(),
      artworkTitle: text(data.artworkTitle),
      category: data.category,
      imageUrl: text(data.imageUrl),
      visibility: data.visibility,
      description: text(data.description),
      permission: true,
      reviewStatus: "Pending Review", // new submissions always start here, whatever the browser sent
      submittedAt: text(data.submittedAt)
    };
  }
};

// ---- returns: returns.html return requests ----
// like orders, prices come from data/products.json and the refund total is worked out here,
// so changing a price in the browser has no effect. js/returns.js keeps the same lists for its dropdowns.
const RETURN_REASONS = ["Defective or damaged", "Wrong item received", "Not as described", "No longer needed", "Found a better price", "Other"];
const RETURN_CONDITIONS = ["Unopened", "Opened, like new", "Used", "Damaged"];
const RETURN_RESOLUTIONS = ["Refund", "Exchange", "Store Credit"];
const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
const MAX_COMMENTS = 500;

const returns = {
  label: "Return",
  file: "returns.json",
  validate: function (data) {
    const errors = {};

    const name = text(data.name);
    if (name === "") errors.name = "Full name is required";
    else if (name.length < 2 || name.length > 100 || !NAME_PATTERN.test(name)) {
      errors.name = "Name must be 2 to 100 characters, using letters, spaces, periods, apostrophes and hyphens";
    }

    const email = text(data.email);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) errors.email = "A valid email is required";

    const orderNumber = text(data.orderNumber);
    if (orderNumber !== "" && !ORDER_NUMBER_PATTERN.test(orderNumber)) {
      errors.orderNumber = "Order number can only use letters, numbers and dashes (4 to 20 characters)";
    }

    if (!RETURN_RESOLUTIONS.includes(data.resolution)) errors.resolution = "Resolution must be one of: " + RETURN_RESOLUTIONS.join(", ");

    const comments = text(data.comments);
    if (comments.length > MAX_COMMENTS) errors.comments = "Comments can be " + MAX_COMMENTS + " characters at most";

    if (!Array.isArray(data.items) || data.items.length === 0) {
      errors.items = "A return needs at least one item";
    } else if (data.items.length > MAX_ITEMS) {
      errors.items = "A return can have at most " + MAX_ITEMS + " different items";
    } else {
      const products = loadProducts();
      const seen = [];
      data.items.forEach(function (item, i) {
        const key = "items[" + i + "]";
        if (!item || !products.some(p => p.id === item.id)) {
          errors[key] = "Unknown product " + (item && item.id);
          return;
        }
        if (seen.includes(item.id)) errors[key] = "Each product can only be listed once, change its quantity instead";
        seen.push(item.id);
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) errors[key + ".quantity"] = "Quantity must be a whole number from 1 to " + MAX_QUANTITY;
        if (!RETURN_REASONS.includes(item.reason)) errors[key + ".reason"] = "Please choose a reason for the return";
        if (!RETURN_CONDITIONS.includes(item.condition)) errors[key + ".condition"] = "Please choose the condition of the item";
      });

      // "Other" is not a reason by itself, so the customer has to explain in the comments
      if (!errors.comments && comments === "" && data.items.some(item => item && item.reason === "Other")) {
        errors.comments = "Please describe the reason for your return";
      }
    }

    return errors;
  },
  clean: function (data) {
    const products = loadProducts();
    const items = data.items.map(function (item) {
      const p = products.find(p => p.id === item.id);
      return { id: p.id, description: p.description, category: p.category, price: p.price, quantity: item.quantity, reason: item.reason, condition: item.condition };
    });
    const refundTotal = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
    return {
      name: text(data.name),
      email: text(data.email).toLowerCase(),
      orderNumber: text(data.orderNumber),
      resolution: data.resolution,
      comments: text(data.comments),
      items: items,
      refundTotal: refundTotal,
      status: "Pending Review" // new requests always start here, whatever the browser sent
    };
  }
};

module.exports = { registrations, orders, artworks, returns };
