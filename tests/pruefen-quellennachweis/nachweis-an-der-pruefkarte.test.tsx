// @vitest-environment jsdom
// ================================================================================================
// JOB 4013 — WER FREIGIBT, SIEHT DEN NACHWEIS: Zeitpunkt, Adresse und Belegstelle je Quelle
// ================================================================================================
//
// DER BEFUND (gemessen am main `b0315de`, 1.0.0-beta.1.503): auf `/pruefen` entschied ein Mensch
// über fremdes Wissen, ohne dessen Herkunft sehen zu können. Die Quelle stand als Namensschildchen
// da — `Validation.tsx:1487` zeichnete ausschliesslich `{q.label}`, daneben ein Datei-Symbol. WANN
// die Quelle ans Objekt kam, WOHER sie stammt und WELCHE Stelle sie belegt, lag die ganze Zeit am
// Draht (`KoSource` führt `at`, `url`, `excerpt` — `api/types.ts:46-56`; die Board-Route reicht
// `sources` unbeschnitten durch — `services/validation/src/board-herkunft.ts:122-135`) und wurde
// von der Fläche weggeworfen. Freigeben und Ablehnen sitzen auf DERSELBEN Karte.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE, über den echten react-query-Weg: gemockt ist der
// ENDPUNKT, nicht der Haken. Damit läuft die ganze Kette `endpoints.validation.board` →
// `useValidationBoard` → `boardZeilen` → `karte()`. Muster und Kulisse übernommen von
// `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` — ein zweiter Aufbau für dieselbe Seite
// wäre eine zweite Wahrheit über sie.
//
// JEDER FALL PRÜFT BEIDE RICHTUNGEN, wo es eine zweite gibt: die Angabe erscheint bei ihrer Lage
// UND sie erscheint nicht, wo sie nicht belegt ist. Ein Platzhalter zählt als Erfindung, nicht als
// Anzeige.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: vi.fn(async () => []), overview: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: false,
        mode: "none",
        reachable: "unknown",
        tasks: {},
      })),
    },
    ko: {
      act: vi.fn(async () => ({})),
      aiCheckRetry: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    lifecycle: { pending: vi.fn(async () => []) },
  },
}));

vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoSource, ValidationBoardKo } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { sourceBadgeKey } from "../../apps/web/src/lib/koSource";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

const ZEIT_ISO = "2026-09-14T10:00:00Z";
const ADRESSE = "https://beispiel.de/norm/din-1234/abschnitt-7";
const AUSZUG = "Kap. 1 — die tragende Naht wird vor dem Verzinken geprüft.";

/** Die volle Quelle des Auftrags (§6): alle drei Angaben belegt. */
function quelle(over: Partial<KoSource> = {}): KoSource {
  return {
    id: "q1",
    label: "DIN 1234",
    url: ADRESSE,
    excerpt: AUSZUG,
    kind: "external",
    peerValidated: false,
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function zeile(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: null,
    confidentialityProvenance: "unknown",
    origin: null,
    originSources: [],
    ...over,
  } as ValidationBoardKo;
}

/**
 * Fall e) misst, ob der Klick die Seite ins Wissensobjekt springen lässt — am ECHTEN Router und
 * NICHT an einem ersetzten `useNavigate`: die Karte navigiert über `navigate()`
 * (`Validation.tsx:1332`), und ein Mock davon bewiese nur, dass der Mock gerufen wird. Diese Sonde
 * steht als Geschwister der Seite IM Router und schreibt den aktuellen Pfad in den Baum — sie liegt
 * ausserhalb der Karte, damit ihr Text keine Kartenmessung verfälscht.
 */
function Ort(): JSX.Element {
  const { pathname } = useLocation();
  return createElement("span", { "data-testid": "test-ort" }, pathname);
}

function ort(): string {
  return (
    (container.querySelector('[data-testid="test-ort"]') as HTMLElement | null)?.textContent ?? ""
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountMit(items: ValidationBoardKo[]): Promise<void> {
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    items as never,
  );
  (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
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
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Ort),
          createElement(Validation),
        ),
      ),
    );
  });
  for (
    let i = 0;
    i < 8 && container.querySelectorAll('[data-testid="validation-row"]').length === 0;
    i += 1
  ) {
    await flush();
  }
}

