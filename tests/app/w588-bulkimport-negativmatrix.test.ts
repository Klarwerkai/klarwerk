// ================================================================================================
// JOB 588 · D5 — DIE NEGATIVMATRIX DES BULKIMPORTS, SOWEIT SIE OHNE NETZ UND OHNE HALT-MECHANIK
// AUSFÜHRBAR IST.
// ================================================================================================
//
// HERKUNFT. Das D4-Vollurteil (BEN, `_relay/kopf/outbox/BEN-PRUEFUNG-JOB-588-D4.md`) lässt als
// Mangel 1 stehen: „N3–N8, Wiederanlauf, laufübergreifende Idempotenz, Rechte- und
// Mandantengrenzen sowie ImportRun-/Teilfehlerwirkung sind weiterhin nicht ausgeführt."
// Die Matrix selbst ist in der D3-Rückgabe spezifiziert (Abschnitt „Negativmatrix", N1–N8).
//
// WAS HIER LÄUFT, und warum genau das:
//
//   N4  fehlerhafte Zeile        — samt der Disjunktheits-Zusicherung `items ∩ collectFailed = ∅`
//   N5  Dublette im selben Lauf  — die In-Run-Dedup über `queuedKeys` (confluence-import.ts:199-210)
//   N5b laufübergreifende        — der zweite Lauf sieht den offenen Kandidaten des ersten
//       Idempotenz                 (`pendingKeys`) und reiht ihn NICHT erneut ein
//   IRW ImportRun-/Teilfehler-   — `abschlussStatus` (confluence-import-routes.ts:118-120) und die
//       wirkung                    fünf Zähler am persistierten Lauf
//
// WAS HIER BEWUSST NICHT LÄUFT, mit Grund — keine grünen Zeilen für Ungemessenes:
//
//   N3/N6 Abbruch und Wiederanlauf. Es gibt im Bestand KEINEN Halt-/Resume-Mechanismus. Ein Fall
//         dazu wäre „rot durch Nichtexistenz", und ob daraus ein eigener Gegenstand wird oder ein
//         ausdrücklich nicht unterstützter Zustand, ist laut D4-Urteil Mangel 3 ausdrücklich
//         ownerseitig ungebunden. Diese Bahn entscheidet das nicht.
//   N7    Rechtefehler. VOLLSTÄNDIG ABGEDECKT im Bestand und deshalb hier NICHT wiederholt:
//         `tests/app/confluence-import-rechtetor.test.ts` (JOB 876 D2) prüft für alle sechs Routen
//         403-statt-401/404, den exakten Verweigerungskörper, die Leckfreiheit und ausdrücklich
//         „das Tor liegt VOR der Objektauflösung"; `tests/app/w2a-import-run-routes-148.test.ts`
//         (Abschnitt 3) prüft denselben Pfad an der Laufdomäne samt Seiteneffektfreiheit.
//         Eine zweite Fassung derselben Zusage wäre eine Doppelrunde, kein Beleg.
//   N8    Mandantenfremdzugriff. Das Repository führt KEIN Mandantenmodell — wörtlich in
//         `services/app/src/services/klara-session-service.ts:42` („Das Repository führt kein
//         Mandantenmodell") samt `KLARA_SINGLE_TENANT_ID`; im gesamten Import-/Library-Weg kommt
//         `tenant` nicht vor (gemessen). Ein Fall dazu hätte keine zweite Mandanteninstanz, gegen
//         die er prüfen könnte — er wäre ein Vakuumtest.
//
// RED-FIRST. Die geprüften Zusagen sind im Bestand bereits WAHR; ein Zieltest, der auf der
// unveränderten Base rot wäre, müsste etwas Falsches über den Bestand behaupten. Für genau diesen
// Fall ist nach Regelwerk (BEN 502/S9, Regel 2) allein die nach dem Einbau angewandte,
// byteidentisch zurückgenommene Gegenmutation der Red-first-Beleg. Drei sind gefahren, eine je
// fachlichem Kern; sie stehen in der Rückgabe.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";

