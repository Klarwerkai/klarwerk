// ================================================================================================
// R-0586 (W2) · DIE DEKLARIERTE ZIELLISTE IST VOLLSTÄNDIG — UND NUR SIE.
// ================================================================================================
//
// Gegenstand: `services/app/src/ausgehende-ziele.json`. Bewusst eine Datenliste und kein Modul: der
// Egress-Wächter (`tests/security/egress-chokepoint.test.ts`) erlaubt die Namen der Modellhosts in
// keiner `.ts`-Datei ausser den Chokepoint-Clients — eine Liste, die sie nennt, ist keine davon.
// Gemessen wird am Quelltext des Servers (`services/**`, ohne Tests), in beide Richtungen:
//   Z1  jede Datei, die selbst eine Verbindung nach aussen aufbaut, steht in der Liste — und jede
//       Verbindungsdatei der Liste baut wirklich eine auf (keine toten Einträge);
//   Z2  jeder im Code einer Verbindungsdatei FEST vorgegebene Host ist für diese Datei eingetragen;
//   Z3  jeder eingetragene Host und jede eingetragene Umgebungsvariable kommt in den genannten
//       Dateien tatsächlich vor.
// Ein neuer Client, ein neuer fester Host oder ein still entfernter Weg macht diese Datei rot.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AUSGELASSEN = new Set(["node_modules", "dist", "coverage", "test-results"]);
const LISTE = "services/app/src/ausgehende-ziele.json";

interface AusgehendesZiel {
  kennung: string;
  zweck: string;
  dateien: string[];
  hosts: string[];
  umgebung: string[];
  freigabe: string;
}

const AUSGEHENDE_ZIELE = (
  JSON.parse(readFileSync(join(WURZEL, LISTE), "utf8")) as { ziele: AusgehendesZiel[] }
).ziele;

function serverQuellen(verzeichnis: string, aus: string[] = []): string[] {
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const voll = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (!AUSGELASSEN.has(eintrag.name)) {
        serverQuellen(voll, aus);
      }
    } else if (eintrag.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(eintrag.name)) {
      aus.push(relative(WURZEL, voll).replaceAll("\\", "/"));
    }
  }
  return aus;
}

const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

/**
 * Kommentare weg, Zeichenketten bleiben. Ein Kommentar beginnt nur am Zeilenanfang oder nach
 * Leerraum — `"https://…"` (Doppelpunkt vor `//`) und `"image/*"` bleiben damit Code.
 */
function nurCode(text: string): string {
  return text
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, "$1")
    .split("\n")
    .map((zeile) => zeile.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n");
}

/** Woran eine Datei erkennbar ist, die selbst eine Verbindung aufbaut. */
const VERBINDUNGSMUSTER: readonly RegExp[] = [
  // injizierbarer Transport mit dem globalen `fetch` als Vorgabe
  /\?\?\s*fetch\b/,
  /\bglobalThis\.fetch\b/,
  // direkter Aufruf des globalen `fetch`
  /(^|[^.\w])fetch\(/m,
  /from\s+"node:(?:https?|http2|tls)"/,
  /\bnet\.(?:connect|createConnection)\(/,
  /from\s+"(?:nodemailer|undici|axios|got|node-fetch)"/,
  /\bnew\s+WebSocket\(/,
];

const HOST_MUSTER = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/g;

function verbindungsdateien(): string[] {
  return serverQuellen(join(WURZEL, "services"))
    .filter((pfad) => VERBINDUNGSMUSTER.some((muster) => muster.test(nurCode(lies(pfad)))))
    .sort();
}

/** Die Datei, die eine eingetragene Verbindung aufbaut, ist jeweils die erste ihrer Liste. */
function eingetrageneVerbindungsdateien(): string[] {
  return [
    ...new Set(
      AUSGEHENDE_ZIELE.map((ziel) => ziel.dateien[0] ?? "").filter((p) => p.endsWith(".ts")),
    ),
  ].sort();
}

describe("R-0586 · die deklarierte Liste der ausgehenden Ziele", () => {
  it("Kalibrierung: die Siebung lässt Hosts in Kommentaren fallen und in Zeichenketten stehen", () => {
    const probe = [
      "// Beispiel: https://kommentar.example/v1",
      "/** z. B. `https://block.example` */",
      'const ziel = "https://code.example/v1"; // dahinter https://hinten.example',
      'const muster = "image/*";',
      "const zweites = `https://${lang}.wikipedia.org`;",
    ].join("\n");
    const hosts = [...nurCode(probe).matchAll(HOST_MUSTER)].map((m) => m[1]);
    expect(hosts).toEqual(["code.example"]);
    expect(VERBINDUNGSMUSTER.some((m) => m.test(nurCode("// fetch(url)")))).toBe(false);
    expect(VERBINDUNGSMUSTER.some((m) => m.test("const f = cfg.fetchFn ?? fetch;"))).toBe(true);
  });

  it("Z1 · genau die Dateien, die eine Verbindung aufbauen, stehen in der Liste", () => {
    const gefunden = verbindungsdateien();
    // Die Messung ist nicht leer — sonst bewiese die Gleichheit unten nichts.
    expect(gefunden).toContain("services/reasoner/src/model-client.ts");
    expect(gefunden).toEqual(eingetrageneVerbindungsdateien());
  });

  it("Z2 · jeder im Code fest vorgegebene Host einer Verbindungsdatei ist für sie eingetragen", () => {
    for (const datei of verbindungsdateien()) {
      const erlaubt = new Set(
        AUSGEHENDE_ZIELE.filter((ziel) => ziel.dateien.includes(datei)).flatMap((z) => z.hosts),
      );
      const imCode = [...nurCode(lies(datei)).matchAll(HOST_MUSTER)].map((m) => m[1] ?? "");
      const fremd = imCode.filter((host) => !erlaubt.has(host));
      expect([datei, fremd]).toEqual([datei, []]);
    }
  });

  it("Z3 · jeder Eintrag ist gedeckt: Dateien da, Hosts und Umgebungsvariablen darin genannt", () => {
    const kennungen = AUSGEHENDE_ZIELE.map((ziel) => ziel.kennung);
    expect(new Set(kennungen).size).toBe(kennungen.length);
    for (const ziel of AUSGEHENDE_ZIELE) {
      expect([ziel.kennung, ziel.dateien.length > 0]).toEqual([ziel.kennung, true]);
      expect([ziel.kennung, ziel.freigabe.length > 0]).toEqual([ziel.kennung, true]);
      // Jedes Ziel ist entweder fest vorgegeben oder vom Betreiber gesetzt — nie keines von beiden.
      expect([ziel.kennung, ziel.hosts.length + ziel.umgebung.length > 0]).toEqual([
        ziel.kennung,
        true,
      ]);
      for (const datei of ziel.dateien) {
        expect([ziel.kennung, datei, existsSync(join(WURZEL, datei))]).toEqual([
          ziel.kennung,
          datei,
          true,
        ]);
      }
      const text = ziel.dateien.map(lies).join("\n");
      for (const host of ziel.hosts) {
        const spur = host.startsWith("*.") ? `.${host.slice(2)}` : `://${host}`;
        expect([ziel.kennung, host, text.includes(spur)]).toEqual([ziel.kennung, host, true]);
      }
      for (const variable of ziel.umgebung) {
        expect([ziel.kennung, variable, text.includes(variable)]).toEqual([
          ziel.kennung,
          variable,
          true,
        ]);
      }
    }
  });
});
