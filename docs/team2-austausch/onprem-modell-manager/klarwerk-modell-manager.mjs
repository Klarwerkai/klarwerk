#!/usr/bin/env node
/* KLARWERK Modell-Manager (On-Prem) — KWN / KLLM-62
 *
 * Kleiner, abhängigkeitsfreier lokaler Server: bedient Ollama über dessen HTTP-API und
 * liefert ein Web-UI zum Laden/Verwalten lokaler LLMs. Bindet NUR an 127.0.0.1 (nie öffentlich).
 * Talkt ausschließlich mit dem lokalen Ollama (127.0.0.1:11434) — der eigentliche Modell-Download
 * läuft über Ollama (braucht einmalig Internet). Keine Secrets, keine Käufe.
 *
 * Start:  node klarwerk-modell-manager.mjs      → http://localhost:11888
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.KWN_PORT || 11888);
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const HOST = "127.0.0.1"; // niemals öffentlich binden

const readBody = (req) =>
  new Promise((res) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => res(d));
  });

const sendJson = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

// Web-ReadableStream (fetch-Body) → Node-Response durchpumpen (NDJSON-Streaming von Ollama).
async function pump(webStream, res) {
  const reader = webStream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/") {
      const html = readFileSync(join(DIR, "ui.html"), "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (req.method === "GET" && path === "/api/health") {
      try {
        const r = await fetch(OLLAMA + "/api/version");
        const j = await r.json();
        return sendJson(res, 200, { ok: true, ollama: j.version || "?" });
      } catch {
        return sendJson(res, 200, { ok: false });
      }
    }

    if (req.method === "GET" && path === "/api/models") {
      try {
        const r = await fetch(OLLAMA + "/api/tags");
        const j = await r.json();
        return sendJson(res, 200, j);
      } catch (e) {
        return sendJson(res, 502, { error: "Ollama nicht erreichbar: " + e.message });
      }
    }

    if (req.method === "POST" && path === "/api/pull") {
      const { source } = JSON.parse((await readBody(req)) || "{}");
      if (!source) return sendJson(res, 400, { error: "Quelle fehlt" });
      let upstream;
      try {
        upstream = await fetch(OLLAMA + "/api/pull", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: source, stream: true }),
        });
      } catch (e) {
        return sendJson(res, 502, { error: "Ollama nicht erreichbar: " + e.message });
      }
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text().catch(() => "");
        return sendJson(res, 502, { error: "Ollama-Pull HTTP " + upstream.status + " " + t });
      }
      res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" });
      return pump(upstream.body, res);
    }

    if (req.method === "POST" && path === "/api/copy") {
      const { source, destination } = JSON.parse((await readBody(req)) || "{}");
      if (!source || !destination) return sendJson(res, 400, { error: "source/destination fehlt" });
      const r = await fetch(OLLAMA + "/api/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, destination }),
      });
      return sendJson(res, r.ok ? 200 : 502, { ok: r.ok });
    }

    if (req.method === "POST" && path === "/api/delete") {
      const { name } = JSON.parse((await readBody(req)) || "{}");
      if (!name) return sendJson(res, 400, { error: "name fehlt" });
      const r = await fetch(OLLAMA + "/api/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      return sendJson(res, r.ok ? 200 : 502, { ok: r.ok });
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`KLARWERK Modell-Manager läuft auf http://localhost:${PORT}  (Ollama: ${OLLAMA})`);
  console.log("Nur lokal erreichbar (127.0.0.1). Fenster schließen = Server stoppen.");
});
