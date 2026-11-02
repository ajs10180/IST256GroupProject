// restful api the pages send their json documents to with ajax.
// every resource in server/resources.js gets the same five routes, saved in data/<file>.json:
//
//   GET    /api/<resource>       list every record
//   GET    /api/<resource>/:id   one record
//   POST   /api/<resource>       create (server adds id + timestamps), returns 201
//   PUT    /api/<resource>/:id   replace an existing record
//   DELETE /api/<resource>/:id   remove a record, returns 204
//
// plus GET /api/health to check the server is up
const fs = require("fs");
const path = require("path");
const { log, detail, error } = require("./logger");
const resources = require("./resources");

const DATA_DIR = path.join(__dirname, "..", "data");
const MAX_BODY = 1024 * 1024; // 1 MB is plenty for a form submission

const ROUTES = ["GET    /api/health"];
Object.keys(resources).forEach(function (name) {
  ROUTES.push(
    `GET    /api/${name}`,
    `GET    /api/${name}/:id`,
    `POST   /api/${name}`,
    `PUT    /api/${name}/:id`,
    `DELETE /api/${name}/:id`
  );
});

function dataFile(resource) {
  return path.join(DATA_DIR, resource.file);
}

function readAll(resource) {
  try {
    return JSON.parse(fs.readFileSync(dataFile(resource), "utf8"));
  } catch (e) {
    return []; // no file yet on a fresh clone
  }
}

function writeAll(resource, list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(dataFile(resource), JSON.stringify(list, null, 2) + "\n");
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

// run the resource's checks, then build the record to save. returns { errors } or { record }
function prepare(resource, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { errors: { body: "Expected a JSON object" } };
  const errors = resource.validate(data);
  if (errors && Object.keys(errors).length) return { errors: errors };
  return { record: resource.clean(data) };
}

// a resource can name one field that has to be unique, like the email on a registration
function duplicate(resource, list, record, id) {
  const field = resource.unique;
  return field && list.some(r => r[field] === record[field] && String(r.id) !== id);
}

// returns true when the request was an api route we handled
function handle(req, res) {
  const url = req.url.split("?")[0];

  if (url === "/api/health") {
    if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
    send(req, res, 200, { status: "ok", uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    return true;
  }

  const match = url.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?\/?$/);
  if (!match || !Object.prototype.hasOwnProperty.call(resources, match[1])) return false;
  const resource = resources[match[1]];
  const id = match[2];

  try {
    if (!id) collection(req, res, resource);
    else item(req, res, resource, decodeURIComponent(id));
  } catch (e) {
    error("API error on " + req.method + " " + req.url, e);
    send(req, res, 500, { error: "Server error" });
  }
  return true;
}

// /api/<resource>
function collection(req, res, resource) {
  if (req.method === "GET") return send(req, res, 200, readAll(resource));
  if (req.method !== "POST") return methodNotAllowed(req, res, "GET, POST");

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    const result = prepare(resource, data);
    if (result.errors) return send(req, res, 422, { error: "Validation failed", details: result.errors });

    const list = readAll(resource);
    const record = result.record;
    if (duplicate(resource, list, record)) {
      return send(req, res, 409, { error: resource.duplicateMessage, details: { [resource.unique]: resource.duplicateMessage } });
    }
    const now = new Date().toISOString();
    Object.assign(record, { id: Date.now().toString(36), createdAt: now, updatedAt: now });
    list.push(record);
    writeAll(resource, list);
    res.setHeader("Location", req.url.split("?")[0].replace(/\/$/, "") + "/" + record.id);
    send(req, res, 201, record);
  });
}

// /api/<resource>/:id
function item(req, res, resource, id) {
  const list = readAll(resource);
  const index = list.findIndex(r => String(r.id) === id);

  if (!["GET", "PUT", "DELETE"].includes(req.method)) return methodNotAllowed(req, res, "GET, PUT, DELETE");
  if (index === -1) return send(req, res, 404, { error: resource.label + " " + id + " not found" });

  if (req.method === "GET") return send(req, res, 200, list[index]);

  if (req.method === "DELETE") {
    list.splice(index, 1);
    writeAll(resource, list);
    return send(req, res, 204);
  }

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    const result = prepare(resource, data);
    if (result.errors) return send(req, res, 422, { error: "Validation failed", details: result.errors });

    // read again in case another request changed the file while this body was arriving
    const latest = readAll(resource);
    const at = latest.findIndex(r => String(r.id) === id);
    if (at === -1) return send(req, res, 404, { error: resource.label + " " + id + " not found" });
    const record = result.record;
    if (duplicate(resource, latest, record, id)) {
      return send(req, res, 409, { error: resource.duplicateMessage, details: { [resource.unique]: resource.duplicateMessage } });
    }
    // id and createdAt always come from the server, never the client
    Object.assign(record, { id: latest[at].id, createdAt: latest[at].createdAt, updatedAt: new Date().toISOString() });
    latest[at] = record;
    writeAll(resource, latest);
    send(req, res, 200, record);
  });
}

function methodNotAllowed(req, res, allowed) {
  res.setHeader("Allow", allowed);
  send(req, res, 405, { error: req.method + " is not allowed here. Use: " + allowed });
  return true;
}

module.exports = { handle, ROUTES };
