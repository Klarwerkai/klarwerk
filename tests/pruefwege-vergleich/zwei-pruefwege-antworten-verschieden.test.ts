// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSBLICK — DIE ZWEI PRÜFVERTRÄGE, NEBENEINANDER GEFAHREN.
// ================================================================================================
//
// Zielzustand (R-0332 / R-1466): „Es gibt zwei Wege, die ähnliche Fragen beantworten: der eine sagt
// ‚steht es als geprüftes Wissen da?', der andere ‚ähnelt es irgendetwas im Bestand, auch
// Entwürfen?'. Beide bleiben bestehen, ihre Unterschiede werden dokumentiert und durch einen
// Vergleichstest dauerhaft festgehalten, damit sie nicht auseinanderlaufen."
//
// DIE ZWEI WEGE im heutigen Code:
//   · `checkText` (`services/app/src/check-text-detection.ts`) — die Dublettenprüfung hinter
//     `POST /api/check-text`. Am Add-in-Weg (`includeUnvalidated` aus) sagt sie „steht es als
//     geprüftes Wissen da?"; am angemeldeten Menschen (`includeUnvalidated` an, JOB 3020) zählt
//     auch der noch offene Bestand.
//   · `checkKnowledge` (`services/app/src/knowledge-check.ts`) — der Live-Check hinter
//     `POST /api/knowledge/check` („Wissen erfassen"). Er ist zustandsneutral: „ähnelt es
//     irgendetwas im Bestand?".
//
// WAS DIESE DATEI TUT: EIN Bestand, EIN Prüftext, beide Wege über den ECHTEN `KoService` — und je
// Bestandsobjekt die Frage „wer findet es?". Die Tabelle `ERWARTET` ist die dokumentierte
// Unterschiedsliste (Doku: `docs/klara/bestandsblick-zwei-pruefwege.md`). Ändert sich eine Zeile,
// wird dieser Test rot — ein Unterschied kann nicht mehr unbemerkt größer (oder kleiner) werden.
// Wer ihn bewusst ändert, ändert Tabelle UND Doku in demselben Schritt.
//
// WAS SIE NICHT ZUSAGT: die Schwellen der beiden Ähnlichkeitsmaße (Trigramm ≥ 0,18 gegen die
// deterministische Überdeckung des Overlap-Dienstes) werden nicht gegeneinander vermessen — der
// Prüftext ist mit Absicht nahezu wortgleich, damit ausschließlich die POOLREGEL entscheidet.
// Keine Route, kein Modell, kein PostgreSQL: der Vergleich gilt dem Kern.
//
// ENTWÜRFE (V5): „auch Entwürfen" aus R-0332 und „Entwürfe aller im Haus" aus R-1788 (Pedi,
// 30./31.07.) hat Pedi am 05.09.2026 12:03 jünger entschieden: „N1c NEIN (Entwürfe nicht im
// Kandidatenpool)" (STEUERUNG-ANTWORT-11.md:12; R-1592: „Entwürfe sind gemäß Pedi ausgenommen").
// Beide Wege antworten hier GLEICH — ein Erfassungsentwurf ist auf keinem von beiden ein Treffer.
// V5 hält das über die ECHTEN Routen fest (Entwurf über `POST /api/drafts`, Kalibrierung über
// `/promote`), damit eine spätere Öffnung eine bewusste Entscheidung bleibt und nicht still passiert.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { checkText } from "../../services/app/src/check-text-detection";
import { checkKnowledge } from "../../services/app/src/knowledge-check";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";

// Nahezu wortgleiche Kerntexte → deterministischer Treffer auf BEIDEN Wegen (Muster
// `tests/pruefung-gegen-alles/n1-ungeprueftes-wird-gefunden.test.ts`).
const TITEL = "Kuehlmittelpumpe entlueften";
const AUSSAGE = "Nach dem Anfahren der Kuehlmittelpumpe zehn Sekunden warten, dann entlueften.";
const PRUEFTEXT =
  "Nach dem Anfahren der Kuehlmittelpumpe zehn Sekunden warten und dann entlueften.";

type Art = "validiert" | "offen" | "demo" | "vertraulich" | "papierkorb";

/** Wer findet welches Objekt? `true` = erscheint als Treffer. */
interface Sicht {
  /** `checkText` am Add-in-Weg (`includeUnvalidated` aus). */
  textAddin: boolean;
  /** `checkText` am angemeldeten Menschen (`includeUnvalidated` an). */
  textMensch: boolean;
  /** `checkKnowledge` (Live-Check). */
  wissen: boolean;
}

