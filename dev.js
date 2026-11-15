// this is a simple http server that is launched via localhost, makes it easy to run npm run dev to launch the localhost server.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const db = require("./server/db");
const registrationsApi = require("./server/api");
const { color, log } = require("./server/logger");

const PORT = 3000;
const ROOT = __dirname;

const types = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

const server = http.createServer(function (req, res) {
  req.startTime = Date.now(); // used by the logger to show how long each request took
  // restful api backed by MongoDB: registrations, orders, carts, returns, members, posts, products... (see server/api.js)
  if (registrationsApi.handle(req, res)) return;

  const url = decodeURIComponent(req.url.split("?")[0]);

  const filePath = path.join(ROOT, url === "/" ? "index.html" : url);

  // only serve files inside the project folder, never node_modules
  if (!filePath.startsWith(ROOT) || filePath.includes("node_modules") || filePath.startsWith(path.join(ROOT, "data", "db"))) {
    res.writeHead(403).end("Forbidden");
    return log(req, 403);
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404).end("Not found");
      return log(req, 404);
    }
    const ext = path.extname(filePath);
    // no-cache so a normal browser refresh always shows the latest edits
    res.writeHead(200, { "Content-Type": (types[ext] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(data);
    log(req, 200);
  });
});

server.on("listening", function () {
  console.log(`\n${color.green}${color.bold}✔ Server was started successfully!${color.reset}`);
  console.log(`${color.cyan}  Local: http://localhost:${PORT}${color.reset}`);
  console.log(`${color.bold}  API routes:${color.reset}`);
  registrationsApi.ROUTES.forEach(route => console.log(`${color.dim}    ${route}${color.reset}`));
  console.log(`${color.bold}  Database: MongoDB "${db.DB_NAME}" (data/db)${color.reset}`);
  console.log(`${color.dim}  Reload the page to see changes. Break with Ctrl+C to stop.${color.reset}\n`);
  // open the default browser (windows, mac, linux)
  const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${opener} http://localhost:${PORT}`);
});

server.on("error", function (err) {
  const msg = err.code === "EADDRINUSE" ? `Port ${PORT} is already in use.` : err.message;
  console.error(`\n${color.red}${color.bold}✖ Server error: ${msg}${color.reset}\n`);
  process.exit(1);
});

// start the database first (connects to MongoDB, launching it if it is not running), then the web server
db.start().then(function () {
  server.listen(PORT);
}).catch(function (err) {
  console.error(`\n${color.red}${color.bold}✖ Could not start MongoDB: ${err.message}${color.reset}\n`);
  process.exit(1);
});

// shut the database down cleanly with the server
["SIGINT", "SIGTERM"].forEach(function (signal) {
  process.on(signal, function () {
    db.stop().finally(() => process.exit(0));
  });
});