// Das Import-Flag bleibt AUS, damit `buildApp` die Routen NICHT selbst mit dem env-basierten
// Adapter registriert; jeder Aufbau unten registriert sie mit seinem eigenen Fixture-Adapter.
// Dasselbe Muster wie `confluence-import-routes.test.ts:141-156` im Bestand.
const GESICHERT: Record<string, string | undefined> = {};
const SCHLUESSEL = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_CONFLUENCE_SPACE"];
beforeEach(() => {
  for (const k of SCHLUESSEL) {
    GESICHERT[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of SCHLUESSEL) {
    if (GESICHERT[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = GESICHERT[k];
    }
  }
});

const START = "/api/admin/import/confluence";

/** Ein Quell-Item mit Herkunftsanker — externalId und sourceVersion tragen die Idempotenz. */
function quellSeite(
  externalId: string,
  version: number,
  titel = `Seite ${externalId}`,
): ImportItem {
  return {
    title: titel,
    statement: `Inhalt von ${externalId}`,
    type: "best_practice",
    category: "Anlage 1",
    provider: "Confluence",
    externalId,
    sourceScope: "space:TEST",
    sourceVersion: version,
  } as ImportItem;
}

/**
 * Ein deterministischer Fixture-Adapter. Der Cast ist nötig, weil `ConfluenceSourceAdapter` eine
 * Klasse mit privaten Feldern ist — der Stub erfüllt den öffentlichen Vertrag, mehr sieht der
 * Importkern nicht (Muster: `confluence-import-routes.test.ts:123-134`).
 *
 * KEIN NETZ: Der Auftrag verbietet Netzaufrufe, und ein echter Confluence-Adapterlauf ist damit
 * hier nicht fahrbar. Genau das ist Mangel 2 des Urteils; er bleibt offen und wird in der Rückgabe
 * als solcher ausgewiesen, nicht durch diesen Stub geheilt.
 */
function fixtureAdapter(
  items: ImportItem[],
  failed: { ref: string; error: string; errorClass?: string }[] = [],
  truncated = false,
): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed, truncated }),
  } as unknown as ConfluenceSourceAdapter;
}

/** Aufbau A — ohne Laufdomäne: die Route antwortet mit der vollen `ImportRunSummary`. */
async function appMitSummary(adapter: ConfluenceSourceAdapter) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => adapter,
    }),
  );
  return { ...(await mitAdmin(app)), services };
}

/** Aufbau B — MIT Laufdomäne und Leseweg: der Lauf wird persistiert und ist lesbar. */
async function appMitLaufdomaene(adapter: ConfluenceSourceAdapter) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      guards: makeGuards(services.auth),
    }),
  );
  return { ...(await mitAdmin(app)), services };
}