// DIE DOKUMENTIERTE UNTERSCHIEDSLISTE. Gleich sind: vertraulich und Papierkorb (auf keinem Weg).
// Verschieden sind: der offene Bestand (Add-in nein) und der Demobestand (nur der Live-Check).
const ERWARTET: Record<Art, Sicht> = {
  validiert: { textAddin: true, textMensch: true, wissen: true },
  offen: { textAddin: false, textMensch: true, wissen: true },
  demo: { textAddin: false, textMensch: false, wissen: true },
  vertraulich: { textAddin: false, textMensch: false, wissen: false },
  papierkorb: { textAddin: false, textMensch: false, wissen: false },
};

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Instandhaltung",
  author: "anna",
  confidentiality: "intern",
};

interface Bestand {
  ko: KoService;
  ids: Record<Art, string>;
}

async function bestand(): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const anlegen = async (extra: Partial<CreateKoInput>, status: "offen" | "validiert") => {
    const eintrag = await ko.create({ ...VORLAGE, title: TITEL, statement: AUSSAGE, ...extra });
    if (status === "validiert") {
      await ko.setValidationState(eintrag.id, { trust: 80, status: "validiert" });
    }
    return eintrag.id;
  };

  const ids: Record<Art, string> = {
    validiert: await anlegen({}, "validiert"),
    offen: await anlegen({}, "offen"),
    demo: await anlegen({ demoSeed: true }, "validiert"),
    vertraulich: await anlegen({ confidentiality: "vertraulich" }, "validiert"),
    papierkorb: await anlegen({}, "validiert"),
  };
  await ko.delete(ids.papierkorb, "anna", { forceTrash: true });
  return { ko, ids };
}

async function textTreffer(b: Bestand, includeUnvalidated: boolean) {
  const ergebnis = await checkText(
    { text: PRUEFTEXT, title: TITEL },
    {
      ko: b.ko,
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
      includeUnvalidated,
    },
  );
  return ergebnis;
}

async function wissenTreffer(b: Bestand) {
  return checkKnowledge(PRUEFTEXT, {
    ko: b.ko,
    conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
  });
}

let b: Bestand;
let addin: Awaited<ReturnType<typeof textTreffer>>;
let mensch: Awaited<ReturnType<typeof textTreffer>>;
let wissen: Awaited<ReturnType<typeof wissenTreffer>>;

beforeAll(async () => {
  b = await bestand();
  addin = await textTreffer(b, false);
  mensch = await textTreffer(b, true);
  wissen = await wissenTreffer(b);
});

describe("Aufnahme 20260922 · zwei Prüfverträge — wer findet was", () => {
  it("V0 · Kalibrierung: der Bestand ist echt angelegt, der Papierkorb ist wirklich getrasht", async () => {
    // Ohne diese Probe könnte ein „kein Treffer" auch ein nicht angelegtes Objekt sein.
    const lebend = await b.ko.list();
    const lebendIds = new Set(lebend.map((k) => k.id));
    for (const art of ["validiert", "offen", "demo", "vertraulich"] as const) {
      expect(lebendIds.has(b.ids[art]), art).toBe(true);
    }
    expect(lebendIds.has(b.ids.papierkorb)).toBe(false);
    const nachStatus = new Map(lebend.map((k) => [k.id, k.status]));
    expect(nachStatus.get(b.ids.offen)).toBe("offen");
    expect(nachStatus.get(b.ids.validiert)).toBe("validiert");
    // Ohne Judge ist der Live-Check ehrlich „pending" (Konflikte ungeprüft, kein Modell); die
    // lexikalische Ähnlichkeit läuft trotzdem — auf ihr liegt dieser Vergleich.
    expect(wissen.status).toBe("pending");
    expect(wissen.similar.length).toBeGreaterThan(0);
    expect(mensch.duplicates.length).toBeGreaterThan(0);
  });

  for (const art of Object.keys(ERWARTET) as Art[]) {
    it(`V1 · ${art}: Add-in ${ERWARTET[art].textAddin ? "ja" : "nein"} · Mensch ${
      ERWARTET[art].textMensch ? "ja" : "nein"
    } · Live-Check ${ERWARTET[art].wissen ? "ja" : "nein"}`, () => {
      const id = b.ids[art];
      const ist: Sicht = {
        textAddin: addin.duplicates.some((d) => d.koId === id),
        textMensch: mensch.duplicates.some((d) => d.koId === id),
        wissen: wissen.similar.some((s) => s.id === id),
      };
      expect(ist).toEqual(ERWARTET[art]);
    });
  }

  it("V2 · die Unterschiedsliste ist genau zwei Zeilen lang — offen und demo", () => {
    // Wer eine dritte Abweichung einführt (oder eine schließt), muss sie hier benennen.
    const abweichend = (Object.keys(ERWARTET) as Art[]).filter((art) => {
      const s = ERWARTET[art];
      return !(s.textAddin === s.textMensch && s.textMensch === s.wissen);
    });
    expect(abweichend).toEqual(["offen", "demo"]);
  });

  it("V3 · beide Wege nennen den Fundort mit demselben Vokabular (koStatus, koCategory)", () => {
    const offenMensch = mensch.duplicates.find((d) => d.koId === b.ids.offen);
    const offenWissen = wissen.similar.find((s) => s.id === b.ids.offen);
    expect(offenMensch?.koStatus).toBe("offen");
    expect(offenWissen?.koStatus).toBe("offen");
    expect(offenMensch?.koCategory).toBe("Instandhaltung");
    expect(offenWissen?.koCategory).toBe("Instandhaltung");
  });

  it("V4 · die Ergebnisformen bleiben verschieden benannt (duplicates/koId gegen similar/id)", () => {
    // Die Formen sind NICHT vereinheitlicht; die Verbraucher (Add-in-Panel, Erfassen-Editor) lesen
    // je ihre eigene. Festgehalten, damit eine Angleichung eine bewusste Entscheidung bleibt.
    expect(Object.keys(mensch)).toEqual(expect.arrayContaining(["duplicates", "conflicts"]));
    expect(Object.keys(wissen).sort()).toEqual(["conflicts", "similar", "status"]);
    expect(Object.keys(mensch.duplicates[0] ?? {})).toContain("koId");
    expect(Object.keys(wissen.similar[0] ?? {})).toContain("id");
  });
});

