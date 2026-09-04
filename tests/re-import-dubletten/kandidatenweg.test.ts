// ================================================================================================
// JOB 3050 — AUCH DIE REVIEW-WARTESCHLANGE PRUEFT AUF DUBLETTEN, STATT ZEICHEN ZU VERGLEICHEN.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (HEAD e296c75, `service.ts:284/300`):
// `createImportCandidates` baute `const seen = new Set(existing.map(ko => `${ko.title}|${ko.statement}`))`
// und entschied `duplicate = seen.has(`${item.title}|${item.statement}`)`. JOB 3023 hat genau diesen
// Vergleich am DIREKTEN Weg (`importJson`) abgeschafft, den Kandidatenweg aber ausdruecklich
// ausgenommen (LEHREN.md, JOB 3023 R3).
//
// WARUM DAS MEHR IST ALS KOSMETIK: `duplicate` ist keine Anzeige, sondern eine ENTSCHEIDUNG. Der
// `accept`-Zweig legt bei einer Dublette KEIN Wissensobjekt an (`service.ts`, reviewImportCandidate).
// Ein falsches `false` erzeugt also wirklich die zweite Karteikarte — nur eine Reviewrunde spaeter
// als beim direkten Weg.
//
// WARUM DIESE DATEI DIE GANZE APP MONTIERT UND KEINEN DIENST (K1/K2/K3/K5): die Regel reist als PORT
// in den Dienst und wird in der Kompositionswurzel (`library-routes.ts`) aus `coreText` +
// `trigramSimilarity` gebaut. Ein Diensttest mit selbstgebauter Pruefung wuerde genau die Naht
// ueberspringen, um die es geht — er waere gruen, waehrend die Route weiter Zeichen vergleicht.
//
// WARUM K4/K6/K7/K9 AM DIENST HAENGEN, und das ist dieselbe Begruendung wie in
// `pruefung-faellt-aus.test.ts` (JOB 3023): einen AUSGEFALLENEN Port, einen FEHLENDEN Port, den
// aktiven externalId-Upsert-Strang und einen nie treffenden Prueflauf kann die Kompositionswurzel
// nicht herstellen — sie verdrahtet die funktionierende Regel und den Standard-Strang. Der Vertrag,
// der dort gemessen wird, gehoert dem Dienst: er nimmt den Port entgegen und entscheidet, was bei
// dessen Ausfall oder Fehlen geschieht.
//
// WER DEN PORT UEBERGEBEN MUSS, haelt der Waechter `port-aufrufer-waechter.test.ts` daneben fest:
// jeder Aufruf im Nicht-Test-Baum ohne Port ist rot, ausser den zwei namentlich registrierten
// Anker-/Re-Sync-Wegen. K9 misst, dass ein portloser Aufruf nichts still durchlaesst.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type {
  DublettenBefund,
  DublettenPruefung,
  ImportItem,
  KandidatDublettenbefund,
} from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "kandidatenweg@x.de", password: "secret123" };

/** Die Kandidaten-Antwort der Route, so weit dieser Test sie liest. */
interface KandidatDto {
  id: string;
  item: { title: string };
  duplicate: boolean;
  koId: string | null;
  status: string;
  dublettenbefund?: KandidatDublettenbefund;
}

// Die Aussagen enden BEWUSST ohne Schlusszeichen — die Sicherung haengt den Punkt dann wirklich
// NEU an (Korrekturpflicht aus JOB 3023 R1: eine „Satzzeichenaenderung", die das Satzzeichen
// hinterher unveraendert laesst, prueft nichts). K0 misst diese Voraussetzung, statt sie zu glauben.
const BESTANDS_KO = {
  title: "Ventil entlueften",
  statement: "Bei Ueberdruck das Ventil X langsam entlueften",
  type: "best_practice" as const,
  category: "Wartung",
};

/**
 * Ein VOLLSTAENDIG gepflegtes Wissensobjekt — mit Bedingungen und Massnahmen (K2).
 * Eine Sicherung traegt davon nichts; genau hier ist am meisten zu verlieren.
 */
