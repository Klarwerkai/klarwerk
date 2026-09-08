// @vitest-environment jsdom
// ================================================================================================
// JOB 3243 · M3c-UI — „HABEN WIR DAS SCHON?" ZEIGT QUELLENFUNDE, GETRENNT VON DUBLETTE UND KONFLIKT.
// ================================================================================================
//
// PEDIS FALL (Auftrag §1): er markiert in Word einen Absatz aus dem importierten BAADER-Dokument
// und fragt „Haben wir das schon?". Das Panel antwortet zusaetzlich mit einem QUELLENFUND — „Diese
// Passage steht im Volltext von ‚<Titel>'" — mit Pruefstand, Fundstelle zum Aufklappen und dem
// Sprung zur Quelle. Ein Quellenfund behauptet NIE fachliche Gleichheit und erscheint deshalb nie
// in der Dublettenliste.
//
// WIE GEMESSEN WIRD: `createKlaraPanel` (tests/app/klara-panel-fixture.ts) baut den AUSGELIEFERTEN
// Rumpf von `apps/web/public/word-addin/taskpane.html` ins jsdom-DOM und fuehrt das vollstaendige
// Inline-Skript aus — kein zweiter Quelltext, keine Attrappe des Panels. Der Server ist ein Fake je
// Pfad; die Antworten tragen genau die Form, die `toSourceHitResponse`/`toResponse` in
// `services/app/src/routes/check-text-routes.ts:366-455` erzeugen.
//
// RED-FIRST: vor dieser Runde kannte das Panel `#quellenfund-block`, `#quellenfund-stand` und
// `#quellenfund-liste` nicht — jeder Fall unten war rot („Panel: Stelle #quellenfund-stand
// existiert nicht"), und `sourceHits` wurde aus der Antwort gar nicht gelesen.
//
// NACHBARSCHAFTSPROBE (Auftrag §5.3, Prüfrest aus JOB 3096 R3, Codex 5b8aa78b): erwartet werden
// hier UNABHAENGIGE Testwerte — die Saetze stehen woertlich im Test, nicht als `p.t("…")`. Ein Test,
// der das Woerterbuch des Produkts gegen sich selbst haelt, ist gruen, auch wenn beide falsch sind.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FakeReplyInit,
  type FakeRoute,
  type FetchCall,
  type KlaraPanel,
  createKlaraPanel,
  reply,
} from "../app/klara-panel-fixture";

// Ein markierter Absatz aus Pedis Dokument — lang genug fuer die Route (≥ 40 Zeichen).
const ABSATZ =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen. Erst danach darf die Schutzhaube geöffnet werden.";

/** Ein Quellenfund, wie ihn `toSourceHitResponse` (check-text-routes.ts:366) liefert. */
function quellenfund(over: Record<string, unknown> = {}) {
  return {
    refId: "ko-77",
    koTitle: "BAADER Betriebsanweisung Presse P2",
    koStatus: "offen",
    koCategory: "Instandhaltung",
    pruefstand: "eingereicht",
    version: 4,
    fundort: {
      kategorie: "Instandhaltung",
      bereich: "Instandhaltung",
      bibliothekPfad: "/wissen/ko-77",
    },
    coverage: "full",
    gedeckteZeichen: 176,
    passageZeichen: 176,
    fundstelle:
      "… im Abschnitt 4.2: Vor jeder Wartung an der Presse P2 ist der Hauptschalter " +
      "abzuschließen und der Druck im Hydrauliksystem vollständig abzubauen. …",
    quelle: { label: "Betriebsanweisung BA-P2", url: null },
    anhang: null,
    ...over,
  };
}

/** Ein Dublettentreffer (JOB 3093, `fundort-im-server.test.ts` F1) — die ANDERE Aussage. */
function dublette(over: Record<string, unknown> = {}) {
  return {
    koId: "ko-1",
    koTitle: "Wartungsregel Presse P2",
    relation: "identisch",
    confidence: null,
    method: "deterministic",
    rationale: null,
    koStatus: "validiert",
    koCategory: "Instandhaltung",
    pruefstand: "validiert",
    version: 9,
    fundort: {
      kategorie: "Instandhaltung",
      bereich: "Instandhaltung",
      bibliothekPfad: "/wissen/ko-1",
    },
    ...over,
  };
}

