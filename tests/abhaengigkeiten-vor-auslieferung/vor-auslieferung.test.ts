// ================================================================================================
// R-1398 — VOR DER AUSLIEFERUNG WIRD GEPRÜFT, OB EINGEBUNDENE FREMDBIBLIOTHEKEN BEKANNTE
// SCHWACHSTELLEN HABEN.
// ================================================================================================
//
// Die Prüfung selbst steht in `tools/abhaengigkeiten-audit.ts`. Aufrufer sind der Image-Bau
// (`Dockerfile`, Stufe `abhaengigkeiten`; belegt in `dockerfile-sperre.test.ts` daneben) und
// `scripts/deploy/klarwerk-ship.command` (Schritt 0b; der Abbruch dort ist in
// `tests/deploy-liefernachweis/live-update-liefernachweis.test.ts` AUSGEFÜHRT belegt). Die echte
// Registry-Messung beider Bestände steht in `echter-audit.integration.test.ts`.
//
// KEIN NETZ IN DIESEM TEST. Die Auditberichte unten sind SYNTHETISCH — gebaut in der Form, die
// `npm audit --json` liefert (`auditReportVersion: 2`), mit den fünf Advisories, die nach JOB 4272
// und der Fastify-Hebung (17.09./06.10.2026) noch gemeldet waren. Sie sind keine neue Messung.
// Register und Lockdateien sind die ECHTEN des Repositorys.
//
// WAS DAMIT BELEGT IST: dass die Prüfung unbewertete, veraltete und nicht geprüfte Fälle sperrt,
// bewertete durchlässt und exponierte laut nennt. WAS NICHT: was die Registry heute meldet — das
// zeigt erst der echte Lauf im Ship-Weg.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  type Bewertung,
  type Lockdatei,
  REGISTER_DATEI,
  liesAuditBericht,
  pruefe,
  registerFehler,
} from "../../tools/abhaengigkeiten-audit";
import { berichtstabelle } from "../produktionsabhaengigkeiten/waechter";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "..", "..");
const EXPOSITIONSBERICHT = join(WURZEL, "tests/produktionsabhaengigkeiten/README.md");

const arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-abhaengigkeiten-audit-"));
afterAll(() => {
  rmSync(arbeitsordner, { recursive: true, force: true });
});

function liesJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(WURZEL, rel), "utf8")) as T;
}

const register = (): Bewertung[] => liesJson<Bewertung[]>(REGISTER_DATEI);
const locks = (): { wurzel: Lockdatei; web: Lockdatei } => ({
  wurzel: liesJson<Lockdatei>("package-lock.json"),
  web: liesJson<Lockdatei>("apps/web/package-lock.json"),
});

interface Advisory {
  readonly ghsa: string;
  readonly schwere: string;
  readonly bereich: string;
}

/** Ein Eintrag in der Form von `npm audit --json` (v2): Advisories als Objekte in `via`. */
function eintrag(paket: string, ort: string, advisories: readonly Advisory[]) {
  return {
    name: paket,
    severity: advisories[0]?.schwere ?? "high",
    isDirect: true,
    via: advisories.map((a, i) => ({
      source: 1000 + i,
      name: paket,
      dependency: paket,
      title: `synthetisch ${a.ghsa}`,
      url: `https://github.com/advisories/${a.ghsa}`,
      severity: a.schwere,
      range: a.bereich,
    })),
    effects: [],
    range: advisories[0]?.bereich ?? "*",
    nodes: [ort],
    fixAvailable: false,
  };
}

/** Der nach JOB 4272 und der Fastify-Hebung verbleibende Stand — synthetisch, s. Kopf. */
function verbleibenderStand(): Record<string, unknown> {
  return {
    "@fastify/static": eintrag("@fastify/static", "node_modules/@fastify/static", [
      { ghsa: "GHSA-83w8-p2f5-377r", schwere: "high", bereich: "<=10.1.0" },
      { ghsa: "GHSA-8pvw-jcv7-9cmj", schwere: "moderate", bereich: "<=10.1.1" },
    ]),
    "find-my-way": eintrag("find-my-way", "node_modules/find-my-way", [
      { ghsa: "GHSA-c96f-x56v-gq3h", schwere: "high", bereich: "<=9.6.0" },
    ]),
    // Mitgemeldet ÜBER find-my-way: ein Zeichenketten-Eintrag in `via`, keine eigene Advisory.
    fastify: {
      name: "fastify",
      severity: "high",
      isDirect: true,
      via: ["find-my-way"],
      effects: [],
      range: "*",
      nodes: ["node_modules/fastify"],
      fixAvailable: true,
    },
    nodemailer: eintrag("nodemailer", "node_modules/nodemailer", [
      { ghsa: "GHSA-2x7j-588g-ccc2", schwere: "high", bereich: "<9.1.0" },
      { ghsa: "GHSA-cc9r-2j5m-2m83", schwere: "moderate", bereich: ">=6.9.16 <9.1.0" },
    ]),
  };
}