/**
 * Ein Klick wie von einer Maus — mit einem Vorbehalt, der KEINE Produktionswirkung hat: der
 * mitgehörte `preventDefault` unterdrückt allein die jsdom-Eigenreaktion auf ein `<a>` (dort ist
 * Navigation „not implemented"). Die React-Handler der Karte laufen davon unberührt weiter; dass
 * der Weg ins Objekt überhaupt noch funktioniert, misst die Gegenrichtung in Fall e).
 */
async function klick(el: Element | null): Promise<void> {
  const halt = (e: Event): void => e.preventDefault();
  document.addEventListener("click", halt, true);
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  document.removeEventListener("click", halt, true);
}

/** Der Aufklapper „Mehr", wie ihn ein Mensch öffnet — sonst misst der Test eine zugeklappte Fläche. */
async function aufklappen(): Promise<void> {
  await act(async () => {
    for (const d of container.querySelectorAll("details")) {
      d.open = true;
    }
  });
}

const KARTE = '[data-testid="pruefen-karte"]';
const CHIP = '[data-testid="pruefen-chip"]';
const NACHWEIS = '[data-testid="pruefen-quellennachweis"]';
const ZEIT = '[data-testid="pruefen-quelle-zeit"]';
const ADRESS_MARKE = '[data-testid="pruefen-quelle-adresse"]';
const AUSZUG_MARKE = '[data-testid="pruefen-quelle-auszug"]';

function karteText(): string {
  return (container.querySelector(KARTE) as HTMLElement | null)?.textContent ?? "";
}

/**
 * Der Text GENAU des Nachweises — nicht der ganzen Karte. „—" und „unbekannt" stehen auf der Karte
 * schon aus anderem Recht (`val.herkunft.unbekannt` bei `origin: null`, die Entscheidungszeile);
 * ein Platzhalterverbot, das die ganze Karte misst, wäre entweder falsch-rot oder stumpf.
 */
function nachweisText(): string {
  return alle(NACHWEIS)
    .map((e) => e.textContent ?? "")
    .join(" | ");
}

function einer(wahl: string): HTMLElement | null {
  return container.querySelector(`${KARTE} ${wahl}`) as HTMLElement | null;
}

