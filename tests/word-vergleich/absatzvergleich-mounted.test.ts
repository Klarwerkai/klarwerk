// @vitest-environment jsdom
// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — VIER ABSAETZE, VIER AUSSAGEN, VIER FARBEN (UND EINE OHNE FARBE).
// ================================================================================================
//
// PEDIS FALL (Auftrag §1): er oeffnet Codex' Vergleichsdokument in Word und klickt in Klara auf
// „Dokument pruefen". Klara geht Absatz fuer Absatz durch, faerbt im DOKUMENT — gruen woertlich
// belegt, gelb aehnlich, tuerkis kein Fund, rot Widerspruch — und listet im Panel je Absatz die
// Quellen mit Titel, Weg in die Bibliothek und Pruefstand. Klara entscheidet nichts.
//
// GEMESSEN WIRD AM AUSGELIEFERTEN FENSTER (`createKlaraPanel`) GEGEN EINEN NACHGEBAUTEN
// WORD-HOST (`createWordBuehne`). Die Serverantworten tragen genau die Form, die
// `toResponse`/`toSourceHitResponse` in `services/app/src/routes/check-text-routes.ts` erzeugen;
// je Absatz eine eigene Antwort, ausgewaehlt am gesendeten Text.
//
// NACHBARSCHAFTSPROBE: die erwarteten Saetze stehen WOERTLICH hier, nicht als `p.t("…")`. Ein Test,
// der das Woerterbuch des Produkts gegen sich selbst haelt, ist gruen, auch wenn beide falsch sind.
//
// RED-FIRST: vor dieser Runde kannte das Panel weder `#wv-btn` noch `#wv-liste`; jeder Fall unten
// war rot mit „Panel: Stelle #wv-btn existiert nicht".
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, FetchCall, KlaraPanel } from "../app/klara-panel-fixture";
import { reply } from "../app/klara-panel-fixture";
import { type WordBuehne, createWordBuehne, starteMitWord } from "./word-buehne";

// ------------------------------------------------------------------------------------------------
// Die vier Absaetze aus Codex' Vergleichsdokument — plus eine Ueberschrift, die zu kurz ist.
// ------------------------------------------------------------------------------------------------
const UEBERSCHRIFT = "Wartung Presse P2";

const EXAKT =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck im " +
  "Hydrauliksystem vollstaendig abzubauen.";

const AEHNLICH =
  "Bevor jemand an der Presse P2 arbeitet, wird der Hauptschalter gesperrt und das Hydrauliksystem " +
  "drucklos gemacht.";

const NEU =
  "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht auf Filterbruch " +
  "durchgesehen.";

const WIDERSPRUCH =
  "Die Schutzhaube der Presse P2 darf waehrend des Probelaufs geoeffnet bleiben, wenn ein zweiter " +
  "Mitarbeiter danebensteht.";

// ------------------------------------------------------------------------------------------------
// Antwortbausteine — die Form der Route, nicht eine Abschrift des Panels.
// ------------------------------------------------------------------------------------------------
function fundort(id: string, bereich: string): Record<string, unknown> {
  return { kategorie: bereich, bereich, bibliothekPfad: `/wissen/${id}` };
}

/** Ein Quellenfund (`toSourceHitResponse`). `fundstelle` ist der BELEGTE Quellabschnitt. */
function quellenfund(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    refId: "ko-77",
    koTitle: "BAADER Betriebsanweisung Presse P2",
    koStatus: "offen",
    koCategory: "Instandhaltung",
    pruefstand: "eingereicht",
    version: 4,
    fundort: fundort("ko-77", "Instandhaltung"),
    coverage: "full",
    gedeckteZeichen: EXAKT.length,
    passageZeichen: EXAKT.length,
    fundstelle: `… Abschnitt 4.2: ${EXAKT} Erst danach darf die Schutzhaube geoeffnet werden. …`,
    quelle: { label: "Betriebsanweisung BA-P2", url: null },
    anhang: null,
    ...over,
  };
}

