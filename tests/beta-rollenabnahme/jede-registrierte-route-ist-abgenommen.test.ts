// ================================================================================================
// JOB 4061 · LIEFERUNG 2 + 3 — JEDE REGISTRIERTE TÜR HAT EINEN PLATZ, UND BEIDE ZAHLEN STEHEN DA.
// ================================================================================================
//
// `jede-gruppe-steht-in-der-tabelle.test.ts` hält die GRUPPEN gegen die Tabelle. Dieser Wächter hält
// die ROUTEN dagegen — die Einheit, in der ein Mensch eine Tür öffnet. Nach ihm gibt es keine
// registrierte Route mehr, über die die Abnahme schweigt: sie ist entweder mit fünf Akteuren
// gemessen (`TABELLE`) oder steht mit eigenem Grund in `NICHT_ABGENOMMEN`.
//
// UND ER GIBT BEIDE ABDECKUNGSUMFÄNGE GETRENNT AUS. Das ist die Promptverbesserung des Prüfers zu
// JOB 4015 R2 wörtlich: „Eine vollständige Routengruppenabnahme ist keine vollständige
// Endpunktabnahme. Weise beide Abdeckungsumfänge getrennt aus."
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Buehne, baueBuehne, schliesseBuehnen } from "./buehne";
import {
  AUTOMATISCHE_METHODEN,
  type Aufzaehlung,
  schluessel,
  zaehleRegistrierteRouten,
} from "./registrierte-routen";
import { erhebeRoutengruppen } from "./routengruppen";
import { DIREKT, NICHT_ABGENOMMEN, TABELLE, registrierteRoute } from "./tabelle";

let buehne: Buehne;
let aufzaehlung: Aufzaehlung;

beforeAll(async () => {
  buehne = await baueBuehne();
  aufzaehlung = zaehleRegistrierteRouten(buehne.app);
});

afterAll(schliesseBuehnen);

/** Die sieben Türen, die JOB 4015 als bewusst offen gemessen hat (`archiv/4015/runde-2/RUECKGABE.md:56`). */
const OEFFENTLICHE_TUEREN = [
  "GET /health",
  "GET /api/reasoner/status",
  "GET /api/ai-status",
  "GET /api/i18n/locales",
  "GET /api/branding",
  "GET /addin",
  "GET /api/features",
];

const eigenstaendig = (): { methode: string; pfad: string }[] =>
  aufzaehlung.routen.filter(
    (r) => !(AUTOMATISCHE_METHODEN as readonly string[]).includes(r.methode),
  );

