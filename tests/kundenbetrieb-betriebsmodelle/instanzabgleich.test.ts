// R-0781 · R-0851 · R-0861 — INSTANZIDENTITÄT, ERWARTETE UND LAUFENDE FASSUNG, KANAL, SOLL/IST.
//
// Befund aus der Prüfung (Ben, Kandidat 09a1e475): eine Versions-/Instanzübersicht mit Kanal und
// Soll/Ist-Abgleich fehlte; `/health` war die Auskunft EINER Instanz. Gemessen wird hier:
//   · `/health` meldet die Identität der Instanz (`instanz`, aus `APP_BASE_URL`) — am echten Produkt;
//   · `scripts/betrieb/instanzabgleich.mjs` als eigener Prozess gegen echte HTTP-Server: gleich,
//     Versions- und Commitabweichung, fremde Identität, nicht erreichbar, auseinandergelaufener Kanal,
//     ungültiges Inventar.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices, instanzAdresse } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";
import { type HealthServer, fahreNode, freieAdresse, healthServer } from "./hilfen";

const WERKZEUG = repoPfad("scripts/betrieb/instanzabgleich.mjs");
const MUSTER = repoPfad("scripts/betrieb/instanzen.beispiel.json");
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const ANDERER_COMMIT = "fedcba9876543210fedcba9876543210fedcba98";

interface Anlage {
  kennung: string;
  ergebnis: string;
  identitaet: string;
  abweichungen: string[];
  laufend: { version: string | null } | null;
}
interface Kanal {
  kanal: string;
  auseinandergelaufen: boolean;
  laufendeFassungen: string[];
  nichtAufStand: string[];
}
interface Bericht {
  gueltig: boolean;
  fehler?: string[];
  anlagen: Anlage[];
  kanaele: Kanal[];
}

const ordner = mkdtempSync(join(tmpdir(), "kw-instanzabgleich-"));
const server: HealthServer[] = [];
let laufNr = 0;

afterEach(async () => {
  await Promise.all(server.splice(0).map((s) => s.schliessen()));
});
afterAll(() => {
  rmSync(ordner, { recursive: true, force: true });
});

/** Eine Instanz, die sich unter ihrer eigenen Adresse kennt — sofern `extra` nichts anderes sagt. */
async function instanz(version: string, extra: Record<string, unknown> = {}): Promise<string> {
  const s = await healthServer((adresse) => ({
    status: "ok",
    version,
    commit: COMMIT,
    instanz: adresse,
    ...extra,
  }));
  server.push(s);
  return s.adresse;
}

/** Ein Inventareintrag; die Firma ist aus der Kennung abgeleitet. */
function eintrag(kennung: string, modell: string, adresse: string, kanal: string) {
  return { kennung, firma: `Firma ${kennung}`, modell, adresse, kanal };
}

async function abgleich(inventar: unknown): Promise<{ code: number | null; bericht: Bericht }> {
  laufNr += 1;
  const datei = join(ordner, `inventar-${laufNr}.json`);
  writeFileSync(datei, JSON.stringify(inventar));
  const lauf = await fahreNode([WERKZEUG, datei, "--json"]);
  return { code: lauf.code, bericht: JSON.parse(lauf.stdout) as Bericht };
}

function anlage(bericht: Bericht, kennung: string): Anlage {
  const treffer = bericht.anlagen.find((a) => a.kennung === kennung);
  expect(treffer, kennung).toBeDefined();
  return treffer as Anlage;
}