/**
 * Der volle Antwortkoerper der Route. `quellenfund` ist die LAGE (gelaufen/Grund/Anzahl), die
 * `sourceHits` erst zu einer Aussage macht — `undefined` laesst das Feld ganz weg (Alt-Antwort).
 */
function antwort(opt: {
  duplicates?: unknown[];
  sourceHits?: unknown[];
  sourceHitsTruncated?: boolean;
  gelaufen?: boolean | undefined;
  grund?: string | null;
  geprueft?: number;
}) {
  const koerper: Record<string, unknown> = {
    duplicates: opt.duplicates ?? [],
    conflicts: [],
    konfliktpruefung: { gelaufen: false, grund: "nicht_angefordert", geprueft: 0 },
    answer: null,
    note: null,
    persisted: false,
  };
  if (opt.sourceHits !== undefined) {
    koerper.sourceHits = opt.sourceHits;
  }
  if (opt.sourceHitsTruncated !== undefined) {
    koerper.sourceHitsTruncated = opt.sourceHitsTruncated;
  }
  if (opt.gelaufen !== undefined) {
    koerper.quellenfund = {
      gelaufen: opt.gelaufen,
      grund: opt.grund ?? null,
      geprueft: opt.geprueft ?? 0,
    };
  }
  return koerper;
}

let panel: KlaraPanel | null = null;
let abKlick = 0;

function starte(routen: Record<string, FakeReplyInit | FakeRoute>): KlaraPanel {
  panel = createKlaraPanel({ selectionText: ABSATZ, routes: routen });
  return panel;
}

async function fragen(p: KlaraPanel): Promise<void> {
  await p.flush();
  const knopf = p.q("#bestand-btn");
  expect(knopf, "der Knopf „Haben wir das schon?“ fehlt").not.toBeNull();
  abKlick = p.calls.length;
  (knopf as { click(): void }).click();
  await p.flush();
}

function checkTextRufe(p: KlaraPanel): FetchCall[] {
  return p.calls.slice(abKlick).filter((c) => c.url === "/api/check-text");
}

