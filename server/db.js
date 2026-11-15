// mongodb setup. starting the node server (npm run dev) also starts the database:
//   1. if MONGODB_URI is set, or a mongod is already running on localhost:27017, that one is used
//   2. otherwise a real mongod is launched for us (mongodb-memory-server) and saves its files in data/db,
//      so everything stays between runs. connect to mongodb://127.0.0.1:27017/ist256 with Compass to look at it.
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { color } = require("./logger");

const DB_NAME = "ist256";
const DEFAULT_URI = "mongodb://127.0.0.1:27017/" + DB_NAME;
const DB_DIR = path.join(__dirname, "..", "data", "db");
const DATA_DIR = path.join(__dirname, "..", "data");

// collections used by the pages. Products, Cart, Shipping, Billing and Returns are the ones the lab asks for.
// the schema is open (strict: false) because each api resource in resources.js already checks its own fields.
const COLLECTIONS = {
  products: "products",
  carts: "carts",
  shippings: "shipping",
  billings: "billing",
  returns: "returns",
  orders: "orders",
  registrations: "registrations",
  artworks: "artworks",
  members: "members",
  posts: "posts",
  events: "events"
};

// collections filled from a data/<file>.json the first time the database is empty
const SEED_FILES = { products: "products.json", members: "members.json", posts: "posts.json", events: "events.json" };

const models = {};
Object.keys(COLLECTIONS).forEach(function (key) {
  const schema = new mongoose.Schema({}, { strict: false, versionKey: false, id: false });
  models[key] = mongoose.model(key, schema, COLLECTIONS[key]);
});

let memoryServer = null;

async function tryConnect(uri, timeoutMs) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
}

async function startEmbedded() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  fs.mkdirSync(DB_DIR, { recursive: true });
  const options = { instance: { dbPath: DB_DIR, storageEngine: "wiredTiger", dbName: DB_NAME } };
  try {
    memoryServer = await MongoMemoryServer.create({ instance: Object.assign({ port: 27017 }, options.instance) });
  } catch (e) {
    // port 27017 is taken by something that is not mongodb, so let mongod pick a free one
    memoryServer = await MongoMemoryServer.create(options);
  }
  return memoryServer.getUri(DB_NAME);
}

async function seed() {
  for (const key of Object.keys(SEED_FILES)) {
    if (await models[key].estimatedDocumentCount() > 0) continue;
    try {
      const list = JSON.parse(fs.readFileSync(path.join(DATA_DIR, SEED_FILES[key]), "utf8"));
      if (Array.isArray(list) && list.length) {
        await models[key].insertMany(list);
        console.log(`${color.dim}  Seeded ${COLLECTIONS[key]} with ${list.length} documents from data/${SEED_FILES[key]}${color.reset}`);
      }
    } catch (e) {
      // no seed file on a fresh clone, the collection just starts empty
    }
  }
}

// connect to mongodb (starting it if needed), create the collections and seed them
async function start() {
  let uri = process.env.MONGODB_URI;
  if (uri) {
    await tryConnect(uri, 5000);
  } else {
    try {
      await tryConnect(DEFAULT_URI, 1500); // a mongod the group member already runs
    } catch (e) {
      console.log(`${color.dim}  No MongoDB found on localhost:27017, starting one (first run downloads mongod)...${color.reset}`);
      uri = await startEmbedded();
      await tryConnect(uri, 15000);
    }
  }
  await Promise.all(Object.keys(models).map(key => models[key].createCollection().catch(() => {})));
  await models.registrations.collection.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  await seed();
  const c = mongoose.connection;
  console.log(`${color.green}${color.bold}✔ MongoDB connected${color.reset} ${color.cyan}${c.host}:${c.port}/${c.name}${color.reset}`);
}

async function stop() {
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) await memoryServer.stop().catch(() => {});
}

// documents come back without mongo's internal _id so the pages see the same json as before
function strip(doc) {
  if (!doc) return doc;
  const copy = Object.assign({}, doc);
  delete copy._id;
  return copy;
}

module.exports = { start, stop, models, strip, COLLECTIONS, DB_NAME };