/** Ein Dublettentreffer (`toResponse.duplicates`). */
function dublette(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    koId: "ko-1",
    koTitle: "Wartungsregel Presse P2",
    relation: "identisch",
    confidence: 0.98,
    method: "trigram",
    rationale: null,
    koStatus: "validiert",
    koCategory: "Instandhaltung",
    pruefstand: "validiert",
    version: 9,
    fundort: fundort("ko-1", "Instandhaltung"),
    ...over,
  };
}

/** Ein Konflikttreffer (`toResponse.conflicts`) mit beiden Stellen aus dem Modellurteil. */
function konflikt(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    koId: "ko-9",
    koTitle: "Sicherheitsregel Schutzhaube",
    // `truth` ist der Typ, den `relationToType` aus der Relation „widerspruch" bildet
    // (services/conflicts/src/detect.ts:161) — kein erfundener Wert.
    type: "truth",
    confidence: 0.9,
    method: "judge",
    rationale: "Der Text erlaubt, was die Regelung verbietet.",
    koStatus: "validiert",
    koCategory: "Arbeitssicherheit",
    pruefstand: "validiert",
    version: 3,
    fundort: fundort("ko-9", "Arbeitssicherheit"),
    stellen: {
      eigen: "darf waehrend des Probelaufs geoeffnet bleiben",
      quelle: "Die Schutzhaube bleibt in jedem Betriebszustand geschlossen.",
    },
    ...over,
  };
}

interface AntwortWahl {
  duplicates?: unknown[];
  conflicts?: unknown[];
  sourceHits?: unknown[];
  quellenfundGelaufen?: boolean;
  quellenfundGrund?: string | null;
  sourceHitsTruncated?: boolean;
  konfliktGelaufen?: boolean;
  konfliktGrund?: string | null;
}

function antwort(o: AntwortWahl = {}): Record<string, unknown> {
  return {
    duplicates: o.duplicates ?? [],
    conflicts: o.conflicts ?? [],
    konfliktpruefung: {
      gelaufen: o.konfliktGelaufen ?? false,
      grund: o.konfliktGrund ?? "nicht_angefordert",
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    },
    answer: null,
    note: null,
    persisted: false,
    sourceHits: o.sourceHits ?? [],
    sourceHitsTruncated: o.sourceHitsTruncated ?? false,
    quellenfund: {
      gelaufen: o.quellenfundGelaufen ?? true,
      grund: o.quellenfundGrund ?? null,
      geprueft: 3,
    },
  };
}

/** Die Route antwortet je nach GESENDETEM Text — ein Aufruf je Absatz, vier verschiedene Lagen. */
function jeAbsatz(tabelle: Array<{ enthaelt: string; koerper: Record<string, unknown> }>) {
  return (_url: string, init: Record<string, unknown> | undefined): FakeReplyInit => {
    const roh = typeof init?.body === "string" ? init.body : "";
    for (const zeile of tabelle) {
      if (roh.includes(zeile.enthaelt)) {
        return reply(200, zeile.koerper);
      }
    }
    return reply(200, antwort());
  };
}

const VIER_ABSAETZE = [
  { enthaelt: "Hauptschalter abzuschliessen", koerper: antwort({ sourceHits: [quellenfund()] }) },
  {
    enthaelt: "wird der Hauptschalter gesperrt",
    koerper: antwort({ duplicates: [dublette()] }),
  },
  { enthaelt: "Absauganlage an Linie 7", koerper: antwort() },
  {
    enthaelt: "Schutzhaube der Presse P2 darf",
    koerper: antwort({ conflicts: [konflikt()], konfliktGelaufen: true, konfliktGrund: null }),
  },
];

// ------------------------------------------------------------------------------------------------
// Buehne
// ------------------------------------------------------------------------------------------------
let panel: KlaraPanel | null = null;
let abKlick = 0;

function dokument(): WordBuehne {
  return createWordBuehne([
    { text: UEBERSCHRIFT },
    { text: EXAKT },
    { text: AEHNLICH },
    { text: NEU },
    { text: WIDERSPRUCH },
  ]);
}