const REICHES_KO = {
  title: "Rueckschlagklappe pruefen",
  statement: "Die Rueckschlagklappe vor jedem Anlauf auf Dichtheit pruefen",
  type: "best_practice" as const,
  category: "Wartung",
  conditions: [
    "Anlage steht still und ist drucklos",
    "Absperrschieber vor der Klappe ist geschlossen",
    "Freigabe des Schichtleiters liegt vor",
  ],
  measures: [
    "Klappe ausbauen und Sitzflaeche sichtpruefen",
    "Dichtung bei Riefen ersetzen",
    "Befund im Betriebsbuch vermerken",
  ],
};

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

type App = Awaited<ReturnType<typeof angemeldeteApp>>["app"];
type Headers = Record<string, string>;

async function legeKoAn(
  app: App,
  headers: Headers,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function reiheEin(app: App, headers: Headers, items: unknown[]): Promise<KandidatDto[]> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as KandidatDto[];
}

async function koTitel(app: App, headers: Headers): Promise<string[]> {
  const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(liste.statusCode, liste.body).toBe(200);
  return (liste.json() as { title: string }[]).map((ko) => ko.title).sort();
}

/** Die veraenderte Sicherung: Schlusszeichen NEU dran, Grossschreibung anders. */
function leichtVeraendert(eintrag: { title: string; statement: string }) {
  return { title: eintrag.title.toUpperCase(), statement: `${eintrag.statement}.` };
}

