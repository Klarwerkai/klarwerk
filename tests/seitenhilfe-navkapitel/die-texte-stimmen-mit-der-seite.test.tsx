// @vitest-environment jsdom
// ================================================================================================
// JOB 3741 · RUNDE 2/3 — JEDE BEDIENANWEISUNG IST AM SEITENVERHALTEN BELEGT.
// ================================================================================================
//
// DIE LEHRE, DIE HIER GEBAUT WIRD (Codex/BEN, Runde 1, Promptverbesserung): „Belege jede konkrete
// Bedienanweisung am tatsaechlichen Seitenverhalten. Beruecksichtige alternative Darstellungen und
// Sichtbarkeitsschalter; leite automatische Folgeschritte nicht aus Bezeichnungen wie ‚Pruefliste'
// ab." Genau daran sind in Runde 1 drei Texte gescheitert:
//
//   1. Themenkarte — beschrieben war ausschliesslich die Zeichnung. Unter 900 px gibt es sie GAR
//      NICHT (`pages/Wissensnetz.tsx`, `LESEN_UNTER`), und einen Umschalter dann auch nicht.
//   2. Profil — „Fehlen dir Bereiche im Menue, liegt das an deiner Rolle" war falsch: `canSee`
//      (`app/navigation.ts`) blendet einen Bereich AUCH bei ausreichender Rolle aus, wenn die
//      erweiterten Module aus sind.
//   3. Import — „danach rueckt der naechste nach" war frei erfunden. Entschiedene Kandidaten
//      bleiben in der Liste stehen, und die Liste liegt in einem zugeklappten Bereich.
//
// WARUM DIESE DATEI UND NICHT EIN ZWEITER TEXTVERGLEICH: der Wortlaut gegen denselben hinterlegten
// Wortlaut zu pruefen beweist gar nichts (BEN, Substanzurteil 2). Hier steht deshalb je
// Korrekturpflicht ZWEI Dinge nebeneinander — das gemessene Verhalten der Seite UND der Satz, der
// es beschreibt, gebunden an die ECHTEN Beschriftungen aus `i18n.ts`. Wer den Umschalter, die
// Knoepfe oder den Abschnittstitel umbenennt, macht diese Datei rot; wer das Verhalten aendert,
// ebenso.
//
// RUNDE 3 — UND WORAN DIESE DATEI SELBST SCHEITERTE (BEN, Runde 2, Korrekturpflicht 1): K3a schrieb
// „vorher" und „nachher" als zwei Listen SELBST hin und verglich sie miteinander. Das ist kein
// Verhaltensbeleg, sondern ein Vergleich zweier Behauptungen — beide Produktmutationen (leerer
// Listenabruf, Filter auf offene Kandidaten) blieben unbemerkt. K3a montiert jetzt die echte
// `ImportReview`-Seite und KLICKT die Entscheidung; „vorher" und „nachher" sind zwei Ablesungen
// desselben gezeichneten DOM um eine ausgefuehrte Operation herum.
// Die Lehre in einem Satz: eine Vorher-/Nachher-Liste muss aus einer AUSGEFUEHRTEN Produktoperation
// stammen; zwei im Test ausgeschriebene Zustaende sind keiner.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Endpunktgrenze ist die einzige Attrappe — Seiten, i18n, React-Query und Router sind echt.
// Bauform uebernommen aus `tests/wissensnetz-leseweg/leseweg.test.tsx`.
//
// RUNDE 3: die Attrappe der Pruefliste ist kein fester Rueckgabewert mehr, sondern ein STAND, den
// die Entscheidung wirklich veraendert — `review()` schreibt in denselben Bestand, den `list()`
// danach neu ausliefert. Nur so ist „vorher" und „nachher" das Ergebnis einer AUSGEFUEHRTEN
// Operation und nicht zweier im Test ausgeschriebener Listen (BEN, Runde 2, Korrekturpflicht 1).
const d = vi.hoisted(() => {
  const karte = { resolve: (_v: unknown) => {} };
  const luecken = vi.fn(
    () =>
      new Promise((resolve) => {
        karte.resolve = resolve;
      }),
  );
  const search = vi.fn(async () => []);

  /** Der Stand der Pruefliste auf der Serverseite — EINE Liste, die beide Aufrufe teilen. */
  const bestand: Record<string, unknown>[] = [];
  /**
   * `GET /import-candidates` — gibt AUS, was gerade im Bestand liegt, ohne Statusfilter (so wie
   * `listImportCandidates` in `services/library-analytics/src/service.ts`: `this.candidates.all()`).
   */
  const list = vi.fn(async () => bestand.map((c) => ({ ...c })));
  /** `POST …/review` — DIE Entscheidung. Sie schreibt den Status, sie entfernt nichts. */
  const review = vi.fn(async (id: string, action: string, note?: string) => {
    const treffer = bestand.find((c) => c.id === id);
    if (!treffer) {
      throw new Error(`kein Kandidat mit der Kennung ${id}`);
    }
    treffer.status =
      action === "accept" ? "angenommen" : action === "reject" ? "abgelehnt" : "info-angefragt";
    if (note !== undefined) {
      treffer.note = note;
    }
    return { ...treffer };
  });
  const setzeBestand = (neu: Record<string, unknown>[]): void => {
    bestand.length = 0;
    bestand.push(...neu.map((c) => ({ ...c })));
  };
  const lesBestand = (): Record<string, unknown>[] => bestand.map((c) => ({ ...c }));

  return {
    luecken,
    search,
    antworten: (v: unknown) => karte.resolve(v),
    list,
    review,
    setzeBestand,
    lesBestand,
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // Alles, was diese Faelle NICHT messen, antwortet leer — aber es antwortet. Ohne den Rueckfall
  // stuerzte die Import-Seite an der ersten unbekannten Ecke ab, und der Fall maesse nichts.
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return leer();
        },
      },
    );
  const mitRueckfall = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return leer();
      },
    });
  return {
    endpoints: mitRueckfall({
      // `null` und nicht `[]`: die Zugangskarte des Imports zeigt ohne Auskunft GAR NICHTS
      // (`components/ImportAccessPanel.tsx`: „Keine Auskunft — dann auch keine Behauptung"). Das ist
      // der ehrliche Zustand fuer einen Lauf, der diese Karte nicht messen will.
      importAccess: mitRueckfall({ confluence: vi.fn(async () => null) }),
      wissensnetz: mitRueckfall({ luecken: d.luecken }),
      library: mitRueckfall({
        search: d.search,
        importCandidates: mitRueckfall({ list: d.list, review: d.review }),
      }),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, type NavItem, canSee, roleAllows } from "../../apps/web/src/app/navigation";
import { ImportHistorySection } from "../../apps/web/src/components/ImportHistory";
import i18n from "../../apps/web/src/i18n";
import { isOpenImportCandidate } from "../../apps/web/src/lib/importCandidateStatus";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

/** Der hinterlegte Wert EINER Sprache, ohne Rueckfall auf Deutsch. */
function wert(lng: Sprache, key: string): string {
  return String(i18n.getResource(lng, "translation", key) ?? "");
}

/** Der Kapiteltext, um den es geht — in der Sprache, in der er gelesen wird. */
function kapiteltext(lng: Sprache, id: string): string {
  return wert(lng, `help.${id}.body`);
}

// ------------------------------------------------------------------------------------------------
// matchMedia — die Attrappe fuer die Fensterbreite (jsdom bringt keine mit).
// ------------------------------------------------------------------------------------------------
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
let istSchmal = false;
function setzeBreite(schmal: boolean): void {
  hoerer = [];
  istSchmal = schmal;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    get matches() {
      return istSchmal && /max-width:\s*899px/.test(abfrage);
    },
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (!steht) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  steht = false;
}

async function montiere(kind: ReturnType<typeof createElement>, pfad: string): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [pfad] }, kind),
      ),
    );
    await flush();
  });
  await act(flush);
  steht = true;
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];

