// @vitest-environment jsdom
// ================================================================================================
// JOB 3832 · TOTER ANZEIGETEXT AUF `/duplikate` — WER LIEST DIE ZEHN BRETT-BESCHRIFTUNGEN?
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, in Alltagssprache. `DUPLICATE_BOARD_TEXT` (`apps/web/src/lib/
// duplicateBoard.ts:7-18`) führt zehn Beschriftungen des Duplikate-Bretts. Diese Datei baut die
// echte Fläche `/duplikate` im jsdom auf, bedient sie so, wie ein Mensch sie bedienen kann (beide
// „Mehr", beide „···", das „?", das Abschlussformular), und schneidet dabei mit, WELCHE
// Registerschlüssel die Fläche anfordert. Danach steht für JEDE der zehn Beschriftungen ein
// eigener, benannter Fall da: erreicht sie heute einen Menschen — ja oder nein.
//
// GEMESSEN WIRD AM SCHLÜSSEL, NICHT AM WORTLAUT, und das ist hier nicht Geschmack, sondern
// notwendig: `dup.action.linkRelated` (das tote Mitglied `linkRelated`) trägt WÖRTLICH denselben
// deutschen Satz wie `dup.rec.verwandt_verlinken` — und der wird gezeichnet
// (`Duplicates.tsx:347`). Wer am sichtbaren Text suchte, fände „Als verwandt verlinken" auf dem
// Bildschirm und erklärte den toten Schlüssel für lebendig. Der Mitschnitt hängt deshalb an der
// Übersetzungsfunktion und sieht den angeforderten Schlüssel, nicht sein Ergebnis. Fall K2
// kalibriert genau das: er liest beide Sätze AUS DEM REGISTER, belegt ihre Zeichengleichheit und
// trennt die Schlüssel trotzdem.
//
// DIE FÜNF VERNEINUNGEN SIND EIN BEFUND, KEINE ZUSICHERUNG. `quoteA`, `quoteB`, `dismiss`,
// `keepSeparate` und `linkRelated` haben heute keinen Leser. Diese Datei hält das fest, damit der
// Zustand nicht unbemerkt weiterläuft — sie sagt NICHT, dass es so bleiben soll. Wer die fünf
// Schlüssel wieder verdrahtet, macht die zugehörigen Fälle rot, und das ist richtig so: dann wird
// die Verneinung umgedreht und die Zeile zur Bejahung (Muster JOB 3801/3810/3811).
//
// WOHER DER VERLUST KOMMT (am eigenen Stand nachgemessen mit
// `git log -S "DUPLICATE_BOARD_TEXT.quoteA" --oneline --name-only`): genau zwei Änderungen, beide
// an `apps/web/src/pages/Duplicates.tsx` — `bc87f45` hat die Leser eingeführt, `8f51032`
// („JOB 3061 D7: H2 Prüfen nach Pages-Maßstab … vier Reiter EINER Fläche") hat sie entfernt. Die
// Mitglieder und ihre Registertexte blieben stehen; gemerkt hat es niemand, weil nichts es maß.
//
// WAS DIESE DATEI NICHT TUT. Sie repariert nichts: weder wird ein Schlüssel verdrahtet noch
// entfernt (das braucht `i18n.ts` und `duplicateBoard.ts` und ist ein eigener Schnitt). Sie ändert
// keinen Produktcode, keinen Registertext und keine Oberfläche. Sie startet KEINEN Browser.
//
// WAS SIE NICHT DECKT, ausdrücklich: Englisch und Niederländisch (gemessen wird Deutsch), der
// echte Browser (jsdom hat kein Layout — belegt ist ERREICHBARKEIT, nicht Sichtbarkeit), echtes
// HTTP, echte Persistenz, und jede Fläche ausser `/duplikate` und `/duplikate/:id/vergleich`.
// Ebenfalls nicht gedeckt: der GESCHLOSSENE Zweig der Brettfläche (`canClose` false — dort steht
// statt des Aktionsbandes ein Abschlusssatz). Gemessen ist der offene Eintrag, wie beauftragt.
//
// DOPPELUNG MIT DEM BESTAND, offengelegt statt aufgelöst: dieselbe Fläche messen auch
// `tests/seitenhilfe-dubletten/seitenhilfe-dubletten.test.tsx` (Seitenhilfe) und
// `tests/review26-duplikat-prozente/flaechen-benennen-die-metrik-mounted.test.tsx` (die führende
// Prozentzahl); von Letzterem ist das Aufbaugerüst übernommen. Anderer Gegenstand, kein Umbau.
//
// WARUM HIER KEIN PFAD ZUM 3804er PRÜFSTAND STEHT — der Grund gehört in diese Datei, nicht nur in
// eine Rückgabe: der Auftrag nennt unter seinen Pflichtquellen eine Datei im Ordner
// `tests/seitenhilfe-navkapitel/`, die es am Basisstand dieser Runde nicht gibt; dort liegen drei
// andere Dateien aus JOB 3741/3804. Ihren Pfad hier trotzdem zu nennen, wäre genau die Behauptung,
// die `tests/structure/testverweise-aufloesbar.test.ts` verbietet: ein Kommentar sagt eine
// Prüfabdeckung zu, die ins Leere zeigt. Dieser Wächter hat die Datei in Runde 1 rot gemacht, und
// er hatte recht. Die Doppelung mit jenem Prüfstand ist damit weiterhin offengelegt — benannt ist
// der Ordner, der existiert, statt einer Datei, die es nicht tut.
import { beforeAll, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ duplikate: [] as unknown[] }));

