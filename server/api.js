// restful api the pages send their json documents to with ajax.
// every resource in server/resources.js gets the same five routes, saved in its MongoDB collection (server/db.js):
//
//   GET    /api/<resource>       list every record (returns and registrations also take ?email=...)
//   GET    /api/<resource>/:id   one record
//   POST   /api/<resource>       create (server adds id + timestamps), returns 201
//   PUT    /api/<resource>/:id   replace an existing record
//   DELETE /api/<resource>/:id   remove a record, returns 204
//
// billings and shippings are filled in when an order is placed, so they only have the two GET routes.
// plus GET /api/health to check the server and database are up, and for members, posts, products and events
// (lists the pages edit as a whole) GET /api/<name> and PUT /api/<name> which replaces the whole collection
const mongoose = require("mongoose");
const { log, detail, error } = require("./logger");
const resources = require("./resources");
const { models, strip } = require("./db");

const LISTS = ["members", "posts", "products", "events"];
const MAX_BODY = 1024 * 1024; // 1 MB is plenty for a form submission

const ROUTES = ["GET    /api/health"];
LISTS.forEach(name => ROUTES.push(`GET    /api/${name}  (whole list)`, `PUT    /api/${name}  (replace whole list)`));
Object.keys(resources).filter(name => typeof resources[name] === "object").forEach(function (name) {
  const resource = resources[name];
  if (!LISTS.includes(name)) ROUTES.push(`GET    /api/${name}`);
  ROUTES.push(`GET    /api/${name}/:id`);
  if (resource.readOnly) return;
  ROUTES.push(`POST   /api/${name}`, `PUT    /api/${name}/:id`, `DELETE /api/${name}/:id`);
});

// make sure the order / return checks use the prices currently saved in the products collection
async function refreshProducts() {
  resources.setProducts((await models.products.find({}).sort({ _id: 1 }).lean()).map(strip));
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

// returns true when the request was an api route we handled
function handle(req, res) {
  const url = req.url.split("?")[0];

  if (url === "/api/health") {
    if (req.method !== "GET") return methodNotAllowed(req, res, "GET");
    const up = mongoose.connection.readyState === 1;
    send(req, res, up ? 200 : 503, { status: up ? "ok" : "database unavailable", database: mongoose.connection.name, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    return true;
  }

  const match = url.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?\/?$/);
  if (!match) return false;

  // the pages read and save these as one whole list (GET / PUT), anything else on the collection is a normal route
  if (LISTS.includes(match[1]) && !match[2] && req.method !== "POST") {
    run(req, res, () => list(req, res, match[1]));
    return true;
  }

  if (!Object.prototype.hasOwnProperty.call(resources, match[1]) || typeof resources[match[1]] !== "object") return false;
  const resource = resources[match[1]];
  const id = match[2];

  run(req, res, () => (!id ? collection(req, res, resource) : item(req, res, resource, decodeURIComponent(id))));
  return true;
}

// run an async route and answer 500 if it throws
function run(req, res, route) {
  Promise.resolve().then(route).catch(function (e) {
    error("API error on " + req.method + " " + req.url, e);
    if (!res.headersSent) send(req, res, 500, { error: "Server error" });
  });
}

// /api/members, /api/posts, /api/products, /api/events: GET the list, PUT replaces the whole collection
async function list(req, res, name) {
  const model = models[name];
  if (req.method === "GET") {
    return send(req, res, 200, (await model.find({}).sort({ _id: 1 }).lean()).map(strip));
  }
  if (req.method !== "PUT") return methodNotAllowed(req, res, "GET, PUT");

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    if (!Array.isArray(data) || !data.every(d => d && typeof d === "object" && !Array.isArray(d))) {
      return send(req, res, 400, { error: "Expected a JSON list of objects" });
    }
    run(req, res, async function () {
      await model.deleteMany({});
      if (data.length) await model.insertMany(data);
      send(req, res, 200, { saved: data.length });
    });
  });
}

// find a record by its id. ids that are all digits are also tried as numbers because members and events use Date.now()
function byId(id) {
  return /^\d+$/.test(id) ? { $or: [{ id: id }, { id: Number(id) }] } : { id: id };
}

// the id a new record gets: the one the page sent when the resource allows it, otherwise one made here
function newId(resource, record) {
  if (resource.clientId && record.id !== undefined && record.id !== "") return record.id;
  return resource.numericId ? Date.now() : Date.now().toString(36);
}

