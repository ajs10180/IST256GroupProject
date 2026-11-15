// debug mode: add ?debug=true or ?debug=1 to any page's address to show the JSON / database panels.
// without it, every element marked data-debug is hidden.
window.DEBUG = /[?&]debug=(true|1)(&|$)/i.test(location.search);

if (!window.DEBUG) {
  const style = document.createElement("style");
  style.textContent = "[data-debug] { display: none !important; }";
  document.head.appendChild(style);
}

// show what MongoDB holds for a collection (or one document, like "carts/<id>") in a <pre>.
// it asks the API again instead of printing the page's own copy, so this is what is really saved.
// the short delay lets a save that was just sent finish first.
window.showDatabase = function (path, element) {
  if (!window.DEBUG || !element) return;
  clearTimeout(element.debugTimer);
  element.debugTimer = setTimeout(function () {
    fetch("/api/" + path, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status === 404 ? "(nothing saved in the database yet)" : "(database returned " + r.status + ")")))
      .then(data => { element.textContent = JSON.stringify(data, null, 2); })
      .catch(msg => { element.textContent = typeof msg === "string" ? msg : "(could not reach the database)"; });
  }, 400);
};