async function mitAdmin(app: ReturnType<typeof buildApp>) {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@w588d5.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@w588d5.test", password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

type Seite = { ref: string; status: string; note?: string };
type Summary = {
  found: number;
  imported: number;
  skipped: number;
  failed: number;
  truncated: boolean;
  perPage: Seite[];
};

async function starteMitSummary(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
): Promise<Summary> {
  const res = await app.inject({ method: "POST", url: START, headers, payload: { dryRun: false } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Summary;
}

// ================================================================================================
// N4 — EINE FEHLERHAFTE ZEILE STOPPT DEN LAUF NICHT, UND SIE WIRD NICHT DOPPELT GEZÄHLT.
// ================================================================================================
describe("JOB 588 D5 · N4 — fehlerhafte Zeile, never-block und Disjunktheit", () => {
  it("N4-1: der Lauf läuft weiter — die lesbaren Seiten werden eingereiht, die fehlerhafte verbucht", async () => {
    const { app, headers, services } = await appMitSummary(
      fixtureAdapter(
        [quellSeite("A-1", 1), quellSeite("A-2", 1)],
        [{ ref: "A-KAPUTT", error: "Seite nicht lesbar", errorClass: "MappingError" }],
      ),
    );

    const s = await starteMitSummary(app, headers);
    expect(s.failed, "die fehlerhafte Seite ist verbucht").toBe(1);
    expect(s.imported, "die beiden lesbaren Seiten sind trotzdem eingereiht — never block").toBe(2);
    expect(
      (await services.library.listImportCandidates()).length,
      "und sie sind WIRKLICH im Bestand, nicht nur im Zähler",
    ).toBe(2);
  });

  it("N4-2: DISJUNKTHEIT — die fehlerhafte Seite erscheint NIE als importiert", async () => {
    const { app, headers } = await appMitSummary(
      fixtureAdapter(
        [quellSeite("B-1", 1)],
        [
          { ref: "B-KAPUTT", error: "Seite nicht lesbar", errorClass: "MappingError" },
          { ref: "B-KAPUTT-2", error: "Zeitüberschreitung", errorClass: "TimeoutError" },
        ],
      ),
    );

    const s = await starteMitSummary(app, headers);
    const importiert = s.perPage.filter((p) => p.status === "imported").map((p) => p.ref);
    const gescheitert = s.perPage.filter((p) => p.status === "failed").map((p) => p.ref);

    expect(gescheitert.sort(), "beide Fehlerzeilen stehen als failed").toEqual([
      "B-KAPUTT",
      "B-KAPUTT-2",
    ]);
    // Die Zusicherung aus der D3-Spezifikation, wörtlich: `items ∩ collectFailed = ∅`.
    expect(
      importiert.filter((ref) => gescheitert.includes(ref)),
      "eine Seite kann nicht zugleich eingereiht und gescheitert sein",
    ).toEqual([]);
    expect(s.found, "`found` zählt die GELESENEN Seiten, nicht die gescheiterten").toBe(1);
    expect(s.failed).toBe(2);
  });

  it("N4-3: KALIBRIERUNG — ohne Fehlerzeile ist `failed` null (der Zähler zählt wirklich)", async () => {
    const { app, headers } = await appMitSummary(fixtureAdapter([quellSeite("C-1", 1)]));

    const s = await starteMitSummary(app, headers);
    expect(
      s.failed,
      "ohne diesen Fall wäre `failed: 2` oben auch bei einem blinden Zähler grün",
    ).toBe(0);
    expect(s.imported).toBe(1);
  });
});

// ================================================================================================
// N5 — DIESELBE SEITE ZWEIMAL IN EINEM LAUF, UND DIESELBE SEITE IN ZWEI LÄUFEN.
// ================================================================================================
describe("JOB 588 D5 · N5 — Idempotenz innerhalb eines Laufs und über Läufe hinweg", () => {
  it("N5-1: Dublette im selben Lauf wird EINMAL eingereiht, mit der belegten Notiz", async () => {
    // Die Quelle liefert dieselbe Seite (gleiche externalId UND gleiche Version) doppelt.
    const doppelt = quellSeite("D-1", 1);
    const { app, headers, services } = await appMitSummary(
      fixtureAdapter([doppelt, { ...doppelt }]),
    );

    const s = await starteMitSummary(app, headers);
    expect(s.found, "die Quelle hat zwei Zeilen geliefert").toBe(2);
    expect(s.imported, "eingereiht wird sie genau einmal").toBe(1);
    expect(s.skipped, "die zweite Zeile ist ein Skip, kein Fehler").toBe(1);

    const uebersprungen = s.perPage.filter((p) => p.status === "skipped");
    expect(uebersprungen).toHaveLength(1);
    expect(
      uebersprungen[0]?.note,
      "die Notiz benennt den Grund — sonst ist ein Skip nicht von einem Idempotenz-Skip zu unterscheiden",
    ).toBe("Dublette im selben Lauf (idempotent)");

    expect(
      (await services.library.listImportCandidates()).length,
      "und der Bestand trägt sie genau einmal",
    ).toBe(1);
  });

  it("N5-2: SCHÄRFE — zwei VERSCHIEDENE Seiten sind keine Dublette", async () => {
    const { app, headers, services } = await appMitSummary(
      fixtureAdapter([quellSeite("E-1", 1), quellSeite("E-2", 1)]),
    );

    const s = await starteMitSummary(app, headers);
    expect(s.imported, "ohne diesen Fall könnte die Dedup einfach alles verschlucken").toBe(2);
    expect(s.skipped).toBe(0);
    expect((await services.library.listImportCandidates()).length).toBe(2);
  });

  it("N5-3: eine NEUERE Version derselben Seite wird erneut eingereiht — kein Idempotenz-Irrtum", async () => {
    const { app, headers } = await appMitSummary(
      fixtureAdapter([quellSeite("F-1", 1), quellSeite("F-1", 2)]),
    );

    const s = await starteMitSummary(app, headers);
    expect(
      s.imported,
      "die Idempotenz gilt je (Quelle, Kennung, VERSION) — eine neue Fassung ist neue Arbeit",
    ).toBe(2);
    expect(s.skipped).toBe(0);
  });

  it("N5b: LAUFÜBERGREIFEND — der zweite Lauf sieht den offenen Kandidaten des ersten", async () => {
    const { app, headers, services } = await appMitSummary(fixtureAdapter([quellSeite("G-1", 1)]));

    const erster = await starteMitSummary(app, headers);
    expect(erster.imported, "Vorbedingung: der erste Lauf reiht wirklich ein").toBe(1);
    const nachErstem = (await services.library.listImportCandidates()).length;
    expect(nachErstem).toBe(1);

    const zweiter = await starteMitSummary(app, headers);
    expect(zweiter.imported, "der zweite Lauf reiht NICHTS erneut ein").toBe(0);
    expect(zweiter.skipped).toBe(1);
    expect(
      zweiter.perPage[0]?.note,
      "und er sagt, warum — der Kandidat liegt bereits offen in der Queue",
    ).toBe("unverändert (idempotent)");

    expect(
      (await services.library.listImportCandidates()).length,
      "der Bestand ist NICHT gewachsen — das ist die eigentliche Zusage",
    ).toBe(nachErstem);
  });
});

// ================================================================================================
// IRW — DIE IMPORTRUN-WIRKUNG: WAS DER LAUF GETAN HAT, ÜBERLEBT IHN.
// ================================================================================================
describe("JOB 588 D5 · ImportRun- und Teilfehlerwirkung", () => {
  it("IRW-1: ein Lauf ohne Fehler und ohne Abschnitt endet COMPLETED", async () => {
    const { app, headers } = await appMitLaufdomaene(
      fixtureAdapter([quellSeite("H-1", 1), quellSeite("H-2", 1)]),
    );

    const res = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(res.statusCode, res.body).toBe(200);
    expect((res.json() as { status: string }).status).toBe("COMPLETED");
  });

  it("IRW-2: EINE fehlerhafte Seite macht den Lauf PARTIAL, nicht COMPLETED", async () => {
    const { app, headers } = await appMitLaufdomaene(
      fixtureAdapter(
        [quellSeite("I-1", 1)],
        [{ ref: "I-KAPUTT", error: "nicht lesbar", errorClass: "MappingError" }],
      ),
    );

    const res = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(res.statusCode, res.body).toBe(200);
    expect(
      (res.json() as { status: string }).status,
      "ein Lauf, der eine Seite verloren hat, hat seinen Auftrag nicht erfüllt",
    ).toBe("PARTIAL");
  });

  it("IRW-3: ein ABGESCHNITTENER Lauf ist PARTIAL — auch wenn keine einzige Seite scheiterte", async () => {
    const { app, headers } = await appMitLaufdomaene(
      fixtureAdapter([quellSeite("J-1", 1)], [], true),
    );

    const res = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(res.statusCode, res.body).toBe(200);
    expect(
      (res.json() as { status: string }).status,
      "truncated heisst: es gibt ungelesene Seiten. COMPLETED waere hier die teuerste Sorte Luege.",
    ).toBe("PARTIAL");
  });

  it("IRW-4: die fünf Zähler stehen AM LAUF und sind über seine Kennung lesbar", async () => {
    // Zwei lesbare Seiten, davon eine Dublette (→ ein Skip), plus eine Fehlerzeile.
    const doppelt = quellSeite("K-1", 1);
    const { app, headers } = await appMitLaufdomaene(
      fixtureAdapter(
        [doppelt, { ...doppelt }, quellSeite("K-2", 1)],
        [{ ref: "K-KAPUTT", error: "nicht lesbar", errorClass: "MappingError" }],
      ),
    );

    const start = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(start.statusCode, start.body).toBe(200);
    const { importId, status } = start.json() as { importId: string; status: string };
    expect(status).toBe("PARTIAL");
    expect(importId, "der Lauf braucht eine Kennung, unter der er nachlesbar ist").toBeTruthy();

    const gelesen = await app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${importId}`,
      headers,
    });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const lauf = gelesen.json() as {
      status: string;
      counters: {
        itemsTotal: number;
        itemsCreated: number;
        itemsBound: number;
        itemsSkipped: number;
        itemsFailed: number;
      };
    };

    expect(lauf.status, "der persistierte Status ist derselbe wie der gemeldete").toBe("PARTIAL");
    expect(lauf.counters.itemsTotal, "drei gelesene Quellzeilen").toBe(3);
    expect(lauf.counters.itemsCreated, "zwei davon wurden wirklich eingereiht").toBe(2);
    expect(lauf.counters.itemsSkipped, "die Dublette").toBe(1);
    expect(lauf.counters.itemsFailed, "die nicht lesbare Seite").toBe(1);
    // REVIEW-INVARIANTE: der Import legt ausschliesslich Kandidaten an, nie ein Wissensobjekt.
    expect(
      lauf.counters.itemsBound,
      "der Import bindet KEIN Wissensobjekt — das entsteht erst beim Annehmen im Review",
    ).toBe(0);
  });

  it("IRW-5: ohne erreichbare Quelle scheitert der Lauf SICHTBAR statt spurlos", async () => {
    const services = buildServices();
    const app = buildApp(services);
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards: makeGuards(services.auth),
        // Kein Adapter konfiguriert — der Fall, der frueher mit 503 und ohne jede Spur endete.
        makeAdapter: () => undefined,
        importRuns: services.importRuns,
      }),
    );
    app.register(
      importRunRoutes({
        importRuns: services.importRuns,
        externalSources: services.externalSources,
        guards: makeGuards(services.auth),
      }),
    );
    const { headers } = await mitAdmin(app);

    const start = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(start.statusCode, "der START ist gelungen — gescheitert ist der LAUF").toBe(200);
    const { importId, status } = start.json() as { importId: string; status: string };
    expect(status).toBe("FAILED");

    const gelesen = await app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${importId}`,
      headers,
    });
    expect(gelesen.statusCode, "und er ist unter seiner Kennung nachlesbar").toBe(200);
    expect((gelesen.json() as { failureCode: string }).failureCode).toBe("IMPORT_UNAVAILABLE");
  });
});

// ================================================================================================
// JOB 588 D6 · MODELLFREIHEIT — DIE VIER FAELLE AUS D4, WIEDERAUFGENOMMEN
// ================================================================================================
//
// WARUM SIE HIER STEHEN UND NICHT IN EINER EIGENEN DATEI: Das rote D5-Urteil sagt es woertlich
// (`BEN-PRUEFUNG-JOB-588-D5.md:15`): „Der alte D4-Waechter ist nicht parallel vorhanden, sondern
// verloren. Gerade deshalb ist seine Wiederaufnahme keine DOPPELRUNDE; der neu angelegte
// D5-Zielpfad muss den belegten Schutz des Vorlaufs zusammen mit den zwoelf neuen Faellen tragen."
//
// WAS GENAU ZUGESAGT IST — und was nicht. Die Ownerentscheidung
// `00_CONTROL/ENTSCHEIDUNGEN/JOB-588.md` beantwortet die Reichweite abschliessend:
//
//     „Nur Import und Speichern — das ist heute schon wahr"
//
// Ausdruecklich VERWORFEN wurden „Ganze Kette inkl. Auswahl und Annahme" und „Modell darf laufen,
// aber nicht blockieren". Die Faelle unten pruefen deshalb GENAU den zugesagten Abschnitt:
// Importstart, Erkundung, Kandidatenpersistenz. Sie behaupten NICHTS ueber `/select`, `/group`
// oder `/apply` — dort ist ein Modellaufruf erlaubt, und MF-5 belegt, dass er dort auch wirklich
// stattfindet.
//
// WARUM EIN SPION UND NICHT „kein Reasoner uebergeben": Die zwoelf D5-Faelle registrieren die
// Routen OHNE `reasoner`. Eine Zusicherung „null Modellaufrufe" waere dort gegenstandslos — es
// gaebe nichts, was rufen koennte. Der Spion unten wird VERDRAHTET; erst dadurch ist die Null
// eine Messung statt einer Abwesenheit. MF-5 ist die Gegenprobe, die das belegt.
//
// DIE BEIDEN MODELLKANTEN, gemessen im Bestand (nicht angenommen):
//   · `confluence-import-routes.ts:524`  reasoner.deriveImportCriteria(...)   — in `/select`
//   · `confluence-import-routes.ts:684`  reasoner.groupCandidates(...)        — in `/group`
// Der Importkern `services/app/src/confluence-import.ts` (289 Z.) enthaelt keine davon.

/** Ein Reasoner-Spion: er kann alles, was die Importrouten von ihm verlangen, und zaehlt mit. */
function spionReasoner() {
  const rufe: string[] = [];
  const reasoner = {
    deriveImportCriteria: async () => {
      rufe.push("deriveImportCriteria");
      return { criteria: {}, fallbackReason: null };
    },
    groupCandidates: async () => {
      rufe.push("groupCandidates");
      return { groups: [], demo: false, fallbackReason: null };
    },
    // `exactOptionalPropertyTypes` ist an: `reasoner?: Reasoner` nimmt KEIN `undefined` entgegen.
    // Deshalb `NonNullable` — der Spion ist immer da, nur eben ein Stub.
  } as unknown as NonNullable<Parameters<typeof confluenceImportRoutes>[0]["reasoner"]>;
  return { reasoner, rufe };
}

/** Aufbau C — wie Aufbau B, aber MIT verdrahtetem Reasoner-Spion. */
async function appMitSpion(adapter: ConfluenceSourceAdapter) {
  const services = buildServices();
  const app = buildApp(services);
  const { reasoner, rufe } = spionReasoner();
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
      reasoner,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      guards: makeGuards(services.auth),
    }),
  );
  return { ...(await mitAdmin(app)), services, rufe };
}