function bericht(vulnerabilities: Record<string, unknown>): string {
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: {} });
}

const LEER = bericht({});

/** Eine Prüfung mit echtem Register und echten Lockdateien, sofern nichts anderes übergeben ist. */
function pruefeStand(
  wurzel: string,
  web = LEER,
  anders: { register?: Bewertung[]; wurzelLock?: Lockdatei } = {},
) {
  const l = locks();
  const e = pruefe(
    { wurzel: liesAuditBericht(wurzel), web: liesAuditBericht(web) },
    anders.register ?? register(),
    { wurzel: anders.wurzelLock ?? l.wurzel, web: l.web },
  );
  return { code: e.code, text: e.zeilen.join("\n") };
}

describe("R-1398 · das Register der bewerteten Meldungen", () => {
  it("R1 · ist formal gültig — jede Bewertung mit Urteil, Begründung, Beleg und Datum", () => {
    expect(registerFehler(register())).toEqual([]);
    expect(register().length).toBeGreaterThan(0);
  });

  it("R2 · jede Bewertung hängt an der HEUTE gebundenen Version", () => {
    // Ändert sich eine Version, ist die Bewertung veraltet und der Ship-Weg sperrt. Dieser Fall
    // macht dieselbe Drift schon im Testlauf sichtbar, nicht erst beim Ausliefern.
    const l = locks();
    const abweichend: string[] = [];
    for (const b of register()) {
      const gebunden = l[b.bestand].packages?.[b.ort]?.version;
      if (gebunden !== b.version) {
        abweichend.push(`${b.kennung} ${b.ort}: bewertet ${b.version}, gebunden ${gebunden}`);
      }
    }
    expect(abweichend).toEqual([]);
  });

  it("R3 · die Bewertungen vom 17.09. stimmen mit dem Expositionsbericht (README) überein", () => {
    // Die Tabelle in README.md Abschnitt 1 urteilt JE PAKET über die Meldungen vom 17.09.2026.
    // Die Messung vom 08.10.2026 ist je ADVISORY bewertet (README Abschnitt 6) und hat für
    // dieselben Pakete weitere Meldungen gebracht — sie gehört deshalb nicht in diesen Abgleich.
    const tabelle = berichtstabelle(readFileSync(EXPOSITIONSBERICHT, "utf8"));
    const alt = register().filter((e) => e.bestand === "wurzel" && e.bewertet_am === "2026-09-17");
    expect(alt).toHaveLength(5);
    for (const b of alt) {
      const zeile = tabelle.find((z) => z.ort === b.ort);
      expect(zeile, `${b.ort} fehlt in der Expositionstabelle`).toBeDefined();
      expect(zeile?.urteil, `${b.kennung} ${b.ort}`).toBe(b.urteil);
    }
  });

  it("R4 · ein in der Tabelle exponiertes Paket hat auch im Register eine exponierte Meldung", () => {
    const tabelle = berichtstabelle(readFileSync(EXPOSITIONSBERICHT, "utf8"));
    for (const zeile of tabelle.filter((z) => z.urteil === "exponiert")) {
      const eintraege = register().filter((e) => e.bestand === "wurzel" && e.ort === zeile.ort);
      if (eintraege.length > 0) {
        expect(
          eintraege.map((e) => e.urteil),
          zeile.ort,
        ).toContain("exponiert");
      }
    }
  });
});