function starte(
  buehne: WordBuehne,
  routen: Record<string, FakeReplyInit | ReturnType<typeof jeAbsatz>> = {},
): KlaraPanel {
  panel = starteMitWord({ "/api/check-text": jeAbsatz(VIER_ABSAETZE), ...routen }, buehne);
  return panel;
}

/** Klick auf „Dokument pruefen" und alle Promise-Ketten des Panels abwarten. */
async function pruefe(p: KlaraPanel): Promise<void> {
  await p.flush();
  const knopf = p.q("#wv-btn");
  expect(knopf, "der Knopf „Dokument pruefen“ fehlt").not.toBeNull();
  abKlick = p.calls.length;
  (knopf as { click(): void }).click();
  // Der Weg ist eine Kette je Absatz — sie braucht mehr Runden als ein einzelner Abruf.
  for (let i = 0; i < 10; i += 1) {
    await p.flush();
  }
}

function checkTextRufe(p: KlaraPanel): FetchCall[] {
  return p.calls.slice(abKlick).filter((c) => c.url === "/api/check-text");
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

// ================================================================================================
describe("JOB 3281 · W0 · der Weg existiert und liest Word erst beim Klick", () => {
  it("W0a · Knopf, Abbruchknopf und Ruhesatz stehen im Fenster — ohne einen einzigen Word-Lauf", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await p.flush();
    expect(p.q("#wv-block"), "der Vergleichsblock fehlt").not.toBeNull();
    expect(p.text("#wv-btn")).toBe("Dokument prüfen");
    // Nichts wird beim Laden gelesen: kein Word.run, kein Abruf.
    expect(buehne.mitschrift.laeufe).toBe(0);
    expect(p.calls.filter((c) => c.url === "/api/check-text")).toEqual([]);
    // Und nichts wird vorgetaeuscht: die Liste ist leer, der Ruhesatz sagt genau das.
    expect(p.text("#wv-liste")).toBe("");
    expect(p.text("#wv-stand")).toContain(
      "Für dieses Fenster liegt noch kein Abgleich vor. Farben aus einem früheren Lauf bleiben " +
        "im Dokument",
    );
  });

  it("W0b · der Lauf laedt Text UND Hervorhebung — sonst waere die Ursprungsfarbe geraten", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.mitschrift.laeufe).toBeGreaterThan(0);
  });
});