describe("R-0851 · /health meldet die Identität der Instanz", () => {
  const vorher = process.env.APP_BASE_URL;
  afterEach(() => {
    if (vorher === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = vorher;
  });

  it("I1 · nur Schema, Host und Port der APP_BASE_URL, sonst ehrlich `unbekannt`", () => {
    expect(instanzAdresse({ APP_BASE_URL: "https://wissen.kunde.de/pfad?x=1" })).toBe(
      "https://wissen.kunde.de",
    );
    expect(instanzAdresse({ APP_BASE_URL: "https://nutzer:geheim@wissen.kunde.de:8443/" })).toBe(
      "https://wissen.kunde.de:8443",
    );
    expect(instanzAdresse({})).toBe("unbekannt");
    expect(instanzAdresse({ APP_BASE_URL: "  " })).toBe("unbekannt");
    expect(instanzAdresse({ APP_BASE_URL: "ftp://wissen.kunde.de" })).toBe("unbekannt");
    expect(instanzAdresse({ APP_BASE_URL: "kein Link" })).toBe("unbekannt");
  });

  it("I2 · die echte Route trägt das Feld neben Version und Commit", async () => {
    process.env.APP_BASE_URL = "https://wissen.kunde-a.example/";
    const app = buildApp(buildServices());
    const antwort = await app.inject({ method: "GET", url: "/health" });
    await app.close();
    const rumpf = JSON.parse(antwort.body) as Record<string, unknown>;
    expect(rumpf.status).toBe("ok");
    expect(rumpf.instanz).toBe("https://wissen.kunde-a.example");
    expect(typeof rumpf.version).toBe("string");
  });
});

describe("R-0781/R-0861 · Inventar, Kanal und Soll/Ist-Abgleich", () => {
  it("A1 · alle Anlagen auf dem Stand ihres Kanals, Identität bestätigt: Exit 0", async () => {
    const a = await instanz("1.0.0-beta.1.760");
    const b = await instanz("1.0.0-beta.1.761");
    const { code, bericht } = await abgleich({
      kanaele: {
        stabil: { version: "1.0.0-beta.1.760", commit: COMMIT },
        pilot: { version: "1.0.0-beta.1.761" },
      },
      instanzen: [eintrag("a", "kundeninstanz", a, "stabil"), eintrag("b", "cloud", b, "pilot")],
    });
    expect(code).toBe(0);
    expect(bericht.anlagen.map((x) => [x.kennung, x.ergebnis, x.identitaet])).toEqual([
      ["a", "gleich", "bestaetigt"],
      ["b", "gleich", "bestaetigt"],
    ]);
    expect(bericht.kanaele.every((k) => !k.auseinandergelaufen)).toBe(true);
  });

  it("A2 · eine Anlage auf altem Stand: Kanal auseinandergelaufen, Anlage benannt", async () => {
    const a = await instanz("1.0.0-beta.1.760");
    const b = await instanz("1.0.0-beta.1.740");
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0-beta.1.760" } },
      instanzen: [eintrag("a", "kundeninstanz", a, "stabil"), eintrag("b", "insel", b, "stabil")],
    });
    expect(code).toBe(1);
    expect(anlage(bericht, "a").ergebnis).toBe("gleich");
    expect(anlage(bericht, "b").ergebnis).toBe("abweichend");
    expect(anlage(bericht, "b").abweichungen.join(" ")).toContain(
      "version: erwartet 1.0.0-beta.1.760, laufend 1.0.0-beta.1.740",
    );
    const stabil = bericht.kanaele.find((k) => k.kanal === "stabil");
    expect(stabil?.auseinandergelaufen).toBe(true);
    expect(stabil?.laufendeFassungen).toEqual(["1.0.0-beta.1.740", "1.0.0-beta.1.760"]);
    expect(stabil?.nichtAufStand).toEqual(["b"]);
  });

  it("A3 · gleiche Version, anderer Commit als im Kanal: abweichend", async () => {
    const a = await instanz("1.0.0-beta.1.760", { commit: ANDERER_COMMIT });
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0-beta.1.760", commit: COMMIT } },
      instanzen: [eintrag("a", "cloud", a, "stabil")],
    });
    expect(code).toBe(1);
    expect(anlage(bericht, "a").abweichungen.join(" ")).toContain(`commit: erwartet ${COMMIT}`);
  });

  it("A4 · unter der Adresse meldet sich eine andere Anlage: abweichend", async () => {
    const a = await instanz("1.0.0-beta.1.760", { instanz: "https://wissen.andere.example" });
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0-beta.1.760" } },
      instanzen: [eintrag("a", "kundeninstanz", a, "stabil")],
    });
    expect(code).toBe(1);
    expect(anlage(bericht, "a").identitaet).toBe("abweichend");
    expect(anlage(bericht, "a").ergebnis).toBe("abweichend");
  });

  it("A5 · Fassung ohne Identitätsfeld: gleich, Identität nicht gemeldet", async () => {
    const a = await instanz("1.0.0-beta.1.760", { instanz: undefined });
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0-beta.1.760" } },
      instanzen: [eintrag("a", "cloud", a, "stabil")],
    });
    expect(code).toBe(0);
    expect(anlage(bericht, "a").identitaet).toBe("nicht_gemeldet");
  });

  it("A6 · nicht erreichbar zählt nicht als gleich", async () => {
    const tot = await freieAdresse();
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0-beta.1.760" } },
      instanzen: [eintrag("a", "insel", tot, "stabil")],
    });
    expect(code).toBe(1);
    expect(anlage(bericht, "a").ergebnis).toBe("nicht_erreichbar");
    expect(anlage(bericht, "a").laufend).toBeNull();
  });

  it("A7 · ungültiges Inventar: Exit 2, jeder Fehler benannt", async () => {
    const { code, bericht } = await abgleich({
      kanaele: { stabil: { version: "1.0.0" } },
      instanzen: [
        eintrag("a", "kundeninstanz", "https://x.example", "stabil"),
        eintrag("a", "rechenzentrum", "https://x.example/", "beta"),
      ],
    });
    expect(code).toBe(2);
    expect(bericht.gueltig).toBe(false);
    const fehler = (bericht.fehler ?? []).join("\n");
    expect(fehler).toContain("Kennung doppelt");
    expect(fehler).toContain("Adresse doppelt");
    expect(fehler).toContain('Modell „rechenzentrum" unbekannt');
    expect(fehler).toContain('Kanal „beta" steht nicht unter `kanaele`');
  });

  it("A8 · das mitgelieferte Musterinventar ist gültig", async () => {
    const modul = JSON.stringify(pathToFileURL(WERKZEUG).href);
    const skript = [
      `import { pruefeInventar } from ${modul};`,
      'import { readFileSync } from "node:fs";',
      `const inventar = JSON.parse(readFileSync(${JSON.stringify(MUSTER)}, "utf8"));`,
      "process.stdout.write(JSON.stringify(pruefeInventar(inventar)));",
    ].join("\n");
    const lauf = await fahreNode(["--input-type=module", "-e", skript]);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(JSON.parse(lauf.stdout)).toEqual([]);
  });
});
