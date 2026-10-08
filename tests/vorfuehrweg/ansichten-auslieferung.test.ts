// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DIE BILDSCHIRMANSICHTEN WERDEN MITGELIEFERT.
// ================================================================================================
//
// Der Vorführweg verlinkt je Station eine Bildschirmansicht (Deutsch `<station>.png`, Englisch
// `<station>-en.png`). Diese Datei belegt, dass jede verlinkte Datei im ausgelieferten Ordner liegt,
// genau die gesicherte Aufnahme ist (Größe und SHA-256 aus den Bildbelegen des Aufnahmelaufs,
// Herkunft in `docs/belege/vorfuehrweg-ansichten.md`) und über den echten statischen
// Auslieferungsweg als Bild erreichbar ist.
//
// Die Linkziele werden aus der ausgelieferten Seite gelesen, nicht abgeschrieben: eine neue oder
// umbenannte Verlinkung ohne zugehörige Aufnahme wird hier rot, ebenso eine Aufnahme ohne Link.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";

const OEFFENTLICH = "apps/web/public";
const SEITE = join(OEFFENTLICH, "demonstration", "vorfuehrweg.html");
const ORDNER = join(OEFFENTLICH, "demonstration", "vorfuehrweg-ansichten");
const PRAEFIX = "/demonstration/vorfuehrweg-ansichten/";

/** Die gesicherten Aufnahmen (Kandidat 775fd23c, Gruppe `vorfuehrweg-ansichten`). */
const AUFNAHMEN: Record<string, { bytes: number; sha256: string }> = {
  "bibliothek-en.png": {
    bytes: 110789,
    sha256: "1ff5fb26a6968c803ff3b9e755f045659ddb038401a89e77547cfab5ae5010dd",
  },
  "bibliothek.png": {
    bytes: 109655,
    sha256: "548461c672107ee17e0c72ca4beeaa61fa4a0eaaf1a1580c718399a4e02dcec4",
  },
  "demodaten-en.png": {
    bytes: 93871,
    sha256: "4da4d11ec9da1c8f1309fecc5eab430b4316ea460691cefc59939de379b70179",
  },
  "demodaten.png": {
    bytes: 94864,
    sha256: "6108d2484d64179c18f7700a4faa6db7bce7e5cba539c93a727633c193fdf39b",
  },
  "erfassen-en.png": {
    bytes: 69870,
    sha256: "b35fe1ede3bb1d4f8f5b8272207d1cb3b9b3bd7f738b6a8ee81d0665dc0475b7",
  },
  "erfassen.png": {
    bytes: 70598,
    sha256: "6b5361fff47734ecb2f1b85ab0e46fb956deac6641173a36256a3645859297af",
  },
  "fragen-en.png": {
    bytes: 67209,
    sha256: "ca136a5ad1544ce2dbb7fb1f55b129e25ab3f3d04d9011ba855dfc23f8b5bd37",
  },
  "fragen.png": {
    bytes: 69011,
    sha256: "5a86305fbc37b67ee5e374b7f537b0fad94306e0fc16d083d871e6ea72737f4c",
  },
  "importwege-en.png": {
    bytes: 81869,
    sha256: "ba296aa54349f878e5a0448952eeaa922728c5a32673937cb3bb990381a657ed",
  },
  "importwege.png": {
    bytes: 87908,
    sha256: "5f95a7933ec2857aab5552ee09396f227570832d1e797a4e1b04b54f2a3d663f",
  },
  "konflikte-en.png": {
    bytes: 95039,
    sha256: "b9abf0f551962054c718eaa85449b66d8856d7f6fd8c3df53f7e48cc3295e6ff",
  },
  "konflikte.png": {
    bytes: 98397,
    sha256: "35c93d4d75123be9a40820dcdf8568175c4331dce8e2b9e13eb349cbf3cefff2",
  },
  "lagerfall-en.png": {
    bytes: 113326,
    sha256: "da22911c24f8fe1a76a6c815be52d6bf98694608a9e4e1ff7815e36e812f63e7",
  },
  "lagerfall.png": {
    bytes: 110236,
    sha256: "d48cafaa5b855950290848e853841d90ebe233f3f4bd9a4c85f378787ea1f113",
  },
  "schweissnaht-en.png": {
    bytes: 111699,
    sha256: "a94408c235be2566ff43915543d505db9d3b9151101c5030dcaf5beddcde7ac4",
  },
  "schweissnaht.png": {
    bytes: 116168,
    sha256: "f3c9ec34ec31b9cffe8622109f5a26a2f1efb3ee753aa01b2a236479f33405d8",
  },
  "start-en.png": {
    bytes: 81623,
    sha256: "0e9c26d36fad864d8f56700bbabe907449684cce98afc34470b5e7aa29badb46",
  },
  "start.png": {
    bytes: 82000,
    sha256: "df8c9ccddb11ccc10ff20ec66edfba8d09c08df78c668f5a78a4c755bc2285cd",
  },
  "validierung-en.png": {
    bytes: 107906,
    sha256: "353166a17defe2f298c4c32bcb7cdcb96217eb1f178ff1fe9b3de963551e5246",
  },
  "validierung.png": {
    bytes: 107529,
    sha256: "498898e5143833b0bfbf404d5a0ec82b8241052d5b01c988b6ae30116ca47b80",
  },
};

/** Die Bildlinks der ausgelieferten Seite, ohne Wiederholung. */
function verlinkt(): string[] {
  const html = readFileSync(SEITE, "utf8");
  const treffer = [...html.matchAll(/class="ansicht (?:de|en)"[^>]*href="([^"]+)"/g)];
  return [...new Set(treffer.map((m) => m[1] ?? ""))].sort();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Vorführweg · die verlinkten Bildschirmansichten werden mitgeliefert", () => {
  it("A1 · jeder Bildlink zeigt auf eine gesicherte Aufnahme, und jede Aufnahme ist verlinkt", () => {
    const links = verlinkt();
    expect(links).toHaveLength(20);
    for (const link of links) {
      expect(link.startsWith(PRAEFIX), link).toBe(true);
    }
    const namen = links.map((link) => link.slice(PRAEFIX.length));
    expect(namen).toEqual(Object.keys(AUFNAHMEN).sort());
    expect(readdirSync(ORDNER).sort()).toEqual(namen);
  });

  it("A2 · jede Datei ist genau die gesicherte Aufnahme (Größe und SHA-256)", () => {
    for (const [name, erwartet] of Object.entries(AUFNAHMEN)) {
      const datei = join(ORDNER, name);
      expect(existsSync(datei), `${name} fehlt im Lieferumfang`).toBe(true);
      const bytes = readFileSync(datei);
      expect(bytes.length, `${name}: Größe`).toBe(erwartet.bytes);
      expect(sha256(bytes), `${name}: Prüfsumme`).toBe(erwartet.sha256);
    }
  });

  it("A3 · der echte statische Auslieferungsweg liefert jede verlinkte Datei als PNG", async () => {
    const app = Fastify();
    try {
      await registerSecurityHeaders(app);
      await registerWebStatic(app, resolve(OEFFENTLICH));
      for (const link of verlinkt()) {
        const antwort = await app.inject({ method: "GET", url: link });
        expect(antwort.statusCode, link).toBe(200);
        expect(String(antwort.headers["content-type"]), link).toContain("image/png");
        const name = link.slice(PRAEFIX.length);
        expect(sha256(antwort.rawPayload), link).toBe(AUFNAHMEN[name]?.sha256);
      }
    } finally {
      await app.close();
    }
  });
});