/** Die Elementmarke — die schmalen Fixture-Typen führen `tagName` nicht (keine DOM-lib im Gate-tsc). */
function marke(el: unknown): string {
  return String((el as { tagName?: string } | null)?.tagName ?? "").toLowerCase();
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

describe("JOB 3243 · M3c-UI · der Quellenfund im ausgelieferten Aufgabenfenster", () => {
  it("Q1 · in der RUHE steht der Bereich nicht im Bild — kein Zeichen, solange nichts durchsucht wurde", async () => {
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [quellenfund()], gelaufen: true })),
    });
    await p.flush();
    // Der Textmesser-Vertrag K2/K1 haengt daran: was verborgen ist, zaehlt nicht — was sichtbar
    // ist, zaehlt. Vor der ersten Frage gibt es keinen Lauf und deshalb keine Aussage.
    expect(p.q("#quellenfund-block")?.className.includes("hidden")).toBe(true);
    expect(p.text("#quellenfund-stand")).toBe("");
    expect(p.text("#quellenfund-liste")).toBe("");
  });

  it("Q2 · (a) coverage full → eigener Bereich mit Satz, Prüfstand, Fundstelle und dem Weg zur Quelle — NICHT in der Dublettenliste", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({ duplicates: [dublette()], sourceHits: [quellenfund()], gelaufen: true }),
      ),
    });
    await fragen(p);

    expect(p.q("#quellenfund-block")?.className.includes("hidden")).toBe(false);
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund im Volltext (1):");
    const fund = p.text("#quellenfund-liste");
    expect(fund).toContain(
      "Diese Passage steht im Volltext von „BAADER Betriebsanweisung Presse P2“.",
    );
    expect(fund).toContain("noch nicht geprüft");
    expect(fund).toContain("Fundstelle");
    expect(fund).toContain("im Abschnitt 4.2");
    // EIN Wortlaut für denselben Sprung: die Bestandsliste und der Quellenfund führen mit
    // demselben Satz in die Bibliothek (Runde 2 — vorher zwei Schlüssel für eine Sache).
    expect(fund).toContain("In der Bibliothek öffnen");
    // `coverage: full` sagt der Satz darüber schon; ein zweites Wort dafür wäre Füllung.
    expect(fund).not.toContain("Teilübereinstimmung");

    // DIE TRENNUNG — der Kern des Auftrags: die Dublettenliste traegt den Dublettentreffer und
    // NICHTS aus dem Quellenfund; der Quellenfund traegt nie das Wort „Dublette".
    const dubletten = p.text("#bestand-liste");
    expect(dubletten).toContain("Wartungsregel Presse P2");
    expect(dubletten).not.toContain("BAADER Betriebsanweisung Presse P2");
    expect(dubletten).not.toContain("Fundstelle");
    expect(fund).not.toContain("Wartungsregel Presse P2");
    expect(fund.toLowerCase()).not.toContain("dublette");
    expect(fund.toLowerCase()).not.toContain("konflikt");

    // Der Sprung zur Quelle: derselbe Weg wie in der Bestandsliste — eigener Ursprung, neues
    // Fenster ohne Opener.
    const link = p.q("#quellenfund-liste a");
    expect(link, "der Weg zur Quelle fehlt").not.toBeNull();
    expect(link?.href.endsWith("/wissen/ko-77")).toBe(true);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("Q3 · ein validierter Fund trägt „Validiert“; ein offener Prüfstand bleibt sichtbar und wird nie zu Grün", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({
          sourceHits: [
            quellenfund({ koStatus: "validiert", pruefstand: "validiert", refId: "ko-9" }),
            quellenfund({ refId: "ko-10", koTitle: "Entwurfsnahe Notiz", pruefstand: null }),
          ],
          gelaufen: true,
        }),
      ),
    });
    await fragen(p);
    const fund = p.text("#quellenfund-liste");
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund im Volltext (2):");
    expect(fund).toContain("Validiert");
    // Ein Prüfstand, den die Route nicht liefert, heisst ehrlich „Status unbekannt" —
    // kein Platzhalter, kein stilles Hochstufen.
    expect(fund).toContain("Status unbekannt");
    expect(fund).not.toContain("noch nicht geprüft");
  });

  it("Q4 · (b) coverage partial → „Teilübereinstimmung (n von m Zeichen)“ mit den Zahlen der Route", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({
          sourceHits: [
            quellenfund({ coverage: "partial", gedeckteZeichen: 62, passageZeichen: 176 }),
          ],
          gelaufen: true,
        }),
      ),
    });
    await fragen(p);
    const fund = p.text("#quellenfund-liste");
    expect(fund).toContain("Teilübereinstimmung (62 von 176 Zeichen)");
  });

  it("Q5 · (c) sourceHitsTruncated → der Hinweis steht da — auch bei LEEREM Ergebnis, denn dann gilt „kein Fund“ nur für das Durchsuchte", async () => {
    const mitTreffer = starte({
      "/api/check-text": reply(
        200,
        antwort({ sourceHits: [quellenfund()], sourceHitsTruncated: true, gelaufen: true }),
      ),
    });
    await fragen(mitTreffer);
    expect(mitTreffer.text("#quellenfund-stand")).toBe(
      "Quellenfund im Volltext (1): Nicht vollständig durchsucht — mehr Kandidaten als durchsucht.",
    );
    mitTreffer.restore();

    panel = createKlaraPanel({
      selectionText: ABSATZ,
      routes: {
        "/api/check-text": reply(
          200,
          antwort({ sourceHits: [], sourceHitsTruncated: true, gelaufen: true }),
        ),
      },
    });
    await fragen(panel);
    expect(panel.text("#quellenfund-stand")).toBe(
      "Kein Quellenfund im durchsuchten Bestand. Nicht vollständig durchsucht — mehr Kandidaten als durchsucht.",
    );
  });

  it("Q6 · (d1) leeres Array MIT gelaufen:true → „Kein Quellenfund im durchsuchten Bestand.“", async () => {
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [], gelaufen: true, geprueft: 12 })),
    });
    await fragen(p);
    expect(p.q("#quellenfund-block")?.className.includes("hidden")).toBe(false);
    expect(p.text("#quellenfund-stand")).toBe("Kein Quellenfund im durchsuchten Bestand.");
    expect(p.text("#quellenfund-liste")).toBe("");
    // Ohne Treffer klappt nichts auf: `data-leer` blendet den Aufklapp-Griff per Stilregel aus —
    // kein Dreieck, das auf einen leeren Inhalt zeigt.
    expect(p.q("#quellenfund-block")?.getAttribute("data-leer")).toBe("");
  });

  it("Q7 · (d2) leeres Array MIT gelaufen:false → „Quellenfund nicht durchsucht.“ — dieselbe Arrayform, die andere Aussage", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({ sourceHits: [], gelaufen: false, grund: "passage_zu_kurz" }),
      ),
    });
    await fragen(p);
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund nicht durchsucht.");
    expect(p.text("#quellenfund-stand")).not.toContain("Kein Quellenfund im durchsuchten Bestand");
  });

  it("Q8 · (e) das Feld fehlt ganz (Alt-Antwort) → „Quellenfund nicht durchsucht.“, niemals eine durchsuchte Abwesenheit", async () => {
    const p = starte({ "/api/check-text": reply(200, antwort({ duplicates: [dublette()] })) });
    await fragen(p);
    // Die Dublettenanzeige bleibt unveraendert — der Quellenfund sagt getrennt davon „nicht gelaufen".
    expect(p.text("#bestand-liste")).toContain("Wartungsregel Presse P2");
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund nicht durchsucht.");
    expect(p.text("#quellenfund-liste")).toBe("");
  });

  // ================================================================================================
  // RUNDE 3 (BEN, Korrekturpflicht 1) — DIE LAGE ALLEIN REICHT NICHT: DIE LISTE MUSS AUCH DA SEIN.
  // ================================================================================================
  //
  // BENs Befund an Runde 2: `w6Quellenfundlage` ersetzte ein fehlendes oder falsch typisiertes
  // `sourceHits` durch `[]` und gab es mit `gelaufen: true` als DURCHSUCHTE Abwesenheit aus — „Kein
  // Quellenfund im durchsuchten Bestand." über einer Liste, die der Server nie geliefert hat. Q8
  // deckte das nicht ab: dort fehlten Lage UND Liste gemeinsam, hier fehlt nur die Liste.
  //
  // DIE REGEL SEITHER: eine durchsuchte Abwesenheit braucht BEIDES — `gelaufen === true` UND ein
  // wirklich geliefertes Array. Alles andere ist „nicht durchsucht". Die drei Fälle unten decken
  // die drei Formen ab, in denen die Liste fehlen kann.
  it.each([
    ["das Feld fehlt", undefined],
    ["das Feld ist null", null],
    ["das Feld ist kein Array", { 0: "kein Array" }],
    ["das Feld ist eine Zeichenkette", "[]"],
  ])(
    "Q9a · gelaufen:true, aber %s → „Quellenfund nicht durchsucht.“ — nie eine durchsuchte Abwesenheit",
    async (_name, wert) => {
      const koerper = antwort({ gelaufen: true, geprueft: 7 }) as Record<string, unknown>;
      // `antwort` lässt `sourceHits` bei `undefined` bewusst ganz weg — genau der erste Fall.
      if (wert !== undefined) {
        koerper.sourceHits = wert;
      }
      const p = starte({ "/api/check-text": reply(200, koerper) });
      await fragen(p);
      expect(p.text("#quellenfund-stand")).toBe("Quellenfund nicht durchsucht.");
      expect(p.text("#quellenfund-stand")).not.toContain("Kein Quellenfund");
      expect(p.text("#quellenfund-liste")).toBe("");
    },
  );

  it("Q9b · KALIBRIERUNG zu Q9a: dieselbe Lage MIT geliefertem leerem Array bleibt „kein Quellenfund“", async () => {
    // Ohne diesen Fall wäre Q9a auch dann grün, wenn die Fläche NIE mehr „kein Quellenfund" sagte —
    // die Verschärfung darf die durchsuchte Abwesenheit nicht mit abräumen.
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [], gelaufen: true, geprueft: 7 })),
    });
    await fragen(p);
    expect(p.text("#quellenfund-stand")).toBe("Kein Quellenfund im durchsuchten Bestand.");
  });

  it("Q9 · ein Körper, der „nicht gelaufen“ sagt und trotzdem Funde mitliefert, zeigt KEINE Funde", async () => {
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [quellenfund()], gelaufen: false })),
    });
    await fragen(p);
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund nicht durchsucht.");
    expect(p.text("#quellenfund-liste")).toBe("");
  });

  it("Q10 · ein Fund ohne Kennung macht die Liste unauswertbar → „nicht durchsucht“, nie „kein Fund“", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({
          sourceHits: [quellenfund(), quellenfund({ refId: 42 })],
          gelaufen: true,
        }),
      ),
    });
    await fragen(p);
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund nicht durchsucht.");
    expect(p.text("#quellenfund-liste")).toBe("");
  });

  it("Q11 · ohne Ausschnitt steht kein leerer Aufklapp-Griff, ohne Fundort kein Weg zur Quelle", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({
          sourceHits: [
            quellenfund({
              fundstelle: "",
              fundort: { kategorie: null, bereich: null, bibliothekPfad: "" },
            }),
          ],
          gelaufen: true,
        }),
      ),
    });
    await fragen(p);
    const fund = p.text("#quellenfund-liste");
    expect(fund).toContain("Diese Passage steht im Volltext von");
    expect(fund).not.toContain("Fundstelle");
    expect(fund).not.toContain("In der Bibliothek öffnen");
    expect(p.q("#quellenfund-liste a")).toBeNull();
  });

  it("Q12 · der Bereich ist einklappbar — nativ, und die Lagezeile bleibt IMMER stehen", async () => {
    // RUNDE 2: der eigene Schalter ist entfallen. Der Kasten IST ein <details>, seine Lagezeile das
    // <summary> — deshalb bleibt sie auch zugeklappt lesbar, ohne eigenen Zustand, ohne zweiten
    // Wortlaut und ohne die zwei Wörterbuchschlüssel, die der Zeilendeckel des Inline-Skripts
    // (tests/klara-zerlegung/schnittflaechen.test.ts B3) nicht mehr hergab.
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [quellenfund()], gelaufen: true })),
    });
    await fragen(p);
    const kasten = p.q("#quellenfund-block");
    expect(kasten, "der Quellenfund-Kasten fehlt").not.toBeNull();
    expect(marke(kasten)).toBe("details");
    expect(kasten?.getAttribute("open")).not.toBeNull();
    expect(marke(p.q("#quellenfund-stand"))).toBe("summary");
    // Mit Treffern gibt es etwas aufzuklappen — der Griff bleibt sichtbar.
    expect(kasten?.getAttribute("data-leer")).toBeNull();
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund im Volltext (1):");
    expect(p.text("#quellenfund-liste")).toContain("BAADER Betriebsanweisung Presse P2");

    // RUNDE 3 (BENs Prüflücke 6): WIRKLICH zuklappen und wieder auf. Die Lagezeile ist ein Kind von
    // <details> und wandert dabei NICHT mit — sie steht in beiden Ständen unverändert da. Die
    // Trefferliste ist ein Geschwister der Lagezeile, also genau das, was der Deckel verbirgt.
    // GRENZE, ausdrücklich: jsdom rechnet kein Layout, also misst dieser Fall die STRUKTUR und den
    // Klappzustand, nicht die Sichtbarkeit in Pixeln — die bleibt Chromium vorbehalten (REST).
    const zu = kasten as unknown as { open: boolean; contains(k: unknown): boolean };
    zu.open = false;
    expect(kasten?.getAttribute("open")).toBeNull();
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund im Volltext (1):");
    expect(zu.contains(p.q("#quellenfund-stand")), "die Lagezeile hängt nicht am Kasten").toBe(
      true,
    );
    expect(zu.contains(p.q("#quellenfund-liste")), "die Liste steckt nicht im Kasten").toBe(true);
    zu.open = true;
    expect(kasten?.getAttribute("open")).not.toBeNull();
    expect(p.text("#quellenfund-liste")).toContain("BAADER Betriebsanweisung Presse P2");
  });

  it("Q13 · (g) DE/EN: derselbe Stand, die Sprache des Fensters — Satz, Prüfstand, Deckung, Griffe", async () => {
    const p = starte({
      "/api/check-text": reply(
        200,
        antwort({
          sourceHits: [
            quellenfund({ coverage: "partial", gedeckteZeichen: 62, passageZeichen: 176 }),
          ],
          sourceHitsTruncated: true,
          gelaufen: true,
        }),
      ),
    });
    await fragen(p);
    expect(p.text("#quellenfund-stand")).toBe(
      "Quellenfund im Volltext (1): Nicht vollständig durchsucht — mehr Kandidaten als durchsucht.",
    );
    p.setLang("en");
    expect(p.text("#quellenfund-stand")).toBe(
      "Source hit in the full text (1): Not searched completely — more candidates than searched.",
    );
    const fund = p.text("#quellenfund-liste");
    expect(fund).toContain(
      "This passage is in the full text of “BAADER Betriebsanweisung Presse P2”.",
    );
    expect(fund).toContain("not yet reviewed");
    expect(fund).toContain("Partial match (62 of 176 characters)");
    expect(fund).toContain("Location");
    expect(fund).toContain("Open in the library");
    expect(fund).not.toContain("Teilübereinstimmung");
    p.setLang("de");
    expect(p.text("#quellenfund-liste")).toContain("Teilübereinstimmung (62 von 176 Zeichen)");
  });

  it("Q14 · scheitert eine ERNEUTE Prüfung, bleibt der Quellenfund sichtbar — datiert über die Standzeile, nie geleert", async () => {
    let serverLage: FakeReplyInit = reply(
      200,
      antwort({ sourceHits: [quellenfund()], gelaufen: true }),
    );
    const p = starte({ "/api/check-text": (): FakeReplyInit => serverLage });
    await fragen(p);
    expect(p.text("#quellenfund-liste")).toContain("BAADER Betriebsanweisung Presse P2");

    serverLage = reply(503, {});
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(p.text("#quellenfund-liste")).toContain("BAADER Betriebsanweisung Presse P2");
    expect(p.text("#quellenfund-stand")).toBe("Quellenfund im Volltext (1):");
    expect(p.text("#bestand-stand")).toContain("Prüfung nicht möglich");
  });
});

