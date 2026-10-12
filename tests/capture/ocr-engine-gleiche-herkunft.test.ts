// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0151 (Nacharbeit 13) — DIE BILD-TEXTERKENNUNG LÄUFT UNTER DER EIGENEN CSP
// ================================================================================================
//
// Der Befund der technischen OCR-Probe (fiktives Bild, Peters Entscheidung 25): „Creating a worker
// from 'blob:…' violates … script-src 'self'" — jede Erkennung in der ausgelieferten Anwendung
// scheiterte. Diese Datei belegt die Bausteine der Behebung ohne Browser:
//   G1  die Engine-Einstellungen zeigen nur auf dieselbe Herkunft, kein `blob:`-Arbeiter
//   G2  das Bau-Plugin legt genau die Dateien ab, die die Einstellungen erwarten
//   G3  fehlende Sprachdaten → ehrlich „nicht verfügbar", ohne Engine-Start
//   G4  die CSP erlaubt WebAssembly, aber weder fremde Herkünfte noch `blob:`
// Ob die Erkennung im Browser tatsächlich Text liefert, belegt die Browserprobe
// `tests-smoke/ocr-technische-probe-browser.spec.ts` — sobald Sprachdaten ausgeliefert werden.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  OCR_SPRACHDATEN_PFAD,
  ocrEngineOptionen,
  ocrSprachdatenVorhanden,
  runImageOcr,
} from "../../apps/web/src/lib/files";
import {
  OCR_ENGINE_DATEIEN,
  OCR_ENGINE_PFAD,
  OCR_SPRACHDATEN_ZIEL,
  ocrSprachdateien,
} from "../../apps/web/src/lib/ocrEngineDateien";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";

function antwort(status: number, art: string): Response {
  return new Response(status === 200 ? "x" : null, {
    status,
    headers: { "content-type": art },
  });
}

describe("gesamt-ocr · Nacharbeit 13 · die Engine auf derselben Herkunft", () => {
  it("G1 · Arbeiter, Kern und Sprachdaten kommen von dieser Herkunft; kein blob:-Arbeiter", () => {
    const o = ocrEngineOptionen();
    for (const schluessel of ["workerPath", "corePath", "langPath"]) {
      const wert = String(o[schluessel]);
      expect(wert.startsWith("/"), `${schluessel}: ${wert}`).toBe(true);
      expect(wert.startsWith("//"), `${schluessel}: ${wert}`).toBe(false);
    }
    expect(o.workerBlobURL).toBe(false);
    expect(o.langPath).toBe(OCR_SPRACHDATEN_PFAD);
  });

  it("G2 · das Bau-Plugin legt genau die Dateien ab, die die Einstellungen erwarten", () => {
    const o = ocrEngineOptionen();
    const abgelegt = OCR_ENGINE_DATEIEN.map((d) => `${OCR_ENGINE_PFAD}/${d.name}`);
    expect(abgelegt).toContain(o.workerPath);
    expect(abgelegt).toContain(o.corePath);
    expect(OCR_SPRACHDATEN_ZIEL).toBe(OCR_SPRACHDATEN_PFAD);
    // Sprachdaten aus einem Verzeichnis: nur `*.traineddata.gz`, sortiert.
    const ordner = mkdtempSync(join(tmpdir(), "ocr-sprachen-"));
    writeFileSync(join(ordner, "eng.traineddata.gz"), "e");
    writeFileSync(join(ordner, "deu.traineddata.gz"), "d");
    writeFileSync(join(ordner, "liesmich.txt"), "x");
    expect(ocrSprachdateien(ordner).map((d) => d.name)).toEqual([
      "deu.traineddata.gz",
      "eng.traineddata.gz",
    ]);
    expect(ocrSprachdateien(undefined)).toEqual([]);
  });

  it("G3 · fehlende Sprachdaten: ehrlich nicht verfügbar — und nur echte Sprachdateien zählen", async () => {
    const fehlt = vi.fn(async () => antwort(404, "text/plain"));
    expect(await ocrSprachdatenVorhanden("deu+eng", fehlt as unknown as typeof fetch)).toBe(false);
    const appSeite = vi.fn(async () => antwort(200, "text/html"));
    expect(await ocrSprachdatenVorhanden("deu", appSeite as unknown as typeof fetch)).toBe(false);
    const da = vi.fn(async () => antwort(200, "application/gzip"));
    expect(await ocrSprachdatenVorhanden("deu+eng", da as unknown as typeof fetch)).toBe(true);
    expect(da.mock.calls.map((c) => String((c as unknown[])[0]))).toEqual([
      `${OCR_SPRACHDATEN_PFAD}/deu.traineddata.gz`,
      `${OCR_SPRACHDATEN_PFAD}/eng.traineddata.gz`,
    ]);

    // Der Produktweg: ohne Sprachdaten wird nichts gestartet, die Antwort ist „unavailable".
    const echt = globalThis.fetch;
    globalThis.fetch = fehlt as unknown as typeof fetch;
    try {
      expect(await runImageOcr("data:image/png;base64,AAAA")).toEqual({
        status: "unavailable",
        text: "",
      });
    } finally {
      globalThis.fetch = echt;
    }
  });

  it("G4 · die CSP erlaubt WebAssembly, aber keine fremde Herkunft und kein blob:", async () => {
    // Dieselbe Vorrichtung wie `tests/office-artikel-editor/csp.test.ts`: die echte Registrierung.
    const app = Fastify();
    await registerSecurityHeaders(app, {});
    app.get("/erfassen", async (_request, reply) => reply.type("text/html").send("ok"));
    await app.ready();
    let csp = "";
    try {
      const res = await app.inject({ method: "GET", url: "/erfassen" });
      csp = String(res.headers["content-security-policy"] ?? "");
    } finally {
      await app.close();
    }
    const direktive = (name: string): string[] => {
      const teil = csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `));
      return teil ? teil.split(/\s+/).slice(1) : [];
    };
    expect(direktive("script-src")).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(direktive("connect-src")).toEqual(["'self'"]);
    expect(csp).not.toContain("blob:");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