describe("JOB 3050 · K — der Kandidatenweg bekommt dieselbe Dublettenregel", () => {
  it("K0 · die Voraussetzung von K1: die Sicherung aendert Schlusszeichen UND Schreibweise wirklich", () => {
    const veraendert = leichtVeraendert(BESTANDS_KO);
    expect(
      BESTANDS_KO.statement.endsWith("."),
      "Die Bestandsaussage endet OHNE Schlusszeichen.",
    ).toBe(false);
    expect(veraendert.statement.endsWith("."), "Die Sicherung haengt einen Punkt NEU an.").toBe(
      true,
    );
    expect(veraendert.title).not.toBe(BESTANDS_KO.title);
    // Und die Aenderung ist WIRKLICH nur Schreibweise/Satzzeichen — kein anderer Wortlaut.
    const ohneZierrat = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    expect(ohneZierrat(veraendert.statement)).toBe(ohneZierrat(BESTANDS_KO.statement));
    expect(ohneZierrat(veraendert.title)).toBe(ohneZierrat(BESTANDS_KO.title));
  });

  // ==============================================================================================
  // K1 — DER TRAGENDE FALL.
  // ==============================================================================================
  //
  // Heute (vor JOB 3050): `duplicate: false`, der Kandidat geht als „neu" in die Warteschlange und
  // ein `accept` legt die zweite Karteikarte an. Nachher: Dublette, MIT getroffenem Wissensobjekt
  // und Aehnlichkeitswert — und der `accept` legt nichts an.
  it("K1 · ein zusaetzlicher Satzpunkt ist eine Dublette, mit koId und Aehnlichkeitswert", async () => {
    const { app, headers } = await angemeldeteApp();
    const koId = await legeKoAn(app, headers, BESTANDS_KO);

    const [kandidat] = await reiheEin(app, headers, [
      { ...BESTANDS_KO, ...leichtVeraendert(BESTANDS_KO) },
    ]);

    expect(
      kandidat?.duplicate,
      "Ein Satzpunkt darf keine zweite Karteikarte in die Warteschlange stellen.",
    ).toBe(true);
    const befund = kandidat?.dublettenbefund;
    expect(befund?.ergebnis, "Der Treffer kam aus Pass 2 (Aehnlichkeit), nicht aus Pass 1.").toBe(
      "aehnlich",
    );
    if (befund?.ergebnis !== "aehnlich") {
      throw new Error("Vorbedingung verletzt: kein Aehnlichkeitsbefund.");
    }
    expect(
      befund.treffer,
      "Die Auskunft muss sagen, AUF WELCHES Wissensobjekt der Eintrag getroffen ist.",
    ).toEqual({ art: "wissensobjekt", koId });
    expect(befund.aehnlichkeit).toBeGreaterThanOrEqual(0.85);
    expect(befund.aehnlichkeit).toBeLessThanOrEqual(1);

    // Die NUTZENKETTE bis zum Ende: der Review-Accept legt kein zweites Wissensobjekt an.
    const review = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(review.statusCode, review.body).toBe(200);
    expect((review.json() as KandidatDto).koId, "Kein neues Wissensobjekt.").toBeNull();
    expect(await koTitel(app, headers)).toEqual(["Ventil entlueften"]);
  });

  // K2 — der Fall, an dem JOB 3023 in Runde 1 gescheitert ist (asymmetrische Feldbasis).
  it("K2 · ein Bestandsobjekt MIT Bedingungen und Massnahmen wird ebenfalls getroffen", async () => {
    const { app, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: REICHES_KO,
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = angelegt.json().id as string;
    // Die Voraussetzung wird gemessen, nicht behauptet.
    expect(angelegt.json().conditions, "Der Bestand traegt drei Bedingungen.").toHaveLength(3);
    expect(angelegt.json().measures, "Der Bestand traegt drei Massnahmen.").toHaveLength(3);

    const [kandidat] = await reiheEin(app, headers, [
      {
        title: REICHES_KO.title.toUpperCase(),
        statement: `${REICHES_KO.statement}.`,
        type: REICHES_KO.type,
        category: REICHES_KO.category,
      },
    ]);

    expect(
      kandidat?.duplicate,
      "Ein gepflegtes Objekt darf durch seine eigene Sicherung nicht verdoppelt werden.",
    ).toBe(true);
    const befund = kandidat?.dublettenbefund;
    if (befund?.ergebnis !== "aehnlich") {
      throw new Error(`Erwartet 'aehnlich', erhalten: ${JSON.stringify(befund)}`);
    }
    expect(befund.treffer).toEqual({ art: "wissensobjekt", koId });
    expect(befund.aehnlichkeit).toBeGreaterThanOrEqual(0.85);
  });

  it("K2b · die woertlich gleiche Sicherung heisst `identisch` und nennt das Objekt (Pass 1)", async () => {
    const { app, headers } = await angemeldeteApp();
    const koId = await legeKoAn(app, headers, BESTANDS_KO);

    const [kandidat] = await reiheEin(app, headers, [BESTANDS_KO]);

    expect(kandidat?.duplicate).toBe(true);
    expect(kandidat?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId },
    });
  });

  // ==============================================================================================
  // K3 — DIE GEGENPROBE. Ohne sie waere „alles als Dublette markieren" gruen.
  // ==============================================================================================
  it("K3 · ein fachlich anderer Eintrag bleibt neu, und `accept` legt das Wissensobjekt an", async () => {
    const { app, headers } = await angemeldeteApp();
    await legeKoAn(app, headers, BESTANDS_KO);

    const [kandidat] = await reiheEin(app, headers, [
      {
        title: "Notstromaggregat monatlich probelaufen lassen",
        statement:
          "Das Notstromaggregat einmal im Monat fuenfzehn Minuten unter Last laufen lassen und das Ergebnis im Betriebsbuch vermerken.",
        type: "best_practice",
        category: "Betrieb",
      },
    ]);

    expect(kandidat?.duplicate, "Der fachlich neue Eintrag MUSS als neu durchgehen.").toBe(false);
    expect(kandidat?.dublettenbefund).toEqual({ ergebnis: "keine" });

    const review = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(review.statusCode, review.body).toBe(200);
    expect(
      (review.json() as KandidatDto).koId,
      "Der Accept eines echt neuen Kandidaten erzeugt ein Wissensobjekt.",
    ).toEqual(expect.any(String));
    expect(await koTitel(app, headers)).toEqual([
      "Notstromaggregat monatlich probelaufen lassen",
      "Ventil entlueften",
    ]);
  });

  // ==============================================================================================
  // K5 — GEGEN DEN EIGENEN LAUF: dieselbe Sache zweimal in EINER Sicherung.
  // ==============================================================================================
  //
  // Der Treffer ist ein KANDIDAT desselben Laufs und noch kein Wissensobjekt. Die Auskunft nennt
  // darum den Kandidaten und KEINE koId — eine koId waere hier ein Verweis auf etwas, das es
  // (noch) nicht gibt.
  it("K5 · zweimal dieselbe Sache in EINER Sicherung → der zweite Eintrag ist Dublette", async () => {
    const { app, headers } = await angemeldeteApp();

    const kandidaten = await reiheEin(app, headers, [
      {
        title: "Filter wechseln",
        statement: "Den Filter der Anlage 3 jaehrlich wechseln",
        type: "best_practice",
        category: "Wartung",
      },
      {
        title: "FILTER WECHSELN",
        statement: "Den Filter der Anlage 3 jaehrlich wechseln!",
        type: "best_practice",
        category: "Wartung",
      },
    ]);

    expect(kandidaten).toHaveLength(2);
    expect(kandidaten[0]?.duplicate, "Der erste Eintrag ist keine Dublette.").toBe(false);
    expect(kandidaten[1]?.duplicate, "Der zweite Eintrag ist die Dublette des ersten.").toBe(true);
    const befund = kandidaten[1]?.dublettenbefund;
    if (befund?.ergebnis !== "aehnlich") {
      throw new Error(`Erwartet 'aehnlich', erhalten: ${JSON.stringify(befund)}`);
    }
    expect(
      befund.treffer,
      "Der Treffer ist der KANDIDAT des eigenen Laufs, nicht eine koId, die es nicht gibt.",
    ).toEqual({ art: "kandidat", kandidatId: kandidaten[0]?.id });

    // Und beide angenommen ergibt genau EIN Wissensobjekt.
    for (const kandidat of kandidaten) {
      const review = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${kandidat.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(review.statusCode, review.body).toBe(200);
    }
    expect(
      await koTitel(app, headers),
      "Aus zwei Schreibweisen derselben Sache wird genau ein Wissensobjekt.",
    ).toEqual(["Filter wechseln"]);
  });

  it("K5b · woertlich zweimal derselbe Eintrag in EINER Sicherung → Pass 1 faengt den zweiten", async () => {
    const { app, headers } = await angemeldeteApp();
    const eintrag = {
      title: "Kessel reinigen",
      statement: "Den Kessel halbjaehrlich reinigen",
      type: "best_practice",
      category: "Wartung",
    };

    const kandidaten = await reiheEin(app, headers, [eintrag, eintrag]);

    expect(kandidaten[0]?.duplicate).toBe(false);
    expect(kandidaten[1]?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "kandidat", kandidatId: kandidaten[0]?.id },
    });
  });
});