// ================================================================================================
describe("JOB 3281 · (a) vier Absaetze, vier Farben, richtig zugeordnet", () => {
  it("A1 · gruen woertlich, gelb aehnlich, tuerkis kein Fund, rot Widerspruch", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);

    // Ein Abruf JE nicht-leerem Absatz — auch die Ueberschrift geht hinein (der Weg entscheidet
    // nicht vorab, was zu kurz ist; das sagt die Route).
    expect(checkTextRufe(p)).toHaveLength(4);

    // Die Ueberschrift bleibt ohne Farbe (unter 40 Zeichen, die Route nimmt sie nicht an).
    expect(buehne.farben()).toEqual([null, "BrightGreen", "Yellow", "Turquoise", "Red"]);
  });

  it("A2 · GEGENFALL zur Punktzahl: Dublette „identisch“ mit 0,98 OHNE woertlichen Beleg ist GELB", async () => {
    // Codex' Nachfuehrung 08.09.: ein hoher Trigramm-Wert ist IMMER „aehnlich", nie „woertlich".
    const buehne = createWordBuehne([{ text: AEHNLICH }]);
    const p = starte(buehne, {
      "/api/check-text": jeAbsatz([
        {
          enthaelt: "wird der Hauptschalter gesperrt",
          koerper: antwort({ duplicates: [dublette({ confidence: 0.98 })] }),
        },
      ]),
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Yellow"]);
    expect(p.text("#wv-liste")).toContain("Ähnlich — inhaltlich verwandt, nicht wörtlich");
    expect(p.text("#wv-liste")).not.toContain("Wörtlich im Bestand belegt");
  });

  it("A3 · GEGENFALL zur Deckung: coverage „full“, aber die Fundstelle traegt den Absatz NICHT", async () => {
    // Die Zahlen sagen „ganz gedeckt", der mitgelieferte Quellabschnitt zeigt einen anderen Text.
    // Dann steht die SCHWAECHERE Aussage da — nicht die starke.
    const buehne = createWordBuehne([{ text: EXAKT }]);
    const p = starte(buehne, {
      "/api/check-text": jeAbsatz([
        {
          enthaelt: "Hauptschalter abzuschliessen",
          koerper: antwort({
            sourceHits: [
              quellenfund({ fundstelle: "… ein voellig anderer Abschnitt der Quelle …" }),
            ],
          }),
        },
      ]),
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Yellow"]);
  });

  it("A4 · die Panel-Liste nennt je Absatz Kategorie, Quelle, Weg und Pruefstand", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    const liste = p.text("#wv-liste");

    expect(liste).toContain("Absatz 2");
    expect(liste).toContain("Wörtlich im Bestand belegt");
    expect(liste).toContain("BAADER Betriebsanweisung Presse P2");
    expect(liste).toContain("noch nicht geprüft");
    expect(liste).toContain("Wartungsregel Presse P2");
    expect(liste).toContain("Validiert");
    expect(liste).toContain("Kein Fund im durchsuchten Bestand");
    expect(liste).toContain("Widerspruch zu einem Eintrag");
    expect(liste).toContain("Sicherheitsregel Schutzhaube");
    // Bei Widerspruch der BELEGTE Satz aus der Quelle (§5.3).
    expect(liste).toContain("Die Schutzhaube bleibt in jedem Betriebszustand geschlossen.");
    // Klara entscheidet nichts.
    expect(liste).toContain("Klara entscheidet nichts");

    const weg = p.q("#wv-liste a");
    expect(weg, "der Weg in die Bibliothek fehlt").not.toBeNull();
    expect(weg?.getAttribute("target")).toBe("_blank");
    expect(weg?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(weg?.href.endsWith("/wissen/ko-77")).toBe(true);
  });

  it("A4b · ein Widerspruch OHNE benannte Stelle sagt das — statt die Stelle wegzulassen", async () => {
    // `stellen: null` liefert die Route, wenn sie das Modellurteil nicht wiederfindet
    // (check-text-routes.ts `mitStellen`). Der Konflikt bleibt GENANNT, die Stelle wird nicht
    // erfunden — und die Zeile verschweigt auch nicht, dass sie fehlt.
    const buehne = createWordBuehne([{ text: WIDERSPRUCH }]);
    const p = starte(buehne, {
      "/api/check-text": jeAbsatz([
        {
          enthaelt: "Schutzhaube der Presse P2 darf",
          koerper: antwort({
            conflicts: [konflikt({ stellen: null })],
            konfliktGelaufen: true,
            konfliktGrund: null,
          }),
        },
      ]),
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Red"]);
    const liste = p.text("#wv-liste");
    expect(liste).toContain("Sicherheitsregel Schutzhaube");
    expect(liste).toContain("Die Quelle: Stelle nicht benannt.");
  });

  it("A6 · ein zwischen Lesen und Faerben GEAENDERTER Absatz wird nicht gefaerbt, sondern benannt", async () => {
    const buehne = createWordBuehne([{ text: EXAKT }, { text: NEU }]);
    const p = starte(buehne, {
      "/api/check-text": (_u, init) => {
        const roh = typeof init?.body === "string" ? init.body : "";
        // Waehrend der ZWEITE Absatz geprueft wird, schreibt jemand den ERSTEN um. Gefaerbt wird
        // erst danach — der Hash passt dann nicht mehr.
        if (roh.includes("Absauganlage an Linie 7")) {
          buehne.aendere(0, "Ein voellig anderer Satz steht jetzt an dieser Stelle im Dokument.");
        }
        return jeAbsatz(VIER_ABSAETZE)(_u, init);
      },
    });
    await pruefe(p);
    // Der veraenderte Absatz bleibt farblos; der unveraenderte bekommt seine Farbe.
    expect(buehne.farben()).toEqual([null, "Turquoise"]);
    expect(p.text("#wv-liste")).toContain(
      "Der Absatz hat sich seit dem Abgleich verändert — er wurde nicht gefärbt; gleiche ihn erneut ab.",
    );
  });

  it("A5 · Klick auf einen Eintrag springt zum Absatz — und schreibt nichts", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    const sprung = p.q('#wv-liste button[data-wv-sprung="2"]');
    expect(sprung, "der Sprung zum Absatz fehlt").not.toBeNull();
    (sprung as { click(): void }).click();
    await p.flush();
    expect(buehne.mitschrift.gewaehlt).toEqual([1]);
    expect(buehne.mitschrift.schreib).toEqual([]);
  });
});

// ================================================================================================
describe("JOB 3281 · (b) nicht abgeglichen heisst KEINE Farbe und ein Grund", () => {
  it("B1 · zu kurzer Absatz: keine Farbe, der Grund steht da", async () => {
    const buehne = createWordBuehne([{ text: UEBERSCHRIFT }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual([null]);
    expect(p.text("#wv-liste")).toContain("Nicht abgeglichen");
    expect(p.text("#wv-liste")).toContain("unter 40 Zeichen");
  });

  it("B2 · der Bestand wurde nicht durchsucht (quellenfund.gelaufen === false): kein Türkis", async () => {
    const buehne = createWordBuehne([{ text: NEU }]);
    const p = starte(buehne, {
      "/api/check-text": jeAbsatz([
        {
          enthaelt: "Absauganlage an Linie 7",
          koerper: antwort({
            quellenfundGelaufen: false,
            quellenfundGrund: "suche_nicht_verfuegbar",
          }),
        },
      ]),
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual([null]);
    expect(p.text("#wv-liste")).toContain("der Bestand wurde für diesen Absatz nicht durchsucht");
  });

  it("B3 · mehr Quellen als der Deckel durchsucht: kein pauschales Türkis", async () => {
    const buehne = createWordBuehne([{ text: NEU }]);
    const p = starte(buehne, {
      "/api/check-text": jeAbsatz([
        { enthaelt: "Absauganlage an Linie 7", koerper: antwort({ sourceHitsTruncated: true }) },
      ]),
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual([null]);
    expect(p.text("#wv-liste")).toContain("es gab mehr Quellen, als der Deckel durchsucht hat");
  });

  it("B4 · Serverfehler: keine Farbe, ehrlicher Grund, der Lauf geht weiter", async () => {
    const buehne = createWordBuehne([{ text: NEU }, { text: EXAKT }]);
    const p = starte(buehne, {
      "/api/check-text": (_u, init) => {
        const roh = typeof init?.body === "string" ? init.body : "";
        return roh.includes("Absauganlage")
          ? reply(500, { error: "boom" })
          : reply(200, antwort({ sourceHits: [quellenfund()] }));
      },
    });
    await pruefe(p);
    expect(buehne.farben()).toEqual([null, "BrightGreen"]);
    expect(p.text("#wv-liste")).toContain("der Abgleich dieses Absatzes ist fehlgeschlagen");
  });

  it("B5 · ohne Einwilligung fuer dieses Dokument bleibt der Widerspruchsabgleich aus — und sagt es", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    // Die Buehne fuehrt keine KA4-Einwilligung: `want:"deep"` darf NICHT hinausgehen.
    for (const ruf of checkTextRufe(p)) {
      expect(ruf.body ?? "").not.toContain('"want"');
    }
    expect(p.text("#wv-stand")).toContain(
      "Ohne Einwilligung für dieses Dokument bleibt der Widerspruchsabgleich aus",
    );
  });
});

// ================================================================================================
describe("JOB 3281 · (c) Fortschritt zaehlt, Abbruch stoppt weitere Aufrufe", () => {
  it("C1 · der Fortschritt nennt Absatz und Gesamtzahl", async () => {
    const buehne = dokument();
    let gesehen = "";
    const p = starte(buehne, {
      "/api/check-text": (_u, init) => {
        // Waehrend der zweite Absatz laeuft, steht der Fortschritt im Fenster.
        const roh = typeof init?.body === "string" ? init.body : "";
        if (roh.includes("wird der Hauptschalter gesperrt")) {
          gesehen = panel?.text("#wv-stand") ?? "";
        }
        return jeAbsatz(VIER_ABSAETZE)(_u, init);
      },
    });
    await pruefe(p);
    expect(gesehen).toContain("Absatz 3 von 5");
    expect(p.text("#wv-stand")).toContain("5 von 5 Absätzen abgeglichen");
    expect(p.text("#wv-stand")).toContain("Klara hat nur Farben gesetzt");
  });

  it("C2 · Abbrechen stoppt: keine weiteren Abrufe, das Erreichte bleibt", async () => {
    const buehne = dokument();
    const p = starte(buehne, {
      "/api/check-text": (_u, init) => {
        const roh = typeof init?.body === "string" ? init.body : "";
        if (roh.includes("Hauptschalter abzuschliessen")) {
          // Mitten im Lauf: der Mensch bricht ab.
          const stop = panel?.q("#wv-abbrechen");
          (stop as { click(): void } | null)?.click();
        }
        return jeAbsatz(VIER_ABSAETZE)(_u, init);
      },
    });
    await pruefe(p);
    // Die Ueberschrift geht gar nicht erst hinaus (unter 40 Zeichen, W6 ruft dafuer nicht). Der
    // ERSTE Abruf gilt dem zweiten Absatz — waehrend seiner Antwort wird abgebrochen, danach
    // nichts mehr. GEGENPROBE ZUM ABBRUCH: ohne Abbruch sind es vier (Fall A1) — die Zahl misst
    // wirklich den Abbruch und nicht die Buehne.
    expect(checkTextRufe(p)).toHaveLength(1);
    expect(p.text("#wv-stand")).toContain("Abgebrochen");
    // Nichts wurde gefaerbt: der einzige fertige Absatz ist die Ueberschrift, und die ist „ohne
    // Farbe" — ein abgebrochener Lauf faerbt also genau das, was er wirklich abgeglichen hat.
    expect(buehne.farben()).toEqual([null, null, null, null, null]);
  });
});

// ================================================================================================
describe("JOB 3281 · (e) im Pruefweg wird NICHTS geschrieben", () => {
  it("E1 · kein insertText, kein insertHtml, kein insertParagraph, kein insertOoxml", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.mitschrift.schreib).toEqual([]);
    // Und die Texte stehen unveraendert da.
    expect(buehne.texte()).toEqual([UEBERSCHRIFT, EXAKT, AEHNLICH, NEU, WIDERSPRUCH]);
  });
});

// ================================================================================================
describe("JOB 3281 · (f) DE und EN tragen dieselbe Aussage", () => {
  it("F1 · nach dem Sprachwechsel steht die englische Fassung, ohne neuen Abruf", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    const vorher = checkTextRufe(p).length;
    p.setLang("en");
    await p.flush();
    expect(p.text("#wv-btn")).toBe("Check document");
    const liste = p.text("#wv-liste");
    expect(liste).toContain("Found verbatim in the knowledge base");
    expect(liste).toContain("Similar — related in content, not verbatim");
    expect(liste).toContain("No match in the searched knowledge base");
    expect(liste).toContain("Contradicts an entry");
    expect(p.text("#wv-stand")).toContain("5 of 5 paragraphs compared");
    // Ein Sprachwechsel ist keine neue Frage an den Server.
    expect(checkTextRufe(p).length).toBe(vorher);
  });

  it("F2 · die Legende nennt je Kategorie die Farbe, die im Dokument wirklich steht", async () => {
    const buehne = dokument();
    const p = starte(buehne);
    await pruefe(p);
    const legende = p.text("#wv-legende");
    expect(legende).toContain("Grün");
    expect(legende).toContain("Gelb");
    expect(legende).toContain("Türkis");
    expect(legende).toContain("Rot");
    // Die vier Namen gehoeren zu genau den vier Word-Farben, die A1 im Dokument gemessen hat.
    expect(buehne.farben()).toEqual([null, "BrightGreen", "Yellow", "Turquoise", "Red"]);
  });
});
