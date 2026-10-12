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

/**
 * Die gesicherten Aufnahmen (Gruppe `vorfuehrweg-ansichten`; Herkunft je Datei im Beleg). Alle 20
 * stammen aus dem Aufnahmelauf an Kandidat 73a26d5e (integrierte Oberfläche, Nutzungshinweis
 * bestätigt); importwege und importwege-en waren dort bytegleich mit der bisherigen Auslieferung.
 */
const AUFNAHMEN: Record<string, { bytes: number; sha256: string }> = {
  "bibliothek-en.png": {
    bytes: 124583,
    sha256: "9f7f69366b96a5b572e46e1711a32a9a9abaf60f43fb18bc7b5e063137cb640a",
  },
  "bibliothek.png": {
    bytes: 124066,
    sha256: "e33179711fcad9b8c0cdcf38ba69650a99e848e13972b013933afc657a0a69f6",
  },
  "demodaten-en.png": {
    bytes: 105869,
    sha256: "be6a668cf66f2881ebbdde6776849a7fecf46908736b8b92a8fec2a2041853d8",
  },
  "demodaten.png": {
    bytes: 104973,
    sha256: "b6b9fb662c1809ea11dbb586da0c94d7e83c8be4d43fc15a180605262663d014",
  },
  "erfassen-en.png": {
    bytes: 73989,
    sha256: "2875880581ff3582a140e1cdfcbbd76e32777d8ccb136d7fa4a4ba300c58ddd3",
  },
  "erfassen.png": {
    bytes: 72027,
    sha256: "113205389185a8582ffe31011ef13b12c86f56621a04e095f5dba27dc02e6153",
  },
  "fragen-en.png": {
    bytes: 87685,
    sha256: "5e093bf4288caa10bb6fae0054d348554ddc5502081f98b700d84c523b4ef8f2",
  },
  "fragen.png": {
    bytes: 87402,
    sha256: "3c87410efaf658aefc20da41f561b34c0d8ab34bcd085dae99fac5dcbc04a5f6",
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
    bytes: 95966,
    sha256: "12f4df09d3e0a9d1cde8262e6ce1262c73a7d6cf33fcc9e06e184361fae87c93",
  },
  "konflikte.png": {
    bytes: 95400,
    sha256: "9b51e2a74c644c8495cefbff32a775d9cabecb9ce66b7a1146ec255187c8fb92",
  },
  "lagerfall-en.png": {
    bytes: 123350,
    sha256: "c69db633654cdc93cd2cb1a29d34b7c336d768d1e7f1459b7f9273cf9c3e335f",
  },
  "lagerfall.png": {
    bytes: 125061,
    sha256: "1dfdb4c3b9fba557e01d04dad0ea5f2780664a3d7930283a9d976e4536e18a54",
  },
  "schweissnaht-en.png": {
    bytes: 120411,
    sha256: "f2eee37c1ae870431f08cc3346626d04e8831c5825f00ae24490acbd7aa316e5",
  },
  "schweissnaht.png": {
    bytes: 126151,
    sha256: "1cea861c24f9be88a0dafc11f1b391db4871447eb8992987e5c545e436d4ddd6",
  },
  "start-en.png": {
    bytes: 84361,
    sha256: "5b4c751a2250b7d31d5f140f2cb3e8527bf870cfca093d6ab359f18328d7f597",
  },
  "start.png": {
    bytes: 81629,
    sha256: "50286e40bcd614b614287911c56bff384491baebaffa130e08cfb2750d5a9a41",
  },
  "validierung-en.png": {
    bytes: 131366,
    sha256: "bee495dc697d9dc95418d653bf584131a20f106ac10b42a84cfbe1ae106c3ced",
  },
  "validierung.png": {
    bytes: 133440,
    sha256: "c741028d55d5860bdfd368af3e20b8fe50baa479e08afccb32daa457e000a5b3",
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
