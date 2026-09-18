// Servidor local do painel de acompanhamento. Sem dependências: `node painel/server.js`
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;
const DOCS = ["PLANO-DE-PRODUCAO.md", "Sistema-Deguste-Burguer-Planejamento.md"];

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/") {
        return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(path.join(__dirname, "index.html")));
      }
      if (url.pathname.startsWith("/doc/")) {
        const name = decodeURIComponent(url.pathname.slice(5));
        if (!DOCS.includes(name)) return send(res, 404, "text/plain", "not found");
        const file = path.join(ROOT, name);
        const mtime = fs.statSync(file).mtimeMs;
        res.setHeader("X-Mtime", String(mtime));
        return send(res, 200, "text/markdown; charset=utf-8", fs.readFileSync(file));
      }
      if (url.pathname === "/api/mtime") {
        const m = Object.fromEntries(DOCS.map((d) => [d, fs.statSync(path.join(ROOT, d)).mtimeMs]));
        return send(res, 200, "application/json", JSON.stringify(m));
      }
      send(res, 404, "text/plain", "not found");
    } catch (e) {
      send(res, 500, "text/plain", String(e.message));
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Painel Deguste em http://localhost:${PORT}`));