// ------------------------------------------------------------------------------------------------
// D2 — DER SCHLÜSSELMITSCHNITT.
// ------------------------------------------------------------------------------------------------
// Er hängt an der Übersetzungsfunktion und hält das ERSTE Argument jedes `t(...)`-Aufrufs fest,
// also den angeforderten Schlüssel. Damit ist er literalunabhängig: zwei Schlüssel mit demselben
// deutschen Satz sind für ihn zwei Schlüssel. Was er nicht sieht, sieht auch kein Mensch — wo kein
// `t(...)` steht, steht auch kein Registertext auf dem Bildschirm.
const mitschnitt = vi.hoisted(() => {
  const schluessel: string[] = [];
  return {
    schluessel,
    zuruecksetzen(): void {
      schluessel.length = 0;
    },
    merke(roh: unknown): void {
      if (typeof roh === "string") {
        schluessel.push(roh);
        return;
      }
      if (Array.isArray(roh)) {
        for (const eins of roh) {
          if (typeof eins === "string") {
            schluessel.push(eins);
          }
        }
      }
    },
  };
});

vi.mock("../../apps/web/node_modules/react-i18next", async (echtLaden) => {
  const echt = (await echtLaden()) as Record<string, unknown>;
  const echteNutzung = echt.useTranslation as (...args: unknown[]) => {
    t: (...a: unknown[]) => unknown;
    i18n: unknown;
    ready: unknown;
  };
  // EIN Zapfhahn JE ECHTER `t`-Funktion und nicht je Zeichnung: react-i18next hält `t` über die
  // Zeichnungen hinweg stabil, und eine bei jeder Zeichnung neue Funktion machte aus `t` eine
  // wechselnde Abhängigkeit (Endlosschleifen in `useMemo`/`useEffect` der gemessenen Fläche).
  const zapfhaehne = new WeakMap<object, (...a: unknown[]) => unknown>();
  return {
    ...echt,
    useTranslation: (...args: unknown[]): unknown => {
      const nutzung = echteNutzung(...args);
      const echtT = nutzung.t;
      const anker = echtT as unknown as object;
      let zapf = zapfhaehne.get(anker);
      if (zapf === undefined) {
        zapf = (...a: unknown[]): unknown => {
          mitschnitt.merke(a[0]);
          return echtT(...a);
        };
        zapfhaehne.set(anker, zapf);
      }
      const paket = [zapf, nutzung.i18n, nutzung.ready] as unknown as Record<string, unknown>;
      paket.t = zapf;
      paket.i18n = nutzung.i18n;
      paket.ready = nutzung.ready;
      return paket;
    },
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      duplicates: {
        list: ok(() => daten.duplikate),
        settings: ok(() => ({ minConfidence: 0.5 })),
        // Die vier Schreibwege der Fläche. Sie werden in dieser Datei NICHT ausgelöst — ein
        // Abschluss nähme den offenen Eintrag vom Brett, und §9 verlangt die Messung am
        // Zustand `bestand`. Sie stehen hier, damit ein versehentlicher Klick auffiele.
        dismiss: ok(() => ({})),
        keepSeparate: ok(() => ({})),
        linkRelated: ok(() => ({})),
        setStatus: ok(() => ({})),
      },
      conflicts: { list: ok(() => []) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: { list: ok(() => KOS) },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { DUPLICATE_BOARD_TEXT, overlapDetectorInfo } from "../../apps/web/src/lib/duplicateBoard";
import { DuplicateCompare } from "../../apps/web/src/pages/DuplicateCompare";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// D1 — DIE GRUNDMENGE KOMMT AUS DEM PRODUKT.
// ------------------------------------------------------------------------------------------------
// Die zehn Mitglieder und IHRE SCHLÜSSEL werden nie in dieser Datei aufgeschrieben; sie kommen
// über `Object.entries(DUPLICATE_BOARD_TEXT)` aus dem echten Modul. Aufgeschrieben ist hier nur
// die AUSSAGE je Mitglied — genau der Befund, den diese Datei festhält. Kommt ein elftes Mitglied
// hinzu, fehlt es in dieser Tabelle, und D1b meldet es beim Namen.
type Aussage =
  // erreicht heute einen Menschen auf `/duplikate`
  | "gelesen"
  // erreicht ihn nur beim Modellfund (die Erkennungsart schliesst die andere aus)
  | "gelesen-bei-modellfund"
  // erreicht ihn nur beim Textabgleich
  | "gelesen-bei-textabgleich"
  // hat heute NIRGENDS einen Leser — der Befund dieses Auftrags
  | "ohne-leser";

const BEFUND: Record<string, Aussage> = {
  methodModel: "gelesen-bei-modellfund",
  methodDeterministic: "gelesen-bei-textabgleich",
  overlap: "gelesen",
  confidence: "gelesen",
  why: "gelesen",
  quoteA: "ohne-leser",
  quoteB: "ohne-leser",
  dismiss: "ohne-leser",
  keepSeparate: "ohne-leser",
  linkRelated: "ohne-leser",
};

const MITGLIEDER = Object.entries(DUPLICATE_BOARD_TEXT) as ReadonlyArray<[string, string]>;
const OHNE_LESER = Object.keys(BEFUND).filter((name) => BEFUND[name] === "ohne-leser");

/** Das deutsche Register, wie es das Produkt führt — flach, mit den punktierten Schlüsseln. */
const REGISTER = i18n.getResourceBundle("de", "translation") as Record<string, string>;

const ko = (id: string, titel: string, aussage: string) => ({
  id,
  title: titel,
  statement: aussage,
  bodyHtml: null,
  status: "validiert",
  type: "technik",
  category: "Betrieb",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  attachments: [],
  comments: [],
  tags: [],
  neededValidations: 3,
  createdAt: "2026-09-01T06:00:00.000Z",
  updatedAt: "2026-09-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Reifenwechsel A", "Reifen bei unter 1,6 mm Profiltiefe tauschen."),
  ko("ko-b", "Reifenwechsel B", "Abgefahrene Pneus sind vor der Fahrt zu ersetzen."),
];

/**
 * DER EINE OFFENE EINTRAG, der alle Zweige zieht (§5 D3): `detector` vorhanden MIT `confidence`
 * (sonst bleibt `dup.confidence` unerreichbar) und MIT `rationale` (sonst `dup.why`), `aspects`
 * nicht leer, beide Eigenanteile gesetzt, beide Wissensobjekte vorhanden, Status `offen` (sonst
 * fehlt das Aktionsband und das „Status setzen" im „···").
 */
const MODELLFUND = {
  id: "job3832-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "identisch",
  aspects: [
    {
      beschreibung: "Beide nennen die Profiltiefe als Grenze.",
      zitatA: "unter 1,6 mm Profiltiefe",
      zitatB: "Abgefahrene Pneus",
    },
  ],
  eigenanteilA: "Reifen bei unter 1,6 mm",
  eigenanteilB: "vor der Fahrt zu ersetzen",
  // `verwandt_verlinken` ist mit Absicht gewählt: seine Empfehlungsbeschriftung
  // (`dup.rec.verwandt_verlinken`) trägt denselben deutschen Satz wie der TOTE Schlüssel
  // `dup.action.linkRelated`. Damit steht die Falle aus §2(d) im Lauf wirklich auf dem Bildschirm.
  recommendation: "verwandt_verlinken",
  status: "offen",
  pairKey: "dup|ko-a|ko-b",
  origin: "auto",
  detector: {
    trigger: "validation",
    method: "model",
    lexicalScore: 0.26,
    confidence: 0.95,
    rationale: "Gleiche Reifenaussage, anders formuliert.",
    modelLabel: "anthropic:test",
  },
  createdAt: "2026-09-08T09:00:00.000Z",
};

/** Derselbe Eintrag als deterministischer Fund — die zweite Erkennungsart, sonst nichts geändert. */
const TEXTABGLEICH = {
  ...MODELLFUND,
  detector: {
    trigger: "validation",
    method: "deterministic",
    lexicalScore: 0.26,
    rationale: "Hohe Wortdeckung im Kernsatz.",
  },
};

const VERGLEICHSPFAD = `/duplikate/${MODELLFUND.id}/vergleich`;

/**
 * Eine mehrteilige Fehlermeldung zusammensetzen. Bewusst eine Funktion und kein `+` über mehrere
 * Zeilen: Biome verlangt dafür ein einziges Zeichenkettenliteral (`lint/style/useTemplate`), und
 * eine 200 Zeichen lange Zeile liest niemand mehr — die Meldung IST hier der Nutzen der Datei.
 */
function meldung(...teile: readonly string[]): string {
  return teile.join("");
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Ein Lauf: was die Fläche angefordert hat, und woran belegt ist, dass sie überhaupt dastand. */
interface Lauf {
  angefordert: ReadonlySet<string>;
  /** Wie viele Schlüssel insgesamt angefordert wurden — die Lebendprobe des Mitschnitts. */
  anzahl: number;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mounte(pfad: string, inhalt: unknown): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt as never),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

async function raeumeAb(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

function fehlt(selektor: string): boolean {
  return container.querySelector(selektor) === null;
}

async function klicke(el: Element | null): Promise<void> {
  if (el === null) {
    return;
  }
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(flush);
}

/** Wert in ein React-gesteuertes Eingabefeld schreiben — über den nativen Setter, sonst sieht React nichts. */
async function schreibe(el: Element | null, wert: string): Promise<void> {
  if (el === null) {
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(flush);
}

// ------------------------------------------------------------------------------------------------
// §9 — KEINE VERNEINUNG OHNE BELEGTE DATENGRUNDLAGE.
// ------------------------------------------------------------------------------------------------
// „Schlüssel X wurde nie angefordert" darf erst gesagt werden, wenn die Fläche wirklich im Zustand
// `bestand` steht: Duplikatabruf UND Objektabruf erfolgreich abgeschlossen, ein Kartenpaar
// gezeichnet, keine gescheiterte Auffrischung. Eine Fläche, die noch lädt, fordert die Schlüssel
// schlicht noch nicht an — eine Verneinung darüber wäre falsches Grün. Die drei anderen Lagen
// werden deshalb ABGEWARTET und einzeln ausgeschlossen, nicht angenommen.
function verlangeBestand(route: string): void {
  const lagen = [
    ['[data-testid="pruefen-platzhalter"]', "laedt (Platzhalterzeilen)"],
    ['[data-testid="pruefen-erstfehler"]', "erstfehler (Abruf nie beantwortet)"],
    ['[data-testid="pruefen-satz-leer"]', "leer (keine offene Überschneidung)"],
    ['[data-testid="pruefen-nicht-frisch"]', "bestand, aber Auffrischung gescheitert"],
  ] as const;
  for (const [selektor, name] of lagen) {
    expect(
      fehlt(selektor),
      meldung(
        `${route}: die Fläche steht in der Lage „${name}" — in diesem Zustand fordert sie die `,
        "Brettbeschriftungen gar nicht erst an; eine Verneinung darüber wäre falsches Grün.",
      ),
    ).toBe(true);
  }
  for (const seite of ["a", "b"] as const) {
    const karte = container.querySelector(`[data-testid="pruefen-paar-karte-${seite}"]`);
    expect(karte, `${route}: die Karte ${seite.toUpperCase()} ist nicht gezeichnet`).not.toBeNull();
    expect(
      (karte?.textContent ?? "").includes(REGISTER["board.koRemoved"] ?? " "),
      meldung(
        `${route}: Karte ${seite.toUpperCase()} sagt „Beitrag wurde entfernt" — der Objektabruf `,
        "ist nicht erfolgreich abgeschlossen, die Fläche zeigt kein echtes Paar.",
      ),
    ).toBe(false);
  }
}

/**
 * Das Brett aufbauen, bedienen und mitschneiden. Bedient wird ALLES, was ein Mensch bedienen kann:
 * beide „Mehr"-Flächen, beide „···"-Menüs, das „?"-Menü und das Abschlussformular (geöffnet,
 * Grund gewählt, Vermerk getippt — ABGESCHICKT wird nicht, s. Endpunkt-Attrappe oben).
 */
async function fahreBrett(eintrag: unknown): Promise<Lauf> {
  daten.duplikate = [eintrag];
  await i18n.changeLanguage("de");
  mitschnitt.zuruecksetzen();
  await mounte("/duplikate", createElement(Duplicates) as unknown);
  verlangeBestand("/duplikate");

  // Beide „Mehr" aufklappen. Der Inhalt eines `<details>` wird von React ohnehin gezeichnet; das
  // Aufklappen ist trotzdem echte Bedienung und schliesst aus, dass ein Zweig daran hängt.
  await act(async () => {
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
  });
  await act(flush);

  // Das „?"-Menü neben der Überschrift.
  await klicke(container.querySelector('[data-testid="pruefen-menue-hilfe"]'));

  // Beide „···"-Menüs, und in jedem das Abschlussformular.
  for (const seite of ["a", "b"] as const) {
    await klicke(container.querySelector(`[data-testid="pruefen-menue-duplikat-${seite}"]`));
    const panel = container.querySelector(`[data-testid="pruefen-menue-panel-duplikat-${seite}"]`);
    const geschlossen = [...(panel?.querySelectorAll("button") ?? [])].find(
      (b) => (b.textContent ?? "").trim() === REGISTER["dup.status.geschlossen"],
    );
    await klicke(geschlossen ?? null);
    const form = container.querySelector(`[data-testid="pruefen-abschluss-${seite}"]`);
    expect(
      form,
      meldung(
        `/duplikate: das Abschlussformular der Seite ${seite.toUpperCase()} liess sich nicht `,
        "öffnen — dann ist dieser Bedienweg nicht gemessen.",
      ),
    ).not.toBeNull();
    await klicke(form?.querySelector('input[type="radio"]') ?? null);
    await schreibe(form?.querySelector('input[type="text"]') ?? null, "Vermerk der Messung");
  }

  // Nach der Bedienung noch einmal: die Fläche steht weiterhin auf ihrem Bestand.
  verlangeBestand("/duplikate");
  const angefordert = new Set(mitschnitt.schluessel);
  const anzahl = mitschnitt.schluessel.length;
  await raeumeAb();
  return { angefordert, anzahl };
}

/** D4 — dieselbe Aufzeichnung an der Vergleichsfläche `/duplikate/:id/vergleich`. */
async function fahreVergleich(): Promise<Lauf> {
  daten.duplikate = [MODELLFUND];
  await i18n.changeLanguage("de");
  mitschnitt.zuruecksetzen();
  await mounte(
    VERGLEICHSPFAD,
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/duplikate/:id/vergleich",
        element: createElement(DuplicateCompare, { kind: "duplicate" }),
      }),
    ) as unknown,
  );
  for (const [kennung, name] of [
    ["laedt", "lädt"],
    ["fehler", "Abruf gescheitert"],
    ["fehlt", "Eintrag nicht gefunden"],
  ] as const) {
    expect(
      fehlt(`[data-testid="pruefen-satz-${kennung}"]`),
      `${VERGLEICHSPFAD}: die Seite steht in der Lage „${name}" — dort fordert sie nichts an.`,
    ).toBe(true);
  }
  expect(
    container.querySelector('[data-testid="pruefen-paar-karte-a"]'),
    `${VERGLEICHSPFAD}: kein Kartenpaar gezeichnet`,
  ).not.toBeNull();
  await act(async () => {
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
  });
  await act(flush);
  const angefordert = new Set(mitschnitt.schluessel);
  const anzahl = mitschnitt.schluessel.length;
  await raeumeAb();
  return { angefordert, anzahl };
}

let brettModell: Lauf;
let brettText: Lauf;
let vergleich: Lauf;

beforeAll(async () => {
  brettModell = await fahreBrett(MODELLFUND);
  brettText = await fahreBrett(TEXTABGLEICH);
  vergleich = await fahreVergleich();
}, 60_000);

/** Die Fehlermeldung nennt immer Route, Mitgliedsname und Schlüssel. */
function anschrift(route: string, mitglied: string): string {
  return `${route}: Mitglied \`${mitglied}\` → Schlüssel \`${DUPLICATE_BOARD_TEXT[mitglied as keyof typeof DUPLICATE_BOARD_TEXT]}\``;
}

describe("JOB 3832 · D1 — die Grundmenge kommt aus dem Produkt, nicht aus diesem Test", () => {
  it("D1a: jedes Mitglied zeigt auf einen Schlüssel, der im deutschen Register steht", () => {
    const leer = MITGLIEDER.filter(([, schluessel]) => !Object.hasOwn(REGISTER, schluessel));
    expect(
      leer,
      meldung(
        "Diese Mitglieder von DUPLICATE_BOARD_TEXT zeigen ins Leere — im deutschen Register ",
        "(apps/web/src/i18n.ts) gibt es den Schlüssel nicht: ",
        leer.map(([name, schluessel]) => `${name} → ${schluessel}`).join(", "),
      ),
    ).toEqual([]);
    expect(MITGLIEDER.length).toBeGreaterThan(0);
  });

  it("D1b: über JEDES Mitglied trifft diese Datei eine Aussage — ein elftes wird gemeldet", () => {
    const ohneAussage = MITGLIEDER.filter(([name]) => !Object.hasOwn(BEFUND, name)).map(
      ([name, schluessel]) => `${name} (${schluessel})`,
    );
    expect(
      ohneAussage,
      meldung(
        "NEUE MITGLIEDER in `DUPLICATE_BOARD_TEXT` (apps/web/src/lib/duplicateBoard.ts), über die ",
        "diese Datei nichts sagt. Für jedes gehört eine Zeile in `BEFUND` und damit ein eigener ",
        "Fall in D3 — sonst bleibt unbemerkt, ob es je einen Menschen erreicht: ",
        ohneAussage.join(", "),
      ),
    ).toEqual([]);
    const verschwunden = Object.keys(BEFUND).filter(
      (name) => !Object.hasOwn(DUPLICATE_BOARD_TEXT, name),
    );
    expect(
      verschwunden,
      meldung(
        "Diese Mitglieder stehen noch in `BEFUND`, aber nicht mehr in `DUPLICATE_BOARD_TEXT` — ",
        "die Aussage dieser Datei ist veraltet: ",
        verschwunden.join(", "),
      ),
    ).toEqual([]);
  });
});

describe("JOB 3832 · D2 — der Mitschnitt misst den Schlüssel, nicht den Wortlaut", () => {
  it("K1: der Mitschnitt hat auf `/duplikate` wirklich zugehört", () => {
    // Ohne diese Lebendprobe wäre jede Verneinung unten auch dann grün, wenn gar nichts
    // aufgezeichnet worden wäre — der bequemste Weg zu falschem Grün.
    expect(
      brettModell.anzahl,
      meldung(
        "/duplikate: der Mitschnitt hat keinen einzigen Schlüssel gesehen — dann sagt keine ",
        "Verneinung dieser Datei etwas aus.",
      ),
    ).toBeGreaterThan(20);
    expect(
      brettModell.angefordert.has("pruefen.more"),
      meldung(
        "/duplikate: selbst `pruefen.more` (die Beschriftung der „Mehr“-Fläche) wurde nicht ",
        "aufgezeichnet — der Mitschnitt hängt nicht an der Übersetzungsfunktion.",
      ),
    ).toBe(true);
  });

  it("K2: zwei Schlüssel mit ZEICHENGLEICHEM deutschen Satz werden dennoch getrennt", () => {
    // Beide Sätze kommen AUS DEM REGISTER, nicht aus diesem Test.
    const tot = REGISTER[DUPLICATE_BOARD_TEXT.linkRelated];
    const lebend = REGISTER["dup.rec.verwandt_verlinken"];
    expect(tot, `\`${DUPLICATE_BOARD_TEXT.linkRelated}\` fehlt im deutschen Register`).toBeTruthy();
    expect(lebend, "`dup.rec.verwandt_verlinken` fehlt im deutschen Register").toBeTruthy();
    expect(
      tot,
      meldung(
        "KALIBRIERUNG HINFÄLLIG: `dup.action.linkRelated` und `dup.rec.verwandt_verlinken` tragen ",
        "nicht mehr denselben deutschen Satz. Dann fällt die Literalfalle weg, die dieser Fall ",
        "absichert — der Dateikopf ist nachzuführen.",
      ),
    ).toBe(lebend);
    // Der lebende Zwilling steht im Lauf tatsächlich auf dem Bildschirm …
    expect(
      brettModell.angefordert.has("dup.rec.verwandt_verlinken"),
      meldung(
        "/duplikate: die Empfehlung `dup.rec.verwandt_verlinken` wurde nicht angefordert — dann ",
        "stand der zeichengleiche Satz gar nicht da und die Falle ist nicht gestellt.",
      ),
    ).toBe(true);
    // … und der tote Zwilling trotzdem nicht. Eine Messung am DOM-Text könnte das nicht sagen.
    expect(
      brettModell.angefordert.has(DUPLICATE_BOARD_TEXT.linkRelated),
      meldung(
        `/duplikate: \`${DUPLICATE_BOARD_TEXT.linkRelated}\` wurde angefordert, obwohl D3 ihn `,
        "als ohne Leser führt — Befund und Datei sind auseinandergelaufen.",
      ),
    ).toBe(false);
  });
});

describe("JOB 3832 · D3 — welche der zehn Beschriftungen erreicht heute einen Menschen?", () => {
  it("`methodModel`: beim Modellfund angefordert, beim Textabgleich nicht", () => {
    const schluessel = DUPLICATE_BOARD_TEXT.methodModel;
    // Was die Fläche wählt, entscheidet das Produkt — hier nachgelesen, nicht behauptet.
    expect(overlapDetectorInfo(MODELLFUND as never)?.methodLabelKey).toBe(schluessel);
    expect(
      brettModell.angefordert.has(schluessel),
      meldung(
        `${anschrift("/duplikate", "methodModel")} wurde beim KI-Fund NICHT angefordert — die `,
        "Erkennungsart steht dem Menschen nicht mehr im „Mehr“.",
      ),
    ).toBe(true);
    expect(
      brettText.angefordert.has(schluessel),
      meldung(
        `${anschrift("/duplikate", "methodModel")} wurde beim TEXTABGLEICH angefordert — dann `,
        "etikettiert die Fläche einen deterministischen Fund als „KI-Prüfung“.",
      ),
    ).toBe(false);
  });

  it("`methodDeterministic`: beim Textabgleich angefordert, beim Modellfund nicht", () => {
    const schluessel = DUPLICATE_BOARD_TEXT.methodDeterministic;
    expect(overlapDetectorInfo(TEXTABGLEICH as never)?.methodLabelKey).toBe(schluessel);
    expect(
      brettText.angefordert.has(schluessel),
      meldung(
        `${anschrift("/duplikate", "methodDeterministic")} wurde beim Textabgleich NICHT `,
        "angefordert — die Erkennungsart steht dem Menschen nicht mehr im „Mehr“.",
      ),
    ).toBe(true);
    expect(
      brettModell.angefordert.has(schluessel),
      `${anschrift("/duplikate", "methodDeterministic")} wurde beim KI-Fund angefordert.`,
    ).toBe(false);
  });

  for (const mitglied of ["overlap", "confidence", "why"] as const) {
    it(`\`${mitglied}\`: wird auf dem offenen Brett angefordert`, () => {
      const schluessel = DUPLICATE_BOARD_TEXT[mitglied];
      expect(
        brettModell.angefordert.has(schluessel),
        meldung(
          `${anschrift("/duplikate", mitglied)} wurde von der laufenden Fläche NICHT angefordert. `,
          "Damit hat auch diese Beschriftung ihren Leser verloren — genau der stille Verlust, ",
          "den `8f51032` an fünf anderen Mitgliedern angerichtet hat.",
        ),
      ).toBe(true);
    });
  }

  for (const mitglied of OHNE_LESER) {
    it(`\`${mitglied}\`: hat auf dem Brett heute KEINEN Leser (Befund, keine Zusicherung)`, () => {
      const schluessel = DUPLICATE_BOARD_TEXT[mitglied as keyof typeof DUPLICATE_BOARD_TEXT];
      for (const [lauf, art] of [
        [brettModell, "KI-Fund"],
        [brettText, "Textabgleich"],
      ] as const) {
        expect(
          lauf.angefordert.has(schluessel),
          meldung(
            `${anschrift("/duplikate", mitglied)} WIRD wieder angefordert (Lauf: ${art}). Das `,
            "ist kein Fehler, sondern die Behebung des Befundes dieser Datei: der Schlüssel ",
            "hatte seit `8f51032` (JOB 3061 D7) keinen Leser mehr. Diesen Fall jetzt umdrehen — ",
            "aus der Verneinung wird eine Bejahung — und den Dateikopf nachführen.",
          ),
        ).toBe(false);
      }
    });
  }
});

describe("JOB 3832 · D4 — auch die Vergleichsfläche liest die fünf nicht", () => {
  it("die Vergleichsfläche wurde wirklich aufgezeichnet", () => {
    expect(
      vergleich.anzahl,
      meldung(
        `${VERGLEICHSPFAD}: der Mitschnitt hat keinen Schlüssel gesehen — dann sagt die `,
        "Verneinung über diese Fläche nichts aus.",
      ),
    ).toBeGreaterThan(20);
    expect(
      vergleich.angefordert.has("dcmp.compareByAreas"),
      meldung(
        `${VERGLEICHSPFAD}: die Abschnittsgegenüberstellung wurde nicht angefordert — die Seite `,
        "stand nicht vollständig da.",
      ),
    ).toBe(true);
  });

  for (const mitglied of OHNE_LESER) {
    it(`\`${mitglied}\`: hat auch auf der Vergleichsfläche keinen Leser`, () => {
      const schluessel = DUPLICATE_BOARD_TEXT[mitglied as keyof typeof DUPLICATE_BOARD_TEXT];
      expect(
        vergleich.angefordert.has(schluessel),
        meldung(
          `${anschrift(VERGLEICHSPFAD, mitglied)} WIRD auf der Vergleichsfläche angefordert. `,
          "Dann ist der Schlüssel nicht mehr tot und dieser Fall gehört umgedreht.",
        ),
      ).toBe(false);
    });
  }
});