// ================================================================================================
// V5 · ENTWURF — beide Wege gleich: kein Treffer (Pedi 05.09.2026 12:03, „N1c NEIN").
// ================================================================================================
// An den echten Routen, weil ein Entwurf kein Wissensobjekt ist und im `KoService` oben gar nicht
// vorkommen KANN: angelegt über `POST /api/drafts` (services/capture), geprüft mit demselben Text
// über `POST /api/check-text` (Sitzungsweg, `includeUnvalidated` an) und `POST /api/knowledge/check`.
// Die Kalibrierung danach reicht denselben Entwurf ein (`/promote`): jetzt finden ihn BEIDE — also
// lag das Schweigen vorher am Entwurfsausschluss, nicht an einem Text, den keiner gefunden hätte.
const FLAGS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY"] as const;
const GESICHERT: Partial<Record<(typeof FLAGS)[number], string | undefined>> = {};

describe("Aufnahme 20260922 · zwei Prüfverträge — V5 Entwurf (N1c NEIN)", () => {
  beforeAll(() => {
    for (const k of FLAGS) {
      GESICHERT[k] = process.env[k];
    }
    // `/api/check-text` ist nur bei Flag AN registriert (build-app.ts) — wie in der Live-Instanz.
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = "v5-addon-key";
  });
  afterAll(() => {
    for (const k of FLAGS) {
      const alt = GESICHERT[k];
      if (alt === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = alt;
      }
    }
  });

  it("V5 · ein Erfassungsentwurf ist auf keinem Weg ein Treffer; eingereicht finden ihn beide", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "anna@v5.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@v5.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: TITEL,
        statement: AUSSAGE,
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
      },
    });
    expect(draft.statusCode).toBe(201);
    const draftId = draft.json().id as string;
    // Der Entwurf ist echt da und für dieselbe Person lesbar — das Schweigen unten ist kein Rechte-
    // oder Anlagefehler.
    const gelesen = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    expect(gelesen.statusCode).toBe(200);

    const beideWege = async () => {
      const text = await app.inject({
        method: "POST",
        url: "/api/check-text",
        headers,
        payload: { text: PRUEFTEXT, title: TITEL, locale: "de", source: "transient-document" },
      });
      const wissen = await app.inject({
        method: "POST",
        url: "/api/knowledge/check",
        headers,
        payload: { text: PRUEFTEXT },
      });
      expect(text.statusCode).toBe(200);
      expect(wissen.statusCode).toBe(200);
      return {
        text: text.json() as { duplicates: Array<{ koId: string; pruefstand: string | null }> },
        textRoh: text.payload,
        wissen: wissen.json() as { similar: Array<{ id: string; koStatus: string | null }> },
        wissenRoh: wissen.payload,
      };
    };

    const vorher = await beideWege();
    expect(vorher.text.duplicates).toEqual([]);
    expect(vorher.wissen.similar).toEqual([]);
    // Auch keine Existenzauskunft über Titel oder Kennung des Entwurfs.
    for (const roh of [vorher.textRoh, vorher.wissenRoh]) {
      expect(roh).not.toContain(TITEL);
      expect(roh).not.toContain(draftId);
    }

    // Kalibrierung: eingereicht ist derselbe Inhalt ein Wissensobjekt (offen) — beide finden ihn.
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
      payload: {},
    });
    expect(promote.statusCode).toBe(201);
    const koId = promote.json().id as string;

    const nachher = await beideWege();
    expect(nachher.text.duplicates.find((d) => d.koId === koId)?.pruefstand).toBe("eingereicht");
    expect(nachher.wissen.similar.find((s) => s.id === koId)?.koStatus).toBe("offen");
  });
});
