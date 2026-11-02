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

const orders = {
  label: "Order",
  file: "orders.json",
  validate: function (data) {
    if (!Array.isArray(data.items) || data.items.length === 0) return { items: "An order needs at least one item" };
    const products = loadProducts();
    const errors = {};
    data.items.forEach(function (item, i) {
      if (!item || !products.some(p => p.id === item.id)) errors["items[" + i + "]"] = "Unknown product " + (item && item.id);
      else if (!Number.isInteger(item.quantity) || item.quantity < 1) errors["items[" + i + "]"] = "Quantity must be a whole number of at least 1";
    });
    return errors;
  },
  clean: function (data) {
    const products = loadProducts();
    const items = data.items.map(function (item) {
      const p = products.find(p => p.id === item.id);
      return { id: p.id, description: p.description, category: p.category, unit: p.unit, price: p.price, quantity: item.quantity };
    });
    const total = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
    return { items: items, total: total, status: "Received" };
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

module.exports = { registrations, orders, artworks };
