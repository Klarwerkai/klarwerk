// ================================================================================================
// AUFTRAG-mega69 BLOCK D — WIE KLARAS EINE DATEI AUSGELIEFERT WIRD, GEPINNT AM DRAHT.
// ================================================================================================
//
// DER BEFUND (am Draht gemessen — der erste Lauf dieses Tests war ROT und hat ihn geliefert):
// das Manifest zeigt auf https://app.klarwerk.ai/word-addin/taskpane.html
// (docs/word-addin/klara-manifest.xml:39), und dieser Pfad läuft über den SPA-Static-Server
// (services/app/src/web-static.ts). Dessen setHeaders-Callback WOLLTE no-cache bzw. immutable
// setzen — auf dem Draht stand aber für ALLE Pfade `public, max-age=0`: @fastify/static
// überschreibt den Callback mit seinem cacheControl-Default. Für die Frische war das zufällig
// gutartig (max-age=0 → sofort stale → Revalidierung), aber es war NIEMANDES Entscheidung, und
// das intendierte `immutable` der Assets war tot.
//
// Seit mega69 setzt ein onSend-Hook die Zusage für GENAU DIESE Fläche durch (nur /word-addin/*,
// nicht die ganze App — Auftragsgrenze): no-cache, nie immutable, mit Validator. Dieser Test
// pinnt das am Draht; vorher prüfte kein Test irgendeinen Cache-Header dieser Datei.
//
// EHRLICHE GRENZE (im Bericht ausführlich): Kopfzeilen regeln nur den INHALT des Taskpanes.
// Pedis „Datei löschen und mit leicht anderem Namen zurückkopieren" in einer Library ist die
// MANIFEST-Ebene (Sideload-Katalog + Office-Wef-Cache) — die erreicht kein HTTP-Header.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerWebStatic } from "../../services/app/src/web-static";

describe("mega69 D · /word-addin/taskpane.html wird nie unveränderlich gecacht", () => {
  let dir: string;
  let app: FastifyInstance;

  beforeAll(async () => {
    // Ein dist-Abbild wie aus `vite build`: index, gehashtes Asset, und das word-addin (public/
    // wird 1:1 kopiert — kein Hashing, stabiler Pfad; genau deshalb DARF es nie immutable sein).
    dir = mkdtempSync(join(tmpdir(), "kw-word-addin-"));
    mkdirSync(join(dir, "assets"));
    mkdirSync(join(dir, "word-addin"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
    writeFileSync(join(dir, "assets", "app-Ck7FJVCZ.js"), "export const x = 1;\n");
    writeFileSync(
      join(dir, "word-addin", "taskpane.html"),
      '<!doctype html><html lang="de"><head><meta charset="utf-8" /></head><body>Prüfung</body></html>',
    );
    app = Fastify();
    await registerWebStatic(app, dir);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("taskpane.html: 200, text/html mit utf-8, Cache-Control no-cache — NIE immutable", async () => {
    const res = await app.inject({ method: "GET", url: "/word-addin/taskpane.html" });
    expect(res.statusCode).toBe(200);
    // Kodierungs-Beleg am Draht (Block C): der Umlaut kommt als UTF-8 an, der Content-Type sagt es.
    expect(String(res.headers["content-type"])).toMatch(/text\/html/);
    expect(String(res.headers["content-type"]).toLowerCase()).toContain("utf-8");
    expect(res.body).toContain("Prüfung");
    // DIE Zusage dieses Blocks: revalidieren statt einfrieren.
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(String(res.headers["cache-control"])).not.toContain("immutable");
    // Revalidierung braucht einen Validator — @fastify/static liefert ETag/Last-Modified.
    expect(res.headers.etag ?? res.headers["last-modified"]).toBeTruthy();
  });

  it("KALIBRIERUNG: der Hook trifft NUR /word-addin/* — Assets behalten den heutigen Draht-Stand", async () => {
    // Ohne diesen Kontrast wäre „no-cache am Taskpane" auch mit einem globalen Header grün. Die
    // Assets zeigen den GEMESSENEN Ist-Zustand (public, max-age=0 — der @fastify/static-Default,
    // der den setHeaders-Callback überschreibt): der mega69-Eingriff ändert bewusst nur die eine
    // Fläche; die App-weite Cache-Entscheidung liegt als Registerpunkt beim Kopf.
    const res = await app.inject({ method: "GET", url: "/assets/app-Ck7FJVCZ.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=0");
  });
});