describe("JOB 4061 · jede registrierte Route ist abgenommen", () => {
  it("E1: die Aufzählung findet die Türen der laufenden App — und keine Zeile bleibt unklar", () => {
    // Die stille Null ist der eine Fehler, der ALLE übrigen Fälle dieser Datei grün machte: eine
    // leere Aufzählung hat trivial keine ungedeckte Route.
    expect(aufzaehlung.unklar, "Gedruckte Zeilen ohne bestätigte Route").toEqual([]);
    expect(aufzaehlung.routen.length).toBeGreaterThan(100);

    const alle = new Set(aufzaehlung.routen.map((r) => schluessel(r.methode, r.pfad)));
    // Die vier Routen, die `buildApp` unmittelbar selbst anlegt — genau die, die ein `onRoute`-Hook
    // nicht sehen könnte (siehe Kopf von `registrierte-routen.ts`).
    const direkt = erhebeRoutengruppen().direkt.map((r) => schluessel(r.methode, r.pfad));
    expect(direkt.length).toBeGreaterThan(0);
    expect(
      direkt.filter((k) => !alle.has(k)),
      "direkte Routen aus build-app.ts",
    ).toEqual([]);
    expect(
      OEFFENTLICHE_TUEREN.filter((k) => !alle.has(k)),
      "die sieben bewusst offenen Türen aus JOB 4015",
    ).toEqual([]);
  });

  it("E2: jede registrierte Route steht in der Tabelle ODER mit Grund in der Restliste", () => {
    const inDerTabelle = new Set(TABELLE.map((z) => schluessel(z.methode, registrierteRoute(z))));
    const inDerRestliste = new Set(NICHT_ABGENOMMEN.map((e) => schluessel(e.methode, e.pfad)));
    const ohnePlatz = eigenstaendig()
      .filter((r) => {
        const k = schluessel(r.methode, r.pfad);
        return !inDerTabelle.has(k) && !inDerRestliste.has(k);
      })
      .map((r) => `${r.methode} ${r.pfad}`);
    expect(
      ohnePlatz,
      "Diese Türen sind registriert, aber die Abnahme sagt über sie nichts: weder eine gemessene Zeile in `TABELLE` noch ein begründeter Eintrag in `NICHT_ABGENOMMEN`.",
    ).toEqual([]);
  });

  it("E3: keine Route steht in beiden Listen", () => {
    const inDerTabelle = new Set(TABELLE.map((z) => schluessel(z.methode, registrierteRoute(z))));
    const doppelt = NICHT_ABGENOMMEN.map((e) => schluessel(e.methode, e.pfad)).filter((k) =>
      inDerTabelle.has(k),
    );
    expect(
      doppelt,
      "Eine Route, die gemessen wird und zugleich als ungeprüft geführt wird, macht beide Angaben wertlos.",
    ).toEqual([]);
  });

  it("E4: kein Eintrag der Restliste zeigt auf eine Tür, die es gar nicht gibt", () => {
    const alle = new Set(eigenstaendig().map((r) => schluessel(r.methode, r.pfad)));
    const verwaist = NICHT_ABGENOMMEN.filter((e) => !alle.has(schluessel(e.methode, e.pfad))).map(
      (e) => `${e.methode} ${e.pfad}`,
    );
    expect(
      verwaist,
      "Diese Einträge behaupten eine offene Prüfschuld für Routen, die die App nicht (mehr) registriert — die gefährlichere Richtung, weil sie grün aussieht.",
    ).toEqual([]);
  });

  it("E5: jeder Eintrag der Restliste trägt seinen eigenen Grund", () => {
    const ohneGrund = NICHT_ABGENOMMEN.filter((e) => e.grund.trim().length < 20).map(
      (e) => `${e.methode} ${e.pfad}: "${e.grund}"`,
    );
    expect(
      ohneGrund,
      "Eine Restliste mit leeren oder formelhaften Gründen wäre dem Wortlaut nach erfüllt und der Sache nach ein Ablagefach.",
    ).toEqual([]);
  });

  it("E6: keine zwei Zeilen führen dieselbe registrierte Tür", () => {
    // RUNDE 2. Hier stand ein Textvergleich („passt die gefahrene URL auf das Muster?"), und der
    // Prüfer hat gemessen, dass er die entscheidende Verwechslung durchlässt. Die Frage, ob eine
    // Zeile wirklich ihre eigene Tür befragt, beantwortet seit dieser Runde der Router selbst
    // (`rollen-am-draht.test.ts`, D2 und jede Zeile) — sie lässt sich ohne Anfrage gar nicht
    // beantworten, und deshalb steht hier nicht mehr ihr schwacher Ersatz.
    //
    // Was hier bleibt, ist die ZWEITE Hälfte der Korrekturpflicht: die Abdeckungszahl darf zwei
    // Aufrufe derselben Tür nicht als zwei geprüfte Endpunkte ausweisen. Führen zwei Zeilen dasselbe
    // Muster, ist genau das passiert.
    const gezaehlt = new Map<string, string[]>();
    for (const z of TABELLE) {
      const k = schluessel(z.methode, registrierteRoute(z));
      gezaehlt.set(k, [...(gezaehlt.get(k) ?? []), `${z.gruppe} · ${z.methode} ${z.pfad}`]);
    }
    const doppelt = [...gezaehlt.entries()]
      .filter(([, zeilen]) => zeilen.length > 1)
      .map(([k, zeilen]) => `${k}: ${zeilen.join(" | ")}`);
    expect(
      doppelt,
      "Diese registrierten Türen werden von mehr als einer Zeile geführt — die Abdeckungszahl zählte sie mehrfach.",
    ).toEqual([]);
  });

  it("E7: kein HEAD-Spiegel ohne GET-Zwilling", () => {
    // Die Rechtfertigung dafür, dass die HEAD-Routen nicht eigenständig abgenommen werden: sie sind
    // Fastifys automatische Spiegel derselben GET-Route (`exposeHeadRoutes`), mit demselben Handler
    // und derselben Hook-Kette. Diese Aussage wird hier geprüft, nicht behauptet — ein HEAD ohne GET
    // wäre eine Tür, über die niemand redet.
    const get = new Set(aufzaehlung.routen.filter((r) => r.methode === "GET").map((r) => r.pfad));
    const ohneZwilling = aufzaehlung.routen
      .filter((r) => r.methode === "HEAD" && !get.has(r.pfad))
      .map((r) => `HEAD ${r.pfad}`);
    expect(ohneZwilling).toEqual([]);
  });

  it("E8: beide Abdeckungsumfänge stehen getrennt da — Gruppen UND Endpunkte", () => {
    const erhebung = erhebeRoutengruppen();
    const gruppen = erhebung.gruppen.length;
    const gruppenGedeckt = new Set(TABELLE.map((z) => z.gruppe).filter((g) => g !== DIREKT)).size;
    const endpunkte = eigenstaendig().length;
    // RUNDE 2, Korrekturpflicht 1, zweiter Halbsatz: gezählt werden UNTERSCHIEDLICHE registrierte
    // Türen, nicht Tabellenzeilen. Stünde hier `TABELLE.length`, würden zwei Zeilen auf derselben
    // Tür als zwei geprüfte Endpunkte durchgehen. E6 verbietet diesen Fall zusätzlich; die Zahl
    // hier ist trotzdem die belastbare, weil sie ihn gar nicht erst zählen kann.
    const gemessen = new Set(TABELLE.map((z) => schluessel(z.methode, registrierteRoute(z)))).size;
    const rest = new Set(NICHT_ABGENOMMEN.map((e) => schluessel(e.methode, e.pfad))).size;
    const spiegel = aufzaehlung.routen.length - endpunkte;

    // Die einzige „Anzeige" dieses Auftrags. Jede Zahl stammt aus DIESEM Lauf; keine ist aus einer
    // Akte oder einem Kommentar übernommen (Auftrag §9).
    console.log(
      [
        "ABDECKUNG DER ROLLENABNAHME (gemessen in diesem Lauf)",
        `  Gruppen:   ${gruppenGedeckt} von ${gruppen} registrierten Routengruppen haben eine Zeile`,
        `  Endpunkte: ${gemessen} von ${endpunkte} registrierten Endpunkten sind mit fünf Akteuren gemessen`,
        `             ${rest} stehen mit Grund in NICHT_ABGENOMMEN`,
        `             ${spiegel} automatische HEAD-Spiegel, jeder mit GET-Zwilling (E7)`,
      ].join("\n"),
    );

    // Untergrenzen: ein Rückschritt wird rot. Die Zahlen sind die am Prüfstand gemessenen; wer sie
    // senkt, muss hier begründen, welche Tür die Abnahme künftig nicht mehr anfasst.
    expect(gruppenGedeckt, "gedeckte Routengruppen").toBeGreaterThanOrEqual(39);
    expect(gemessen, "mit fünf Akteuren gemessene Endpunkte").toBeGreaterThanOrEqual(93);
    expect(
      gemessen + rest,
      "Endpunkte mit einem Platz in der Abnahme (gemessen + begründet zurückgestellt)",
    ).toBeGreaterThanOrEqual(endpunkte);
  });
});
