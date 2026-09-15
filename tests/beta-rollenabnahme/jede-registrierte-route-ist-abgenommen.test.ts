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
import { SCHREIB_TABELLE, ausgelasseneAkteure, vollstaendigGemessen } from "./schreibende-tueren";
import { DIREKT, NICHT_ABGENOMMEN, TABELLE, registrierteRoute } from "./tabelle";

let buehne: Buehne;
let aufzaehlung: Aufzaehlung;

// ================================================================================================
// JOB 4113 — DIE ABNAHMETABELLE HAT SEIT DIESEM AUFTRAG ZWEI TEILE, UND DIE ZÄHLUNG KENNT BEIDE.
// ================================================================================================
//
// `TABELLE` (`tabelle.ts`) führt die LESENDEN Türen: fertige URL, feste Nutzlast, eine gemeinsame
// Bühne. `SCHREIB_TABELLE` (`schreibende-tueren.ts`) führt die SCHREIBENDEN: ein `ruesten` je Zeile,
// eine eigene frische Bühne je Messung. Der Unterschied ist bautechnisch unvermeidbar — eine
// schreibende Zeile kann ihre URL erst kennen, wenn der Vorgang hergestellt ist.
//
// FÜR DIE ABDECKUNG SIND SIE EINE MENGE. Jede Zählung dieses Wächters geht deshalb über
// `gemesseneTueren()` und nie über eine der beiden Listen allein; eine Tür, die in einer von beiden
// steht, ist gemessen, und sie darf in der Restliste nicht mehr stehen (E3).
const SCHREIBENDE_METHODEN = ["POST", "PUT", "DELETE"] as const;

/** Jede Tür, die diese Abnahme mit fünf Akteuren fährt — lesend ODER schreibend. */
function gemesseneTueren(): { methode: string; route: string; herkunft: string }[] {
  return [
    ...TABELLE.map((z) => ({
      methode: z.methode,
      route: registrierteRoute(z),
      herkunft: `${z.gruppe} · ${z.methode} ${z.pfad}`,
    })),
    // RUNDE 2 · KORREKTURPFLICHT 1: NUR ZEILEN, DIE WIRKLICH ALLE FÜNF AKTEURE FAHREN.
    //
    // Der Prüfer hat `viewer: nicht-geprueft` in eine Schreibzeile gesetzt und gemessen, dass die
    // Abdeckung unverändert „36 von 94" meldete. Die Zahl behauptete damit eine Fünf-Akteure-
    // Messung, die es nicht gab. Seither entscheidet `vollstaendigGemessen` (die Funktion, die auch
    // der Drahttest benutzt), ob eine Tür überhaupt in die Zählung kommt — und die ausgelassene
    // Tür fällt damit doppelt auf: E8 zählt sie nicht mehr, und E2 nennt sie als Tür ohne Platz.
    ...SCHREIB_TABELLE.filter(vollstaendigGemessen).map((z) => ({
      methode: z.methode,
      route: z.route,
      herkunft: `${z.gruppe} · ${z.methode} ${z.route} (schreibend)`,
    })),
  ];
}