// ==================================================================================================
// K4/K6/K7 — DIE FAELLE, DIE DIE KOMPOSITIONSWURZEL NICHT HERSTELLEN KANN (Begruendung am Dateikopf).
// ==================================================================================================

const DIENST_ITEMS: ImportItem[] = [
  {
    title: "Kessel reinigen",
    statement: "Den Kessel halbjaehrlich reinigen.",
    type: "best_practice",
    category: "Wartung",
  },
  {
    title: "Leitung spuelen",
    statement: "Die Leitung nach jedem Wechsel spuelen.",
    type: "best_practice",
    category: "Wartung",
  },
];

async function dienst(opts: { externalUpsert?: boolean } = {}) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return {
    koService,
    library: new LibraryService({
      koService,
      ...(opts.externalUpsert === undefined ? {} : { externalUpsert: opts.externalUpsert }),
    }),
  };
}

describe("JOB 3050 · K4 — die Pruefung faellt aus: weder Dublette noch Freibrief", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["eine Zeichenkette", "vielleicht"],
    ["ein Aehnlichkeitswert NaN", { dublette: true, koId: "ko-1", aehnlichkeit: Number.NaN }],
    ["eine leere koId", { dublette: true, koId: "   ", aehnlichkeit: 0.99 }],
  ])(
    "K4a · Rueckgabe %s → ausgewiesener dritter Zustand, kein Abbruch",
    async (_name, rueckgabe) => {
      const { library } = await dienst();

      const kandidaten = await library.createImportCandidates(
        DIENST_ITEMS,
        "importeur",
        (() => rueckgabe) as unknown as DublettenPruefung,
      );

      expect(
        kandidaten,
        "Der Lauf bricht nicht ab — beide Eintraege werden verarbeitet.",
      ).toHaveLength(2);
      for (const kandidat of kandidaten) {
        expect(
          kandidat.duplicate,
          "Eine nicht entschiedene Frage ist keine Dublettenbehauptung.",
        ).toBe(false);
        expect(kandidat.dublettenbefund, 'Und sie ist auch kein stilles „keine Dublette".').toEqual(
          { ergebnis: "pruefung_nicht_moeglich" },
        );
      }
    },
  );

  it("K4b · gar kein Port (Aufrufer unterhalb des Compilers) → alles nicht pruefbar", async () => {
    const { library } = await dienst();

    const kandidaten = await library.createImportCandidates(
      DIENST_ITEMS,
      "importeur",
      undefined as never,
    );

    expect(kandidaten.map((k) => k.dublettenbefund?.ergebnis)).toEqual([
      "pruefung_nicht_moeglich",
      "pruefung_nicht_moeglich",
    ]);
  });

  it("K4c · der Ausfall bleibt LOKAL — die uebrigen Eintraege werden verarbeitet", async () => {
    const { library } = await dienst();

    const kandidaten = await library.createImportCandidates(DIENST_ITEMS, "importeur", (item) => {
      if (item.title === "Kessel reinigen") {
        throw new Error("Pruefung nicht verfuegbar");
      }
      return { dublette: false };
    });

    expect(kandidaten.map((k) => k.dublettenbefund?.ergebnis)).toEqual([
      "pruefung_nicht_moeglich",
      "keine",
    ]);
  });

  // Der feindselige Fall aus JOB 3023 R3, hier am Kandidatenweg: `dublette` liefert beim ERSTEN
  // Lesen `false` und wirft beim ZWEITEN. Wer den Befund zweimal liest, verliert den ganzen Lauf.
  it("K4d · ein Getter, der die erste Auswertung passiert und danach wirft, kippt den Lauf NICHT", async () => {
    const { library } = await dienst();
    const gelesen = { dublette: 0 };
    const boshaft = Object.defineProperty({}, "dublette", {
      enumerable: true,
      get() {
        gelesen.dublette += 1;
        if (gelesen.dublette > 1) {
          throw new Error("zweites Lesen von dublette");
        }
        return false;
      },
    }) as DublettenBefund;

    const kandidaten = await library.createImportCandidates(DIENST_ITEMS, "importeur", (item) =>
      item.title === "Kessel reinigen" ? boshaft : { dublette: false },
    );

    expect(kandidaten.map((k) => k.dublettenbefund?.ergebnis)).toEqual(["keine", "keine"]);
    expect(
      gelesen.dublette,
      "DIE URSACHE: `dublette` wird genau EINMAL gelesen — es gibt keinen zweiten Zugriff.",
    ).toBe(1);
  });

  it("K4e · ein `accept` auf einen nicht pruefbaren Kandidaten legt KEIN Wissensobjekt an", async () => {
    const { koService, library } = await dienst();

    const [kandidat] = await library.createImportCandidates(
      [DIENST_ITEMS[0] as ImportItem],
      "importeur",
      (() => undefined) as unknown as DublettenPruefung,
    );
    if (!kandidat) {
      throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
    }

    const beschieden = await library.reviewImportCandidate(kandidat.id, "accept", "pruefer");

    expect(
      beschieden.koId,
      "Fail-closed: ohne Entscheidung entsteht kein Wissensobjekt.",
    ).toBeNull();
    expect(
      beschieden.dublettenbefund,
      "Und der Reviewer sieht am Kandidaten, WARUM nichts entstand.",
    ).toEqual({ ergebnis: "pruefung_nicht_moeglich" });
    expect(await koService.list(), "Der Bestand bleibt leer.").toHaveLength(0);
  });
});