function alle(wahl: string): HTMLElement[] {
  return [...container.querySelectorAll(`${KARTE} ${wahl}`)] as HTMLElement[];
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ================================================================================================
// a) DIE VOLLE QUELLE — Zeitpunkt, gekürzte Adresse und Auszug stehen an DERSELBEN Karte
// ================================================================================================
describe("JOB 4013 · a: eine belegte Quelle trägt ihren Nachweis", () => {
  it("Zeitpunkt am Chip, Adresse und Belegstelle an der Karte", async () => {
    await mountMit([zeile({ sources: [quelle()] })]);
    await aufklappen();

    // Der Zeitpunkt in der Zeitregel des Hauses (Datum + Uhrzeit, aktive Sprache).
    const erwarteteZeit = new Date(ZEIT_ISO).toLocaleDateString("de", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    expect(einer(ZEIT)?.textContent ?? "").toContain(erwarteteZeit);
    expect(karteText()).not.toContain("Invalid Date");

    // Die Adresse ist ein echter Link auf die VOLLE Adresse, in neuem Fenster und ohne Mitgabe.
    const link = einer(ADRESS_MARKE) as HTMLAnchorElement | null;
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe(ADRESSE);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("beispiel.de");

    // Die Belegstelle im Wortlaut der Quelle, als Zitat ausgezeichnet.
    expect(einer(AUSZUG_MARKE)?.textContent ?? "").toContain(AUSZUG);
    expect(einer(AUSZUG_MARKE)?.tagName).toBe("BLOCKQUOTE");

    // Die bestehende Stufenmarkierung wird benutzt und nicht nachgebaut (Lieferung 5).
    expect(karteText()).toContain(de(sourceBadgeKey({ peerValidated: false })));
  });

  it("der Name der Quelle bleibt — der Nachweis ERGÄNZT ihn, er ersetzt ihn nicht", async () => {
    await mountMit([zeile({ sources: [quelle()] })]);
    await aufklappen();

    expect(alle(CHIP)[0]?.textContent ?? "").toContain("DIN 1234");
  });

  it("Freigeben und Ablehnen sitzen auf DERSELBEN Karte wie der Nachweis", async () => {
    await mountMit([zeile({ sources: [quelle()] })]);
    await aufklappen();

    // Der Zweck des Auftrags: die Herkunft ist beurteilbar, BEVOR entschieden wird — ohne
    // Seitenwechsel. Also müssen Nachweis und Entscheidungsknöpfe eine Karte teilen.
    expect(einer('[data-testid="pruefen-entscheidung-up"]')).not.toBeNull();
    expect(einer('[data-testid="pruefen-entscheidung-down"]')).not.toBeNull();
    expect(einer(ADRESS_MARKE)).not.toBeNull();
  });
});

// ================================================================================================
// b) FEHLEN HEISST FEHLEN — `url: null` und `excerpt: null` erscheinen GAR NICHT
// ================================================================================================
describe("JOB 4013 · b: keine Angabe, kein Platzhalter", () => {
  it("ohne Adresse und ohne Auszug fehlen genau diese zwei — der Zeitpunkt steht trotzdem", async () => {
    await mountMit([zeile({ sources: [quelle({ url: null, excerpt: null })] })]);
    await aufklappen();

    expect(einer(ADRESS_MARKE)).toBeNull();
    expect(einer(AUSZUG_MARKE)).toBeNull();
    expect(einer(ZEIT)).not.toBeNull();

    // Kein Ersatzzeichen, kein „unbekannt" — der Nachweis behauptet nichts über die fehlende
    // Angabe. Gemessen am Nachweis UND am Chip, den beiden Orten, die diese Quelle zeichnen.
    const gezeichnet = `${nachweisText()} | ${alle(CHIP)[0]?.textContent ?? ""}`;
    expect(gezeichnet).not.toContain("—");
    expect(gezeichnet).not.toContain("unbekannt");
    expect(gezeichnet).not.toContain("null");
    expect(gezeichnet).not.toContain("http");
  });

  it("ein blanker Wert zählt wie ein fehlender", async () => {
    await mountMit([zeile({ sources: [quelle({ url: "   ", excerpt: "  \n " })] })]);
    await aufklappen();

    expect(einer(ADRESS_MARKE)).toBeNull();
    expect(einer(AUSZUG_MARKE)).toBeNull();
  });
});

// ================================================================================================
// c) EIN UNLESBARES `at` ERZEUGT KEINE ZEITANGABE — und schon gar nicht „Invalid Date"
// ================================================================================================
describe("JOB 4013 · c: kein geratener Zeitpunkt", () => {
  for (const kaputt of ["", "   ", "irgendwann", "2026-13-45T99:99:99Z"]) {
    it(`\`at: ${JSON.stringify(kaputt)}\` zeigt keine Zeit`, async () => {
      await mountMit([zeile({ sources: [quelle({ at: kaputt })] })]);
      await aufklappen();

      expect(einer(ZEIT)).toBeNull();
      expect(karteText()).not.toContain("Invalid Date");
      expect(karteText()).not.toContain("NaN");
      // Die übrigen zwei Angaben bleiben davon unberührt — ein Fehlen steckt nicht an.
      expect(einer(ADRESS_MARKE)).not.toBeNull();
      expect(einer(AUSZUG_MARKE)).not.toBeNull();
    });
  }
});

// ================================================================================================
// d) EINE ÜBERLANGE ADRESSE WIRD GEKÜRZT ANGEZEIGT — das Ziel bleibt vollständig
// ================================================================================================
describe("JOB 4013 · d: gekürzt gezeigt, voll verlinkt", () => {
  const LANG = `https://beispiel.de/${"a".repeat(200)}/ende`;

  it("der sichtbare Text ist gekürzt, das `href` trägt die VOLLE Adresse", async () => {
    await mountMit([zeile({ sources: [quelle({ url: LANG })] })]);
    await aufklappen();

    const link = einer(ADRESS_MARKE) as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe(LANG);

    const sichtbar = link?.textContent ?? "";
    expect(sichtbar).not.toBe(LANG);
    expect(sichtbar).not.toContain("/ende");
    expect(sichtbar.endsWith("…")).toBe(true);
    // Dieselbe Kürzungsgrenze wie im Bestand (`URL_ECHO_LEN` = 80 + Auslassungszeichen).
    expect(sichtbar).toBe(`${LANG.slice(0, 80)}…`);
    // Die volle Adresse steht NICHT im sichtbaren Text der Karte.
    expect(karteText()).not.toContain(LANG);
  });
});

// ================================================================================================
// e) DER KLICKWEG DER KARTE BLEIBT HEIL — der Link führt nicht ins Wissensobjekt
// ================================================================================================
describe("JOB 4013 · e: ein Klick auf die Adresse navigiert nicht", () => {
  it("Klick auf den Adress-Link öffnet NICHT das Wissensobjekt", async () => {
    await mountMit([zeile({ sources: [quelle()] })]);
    await aufklappen();

    const link = einer(ADRESS_MARKE);
    expect(link).not.toBeNull();
    await klick(link);

    expect(ort()).toBe("/validierung");
  });

  it("Gegenrichtung: ein Klick auf die FREIE Kartenfläche öffnet weiterhin das Objekt", async () => {
    await mountMit([zeile({ sources: [quelle()] })]);

    await klick(einer('[data-testid="pruefen-karte-text"]'));

    expect(ort()).toBe("/wissen/k1");
  });
});

// ================================================================================================
// f) OHNE QUELLEN BLEIBT ALLES, WIE ES WAR — keine leere Zeile, kein Satz „keine Quellen"
// ================================================================================================
describe("JOB 4013 · f: ein Objekt ohne Quellen sagt nichts über Quellen", () => {
  it("keine Chip-Reihe, keine Nachweismarken, kein Leersatz", async () => {
    await mountMit([zeile({ sources: [] })]);
    await aufklappen();

    expect(alle(CHIP)).toHaveLength(0);
    expect(alle(NACHWEIS)).toHaveLength(0);
    expect(einer(ZEIT)).toBeNull();
    expect(einer(ADRESS_MARKE)).toBeNull();
    expect(einer(AUSZUG_MARKE)).toBeNull();
    // Die Board-Antwort sichert keine Vollständigkeit der Quellenliste zu (§9) — eine Entwarnung
    // wäre eine Aussage über einen Bestand, den diese Antwort nicht abbildet.
    expect(karteText()).not.toContain(de("ko.sourcesEmpty"));
  });

  it("fehlt das Feld `sources` ganz (Altbestand), gilt dasselbe", async () => {
    const { sources: _weg, ...ohne } = zeile({ sources: [] });
    await mountMit([ohne as ValidationBoardKo]);
    await aufklappen();

    expect(alle(CHIP)).toHaveLength(0);
    expect(alle(NACHWEIS)).toHaveLength(0);
    expect(einer(ADRESS_MARKE)).toBeNull();
  });
});