// ================================================================================================
// NACHBARSCHAFTSPROBEN (Auftrag §5.3) — die Prüfreste aus JOB 3096 R3, hier am Quellenfund.
// ================================================================================================
describe("JOB 3243 · M3c-UI · Sitzung, Laufnummer und der Rumpf, der wirklich abgeht", () => {
  const A = { id: "u-a", name: "Anna" };

  function sitzungsServer() {
    const lage = {
      nutzer: A as { id: string; name: string } | null,
      logout: reply(204),
      pruefung: reply(200, antwort({ sourceHits: [quellenfund()], gelaufen: true })),
    };
    const routen: Record<string, FakeRoute> = {
      "/api/auth/me": () => (lage.nutzer ? reply(200, lage.nutzer) : reply(401)),
      "/api/auth/logout": () => lage.logout,
      "/api/check-text": () => lage.pruefung,
    };
    return { lage, routen };
  }

  it("Q15 · (f) eine VERSPÄTETE Antwort nach dem Logout belebt keinen Quellenfund wieder (Laufnummer)", async () => {
    const { lage, routen } = sitzungsServer();
    const p = starte(routen);
    await p.flush();
    const fenster = globalThis as unknown as {
      window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    };
    const echt = fenster.window.fetch;
    let spaet: (() => void) | null = null;
    fenster.window.fetch = (url, init) =>
      url === "/api/check-text"
        ? new Promise((aufloesen) => {
            spaet = () => aufloesen(echt(url, init));
          })
        : echt(url, init);
    (p.q("#bestand-btn") as { click(): void }).click();
    await p.flush();
    expect(spaet, "die Prüfung von A ist nicht unterwegs").not.toBeNull();

    // Bestaetigter Logout, waehrend die Antwort noch aussteht.
    lage.nutzer = null;
    (p.q("#logout-btn") as { click(): void }).click();
    await p.flush();
    expect(p.q("#quellenfund-block")?.className.includes("hidden")).toBe(true);

    // Jetzt kommt die Antwort von A — zu spaet: nichts erscheint.
    (spaet as unknown as () => void)();
    await p.flush();
    expect(p.text("#quellenfund-stand")).toBe("");
    expect(p.text("#quellenfund-liste")).toBe("");
    fenster.window.fetch = echt;
  });

  it("Q16 · Lieferung 6: der Rumpf trägt den Marker `nichtEingestuft` — die Einstufung wird nicht behauptet, sondern ihr FEHLEN gemeldet", async () => {
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [], gelaufen: true })),
    });
    await fragen(p);
    const rufe = checkTextRufe(p);
    expect(rufe).toHaveLength(1);
    const koerper = JSON.parse(String(rufe[0]?.body)) as Record<string, unknown>;
    expect(koerper.nichtEingestuft).toBe(true);
    // Was der Weg NICHT tut: eine Stufe behaupten oder den Modellweg oeffnen. Beides bleibt
    // Sache des Servers bzw. eines anderen Auftrags.
    expect(koerper.confidentiality).toBeUndefined();
    expect(koerper.want).toBeUndefined();
    expect(koerper.source).toBe("transient-document");
    expect(koerper.text).toBe(ABSATZ);
  });

  it("Q17 · Lieferung 6: OHNE vollständige Klara-Bindung reisen keine Bindungs-Kopfzeilen mit", async () => {
    // Ohne aufgeloeste Klara-Sitzung bleiben Sitzungs- und Dokument-Id leer. Eine HALBE Bindung
    // (nur die Instanz-Id, die es seit dem Laden gibt) traegt keine Zustimmung — sie bliebe am
    // Server fail-closed und taeuschte nur vor, dieses Fenster sei an ein Dokument gebunden.
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [], gelaufen: true })),
      "/api/klara/": reply(503, {}),
    });
    const kopfzeilen = kopfmitschrift();
    await fragen(p);
    const kopf = letzterPruefkopf(p, kopfzeilen);
    expect(kopf["x-klara-session"]).toBeUndefined();
    expect(kopf["x-klara-instance"]).toBeUndefined();
    expect(kopf["x-klara-document"]).toBeUndefined();
    expect(kopf["content-type"]).toBe("application/json");
  });

  it("Q18 · Lieferung 6: MIT vollständiger Klara-Bindung reisen genau die drei Kopfzeilen des Serververtrags mit", async () => {
    const sicht = {
      sessionId: "sess-42",
      documentContextId: "doc-42",
      resolution: { expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
    };
    const p = starte({
      "/api/check-text": reply(200, antwort({ sourceHits: [], gelaufen: true })),
      "/api/klara/sessions": reply(200, sicht),
      "/api/klara/ai-status": reply(200, sicht.resolution),
    });
    await p.flush();
    const kopfzeilen = kopfmitschrift();
    await fragen(p);
    const kopf = letzterPruefkopf(p, kopfzeilen);
    expect(kopf["x-klara-session"]).toBe("sess-42");
    expect(kopf["x-klara-document"]).toBe("doc-42");
    // Die Instanz-Id ist opak und wird je Laden neu gewuerfelt — geprueft wird ihre FORM.
    expect(String(kopf["x-klara-instance"])).toMatch(/^inst-[0-9a-f]{32}$/);
  });
});

