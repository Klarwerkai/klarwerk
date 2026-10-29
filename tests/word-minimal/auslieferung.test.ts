import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { expect, it } from "vitest";
import {
  KLARA_BEGLEITUNG_FASSUNG,
  KLARA_BEGLEITUNG_PFAD,
  KLARA_FASSUNG_KOPF,
  KLARA_TASKPANE_FASSUNG,
  KLARA_TASKPANE_PFAD,
  registerWebStatic,
} from "../../services/app/src/web-static";

it.each([
  [KLARA_TASKPANE_PFAD, KLARA_TASKPANE_FASSUNG, "klara-manifest.xml"],
  [KLARA_BEGLEITUNG_PFAD, KLARA_BEGLEITUNG_FASSUNG, "klara-begleitung-manifest.xml"],
])("UI-MIN: %s liefert dieselbe Fassung in Manifest, HTML, Assets und HEAD", async (path, version, manifest) => {
  const dir = mkdtempSync(join(tmpdir(), "word-ui-min-delivery-"));
  const app = Fastify();
  try {
    mkdirSync(join(dir, "word-addin"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Test</title>");
    for (const file of ["taskpane.html", "begleitung.html"]) {
      writeFileSync(join(dir, "word-addin", file), readFileSync(join("apps/web/public/word-addin", file)));
    }
    await registerWebStatic(app, dir);
    const result = await app.inject({ method: "GET", url: path });
    expect(result.statusCode).toBe(200);
    expect(result.headers[KLARA_FASSUNG_KOPF]).toBe(version);
    expect(result.headers["cache-control"]).toBe("no-cache");
    expect(result.body).toContain('name="kw-loaded-version" content="' + version + '"');
    expect(result.body).not.toContain("__KW_FASSUNG__");
    for (const asset of ["minimal.js", "minimal-funktionen.js", "minimal.css"]) {
      expect(result.body).toContain(asset + "?v=" + version);
    }
    expect(result.headers.etag).toBe('"' + createHash("sha256").update(result.body).digest("hex").slice(0, 32) + '"');
    const head = await app.inject({ method: "HEAD", url: path });
    expect(head.body).toBe("");
    expect(head.headers[KLARA_FASSUNG_KOPF]).toBe(version);
    const xml = readFileSync(join("docs/word-addin", manifest), "utf8");
    expect(xml).toContain("<Version>" + version + "</Version>");
    expect(xml).toContain(path + "?v=" + version);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("UI-MIN: eine fehlende Begleitung wird als 404 ausgeliefert", async () => {
  const dir = mkdtempSync(join(tmpdir(), "word-ui-min-missing-"));
  const app = Fastify();
  try {
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
    await registerWebStatic(app, dir);
    const result = await app.inject({ method: "GET", url: KLARA_BEGLEITUNG_PFAD });
    expect(result.statusCode).toBe(404);
    expect(result.body).toBe("Not Found");
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