/** Die ECHTE Import-Seite, mit den Anbietern, die sie braucht — Attrappe ist nur die Endpunktgrenze. */
async function montiereImport(): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/import"] },
                  createElement(ImportReview),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Durchlaeufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
  steht = true;
}

async function klicke(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

/** Die Titel der Kandidaten, WIE SIE GEZEICHNET SIND (`Stufe2.tsx`, `imp-kandidat-titel`). */
function gezeichneteKandidaten(): string[] {
  return alle("imp-kandidat-titel").map((e) => (e.textContent ?? "").trim());
}

// ------------------------------------------------------------------------------------------------
// Der Bestand der Themenkarte — klein, aber mit allem, was der Text behauptet.
// ------------------------------------------------------------------------------------------------
const METRIK = {
  objekteGesamt: 8,
  ohneThema: 0,
  themen: [
    { thema: "ventil", objekte: 5, sichtbareBeitragende: 2, beitragendeAbgeschnitten: false },
    { thema: "dichtung", objekte: 3, sichtbareBeitragende: 3, beitragendeAbgeschnitten: false },
  ],
  themenkarte: {
    themen: [
      { thema: "ventil", objekte: 5, farbe: "belegt", ohneKanten: false },
      { thema: "dichtung", objekte: 3, farbe: "freigegeben", ohneKanten: false },
    ],
    kanten: [{ a: "dichtung", b: "ventil", gewicht: 1 }],
    // `weitere` traegt die NAMEN der nicht gezeichneten Themen (`api/types.ts`). Leer ist hier
    // richtig: beide Themen des Bestands stehen im Bild — und `AlleThemen` rendert dann nichts.
    weitere: [],
    weitereAbgeschnitten: false,
  },
};

async function themenkarteMit(schmal: boolean): Promise<void> {
  setzeBreite(schmal);
  await montiere(createElement(Wissensnetz), "/wissensnetz");
  await act(async () => {
    d.antworten(METRIK);
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

// ================================================================================================
// K1 · KORREKTURPFLICHT 1 — DIE THEMENKARTE HAT ZWEI DARSTELLUNGEN, UND DER TEXT NENNT BEIDE.
// ================================================================================================
describe("JOB 3741 K1 · Themenkarte — schmal und breit sind zwei verschiedene Seiten", () => {
  it("K1a: BREIT — der Umschalter steht da, und er heisst „Netz“ und „Lesen“", async () => {
    await themenkarteMit(false);
    expect(marke("netz-umschalter"), "auf breiten Fenstern gibt es den Umschalter").not.toBeNull();
    expect(marke("netz-ansicht-netz")?.textContent).toBe(wert("de", "wissensnetz.lesen.netz"));
    expect(marke("netz-ansicht-lesen")?.textContent).toBe(wert("de", "wissensnetz.lesen.lesen"));
    // Und die Zeichnung samt Leiste ist wirklich da — die Aussage „jedes Thema ein Kreis" haengt
    // an ihr.
    expect(container.querySelector("svg"), "die Zeichnung fehlt").not.toBeNull();
    expect(marke("netz-seitenleiste"), "die Leiste neben der Zeichnung fehlt").not.toBeNull();
  });

  it("K1b: SCHMAL — keine Zeichnung, keine Leiste, KEIN Umschalter; die Lesezeilen stehen an ihrer Stelle", async () => {
    await themenkarteMit(true);
    expect(container.querySelector("svg"), "auf schmal ist die Zeichnung NICHT im DOM").toBeNull();
    expect(marke("netz-seitenleiste"), "auch die Leiste ist weg").toBeNull();
    expect(marke("netz-umschalter"), "auf schmal gibt es nichts zu waehlen").toBeNull();
    // Was BLEIBT und worauf der Text deshalb verweisen MUSS: je Thema eine Zeile mit ihrem Weg.
    expect(alle("metrik-thema").length, "kein Leseweg auf schmalem Fenster").toBeGreaterThan(0);
    const weg = container.querySelector('[data-testid="metrik-thema"] a[href*="/bibliothek"]');
    expect(weg, "die Lesezeile fuehrt nicht zu den Objekten des Themas").not.toBeNull();
  });

  it("K1c: derselbe Weg steht auch auf dem BREITEN Fenster unter der Zeichnung — „in beiden Faellen“ ist wahr", async () => {
    await themenkarteMit(false);
    expect(
      alle("metrik-thema").length,
      "breit fehlt der Leseweg unter der Zeichnung",
    ).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-testid="metrik-thema"] a[href*="/bibliothek"]'),
      "breit fehlt der Weg zu den Objekten",
    ).not.toBeNull();
  });

  it("K1d: der Kapiteltext nennt BEIDE Darstellungen — mit den echten Beschriftungen des Umschalters", async () => {
    for (const lng of SPRACHEN) {
      const text = kapiteltext(lng, "wissensnetz");
      for (const key of ["wissensnetz.lesen.netz", "wissensnetz.lesen.lesen"]) {
        const beschriftung = wert(lng, key);
        expect(beschriftung.length, `${lng}: ${key} hat keine Beschriftung`).toBeGreaterThan(0);
        expect(
          text,
          `${lng}: der Kapiteltext nennt die Umschalter-Beschriftung „${beschriftung}“ nicht`,
        ).toContain(beschriftung);
      }
    }
  });

  it("K1e: der Kapiteltext verspricht die Zeichnung NICHT bedingungslos — das schmale Fenster kommt darin vor", async () => {
    // Die Ausgangsfassung sagte „Du kannst einen Kreis anklicken" ohne jede Bedingung. Der Fall
    // verlangt, dass die Bedingung im Satz steht; das WORT dafuer ist je Sprache eines, und es
    // steht hier als Mindestmenge — nicht als Wortlautpin.
    const schmalwort: Readonly<Record<Sprache, string>> = {
      de: "schmal",
      en: "narrow",
      nl: "smal",
    };
    const breitwort: Readonly<Record<Sprache, string>> = {
      de: "breiten",
      en: "wide",
      nl: "breed",
    };
    for (const lng of SPRACHEN) {
      const text = kapiteltext(lng, "wissensnetz").toLowerCase();
      expect(text, `${lng}: der Text sagt nichts ueber das schmale Fenster`).toContain(
        schmalwort[lng],
      );
      expect(text, `${lng}: der Text sagt nichts ueber das breite Fenster`).toContain(
        breitwort[lng],
      );
    }
  });
});

// ================================================================================================
// K2 · KORREKTURPFLICHT 2 — EIN FEHLENDER BEREICH HAT ZWEI MOEGLICHE GRUENDE, NICHT EINEN.
// ================================================================================================
describe("JOB 3741 K2 · Profil — die Rolle ist nicht der einzige Grund", () => {
  /** Ein Stufe-2-Punkt aus der echten Registry — erhoben, nicht abgetippt. */
  function stufe2Punkt(): NavItem {
    const punkt = ALL_ITEMS.find((i) => i.stufe2 === true);
    if (!punkt) {
      throw new Error("die Registry fuehrt keinen Stufe-2-Punkt mehr — der Fall misst nichts");
    }
    return punkt;
  }

  it("K2a: BEI UNVERAENDERTER ROLLE `admin` entscheidet allein der Schalter ueber die Sichtbarkeit", () => {
    const punkt = stufe2Punkt();
    // Erst der Beleg, dass die ROLLE reicht — sonst maesse der Fall nur ein Rollenverbot.
    expect(roleAllows(punkt, "admin"), `${punkt.id}: die Rolle admin reicht nicht`).toBe(true);
    expect(canSee(punkt, "admin", false), `${punkt.id}: mit Schalter AUS sichtbar`).toBe(false);
    expect(canSee(punkt, "admin", true), `${punkt.id}: mit Schalter AN unsichtbar`).toBe(true);
  });

  it("K2b: es sind wirklich mehrere Bereiche, und alle verschwinden bei ausgeschalteten Modulen", () => {
    const betroffen = ALL_ITEMS.filter((i) => i.stufe2 === true);
    expect(betroffen.length, "kein Stufe-2-Punkt — der Fall misst nichts").toBeGreaterThan(1);
    for (const punkt of betroffen) {
      expect(
        canSee(punkt, "admin", false),
        `${punkt.path} bleibt trotz Schalter AUS sichtbar`,
      ).toBe(false);
    }
  });

  it("K2c: der Kapiteltext nennt beide Gruende und nennt den Ort des Schalters", async () => {
    // Der Ort ist der ANZEIGENAME von `/admin` — derselbe Schluessel, den das Zahnrad-Menue und
    // die Schnellnavigation benutzen (`anzeigeNameKey`, JOB 3105 UX-08). Wer ihn umbenennt, macht
    // diesen Fall rot, statt eine Hilfe stehenzulassen, die auf ein Wort zeigt, das es nicht gibt.
    const rollenwort: Readonly<Record<Sprache, string>> = { de: "Rolle", en: "role", nl: "rol" };
    const modulwort: Readonly<Record<Sprache, string>> = {
      de: "erweiterten Module",
      en: "advanced modules",
      nl: "uitgebreide modules",
    };
    for (const lng of SPRACHEN) {
      const text = kapiteltext(lng, "profil");
      expect(text, `${lng}: der Rollen-Grund fehlt`).toContain(rollenwort[lng]);
      expect(text, `${lng}: der Schalter-Grund fehlt — genau das war Runde 1 falsch`).toContain(
        modulwort[lng],
      );
      expect(
        text,
        `${lng}: der Ort des Schalters („${wert(lng, "menue.einstellungen")}“) fehlt`,
      ).toContain(wert(lng, "menue.einstellungen"));
    }
  });

  it("K2d: und er behauptet NICHT mehr, die Rolle sei der einzige Grund", async () => {
    // Die Ausgangsfassung: „Fehlen dir Bereiche im Menü, liegt das an deiner Rolle". Der Fall
    // pinnt nicht den neuen Wortlaut, sondern die Abwesenheit des alten Ausschliesslichkeitssatzes.
    const alt: Readonly<Record<Sprache, string>> = {
      de: "liegt das an deiner Rolle",
      en: "that is down to your role",
      nl: "komt dat door je rol",
    };
    for (const lng of SPRACHEN) {
      expect(
        kapiteltext(lng, "profil"),
        `${lng}: die ausschliessende Aussage aus Runde 1 steht noch da`,
      ).not.toContain(alt[lng]);
    }
  });
});

// ================================================================================================
// K3 · KORREKTURPFLICHT 3 — DIE PRUEFLISTE SCHIEBT NICHTS NACH.
// ================================================================================================
const TITEL_A = "Probe Kandidat A";
const TITEL_B = "Probe Kandidat B";

/** Zwei offene Kandidaten, wie sie der Server ausliefert. */
function zweiOffene(): Record<string, unknown>[] {
  return [
    {
      id: "kand-a",
      item: { title: TITEL_A, statement: "Aussage A", category: "probe", source: "probe" },
      status: "neu",
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-09-12T08:00:00.000Z",
    },
    {
      id: "kand-b",
      item: { title: TITEL_B, statement: "Aussage B", category: "probe", source: "probe" },
      status: "neu",
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-09-12T08:01:00.000Z",
    },
  ];
}

describe("JOB 3741 K3 · Import — entschiedene Vorschlaege bleiben stehen, der Bereich ist zugeklappt", () => {
  // ==============================================================================================
  // K3a · RUNDE 3 — DER VORHER-/NACHHER-BELEG IST JETZT EINE AUSGEFUEHRTE OPERATION.
  // ==============================================================================================
  //
  // WAS RUNDE 2 HIER FALSCH MACHTE (BEN, Korrekturpflicht 1): der Fall schrieb „vorher" und
  // „nachher" als zwei Listen SELBST hin und verglich sie miteinander. Damit maß er nur seine
  // eigene Behauptung — beide Produktmutationen (leerer Listenabruf, Filter auf offene Kandidaten)
  // blieben unbemerkt.
  //
  // JETZT LAEUFT DER WEG WIRKLICH: die echte `ImportReview`-Seite wird montiert, der Verlauf
  // aufgeklappt, der Knopf „Annehmen" der ERSTEN Karte GEKLICKT. Der Klick geht durch
  // `ImportKandidatKarte` → `onReview` → `review.mutate` → `endpoints.library.importCandidates
  // .review` → `invalidateQueries(["import-candidates"])` → erneuter `list()`. Die Attrappe
  // verhaelt sich dabei wie der Server: `review()` SCHREIBT den Status in denselben Bestand, den
  // `list()` danach ausliefert, und entfernt nichts (`listImportCandidates` in
  // `services/library-analytics/src/service.ts` gibt `this.candidates.all()` ohne Statusfilter).
  //
  // Gemessen wird am GEZEICHNETEN DOM (`imp-kandidat-titel`), nicht an der Antwort: nur so faellt
  // der Fall auch dann rot, wenn die Seite den entschiedenen Kandidaten aus der Anzeige filtert.
  it("K3a: eine WIRKLICH ausgefuehrte Entscheidung — danach stehen beide Vorschlaege weiter in der Liste", async () => {
    d.setzeBestand(zweiOffene());
    await montiereImport();

    // Der Verlauf ist zu (das misst K3b eigens) — fuer die Liste muss er aufgehen.
    const details = container.querySelector("details#import-review-queue");
    expect(details, "der Verlauf-Abschnitt fehlt auf der Seite").not.toBeNull();
    await act(async () => {
      (details as HTMLDetailsElement).open = true;
      await flush();
    });

    // VORHER — aus dem Abruf der Seite, nicht aus dieser Datei.
    const vorher = gezeichneteKandidaten();
    expect(vorher, "die Seite zeichnet die beiden Vorschlaege nicht").toEqual([TITEL_A, TITEL_B]);
    const annehmen = [...container.querySelectorAll("button")].filter(
      (b) => (b.textContent ?? "").trim() === wert("de", "imp.accept"),
    );
    expect(annehmen.length, "kein „Annehmen“-Knopf an einem offenen Vorschlag").toBe(2);

    // DIE ENTSCHEIDUNG — ein echter Klick auf der Seite.
    await klicke(annehmen[0]);
    expect(d.review, "die Entscheidung hat den Server gar nicht erreicht").toHaveBeenCalledWith(
      "kand-a",
      "accept",
      undefined,
    );
    expect(
      d.lesBestand().find((c) => c.id === "kand-a")?.status,
      "der Bestand hat die Entscheidung nicht uebernommen",
    ).toBe("angenommen");

    // NACHHER — wieder aus dem Abruf der Seite. BEIDE stehen da, in derselben Reihenfolge.
    const nachher = gezeichneteKandidaten();
    expect(
      nachher,
      "ein entschiedener Vorschlag ist aus der gezeichneten Liste gefallen — genau das behauptete Runde 1",
    ).toEqual(vorher);
    // Und der entschiedene traegt jetzt seinen neuen Stand: was sich bewegt, ist der STATUS.
    const zustaende = alle("imp-kandidat-titel").map(
      (e) => e.closest("div")?.parentElement?.textContent ?? "",
    );
    expect(zustaende[0], "der entschiedene Vorschlag zeigt seinen neuen Stand nicht").toContain(
      wert("de", "imp.status.angenommen"),
    );
    // Der ZAEHLER bewegt sich dagegen — aus derselben Quelle, die auch die Seite benutzt.
    const offenNachher = d.lesBestand().filter((c) => isOpenImportCandidate(String(c.status)));
    expect(
      offenNachher.map((c) => c.id),
      "der Zaehler hat sich nicht bewegt",
    ).toEqual(["kand-b"]);
  });

  it("K3a-KALIBRIERUNG: ohne Kandidaten zeichnet dieselbe Seite KEINE Karte — der Fall haengt am Abruf", async () => {
    // Ohne diesen Fall bliebe offen, ob `gezeichneteKandidaten()` ueberhaupt am Listenabruf haengt.
    // Liefert der Abruf nichts, steht dort nichts — und K3a oben kann nicht zufaellig gruen sein.
    d.setzeBestand([]);
    await montiereImport();
    const details = container.querySelector("details#import-review-queue");
    await act(async () => {
      (details as HTMLDetailsElement).open = true;
      await flush();
    });
    expect(gezeichneteKandidaten(), "ohne Bestand zeichnet die Seite trotzdem Karten").toEqual([]);
  });

  it("K3b: der Bereich mit der Liste ist standardmaessig ZUGEKLAPPT und nennt offen und gesamt getrennt", async () => {
    await montiere(
      createElement(ImportHistorySection, {
        openCount: 1,
        totalCount: 2,
        children: createElement("p", { "data-testid": "probe-liste" }, "zwei Vorschlaege"),
      }),
      "/import",
    );
    const details = container.querySelector("details");
    expect(details, "der Bereich ist kein <details>").not.toBeNull();
    expect(
      details?.hasAttribute("open"),
      "der Bereich steht offen — der Text sagt „zugeklappt“",
    ).toBe(false);
    const kopf = (details?.querySelector("summary")?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(kopf, "der Abschnittstitel fehlt").toContain(
      wert("de", "imp.history.title").split(":")[0] ?? "",
    );
    expect(kopf, "der Zaehler nennt offen und gesamt nicht getrennt").toContain(
      "1 offen · 2 gesamt",
    );
  });

  it("K3c: der Kapiteltext nennt den Abschnitt und die echten Knopf-Beschriftungen", async () => {
    for (const lng of SPRACHEN) {
      const text = kapiteltext(lng, "import");
      // Der Abschnittstitel steht im Woerterbuch als „<Name>: <Erlaeuterung>" — im Kapiteltext
      // steht der NAME, nicht der ganze Satz. Er wird deshalb aus derselben Quelle geschnitten und
      // nicht abgetippt.
      const abschnitt = (wert(lng, "imp.history.title").split(":")[0] ?? "").trim();
      expect(abschnitt.length, `${lng}: der Abschnitt hat keinen Namen`).toBeGreaterThan(0);
      expect(text, `${lng}: der Kapiteltext nennt den Abschnitt „${abschnitt}“ nicht`).toContain(
        abschnitt,
      );
      for (const key of ["imp.accept", "imp.reject"]) {
        expect(text, `${lng}: die Knopf-Beschriftung ${key} fehlt im Kapiteltext`).toContain(
          wert(lng, key),
        );
      }
    }
  });

  it("K3d: und er behauptet NICHT mehr, der naechste rücke von selbst nach", async () => {
    const alt: Readonly<Record<Sprache, string>> = {
      de: "danach rückt der nächste nach",
      en: "the next one moves up",
      nl: "daarna schuift het volgende op",
    };
    for (const lng of SPRACHEN) {
      expect(
        kapiteltext(lng, "import"),
        `${lng}: die erfundene Automatik aus Runde 1 steht noch da`,
      ).not.toContain(alt[lng]);
    }
  });
});