interface Mitschrift {
  kopfzeilen: Record<string, unknown>[];
  loesen(): void;
}

/**
 * Die Fixture schreibt Ziel, Methode und Rumpf jedes Abrufs mit, nicht aber die KOPFZEILEN — und
 * genau die traegt Lieferung 6. Deshalb wird `window.fetch` fuer diese zwei Faelle umschlossen;
 * dieselbe Technik, mit der JOB 3093 F13/F16 einen haengenden Abruf nachstellt.
 */
function kopfmitschrift(): Mitschrift {
  const fenster = globalThis as unknown as {
    window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
  };
  const echt = fenster.window.fetch;
  const kopfzeilen: Record<string, unknown>[] = [];
  fenster.window.fetch = (url, init) => {
    if (url === "/api/check-text") {
      const kopf = init?.headers;
      kopfzeilen.push(
        kopf !== null && typeof kopf === "object" ? (kopf as Record<string, unknown>) : {},
      );
    }
    return echt(url, init);
  };
  return {
    kopfzeilen,
    loesen(): void {
      fenster.window.fetch = echt;
    },
  };
}

function letzterPruefkopf(p: KlaraPanel, m: Mitschrift): Record<string, unknown> {
  m.loesen();
  expect(checkTextRufe(p).length, "kein Prüfruf abgesetzt").toBeGreaterThan(0);
  expect(m.kopfzeilen.length, "keine Kopfzeilen mitgeschrieben").toBeGreaterThan(0);
  return m.kopfzeilen[m.kopfzeilen.length - 1] as Record<string, unknown>;
}