describe("R-1398 · die Prüfung vor der Auslieferung", () => {
  it("P1 · der verbleibende Stand ist vollständig bewertet → grün, exponierte laut genannt", () => {
    const { code, text } = pruefeStand(bericht(verbleibenderStand()));
    expect(code, text).toBe(0);
    expect(text).toContain("5 Meldungen · 5 bewertet · 0 unbewertet · 0 veraltet");
    expect(text).toContain("⚠ exponiert, bewusst offen: GHSA-2x7j-588g-ccc2 nodemailer@6.10.1");
    expect(text).toContain("⚠ exponiert, bewusst offen: GHSA-cc9r-2j5m-2m83 nodemailer@6.10.1");
    expect(text).toContain("· nicht exponiert: GHSA-c96f-x56v-gq3h find-my-way@9.6.0");
  });

  it("P2 · Zeichenketten in `via` sind keine Advisory — fastify wird nicht doppelt gezählt", () => {
    const b = liesAuditBericht(bericht(verbleibenderStand()));
    expect(b.art).toBe("gelesen");
    const meldungen = b.art === "gelesen" ? b.meldungen : [];
    expect(meldungen.map((m) => m.paket)).not.toContain("fastify");
    expect(meldungen).toHaveLength(5);
  });

  it("P3 · eine NEU veröffentlichte Advisory gegen ein unverändertes Paket sperrt", () => {
    const stand = {
      ...verbleibenderStand(),
      jose: eintrag("jose", "node_modules/jose", [
        { ghsa: "GHSA-aaaa-bbbb-cccc", schwere: "moderate", bereich: "<99.0.0" },
      ]),
    };
    const { code, text } = pruefeStand(bericht(stand));
    expect(code).toBe(1);
    expect(text).toMatch(/✖ unbewertet: GHSA-aaaa-bbbb-cccc jose@\S+ \(node_modules\/jose/);
    expect(text).toContain("Abhängigkeitsprüfung ROT");
  });

  it("P4 · eine NEUE Advisory gegen ein schon bewertetes Paket sperrt ebenfalls", () => {
    // Die Bewertung gilt der Advisory, nicht dem Paket: eine weitere Meldung zu nodemailer ist neu.
    const stand = verbleibenderStand();
    stand.nodemailer = eintrag("nodemailer", "node_modules/nodemailer", [
      { ghsa: "GHSA-2x7j-588g-ccc2", schwere: "high", bereich: "<9.1.0" },
      { ghsa: "GHSA-cc9r-2j5m-2m83", schwere: "moderate", bereich: ">=6.9.16 <9.1.0" },
      { ghsa: "GHSA-dddd-eeee-ffff", schwere: "critical", bereich: "<10.0.0" },
    ]);
    const { code, text } = pruefeStand(bericht(stand));
    expect(code).toBe(1);
    expect(text).toContain("✖ unbewertet: GHSA-dddd-eeee-ffff nodemailer@6.10.1");
  });

  it("P5 · eine geänderte gebundene Version macht die Bewertung veraltet → Sperre", () => {
    const wurzelLock: Lockdatei = {
      packages: {
        ...locks().wurzel.packages,
        "node_modules/nodemailer": { version: "6.10.2" },
      },
    };
    const { code, text } = pruefeStand(bericht(verbleibenderStand()), LEER, { wurzelLock });
    expect(code).toBe(1);
    expect(text).toContain("✖ Bewertung veraltet: GHSA-2x7j-588g-ccc2 nodemailer@6.10.2");
    expect(text).toContain("bewertet war 6.10.1 am 2026-09-17");
  });

  it("P6 · die gebündelte SPA ist ein eigener Bestand — ihre Meldungen werden geprüft", () => {
    const orte = Object.keys(locks().web.packages ?? {});
    const ort = orte.find((o) => o.startsWith("node_modules/"));
    expect(ort, "apps/web/package-lock.json ohne Pakete — P6 prüfte nichts").toBeDefined();
    const paket = String(ort).replace(/^.*node_modules\//, "");
    const web = bericht({
      [paket]: eintrag(paket, String(ort), [
        { ghsa: "GHSA-gggg-hhhh-jjjj", schwere: "high", bereich: "*" },
      ]),
    });
    const { code, text } = pruefeStand(bericht(verbleibenderStand()), web);
    expect(code).toBe(1);
    expect(text).toContain("Bestand web (apps/web/package-lock.json): 1 Meldungen");
    expect(text).toContain("✖ unbewertet: GHSA-gggg-hhhh-jjjj");
  });

  it.each([
    ['{"error":{"code":"ENOTFOUND","summary":"request to registry failed"}}', "ENOTFOUND"],
    ["npm ERR! network", "keine JSON-Ausgabe"],
    ["", "(leer)"],
    ['{"auditReportVersion":1,"advisories":{}}', "auditReportVersion 1"],
  ])("P7 · nicht prüfbar ist nicht lieferbar: %s → Exit 2", (roh, grund) => {
    const { code, text } = pruefeStand(roh);
    expect(code).toBe(2);
    expect(text).toContain("NICHT GEPRÜFT");
    expect(text).toContain(grund);
    expect(text).not.toContain("✓");
  });

  it("P8 · eine Bewertung ohne Begründung ist ein Freibrief → Register ungültig, Exit 1", () => {
    const kaputt = register().map((b, i) => (i === 0 ? { ...b, begruendung: " " } : b));
    const { code, text } = pruefeStand(bericht(verbleibenderStand()), LEER, { register: kaputt });
    expect(code).toBe(1);
    expect(text).toContain("ohne Begründung");
  });

  it("P9 · nicht mehr gemeldete Bewertungen werden genannt, sperren aber nicht", () => {
    const stand = verbleibenderStand();
    delete stand["find-my-way"];
    const { code, text } = pruefeStand(bericht(stand));
    expect(code).toBe(0);
    expect(text).toContain("ⓘ nicht mehr gemeldet: GHSA-c96f-x56v-gq3h find-my-way");
  });

  it("P10 · exponiert mit ausstehender kompatibler Behebung sperrt (sharp, GHSA-wq5f)", () => {
    const stand = {
      ...verbleibenderStand(),
      sharp: eintrag("sharp", "node_modules/sharp", [
        { ghsa: "GHSA-wq5f-xc86-pv6w", schwere: "high", bereich: "<0.35.5" },
      ]),
    };
    const { code, text } = pruefeStand(bericht(stand));
    expect(code).toBe(1);
    const zeile = "✖ exponiert, kompatible Behebung ausstehend: GHSA-wq5f-xc86-pv6w sharp@";
    expect(text).toContain(zeile);
    expect(text).toContain("sharp >= 0.35.5");
  });

  it("P11 · behebung_ausstehend ist nur bei „exponiert“ erlaubt", () => {
    const kaputt = register().map((b, i) =>
      i === 0 ? { ...b, urteil: "nicht exponiert", behebung_ausstehend: "x" } : b,
    );
    const { code, text } = pruefeStand(bericht(verbleibenderStand()), LEER, { register: kaputt });
    expect(code).toBe(1);
    expect(text).toContain("behebung_ausstehend nur mit Inhalt");
  });

  it("P12 · npms Auskunft zur Behebbarkeit (fixAvailable) steht an jeder Meldung", () => {
    const mitFix = (fixAvailable: unknown) =>
      liesAuditBericht(
        bericht({
          jose: {
            ...eintrag("jose", "node_modules/jose", [
              { ghsa: "GHSA-aaaa-bbbb-cccc", schwere: "low", bereich: "*" },
            ]),
            fixAvailable,
          },
        }),
      );
    const varianten = [true, false, { name: "jose", version: "6.0.0", isSemVerMajor: true }];
    const fixe = varianten.map((f) => {
      const b = mitFix(f);
      return b.art === "gelesen" ? b.meldungen[0]?.fix : b.grund;
    });
    expect(fixe).toEqual(["kompatibel", "keine", "jose@6.0.0 (Hauptwechsel)"]);
    const { text } = pruefeStand(bericht(verbleibenderStand()));
    expect(text).toContain("npm-Behebung: keine");
  });
});

describe("R-1398 · der Starter, wie der Ship-Weg ihn ruft", () => {
  let lauf = 0;

  function starter(wurzelBericht: string): { code: number | null; aus: string } {
    lauf += 1;
    const wurzelDatei = join(arbeitsordner, `wurzel-${lauf}.json`);
    const webDatei = join(arbeitsordner, `web-${lauf}.json`);
    writeFileSync(wurzelDatei, wurzelBericht);
    writeFileSync(webDatei, LEER);
    const r = spawnSync(
      "bash",
      [
        join(WURZEL, "tools/abhaengigkeiten-audit.sh"),
        "--bericht-wurzel",
        wurzelDatei,
        "--bericht-web",
        webDatei,
      ],
      { cwd: WURZEL, encoding: "utf8" },
    );
    return { code: r.status, aus: `${r.stdout}${r.stderr}` };
  }

  it("S1 · bewerteter Stand → Exit 0, die Quelle steht in der Ausgabe", () => {
    const r = starter(bericht(verbleibenderStand()));
    expect(r.aus).toContain("Quelle wurzel: gespeicherter Bericht");
    expect(r.aus).toContain("✓ Abhängigkeitsprüfung");
    expect(r.code, r.aus).toBe(0);
  });

  it("S2 · unbewertete Meldung → Exit 1", () => {
    const stand = {
      ...verbleibenderStand(),
      pg: eintrag("pg", "node_modules/pg", [
        { ghsa: "GHSA-kkkk-mmmm-nnnn", schwere: "high", bereich: "*" },
      ]),
    };
    const r = starter(bericht(stand));
    expect(r.aus).toContain("✖ unbewertet: GHSA-kkkk-mmmm-nnnn pg@");
    expect(r.code, r.aus).toBe(1);
  });

  it("S3 · Registry nicht erreichbar → Exit 2", () => {
    const r = starter('{"error":{"code":"EAI_AGAIN","summary":"getaddrinfo EAI_AGAIN"}}');
    expect(r.aus).toContain("NICHT durchgeführt");
    expect(r.code, r.aus).toBe(2);
  });
});