describe("JOB 588 D6 · MF — Modellfreiheit im zugesagten Abschnitt", () => {
  it("MF-1: der IMPORTSTART laeuft ohne einen einzigen Modellaufruf", async () => {
    const { app, headers, rufe } = await appMitSpion(
      fixtureAdapter([quellSeite("mf-1-a", 1), quellSeite("mf-1-b", 1)]),
    );

    const start = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(start.statusCode, start.body).toBe(200);

    expect(rufe, "der Importstart hat das Modell gerufen").toEqual([]);
  });

  it("MF-2: die ERKUNDUNG laeuft ohne einen einzigen Modellaufruf", async () => {
    const { app, headers, rufe } = await appMitSpion(
      fixtureAdapter([quellSeite("mf-2-a", 1), quellSeite("mf-2-b", 2)]),
    );

    const erkundung = await app.inject({
      method: "POST",
      url: `${START}/explore`,
      headers,
      payload: {},
    });
    expect(erkundung.statusCode, erkundung.body).toBe(200);

    expect(rufe, "die Erkundung hat das Modell gerufen").toEqual([]);
  });

  it("MF-3: die KANDIDATENPERSISTENZ entsteht ohne einen einzigen Modellaufruf", async () => {
    const { app, headers, rufe, services } = await appMitSpion(
      fixtureAdapter([quellSeite("mf-3-a", 1), quellSeite("mf-3-b", 1)]),
    );

    const start = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(start.statusCode, start.body).toBe(200);

    // Erst LESEN, dann urteilen: ohne diesen Abruf pruefte der Fall nur den Start, nicht die
    // Persistenz. Gelesen wird ueber DENSELBEN Weg wie die zwoelf D5-Faelle
    // (`services.library.listImportCandidates()`, s. N5b `:304`) — nicht ueber die Lauf-Itemrefs,
    // die eine andere Ablage sind.
    expect(
      (await services.library.listImportCandidates()).length,
      "ohne persistierte Kandidaten prueft dieser Fall nichts",
    ).toBeGreaterThan(0);

    expect(rufe, "die Kandidatenpersistenz hat das Modell gerufen").toEqual([]);
  });

  it("MF-4: der kalibrierte FREITEXT-GRENZFALL laeuft ebenfalls modellfrei", async () => {
    // Der Grenzfall aus D4: eine Seite, deren Inhalt genau die Sorte Freitext ist, die ein Modell
    // reizen wuerde — lang, unstrukturiert, ohne Kategoriehinweis. Sie darf den Import trotzdem
    // nicht an ein Modell geben; die Zusage haengt nicht am Inhalt.
    const roman = "Ein langer, unstrukturierter Fliesstext ohne jede Gliederung. ".repeat(40);
    const seite = { ...quellSeite("mf-4-roman", 1), statement: roman } as ImportItem;
    const { app, headers, rufe, services } = await appMitSpion(fixtureAdapter([seite]));

    const start = await app.inject({ method: "POST", url: START, headers, payload: {} });
    expect(start.statusCode, start.body).toBe(200);

    // Zwei Vorbedingungen, sonst prueft der Fall nichts: der Text ist wirklich lang, UND der
    // Import hat ihn wirklich verarbeitet.
    expect(roman.length, "der Grenzfall ist nicht lang genug, um einer zu sein").toBeGreaterThan(
      1000,
    );
    expect(
      (await services.library.listImportCandidates()).length,
      "der lange Text ist gar nicht erst eingereiht worden",
    ).toBeGreaterThan(0);

    expect(rufe, "der Freitext-Grenzfall hat das Modell gerufen").toEqual([]);
  });

  it("MF-5: KALIBRIERUNG — derselbe Spion registriert sehr wohl, wenn das Modell laeuft", async () => {
    // OHNE DIESEN FALL BEWEISEN MF-1 BIS MF-4 NICHTS. Eine leere Rufliste kann zwei Ursachen
    // haben: es wurde nicht gerufen — oder der Spion ist gar nicht verdrahtet. Hier wird die
    // zweite Ursache ausgeschlossen, und zwar an einer Route, an der ein Modellaufruf laut
    // Ownerentscheidung ausdruecklich ERLAUBT ist (`/select` gehoert zur Auswahl, nicht zum
    // Import).
    const { app, headers, rufe } = await appMitSpion(fixtureAdapter([quellSeite("mf-5-a", 1)]));

    const auswahl = await app.inject({
      method: "POST",
      url: `${START}/select`,
      headers,
      payload: { prompt: "nur die Seiten zu Anlage 1", promptConfidential: false },
    });
    expect(auswahl.statusCode, auswahl.body).toBe(200);

    expect(rufe, "der Spion ist nicht verdrahtet — dann sagen MF-1 bis MF-4 nichts aus").toContain(
      "deriveImportCriteria",
    );
  });
});
