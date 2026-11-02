// terminal logging for npm run dev. every request gets one line, api requests also show what came in and what went out.
const color = { green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", magenta: "\x1b[35m", dim: "\x1b[2m", bold: "\x1b[1m", reset: "\x1b[0m" };

const MAX_PREVIEW = 300; // long json bodies get cut off so the terminal stays readable

function time() {
  return `${color.dim}${new Date().toLocaleTimeString()}${color.reset}`;
}

// one line per request, colored by status code, with how long it took
function log(req, code) {
  const c = code >= 400 ? color.red : code >= 300 ? color.yellow : color.green;
  const ms = req.startTime ? Date.now() - req.startTime : 0;
  const tag = req.url.startsWith("/api/") ? `${color.magenta}[API]${color.reset} ` : "";
  console.log(`${time()} ${c}${code}${color.reset} ${tag}${req.method} ${req.url} ${color.dim}${ms}ms${color.reset}`);
}

// indented line under a request, used for request/response bodies
function detail(label, value) {
  let text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined || text === "") return;
  if (text.length > MAX_PREVIEW) text = text.slice(0, MAX_PREVIEW) + `... (${text.length} chars)`;
  console.log(`         ${color.cyan}${label}${color.reset} ${color.dim}${text}${color.reset}`);
}

function error(message, err) {
  console.error(`${time()} ${color.red}${color.bold}✖ ${message}${color.reset}${err ? ` ${color.dim}${err.message}${color.reset}` : ""}`);
}

module.exports = { color, log, detail, error };