// /api/<resource>, with ?field=value filters for the fields a resource lists in "filters"
async function collection(req, res, resource) {
  if (req.method === "GET") {
    const query = new URL(req.url, "http://localhost").searchParams;
    const filter = {};
    (resource.filters || []).forEach(function (field) {
      if (query.has(field)) filter[field] = field === "email" ? query.get(field).trim().toLowerCase() : query.get(field);
    });
    const docs = await models[resource.collection].find(filter).sort({ _id: 1 }).lean();
    return send(req, res, 200, docs.map(strip));
  }
  if (resource.readOnly || req.method !== "POST") return methodNotAllowed(req, res, resource.readOnly ? "GET" : "GET, POST");

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    run(req, res, async function () {
      await refreshProducts();
      const result = prepare(resource, data);
      if (result.errors) return send(req, res, 422, { error: "Validation failed", details: result.errors });

      const record = result.record;
      if (resource.unique && await models[resource.collection].exists({ [resource.unique]: record[resource.unique] })) {
        return send(req, res, 409, { error: resource.duplicateMessage, details: { [resource.unique]: resource.duplicateMessage } });
      }
      const now = new Date().toISOString();
      Object.assign(record, { id: newId(resource, record), createdAt: now, updatedAt: now });
      await models[resource.collection].create(record);
      if (resource.related) {
        const extra = resource.related(record);
        for (const name of Object.keys(extra)) await models[name].create(Object.assign({ id: record.id, createdAt: now }, extra[name]));
      }
      res.setHeader("Location", req.url.split("?")[0].replace(/\/$/, "") + "/" + record.id);
      send(req, res, 201, record);
    });
  });
}

// /api/<resource>/:id
async function item(req, res, resource, id) {
  const model = models[resource.collection];
  if (!["GET", "PUT", "DELETE"].includes(req.method)) return methodNotAllowed(req, res, resource.readOnly ? "GET" : "GET, PUT, DELETE");
  if (resource.readOnly && req.method !== "GET") return methodNotAllowed(req, res, "GET");
  const existing = await model.findOne(byId(id)).lean();

  if (!existing && !(req.method === "PUT" && resource.upsert)) return send(req, res, 404, { error: resource.label + " " + id + " not found" });
  if (req.method === "GET") return send(req, res, 200, strip(existing));

  if (req.method === "DELETE") {
    await model.deleteOne({ _id: existing._id });
    // an order's billing and shipping records go with it
    if (resource.related) for (const name of Object.keys(resource.related(existing))) await models[name].deleteMany({ id: existing.id });
    return send(req, res, 204);
  }

  readJson(req, function (err, data) {
    if (err) return send(req, res, err.code, { error: err.message });
    run(req, res, async function () {
      await refreshProducts();
      // the id in the address wins over any id in the body
      if (data && typeof data === "object" && !Array.isArray(data) && resource.clientId) data = Object.assign({}, data, { id: id });
      const result = prepare(resource, data);
      if (result.errors) return send(req, res, 422, { error: "Validation failed", details: result.errors });

      const record = result.record;
      // the id is the one field that cannot clash with itself, everything else must stay unique
      if (resource.unique && resource.unique !== "id" && await model.exists({ [resource.unique]: record[resource.unique], _id: { $ne: existing && existing._id } })) {
        return send(req, res, 409, { error: resource.duplicateMessage, details: { [resource.unique]: resource.duplicateMessage } });
      }
      // id and createdAt always come from the server, never the client
      const now = new Date().toISOString();
      Object.assign(record, { id: existing ? existing.id : (resource.numericId ? Number(id) : id), createdAt: existing ? existing.createdAt : now, updatedAt: now });
      await model.replaceOne(existing ? { _id: existing._id } : { id: id }, record, { upsert: !!resource.upsert });
      if (resource.related) {
        const extra = resource.related(record);
        for (const name of Object.keys(extra)) await models[name].replaceOne({ id: record.id }, Object.assign({ id: record.id, createdAt: record.createdAt }, extra[name]), { upsert: true });
      }
      send(req, res, 200, record);
    });
  });
}

function methodNotAllowed(req, res, allowed) {
  res.setHeader("Allow", allowed);
  send(req, res, 405, { error: req.method + " is not allowed here. Use: " + allowed });
  return true;
}

module.exports = { handle, ROUTES };
