// restful api for the options / finalization page. the page sends its json document here with ajax.
// registrations are saved in data/registrations.json
//
//   GET    /api/health              server is up
//   GET    /api/registrations       list every registration
//   GET    /api/registrations/:id   one registration
//   POST   /api/registrations       create (server adds id + timestamps), returns 201
//   PUT    /api/registrations/:id   replace an existing registration
//   DELETE /api/registrations/:id   remove a registration, returns 204
const fs = require("fs");
const path = require("path");
const { log, detail, error } = require("./logger");

const DATA_FILE = path.join(__dirname, "..", "data", "registrations.json");
const MAX_BODY = 1024 * 1024; // 1 MB is plenty for a form submission

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{3}-?\d{3}-?\d{4}$/;
const PARTICIPATION_TYPES = ["In-Person", "Virtual", "VIP"];

const ROUTES = [
  "GET    /api/health",
  "GET    /api/registrations",
  "GET    /api/registrations/:id",
  "POST   /api/registrations",
  "PUT    /api/registrations/:id",
  "DELETE /api/registrations/:id"
];

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return []; // no file yet on a fresh clone
  }
}

function writeAll(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2) + "\n");
}

// send json back and log the request + what we answered with
function send(req, res, code, body) {
  const text = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(text);
  log(req, code);
  if (req.bodyText) detail("→ received", req.bodyText);
  detail("← sent", text);
}

// collect the request body and parse it as json
function readJson(req, callback) {
  let body = "";
  let tooBig = false;
  req.on("data", function (chunk) {
    body += chunk;
    if (body.length > MAX_BODY) tooBig = true;
  });
  req.on("end", function () {
    req.bodyText = tooBig ? "(too large)" : body;
    if (tooBig) return callback({ code: 413, message: "Request body is too large" });
    try {
      callback(null, JSON.parse(body));
    } catch (e) {
      callback({ code: 400, message: "Request body must be valid JSON" });
    }
  });
}

// same rules the form uses, checked again on the server so bad data never gets saved
function validate(data) {
  const errors = {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return { body: "Expected a JSON object" };
  if (typeof data.name !== "string" || data.name.trim() === "") errors.name = "Full name is required";
  if (typeof data.email !== "string" || !EMAIL_PATTERN.test(data.email.trim())) errors.email = "A valid email is required";
  if (data.phone && !PHONE_PATTERN.test(String(data.phone).trim())) errors.phone = "Phone must be 10 digits, like 814-555-0123";
  if (!PARTICIPATION_TYPES.includes(data.participation)) errors.participation = "Participation must be one of: " + PARTICIPATION_TYPES.join(", ");
  if (data.sessions !== undefined && (!Array.isArray(data.sessions) || !data.sessions.every(s => typeof s === "string"))) {
    errors.sessions = "Sessions must be a list of session names";
  }
  return Object.keys(errors).length ? errors : null;
}

function clean(data) {
  return Object.assign({}, data, { name: data.name.trim(), email: data.email.trim().toLowerCase() });
}

// returns true when the request was an api route we handled
function handle(req, res) {
  const url = req.url.split("?")[0];

  if (url === "/api/health") {
    if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
    send(req, res, 200, { status: "ok", uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    return true;
  }

  const match = url.match(/^\/api\/registrations(?:\/([^/]+))?\/?$/);
  if (!match) return false;
  const id = match[1];

  try {
    if (!id) collection(req, res);
    else item(req, res, decodeURIComponent(id));
  } catch (e) {
    error("API error on " + req.method + " " + req.url, e);
    send(req, res, 500, { error: "Server error" });
  }
  return true;
}

// /api/registrations
function collection(req, res) {
  if (req.method === "GET") return send(req, res, 200, readAll());
  if (req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    const errors = validate(data);
    if (errors) return send(req, res, 422, { error: "Validation failed", details: errors });

    const list = readAll();
    const record = clean(data);
    if (list.some(r => r.email === record.email)) {
      return send(req, res, 409, { error: "This email is already registered", details: { email: "This email is already registered for the event." } });
    }
    const now = new Date().toISOString();
    Object.assign(record, { id: Date.now().toString(36), createdAt: now, updatedAt: now });
    list.push(record);
    writeAll(list);
    res.setHeader("Location", "/api/registrations/" + record.id);
    send(req, res, 201, record);
  });
}

// /api/registrations/:id
function item(req, res, id) {
  const list = readAll();
  const index = list.findIndex(r => String(r.id) === id);

  if (!["GET", "PUT", "DELETE"].includes(req.method)) return methodNotAllowed(req, res, "GET, PUT, DELETE");
  if (index === -1) return send(req, res, 404, { error: "Registration " + id + " not found" });

  if (req.method === "GET") return send(req, res, 200, list[index]);

  if (req.method === "DELETE") {
    list.splice(index, 1);
    writeAll(list);
    return send(req, res, 204);
  }

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    const errors = validate(data);
    if (errors) return send(req, res, 422, { error: "Validation failed", details: errors });

    // read again in case another request changed the file while this body was arriving
    const latest = readAll();
    const at = latest.findIndex(r => String(r.id) === id);
    if (at === -1) return send(req, res, 404, { error: "Registration " + id + " not found" });
    const record = clean(data);
    if (latest.some(r => r.email === record.email && String(r.id) !== id)) {
      return send(req, res, 409, { error: "This email is already registered", details: { email: "This email is already registered for the event." } });
    }
    // id and createdAt always come from the server, never the client
    Object.assign(record, { id: latest[at].id, createdAt: latest[at].createdAt, updatedAt: new Date().toISOString() });
    latest[at] = record;
    writeAll(latest);
    send(req, res, 200, record);
  });
}

function methodNotAllowed(req, res, allowed) {
  res.setHeader("Allow", allowed);
  send(req, res, 405, { error: req.method + " is not allowed here. Use: " + allowed });
  return true;
}

module.exports = { handle, ROUTES };
