// this is a simple http server that is launched via localhost, makes it easy to run npm run dev to launch the localhost server.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;
const color = { green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m", reset: "\x1b[0m" };

const types = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

// log every request, colored by status code
function log(req, code) {
  const c = code >= 400 ? color.red : code >= 300 ? color.yellow : color.green;
  console.log(`${color.dim}${new Date().toLocaleTimeString()}${color.reset} ${c}${code}${color.reset} ${req.method} ${req.url}`);
}

const server = http.createServer(function (req, res) {
  const url = decodeURIComponent(req.url.split("?")[0]);
  // api for the members: GET reads data/members.json, PUT overwrites it
  if (url === "/api/members") {
    const membersFile = path.join(ROOT, "data", "members.json");
    if (req.method === "GET") {
      fs.readFile(membersFile, "utf8", function (err, data) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(err ? "[]" : data);
        log(req, 200);
      });
      return;
    }
    if (req.method === "PUT") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", function () {
        try {
          const members = JSON.parse(body);
          if (!Array.isArray(members)) throw new Error("not a list");
          fs.writeFileSync(membersFile, JSON.stringify(members, null, 2) + "\n");
          res.writeHead(200).end("saved");
          log(req, 200);
        } catch (e) {
          res.writeHead(400).end("Bad data");
          log(req, 400);
        }
      });
      return;
    }
  }

  const filePath = path.join(ROOT, url === "/" ? "index.html" : url);

  // only serve files inside the project folder, never node_modules
  if (!filePath.startsWith(ROOT) || filePath.includes("node_modules")) {
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

server.listen(PORT);