describe("JOB 3050 · K6 — der externalId-/Re-Sync-Strang bleibt unveraendert", () => {
  const CONF_ITEM: ImportItem = {
    title: "Pumpe warten",
    statement: "Die Pumpe alle 200 Betriebsstunden schmieren",
    type: "best_practice",
    category: "Wartung",
    provider: "Confluence",
    externalId: "PX",
    sourceVersion: 1,
  };

  it("K6a · eine BESTANDSKOLLISION bei aktivem Upsert ist weiterhin KEINE Dublette", async () => {
    const { koService, library } = await dienst({ externalUpsert: true });
    // Der Bestand traegt genau diesen Eintrag WOERTLICH — Pass 1 wuerde sofort greifen, wenn der
    // externalId-Strang die Textfrage stellen wuerde.
    await koService.create({
      title: CONF_ITEM.title,
      statement: CONF_ITEM.statement,
      type: CONF_ITEM.type,
      category: CONF_ITEM.category,
      author: "pedi",
    });

    const [kandidat] = await library.createImportCandidates([CONF_ITEM], "importeur", () => ({
      dublette: true,
      koId: "egal",
      aehnlichkeit: 1,
    }));

    expect(
      kandidat?.duplicate,
      "Eine Bestandskollision ist im Upsert-Strang ein Re-Sync, keine Dublette (SCRUM-510 R2b).",
    ).toBe(false);
    expect(
      kandidat?.dublettenbefund,
      "Der Strang stellt die Textfrage ausdruecklich NICHT.",
    ).toEqual({ ergebnis: "nicht_gestellt" });
  });

  it("K6b · zweimal DASSELBE Quellobjekt in einem Lauf wird weiterhin nur einmal eingereiht", async () => {
    const { library } = await dienst({ externalUpsert: true });

    const kandidaten = await library.createImportCandidates(
      [CONF_ITEM, CONF_ITEM],
      "importeur",
      () => ({ dublette: false }),
    );

    // SCRUM-510 (WP3): der zweite Kandidat wird per `insertIfAbsent` gar nicht erst eingereiht —
    // `persisted` zaehlt ehrlich nur das Eingereihte. JOB 3050 aendert daran nichts.
    expect(kandidaten).toHaveLength(1);
    expect(kandidaten[0]?.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
  });
});

// ==================================================================================================
// K9 — DIE ZWEITE LINIE UNTER DEM PORT: EIN AUFRUF OHNE IHN LÄSST NICHTS DURCH.
// ==================================================================================================
//
// `importJson` trägt die Dublettenregel als PFLICHT-Parameter, weil sie dort genau EINEN Aufrufer
// hatte. `createImportCandidates` hat drei, und zwei davon liegen in Dateien, die dieser Auftrag
// nicht freigibt (der Wächter `port-aufrufer-waechter.test.ts` hält sie namentlich fest). Der
// Parameter ist deshalb additiv — und die Zusicherung, die der Compiler damit nicht mehr gibt,
// steht hier als MESSUNG: fehlt der Port, wird nichts still durchgelassen.
describe('JOB 3050 · K9 — ohne Port gilt fail-closed, nicht „keine Dublette"', () => {
  it("K9a · gar kein Port → jeder Eintrag ist ausgewiesen nicht pruefbar, der Lauf bricht nicht ab", async () => {
    const { library } = await dienst();

    const kandidaten = await library.createImportCandidates(DIENST_ITEMS, "importeur");

    expect(kandidaten, "Der Lauf laeuft durch — beide Eintraege werden eingereiht.").toHaveLength(
      2,
    );
    for (const kandidat of kandidaten) {
      expect(kandidat.duplicate, "Ohne Pruefung wird keine Dublette BEHAUPTET.").toBe(false);
      expect(
        kandidat.dublettenbefund,
        "Und sie wird auch nicht VERNEINT — der Kandidat sagt, dass nicht geprueft wurde.",
      ).toEqual({ ergebnis: "pruefung_nicht_moeglich" });
    }
  });

  it("K9b · und ein `accept` auf so einen Kandidaten legt KEIN Wissensobjekt an", async () => {
    const { koService, library } = await dienst();
    const [kandidat] = await library.createImportCandidates(
      [DIENST_ITEMS[0] as ImportItem],
      "importeur",
    );
    if (!kandidat) {
      throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
    }

    const beschieden = await library.reviewImportCandidate(kandidat.id, "accept", "pruefer");

    expect(
      beschieden.koId,
      "Ein portloser Aufrufer kann keine unbemerkte Dublette erzeugen — er erzeugt gar nichts.",
    ).toBeNull();
    expect(await koService.list()).toHaveLength(0);
  });

  // ================================================================================================
  // K9c — DIE ZWEI REGISTRIERTEN ALTFÄLLE VERHALTEN SICH UNVERÄNDERT.
  // ================================================================================================
  //
  // Beide portlosen Produktions-Aufrufer (`confluence-import.ts`, `confluence-import-routes.ts`)
  // fahren den ANKER-/Re-Sync-Strang: Items mit `externalId`, Upsert-Strang an. Dort wird die
  // Textfrage per Entscheid nicht gestellt — der fehlende Port kostet dort also NICHTS, und der
  // `accept` legt weiterhin an. Ohne diese Messung wäre die Registrierung im Wächter eine
  // Behauptung.
  it("K9c · Anker-Item, Upsert an, KEIN Port → unveraendert `nicht_gestellt`, und der accept legt an", async () => {
    const { koService, library } = await dienst({ externalUpsert: true });

    const [kandidat] = await library.createImportCandidates(
      [
        {
          title: "Pumpe warten",
          statement: "Die Pumpe alle 200 Betriebsstunden schmieren",
          type: "best_practice",
          category: "Wartung",
          provider: "Confluence",
          externalId: "PX",
          sourceVersion: 1,
        },
      ],
      "importeur",
    );
    if (!kandidat) {
      throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
    }

    expect(
      kandidat.dublettenbefund,
      "Der Anker-Strang fragt die Textregel nicht — der fehlende Port aendert dort nichts.",
    ).toEqual({ ergebnis: "nicht_gestellt" });
    const beschieden = await library.reviewImportCandidate(kandidat.id, "accept", "pruefer");
    expect(
      beschieden.koId,
      "Der Confluence-Weg legt weiterhin an — JOB 3050 hat ihn nicht angefasst.",
    ).toEqual(expect.any(String));
    expect(await koService.list()).toHaveLength(1);
  });
});

// ==================================================================================================
// K7 — KALIBRIERUNG. Ohne diesen Fall waere eine Reihe gruener Zusicherungen von einem TOTEN
// Pruefstand nicht zu unterscheiden: eine Pruefung, die immer `true` liefert, machte K1/K2/K5 gruen.
// ==================================================================================================
describe("JOB 3050 · K7 — ein nie treffender Port faellt auf das heutige Verhalten zurueck", () => {
  it("K7 · nur Pass 1 greift: woertlich gleich = Dublette, leicht veraendert = neu", async () => {
    const { koService, library } = await dienst();
    const bestand = await koService.create({
      title: BESTANDS_KO.title,
      statement: BESTANDS_KO.statement,
      type: BESTANDS_KO.type,
      category: BESTANDS_KO.category,
      author: "pedi",
    });
    const nieTreffer: DublettenPruefung = () => ({ dublette: false });

    const kandidaten = await library.createImportCandidates(
      [{ ...BESTANDS_KO }, { ...BESTANDS_KO, ...leichtVeraendert(BESTANDS_KO) }],
      "importeur",
      nieTreffer,
    );

    expect(kandidaten[0]?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: bestand.id },
    });
    expect(
      kandidaten[1]?.duplicate,
      "OHNE Pass 2 ist der leicht veraenderte Eintrag genau das, was er vor JOB 3050 war: neu.",
    ).toBe(false);
    expect(kandidaten[1]?.dublettenbefund).toEqual({ ergebnis: "keine" });
  });
});