function gemesseneSchluessel(): Set<string> {
  return new Set(gemesseneTueren().map((t) => schluessel(t.methode, t.route)));
}

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
    const inDerTabelle = gemesseneSchluessel();
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
    const inDerTabelle = gemesseneSchluessel();
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

  it("E5b: jeder Eintrag der Restliste sagt, welche ART von Grund er führt", () => {
    // JOB 4113 · Lieferung 2. `E5` prüft die LÄNGE des Grundes — das unterscheidet eine bauliche
    // Unmöglichkeit nicht von einer Prüfschuld. Die vier baulichen Türen sind namentlich bekannt
    // (Auftrag §10) und stehen hier ausgeschrieben: wer eine fünfte erklärt, muss diese Liste
    // anfassen und seine Begründung neben die vier bestehenden stellen.
    const BAULICH_ERLAUBT = [
      "OPTIONS /*",
      "POST /api/auth/login",
      "POST /api/auth/setup",
      "POST /api/auth/office-handover/redeem",
    ];
    const baulich = NICHT_ABGENOMMEN.filter((e) => e.art === "baulich").map(
      (e) => `${e.methode} ${e.pfad}`,
    );
    expect(
      baulich.filter((k) => !BAULICH_ERLAUBT.includes(k)),
      "Eine Tür als `baulich` zu führen heisst: an ihr ist eine Rollenzeile UNMÖGLICH. Das ist der Ausweis, mit dem eine Tür die Abnahme dauerhaft verlässt — er wird namentlich vergeben, nicht durch ein Feld.",
    ).toEqual([]);
    expect(
      BAULICH_ERLAUBT.filter((k) => !baulich.includes(k)),
      "Diese Türen sind als baulich unmessbar belegt, tragen die Art aber nicht mehr — entweder ist der Beweis weggefallen (dann gehören sie gemessen) oder das Feld ist verrutscht.",
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
    // JOB 4113: über BEIDE Teile der Tabelle. Eine Tür, die lesend UND schreibend geführt würde,
    // wäre derselbe Zählfehler wie zwei Lesezeilen auf demselben Muster.
    for (const t of gemesseneTueren()) {
      const k = schluessel(t.methode, t.route);
      gezaehlt.set(k, [...(gezaehlt.get(k) ?? []), t.herkunft]);
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
    const gemessen = gemesseneSchluessel().size;
    const rest = new Set(NICHT_ABGENOMMEN.map((e) => schluessel(e.methode, e.pfad))).size;
    const spiegel = aufzaehlung.routen.length - endpunkte;

    // ============================================================================================
    // JOB 4113 · LIEFERUNG 5 — DIE DRITTE ZAHL: DIE SCHREIBENDEN TÜREN.
    // ============================================================================================
    //
    // Die Lehre des Prüfers zu JOB 4015 R2 lautet: „Eine vollständige Routengruppenabnahme ist keine
    // vollständige Endpunktabnahme. Weise beide Abdeckungsumfänge getrennt aus." Dieser Auftrag
    // erweitert sie um eine dritte Zahl, statt sie zu ersetzen — aus demselben Grund: eine
    // vollständige ENDPUNKTabnahme ist keine vollständige SCHREIBWEGabnahme. Bis hierher war die
    // Zahl 95 von 179 richtig UND schweigsam: sie verriet nicht, dass der grosse Teil der Türen,
    // an denen ein Gast etwas ÄNDERN würde, nicht darin vorkam.
    //
    // GEZÄHLT WIRD GEGEN DIE LAUFENDE APP, nicht gegen die eigene Liste: Nenner sind die
    // registrierten POST/PUT/DELETE-Endpunkte, Zähler die davon gemessenen.
    const schreibendeEndpunkte = eigenstaendig().filter((r) =>
      (SCHREIBENDE_METHODEN as readonly string[]).includes(r.methode),
    );
    const schreibendeTueren = new Set(
      schreibendeEndpunkte.map((r) => schluessel(r.methode, r.pfad)),
    );
    const schreibendGemessen = [...gemesseneSchluessel()].filter((k) =>
      schreibendeTueren.has(k),
    ).length;

    // Die einzige „Anzeige" dieses Auftrags. Jede Zahl stammt aus DIESEM Lauf; keine ist aus einer
    // Akte oder einem Kommentar übernommen (Auftrag §9).
    console.log(
      [
        "ABDECKUNG DER ROLLENABNAHME (gemessen in diesem Lauf)",
        `  Gruppen:   ${gruppenGedeckt} von ${gruppen} registrierten Routengruppen haben eine Zeile`,
        `  Endpunkte: ${gemessen} von ${endpunkte} registrierten Endpunkten sind mit fünf Akteuren gemessen`,
        `             ${rest} stehen mit Grund in NICHT_ABGENOMMEN`,
        `             ${spiegel} automatische HEAD-Spiegel, jeder mit GET-Zwilling (E7)`,
        `  SCHREIBENDE Türen: ${schreibendGemessen} von ${schreibendeTueren.size} registrierten POST/PUT/DELETE-Endpunkten sind mit fünf Akteuren gemessen`,
      ].join("\n"),
    );

    // Untergrenzen: ein Rückschritt wird rot. Die Zahlen sind die am Prüfstand gemessenen; wer sie
    // senkt, muss hier begründen, welche Tür die Abnahme künftig nicht mehr anfasst.
    expect(gruppenGedeckt, "gedeckte Routengruppen").toBeGreaterThanOrEqual(40);
    expect(gemessen, "mit fünf Akteuren gemessene Endpunkte").toBeGreaterThanOrEqual(123);
    expect(
      schreibendGemessen,
      "mit fünf Akteuren gemessene SCHREIBENDE Endpunkte (POST/PUT/DELETE)",
    ).toBeGreaterThanOrEqual(36);
    expect(
      gemessen + rest,
      "Endpunkte mit einem Platz in der Abnahme (gemessen + begründet zurückgestellt)",
    ).toBeGreaterThanOrEqual(endpunkte);
  });

  // ----------------------------------------------------------------------------------------------
  // E9 · LIEFERUNG 6 — DER WÄCHTER GEGEN DAS STILLE ZURÜCKSTELLEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Bis hierher wuchs die Restliste OHNE WIDERSTAND: `E5` verlangt einen Grund von mehr als zwanzig
  // Zeichen, und den schreibt sich jeder. Wer eine Tür aus der Messung nahm, brauchte einen Satz —
  // nicht eine Entscheidung. Diese Obergrenze macht daraus eine Entscheidung: sie ist die Zahl, die
  // DIESER Lauf gemessen hat, und wer sie anhebt, tut das sichtbar, mit Begründung, an dieser
  // Stelle. Sie darf fallen, so oft jemand will — steigen nur mit Namen und Grund.
  // ----------------------------------------------------------------------------------------------
  // E10 · RUNDE 2, KORREKTURPFLICHT 1 — DER AUSGELASSENE AKTEUR HAT EINEN NAMEN.
  // ----------------------------------------------------------------------------------------------
  //
  // E8 zählt eine Zeile mit ausgelassenem Akteur seit dieser Runde nicht mehr mit, und E2 meldet
  // ihre Tür als Tür ohne Platz. Beides ist richtig und beides ist INDIREKT: der Mensch, der die
  // Meldung liest, sieht eine Zahl fallen und eine Route in einer Liste. Dieser Fall sagt gerade
  // heraus, WELCHE Zeile WELCHEN Akteur auslässt — das ist der Satz, den Pedi braucht, um zu
  // entscheiden, ob die Tür gemessen oder ehrlich zurückgestellt gehört.
  it("E10: keine Schreibzeile lässt einen Akteur aus", () => {
    const luecken = SCHREIB_TABELLE.filter((z) => !vollstaendigGemessen(z)).map(
      (z) => `${z.methode} ${z.route}: ${ausgelasseneAkteure(z).join(", ")} nicht gefahren`,
    );
    expect(
      luecken,
      "Eine Schreib-Tür, an der ein Akteur nicht klopft, ist genau die Tür, an der niemand weiss, ob er den Bestand ändern könnte. Wer sie nicht mit allen fünf Akteuren fahren kann, nimmt sie aus SCHREIB_TABELLE heraus und führt sie mit eigenem Grund in NICHT_ABGENOMMEN — dort zählt E9 sie als Prüfschuld.",
    ).toEqual([]);
  });

  it("E9: die Zahl der zurückgestellten Türen steigt nicht still", () => {
    const zurueckgestellt = NICHT_ABGENOMMEN.filter((e) => e.art === "zurueckgestellt");
    expect(
      zurueckgestellt.length,
      `Diese Türen sind als PRÜFSCHULD geführt (art: "zurueckgestellt"), nicht als bauliche Unmöglichkeit. Die Obergrenze ist der in JOB 4113 gemessene Stand; wer sie anhebt, nimmt eine Tür aus der Messung und muss hier sagen, welche und warum. Aktuell zurückgestellt: ${zurueckgestellt
        .map((e) => `${e.methode} ${e.pfad}`)
        .join(", ")}`,
    ).toBeLessThanOrEqual(55);
  });
});
