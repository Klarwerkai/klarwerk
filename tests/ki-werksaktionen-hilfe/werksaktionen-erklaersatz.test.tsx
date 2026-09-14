// @vitest-environment jsdom
// ================================================================================================
// JOB 3831 — DER WEG VOM KI-KNOPF ZU SEINEM ERKLÄRSATZ WIRD GEMESSEN, NICHT VERMUTET.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. In der KI-Palette des Erfassungsblatts (`/erfassen`, Werkzeug „KI ▾")
// stehen die fünf fest eingebauten Werksaktionen aus `ASSIST_ACTIONS` — „Klarer formulieren",
// „Strukturieren", „Ausführlicher", „Rechtschreibung", „Formatieren". Zu jeder gibt es seit
// SCRUM-404 einen Erklärsatz (`capture.ai.help.<aktion>`, `i18n.ts:2007-2011`). Seit JOB 3060 (H1)
// zeichnet `HelpTip` diesen Satz nicht mehr selbst, sondern meldet ihn bei der Seitenhilfe an
// (`HelpTip.tsx:11-14` → `SeitenhilfeContext.tsx:65-72`); das Zahnrad-Menü listet die Anmeldungen
// der aktuellen Seite unter „Seitenhilfe" (`ZahnradMenue.tsx:51-72`). OB ein Mensch den Satz dort
// je zu fassen bekommt, hat bis hierher niemand gemessen. Diese Datei misst es.
//
// SIE MASS, SIE REPARIERTE NICHT — IN RUNDE 1 (JOB 3831). Keine Produktdatei wurde angefasst;
// `AiAssistBox.tsx` und `erfassen/Menue.tsx` gehören JOB 3769 (Auftrag §10). Festgehalten wurde der
// damals gemessene Zustand, mit dem Sollzustand daneben: wird der Mangel behoben, schlagen die
// Befundfälle an und sind dann UMZUDREHEN. Genau das ist ihr Zweck — und genau das ist eingetreten.
//
// ------------------------------------------------------------------------------------------------
// JOB 3880 — DREI DER VIER BEFUNDE SIND UMGEDREHT. AUS „GEMESSEN" WURDE „ZUGESICHERT".
// ------------------------------------------------------------------------------------------------
// `components/erfassen/hilfe.ts` meldet die fünf Werksaktionen seither im Hilferegister des Blattes
// an (`EIGENE_SCHLUESSEL`, abgeleitet aus `ASSIST_ACTIONS`). Damit trägt die Kette auch auf dem
// Blatt, und W1, W2a und W2b sagen das Gegenteil von vorher:
//   · W1  BEFUND „keiner der fünf Sätze steht in der Zahnrad-Liste"
//         → ZUSICHERUNG „alle fünf stehen darin, mit Titel UND Text, bei GESCHLOSSENER Palette".
//   · W2a BEFUND (erste Ablesung) „auch vor dem Öffnen der Palette steht keiner darin"
//         → ZUSICHERUNG „alle fünf stehen schon vor dem Öffnen darin". Die ZWEITE Ablesung von W2a
//         (offene Palette ⇒ gar kein Zahnrad-Menü) ist ein ANDERER Befund und bleibt Befund: er
//         gehört einer eigenen Zeile (JOB 3880 Auftrag §10) und wurde von dieser Änderung nicht
//         berührt — nachgemessen, nicht angenommen.
//   · W2b BEFUND „nach dem Weg Palette auf → Zahnrad → Seitenhilfe fehlen die fünf Sätze"
//         → ZUSICHERUNG „nach demselben Weg stehen sie da".
// W3 und W4 wurden ebenfalls nachgemessen und NICHT umgedreht: W3 misst den Ausschluss der beiden
// Flächen (unverändert), W4 das Expertenformular (war schon zugesichert und blieb grün).
// W5 ist neu: er bewacht, dass die Anmeldung aus `ASSIST_ACTIONS` ABGELEITET ist. Eine handgetippte
// Fünferliste im Produkt schwiege beim sechsten Werkzeug; W5 fordert es ein.
//
// KEINE ZUSAGE ÜBER DEN ALTEN WORTLAUT: die alten Erwartungen und die alten „BEFUND UMGEDREHT"-
// Meldungstexte sind ERSETZT, nicht danebengestellt (Auftrag §8.7).
//
// ------------------------------------------------------------------------------------------------
// DER FUND DIESER RUNDE — ER WEICHT VON DER AUSGANGSLAGE DES AUFTRAGS AB.
// ------------------------------------------------------------------------------------------------
// Der Auftrag (§2.2/§2.7) nimmt an, die Palette des Erfassungsblatts zeichne ihre fünf Werksaktionen
// über `AiAssistBox.tsx:107-119` und trage damit den `HelpTip` aus `:117`. Am Basisstand 702b701 ist
// das NICHT so, selbst gelesen:
//
//   · `erfassen/Blatt.tsx:64` importiert aus `../AiAssistBox` ausschliesslich `AiAssistInstructions`
//     — die eigenen Vorlagen der Organisation und die freie Anweisung, NICHT `AiAssistBox`.
//   · Die fünf Werksaktionen zeichnet das Blatt SELBST, als `MenueEintrag` (`Blatt.tsx:2141-2152`),
//     und dort steht KEIN `HelpTip`. Auf dem Blatt wird der Erklärsatz also in keinem Zustand
//     angemeldet — weder bei offener noch bei geschlossener Palette.
//   · `AiAssistBox` samt `HelpTip` lebt an anderen Flächen: `pages/Capture.tsx:5211` (Experten-
//     formular des Arbeitsraums), `:6415`/`:6532`/`:6755`, `KnowledgeInputStudio.tsx:501`,
//     `bibliothek/BibliothekLesen.tsx:996`/`:1051`.
//
// Der Auftrag sagt für diesen Fall: „weicht er ab, GILT DER FUND DER BAHN". Deshalb misst diese
// Datei BEIDE Enden derselben Kette — das Blatt (W1-W3, wo die Anmeldung fehlt) und das
// Expertenformular desselben `/erfassen` (W4, wo sie besteht). Erst W4 macht die vom Auftrag §6
// bestellte Gegenprobe (die `HelpTip`-Zeile fort) überhaupt wirksam: gäbe es hier nur das Blatt,
// bliebe jene Verstellung ohne Wirkung, und die Datei belegte nicht, dass sie am echten `HelpTip`
// hängt.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI AUSDRÜCKLICH NICHT BELEGT.
// ------------------------------------------------------------------------------------------------
// · KEINE SICHTBARKEIT IN PIXELN. jsdom hat kein Layout, jedes Rechteck ist null (Lehre JOB 3796 R1,
//   LEHREN.md 2026-09-12T23:51:37: die Messreichweite wird wahrheitsgemäss beschrieben). Belegt wird
//   ERREICHBARKEIT über den Bedienweg: ist der Satz nach einer gefahrenen Klickfolge im gezeichneten
//   DOM der Zahnrad-Liste? 390 px, 320 px, echtes Chromium, echte Zeigerereignisse und Tab/Enter
//   laufen in JOB 3769, 3809 und 3810 auf eigenen Zielpfaden.
// · KEIN ENGLISCH UND KEIN NIEDERLÄNDISCH. Gemessen wird Deutsch (Auftrag §10).
// · KEINE AUSSAGE ÜBER die eigenen Vorlagen der Organisation — die hat JOB 3769 gerade umgebaut.
//   Hier zählen ausschliesslich die fünf Werksaktionen aus `ASSIST_ACTIONS`.
//
// ------------------------------------------------------------------------------------------------
// ZUSTANDSMODELL (Auftrag §9).
// ------------------------------------------------------------------------------------------------
// · LADEN: Die Bühne fährt OHNE geladene Daten — jede Endpunktfunktion gibt ein Versprechen, das nie
//   erfüllt wird (wie das Vorbild `tests/seitenhilfe-flaechen/sechs-flaechen-erklaeren-sich.test.tsx
//   :18-20`). Das ist Absicht: die Seitenhilfe beschreibt die SEITE, nicht ihren Inhalt, und muss
//   auch dann dastehen, wenn noch keine Zahl da ist.
// · ERFOLGREICH LEER: Eine leere Liste ist von einer NICHT GEÖFFNETEN Liste zu unterscheiden. Jeder
//   Fall prüft deshalb zuerst, dass `[data-testid="seitenhilfe-liste"]` wirklich gezeichnet ist, und
//   liest sonst die Leermeldung `menue.seitenhilfe.leer` wörtlich und nennt sie im Fehlertext.
// · FEHLER / CACHE MIT LAUFENDER ODER GESCHEITERTER AUFFRISCHUNG / OFFLINE: für die Seitenhilfe ohne
//   Wirkung — sie trägt keine Serverdaten, sondern nur die Anmeldungen montierter Bauteile. Deshalb
//   hat sie hier keine eigenen Fälle; übergangen wird das nicht, es steht hier.
// · KEINE NEGATIVE AUSSAGE OHNE FRISCHE GRUNDLAGE: „der Satz ist nicht zu holen" wird nur nach einer
//   erfolgreich geöffneten, tatsächlich gezeichneten Liste behauptet, und jeder Fehlertext nennt den
//   Zeitpunkt im Bedienweg und die Liste, die gelesen wurde.
//
// ------------------------------------------------------------------------------------------------
// OFFENGELEGTE DOPPELUNG (als REST bestellt, nicht gebaut — Muster JOB 3811/3827).
// ------------------------------------------------------------------------------------------------
// Die Bühne unten (Attrappen für `auth`/`endpoints`, `matchMedia`, `ResizeObserver`, `mount`,
// `flush`, das Öffnen der Seitenhilfe) folgt dem Muster von
// `tests/seitenhilfe-flaechen/sechs-flaechen-erklaeren-sich.test.tsx`, ist dort aber INLINE und
// gehört einer fremden Datei (Auftrag §10: gelesen, nicht geändert). Sie steht hier deshalb ein
// zweites Mal. Wer beide zusammenführen will, braucht eine gemeinsame Bühnendatei unter `tests/` und
// beide Auftragsgeber — das ist REST dieses Jobs, nicht sein Bau.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Endpunktfunktion gibt ein Versprechen, das NIE erfüllt wird: die Seite montiert ohne Daten.
// `new Proxy` über einer Funktion, damit auch tief verschachtelte Namensketten auflösen, ohne dass
// sie hier aufgezählt werden.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(() => new Promise(() => {})),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
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
import { BLATT_HILFE_THEMEN } from "../../apps/web/src/components/erfassen/hilfe";
import i18n from "../../apps/web/src/i18n";
import {
  ASSIST_ACTIONS,
  assistActionHelpKey,
  assistActionLabelKey,
} from "../../apps/web/src/lib/captureAiAssist";
import { Capture } from "../../apps/web/src/pages/Capture";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
// `matches: false` heisst: NICHT schmal — die Hülle zeichnet ihr Kopfband mit dem Zahnrad, nicht den
// Hamburger-Drawer (`AppShell.tsx:81`). Der gemessene Bedienweg ist damit der des Schreibtischs.
(globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
  ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

/**
 * Die fünf Werksaktionen — AUS DEM PRODUKT gelesen, nicht im Test abgeschrieben. Eine hier getippte
 * Liste von fünf Wörtern misst nur ihre eigene Kopie; kommt morgen eine sechste Aktion dazu, soll
 * dieser Prüfstand sie ohne Nacharbeit mitmessen (Auftrag §5.1).
 */
const WERKSAKTIONEN = ASSIST_ACTIONS.map((aktion) => ({
  aktion,
  labelKey: assistActionLabelKey(aktion),
  hilfeKey: assistActionHelpKey(aktion),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
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
                  { initialEntries: [url] },
                  createElement(AppShell, null, createElement(Capture)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

/**
 * EIN KLICK, WIE EIN MENSCH IHN AUSLÖST — `mousedown`, `mouseup`, `click`.
 *
 * `HTMLElement.click()` allein sendet in jsdom NUR `click`. Beide Aussenklick-Hörer des Produkts
 * hängen aber am `mousedown` (`erfassen/Menue.tsx:237` für die Palette, `shell/Menue.tsx:86` für das
 * Zahnrad-Menü). Mit `.click()` liefen sie nie — der Test setzte dann still einen Zustand, den die
 * echte Bedienung so nie erzeugt, und W2/W3 wären falsches Grün (Auftrag §5.3: „nicht über einen im
 * Test von Hand gesetzten Zustand").
 */
async function menschKlick(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
    await flush();
  });
  await act(flush);
}

const gestrafft = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

function zahnrad(): Element | null {
  return container.querySelector('[data-testid="kopfband-zahnrad"]');
}
function zahnradMenue(): Element | null {
  return container.querySelector('[data-testid="zahnrad-menue"]');
}
function seitenhilfeListe(): Element | null {
  return container.querySelector('[data-testid="seitenhilfe-liste"]');
}
function kiPalette(): Element | null {
  return container.querySelector('[data-testid="blatt-menue-ki"]');
}
function kiWerkzeug(): Element | null {
  return container.querySelector('[data-testid="blatt-werkzeug-ki"]');
}

/** Zahnrad auf, „Seitenhilfe" aufklappen — der Weg, den ein Mensch geht. */
async function seitenhilfeOeffnen(): Promise<void> {
  await menschKlick(zahnrad(), "Zahnrad im Kopfband");
  await menschKlick(
    container.querySelector('[data-testid="zahnrad-seitenhilfe"]'),
    "Menüzeile „Seitenhilfe“",
  );
}

/**
 * Was in der Zahnrad-Liste STEHT — und ob es sie überhaupt gibt. Der Rückgabewert unterscheidet die
 * drei Lagen, die sonst alle als „der Text fehlt" enden würden: gar kein Menü, ein Menü mit der
 * Leermeldung, eine gezeichnete Liste.
 */
function ablesung(): { lage: "kein-menue" | "leermeldung" | "liste"; text: string } {
  if (zahnradMenue() === null) {
    return { lage: "kein-menue", text: "" };
  }
  const liste = seitenhilfeListe();
  if (liste === null) {
    return { lage: "leermeldung", text: gestrafft(zahnradMenue()?.textContent) };
  }
  return { lage: "liste", text: gestrafft(liste.textContent) };
}

/** Die Schlüssel der fünf Erklärsätze, die im gelesenen Text FEHLEN — mit Wortlaut. */
function fehlendeErklaersaetze(text: string): string[] {
  return WERKSAKTIONEN.filter((w) => !text.includes(i18n.t(w.hilfeKey))).map(
    (w) => `${w.hilfeKey} („${i18n.t(w.hilfeKey)}“)`,
  );
}
/** Die Schlüssel der fünf Erklärsätze, die im gelesenen Text STEHEN — mit Wortlaut. */
function vorhandeneErklaersaetze(text: string): string[] {
  return WERKSAKTIONEN.filter((w) => text.includes(i18n.t(w.hilfeKey))).map(
    (w) => `${w.hilfeKey} („${i18n.t(w.hilfeKey)}“)`,
  );
}

/**
 * JOB 3880 — WAS JE AKTION FEHLT, TITEL UND TEXT GETRENNT.
 *
 * Die naheliegende Halbheit einer Anmeldung ist, die fünf Titel einzutragen und die Erklärsätze
 * wegzulassen (oder umgekehrt). Eine Zeile „Strukturieren" ohne Satz erklärt nichts, ein Satz ohne
 * Überschrift ist keiner Aktion zuzuordnen. Diese Funktion fordert deshalb BEIDES je Aktion ein und
 * nennt jedes fehlende Stück EINZELN mit seinem Schlüssel und seinem Wortlaut — nicht „irgendetwas
 * fehlt" (Auftrag §8.2b, §8.4).
 */
function fehlendeAnmeldungen(text: string): string[] {
  const fehlt: string[] = [];
  for (const w of WERKSAKTIONEN) {
    if (!text.includes(i18n.t(w.labelKey))) {
      fehlt.push(`Titel ${w.labelKey} („${i18n.t(w.labelKey)}“)`);
    }
    if (!text.includes(i18n.t(w.hilfeKey))) {
      fehlt.push(`Text ${w.hilfeKey} („${i18n.t(w.hilfeKey)}“)`);
    }
  }
  return fehlt;
}

/**
 * Der gelesene Listentext für den Fehlertext — gekürzt und mit seiner Länge.
 *
 * Die Seitenhilfe von `/erfassen` ist LANG (das Hilferegister des Blattes zählt über 30 Themen). Der
 * volle Wortlaut im Fehlertext schob in Runde 1 die eigentliche Auskunft — WELCHE Schlüssel fehlen —
 * aus dem sichtbaren Teil der Meldung heraus; vitest kürzt die verglichenen Felder zusätzlich zu
 * „[ …(5) ]". Die Schlüssel stehen deshalb ausgeschrieben IM Satz, die gelesene Liste nur als Probe
 * mit Längenangabe — als Beleg, dass wirklich gelesen wurde.
 */
function leseprobe(text: string): string {
  const kurz = text.length > 220 ? `${text.slice(0, 220)}…` : text;
  return `${text.length} Zeichen gelesen, Anfang: „${kurz}“`;
}

/**
 * Eine gezeichnete, gelesene Liste — sonst bricht der Fall ab, statt aus „kein Treffer" auf „nicht
 * angemeldet" zu schliessen (Zustandsmodell oben, §9 „erfolgreich leer").
 */
function gelesenerListentext(wann: string): string {
  const a = ablesung();
  if (a.lage === "kein-menue") {
    expect.fail(
      `${wann}: es gibt gar kein gezeichnetes Zahnrad-Menü — hier wurde NICHTS gelesen, also wird über den Erklärsatz auch nichts behauptet.`,
    );
  }
  if (a.lage === "leermeldung") {
    expect.fail(
      `${wann}: das Zahnrad-Menü steht, aber es gibt keine Seitenhilfe-Liste. Wörtlich gelesen: „${a.text}“ (die Leermeldung lautet „${i18n.t("menue.seitenhilfe.leer")}“).`,
    );
  }
  expect(a.text.length, `${wann}: die Seitenhilfe-Liste ist leer gezeichnet`).toBeGreaterThan(0);
  return a.text;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

// ------------------------------------------------------------------------------------------------
// W0 — DIE GRUNDLAGE: die fünf Schlüssel lösen auf, und das Blatt zeichnet seine fünf Knöpfe.
// ------------------------------------------------------------------------------------------------
// Ohne diesen Fall wären W1-W3 trivial grün: fünf Schlüssel, die auf nichts zeigen, „fehlen" in
// jeder Liste, und eine Palette ohne Knöpfe hat nichts zu erklären.
describe("JOB 3831 · W0 · fünf Werksaktionen, fünf auflösende Erklärsätze, fünf Knöpfe", () => {
  it("die Schlüssel lösen auf und die Palette des Blattes zeichnet genau diese fünf Aktionen", async () => {
    expect(WERKSAKTIONEN.length, "ASSIST_ACTIONS ist leer — es gäbe nichts zu messen").toBe(5);
    for (const w of WERKSAKTIONEN) {
      expect(i18n.t(w.labelKey), `${w.labelKey} löst nicht auf`).not.toBe(w.labelKey);
      expect(i18n.t(w.hilfeKey), `${w.hilfeKey} löst nicht auf`).not.toBe(w.hilfeKey);
      expect(
        i18n.t(w.hilfeKey).length,
        `${w.hilfeKey}: der Erklärsatz ist zu kurz, um etwas zu erklären`,
      ).toBeGreaterThan(20);
    }

    await mount("/erfassen");
    await menschKlick(kiWerkzeug(), "Werkzeug „KI ▾“ des Blattes");
    const palette = kiPalette();
    expect(palette, "die KI-Palette des Blattes geht nicht auf").not.toBeNull();
    const paletteText = gestrafft(palette?.textContent);
    for (const w of WERKSAKTIONEN) {
      expect(
        paletteText,
        `die Palette zeichnet den Knopf „${i18n.t(w.labelKey)}“ (${w.labelKey}) nicht`,
      ).toContain(i18n.t(w.labelKey));
    }
  });
});

// ------------------------------------------------------------------------------------------------
// W1 — PALETTE GESCHLOSSEN, ZAHNRAD AUF.
// ------------------------------------------------------------------------------------------------
// BIS JOB 3880 — BEFUND (Basisstand 702b701, gemessen): Die Liste stand, sie war nicht leer (das
// Blatt meldet sein Hilferegister `BLATT_HILFE_THEMEN` dauerhaft an, `Blatt.tsx:2061-2063`) — aber
// KEINER der fünf Erklärsätze stand darin.
// SEIT JOB 3880 — ZUSICHERUNG, und sie ist der Sollzustand von damals: Wer wissen will, was
// „Strukturieren" tut, findet Überschrift UND Satz im Zahnrad, OHNE vorher die Palette geöffnet zu
// haben. Bricht die Anmeldung in `components/erfassen/hilfe.ts` weg, wird dieser Fall rot und nennt
// jedes fehlende Stück einzeln.
describe("JOB 3831 · W1 (JOB 3880 umgedreht) · Palette zu, Zahnrad auf — der Erklärsatz steht da", () => {
  it("ZUSICHERUNG: die gezeichnete Seitenhilfe-Liste nennt alle fünf Werksaktionen mit Titel und Erklärsatz", async () => {
    await mount("/erfassen");
    expect(
      kiPalette(),
      "die Palette war zu Beginn schon offen — W1 misst den falschen Zustand",
    ).toBeNull();

    await seitenhilfeOeffnen();
    const text = gelesenerListentext("W1 · Palette zu, Zahnrad auf");

    const fehlt = fehlendeAnmeldungen(text);
    expect(
      fehlt.length,
      `W1 · ZUSICHERUNG VERLETZT: bei geschlossener Palette fehlen ${fehlt.length} Stücke der fünf Werksaktionen in der gezeichneten Zahnrad-Liste — einzeln: ${fehlt.join(" · ")}. Gefunden wurden nur: ${vorhandeneErklaersaetze(text).join(" · ") || "keiner der fünf Erklärsätze"}. Damit ist der Erklärsatz wieder nur über die geöffnete KI-Palette zu holen (JOB 3831 BEFUND). Gelesene Liste: ${leseprobe(text)}`,
    ).toBe(0);
    // ============================================================================================
    // DIE KALIBRIERUNG BLEIBT (JOB 3880 Auftrag §5.5) — SIE TRÄGT JETZT MEHR GEWICHT ALS VORHER.
    // ============================================================================================
    // Solange W1 ein BEFUND war, verhinderte sie falsches Grün aus einer ungelesenen Liste. Jetzt,
    // als Zusicherung, verhindert sie falsches Grün aus einer LEEREN Liste: `fehlt.length === 0`
    // wäre sonst auch dann erfüllt, wenn `.textContent` alles enthielte, was man hineinliest —
    // deshalb muss hier nachweislich das Hilferegister des Blattes stehen, mit einem Wortlaut, den
    // KEINE der fünf Werksaktionen beisteuert (`conf.help`, die Vertraulichkeits-Hilfe).
    expect(
      text,
      "W1: die Liste enthält nicht einmal das Hilferegister des Blattes — hier wurde die falsche Fläche gelesen",
    ).toContain(i18n.t("conf.help"));
    expect(
      text.length,
      "W1: die gelesene Liste ist kürzer als das Hilferegister des Blattes sein kann — sie wurde nicht vollständig gezeichnet",
    ).toBeGreaterThan(i18n.t("conf.help").length);
  });
});

// ------------------------------------------------------------------------------------------------
// W2 — PALETTE OFFEN, DANN ZUM ZAHNRAD. ZWEI ABLESUNGEN, GETRENNT FESTGEHALTEN.
// ------------------------------------------------------------------------------------------------
// Der Unterschied zwischen (a) und (b) IST der Befund, den der Auftrag sucht (§8.4).
//
// JOB 3880 — IN (a) STECKEN ZWEI AUSSAGEN, UND NUR EINE IST UMGEDREHT:
//   · die ERSTE Ablesung („vor dem Öffnen der Palette") sagte, dass auch dort kein Erklärsatz steht
//     — sie ist umgedreht und fordert jetzt alle fünf mit Titel und Text ein;
//   · die ZWEITE Ablesung (offene Palette ⇒ gar kein gezeichnetes Zahnrad-Menü) ist der ANDERE
//     Befund von JOB 3831 („Palette und Zahnrad-Liste können nie gleichzeitig stehen"). Er gehört
//     einer eigenen Zeile (JOB 3880 §10), wurde von der Anmeldung im Hilferegister nicht berührt und
//     bleibt deshalb unverändert Befund — nachgemessen in dieser Runde, nicht angenommen.
describe("JOB 3831 · W2 · Palette offen — und dann der Weg zum Zahnrad", () => {
  it("(a) der Satz steht schon vor dem Öffnen (ZUSICHERUNG) — und solange die Palette offen ist, zeichnet das Zahnrad-Menü gar keine Liste (BEFUND)", async () => {
    await mount("/erfassen");
    // Erst die Liste aufschlagen — sie steht und ist lesbar.
    await seitenhilfeOeffnen();
    const vorher = gelesenerListentext("W2a · vor dem Öffnen der Palette");
    const fehltVorher = fehlendeAnmeldungen(vorher);
    expect(
      fehltVorher.length,
      `W2a · ZUSICHERUNG VERLETZT: schon vor dem Öffnen der Palette fehlen ${fehltVorher.length} Stücke der fünf Werksaktionen in der Liste — einzeln: ${fehltVorher.join(" · ")}. Gefunden wurden nur: ${vorhandeneErklaersaetze(vorher).join(" · ") || "keiner der fünf Erklärsätze"}. Gelesene Liste: ${leseprobe(vorher)}`,
    ).toBe(0);

    // Dann die Palette öffnen — mit einem echten Klick, der den Aussenklick-Hörer des Zahnrad-Menüs
    // (`shell/Menue.tsx:76-88`) wirklich auslöst.
    await menschKlick(kiWerkzeug(), "Werkzeug „KI ▾“ des Blattes");
    expect(kiPalette(), "W2a: die Palette ist nicht aufgegangen").not.toBeNull();

    const nachher = ablesung();
    expect(
      nachher.lage,
      `W2a · BEFUND UMGEDREHT (der ZWEITE Befund, der von JOB 3880 nicht angefasst wurde): mit offener Palette steht das Zahnrad-Menü jetzt noch (Lage „${nachher.lage}“). Bisher schloss der Klick auf das Werkzeug es weg. Dann können Palette und Seitenhilfe-Liste nebeneinander stehen — diese Ablesung ist umzudrehen und muss ab dann statt der Lage die fünf Erklärsätze prüfen; gerade fehlen davon: ${fehlendeErklaersaetze(nachher.text).join(" · ") || "keiner"}. Gelesen: ${leseprobe(nachher.text)}`,
    ).toBe("kein-menue");
    // Deshalb steht hier KEINE Aussage über die Anmeldung: Es gibt in diesem Augenblick keine
    // gezeichnete Liste, also gibt es nichts zu lesen. Genau das ist die Auskunft von (a).
  });

  it("(b) ZUSICHERUNG: nach dem echten Klick auf das Zahnrad steht die Liste wieder — mit allen fünf Werksaktionen", async () => {
    await mount("/erfassen");
    await menschKlick(kiWerkzeug(), "Werkzeug „KI ▾“ des Blattes");
    expect(kiPalette(), "W2b: die Palette ist nicht aufgegangen").not.toBeNull();

    // Der echte Bedienschritt: auf das Zahnrad klicken, während die Palette offen steht.
    await seitenhilfeOeffnen();
    const text = gelesenerListentext("W2b · nach dem Klick auf das Zahnrad");

    const fehlt = fehlendeAnmeldungen(text);
    expect(
      fehlt.length,
      `W2b · ZUSICHERUNG VERLETZT: nach dem Weg „Palette auf → Zahnrad → Seitenhilfe“ fehlen ${fehlt.length} Stücke der fünf Werksaktionen in der Liste — einzeln: ${fehlt.join(" · ")}. Gefunden wurden nur: ${vorhandeneErklaersaetze(text).join(" · ") || "keiner der fünf Erklärsätze"}. Wer die Palette geöffnet hat und dann wissen will, was ein Knopf tut, steht damit wieder ohne Auskunft da (JOB 3831 BEFUND). Gelesene Liste: ${leseprobe(text)}`,
    ).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// W3 — DER RÜCKWEG: gibt es einen Zustand, in dem BEIDES steht?
// ------------------------------------------------------------------------------------------------
// Die Frage des Auftrags §5.4: Ist der Satz nach W2(b) verschwunden, wurde dabei die Palette
// geschlossen — und gibt es überhaupt einen Weg, Palette UND Liste gleichzeitig zu haben?
// BEFUND: nein. Die beiden Flächen schliessen einander aus, in beiden Reihenfolgen.
// SOLLZUSTAND: Entweder trägt der Erklärsatz eine Fläche, die ohne offene Palette auskommt (dann ist
// W1 der Fall, der anschlägt), oder Palette und Zahnrad-Liste können nebeneinander stehen (dann
// schlägt dieser Fall an).
describe("JOB 3831 · W3 · Palette und Zahnrad-Liste gleichzeitig — gibt es diesen Zustand?", () => {
  it("BEFUND: in beiden Reihenfolgen schliesst die eine Fläche die andere; beides zugleich gibt es nicht", async () => {
    await mount("/erfassen");

    // Reihenfolge 1: Palette zuerst, dann Zahnrad → die Palette ist weg.
    await menschKlick(kiWerkzeug(), "Werkzeug „KI ▾“ des Blattes");
    expect(kiPalette(), "W3: die Palette ist nicht aufgegangen").not.toBeNull();
    await seitenhilfeOeffnen();
    gelesenerListentext("W3 · Reihenfolge 1, nach dem Klick auf das Zahnrad");
    expect(
      kiPalette(),
      "W3 · BEFUND UMGEDREHT (Reihenfolge 1): die Palette steht jetzt NEBEN der offenen Seitenhilfe-Liste. Dann ist der Erklärsatz im selben Blick erreichbar wie der Knopf — dieser Fall ist umzudrehen.",
    ).toBeNull();

    // Reihenfolge 2: Zahnrad zuerst, dann Palette → die Liste ist weg (dieselbe Ablesung wie W2a,
    // hier als zweite Hälfte derselben Aussage „beides zugleich gibt es nicht").
    await menschKlick(kiWerkzeug(), "Werkzeug „KI ▾“ des Blattes");
    expect(kiPalette(), "W3: die Palette ging in Reihenfolge 2 nicht wieder auf").not.toBeNull();
    expect(
      ablesung().lage,
      "W3 · BEFUND UMGEDREHT (Reihenfolge 2): das Zahnrad-Menü steht jetzt NEBEN der offenen Palette — dieser Fall ist umzudrehen.",
    ).toBe("kein-menue");
  });
});

// ------------------------------------------------------------------------------------------------
// W4 — DIE ANDERE HÄLFTE DER KETTE: dieselben fünf Aktionen im Expertenformular desselben /erfassen.
// ------------------------------------------------------------------------------------------------
// Dort zeichnet `AiAssistBox` (`pages/Capture.tsx:5211`) die fünf Werksaktionen samt `HelpTip`
// (`AiAssistBox.tsx:117`) — und zwar auf der FLÄCHE, nicht in einem Menüblatt. Die Anmeldung lebt
// deshalb, solange die Fläche steht, und überlebt den Klick auf das Zahnrad.
//
// DIESER FALL IST KEIN BEFUND, SONDERN EIN WÄCHTER: er hält fest, dass die Kette `HelpTip` →
// `SeitenhilfeContext` → Zahnrad-Liste trägt, wo die Anmeldung überhaupt stattfindet. Er ist
// zugleich der Grund, warum die vom Auftrag §6 bestellte Gegenprobe (die `HelpTip`-Zeile fort)
// wirksam ist: sie macht GENAU diesen Fall rot, mit den Schlüsseln einzeln im Fehlertext.
describe("JOB 3831 · W4 · im Expertenformular trägt die Kette — und nur dort", () => {
  it("die fünf Erklärsätze stehen in der Zahnrad-Liste, solange das Formular steht", async () => {
    // `?weg=formular` ist der adressierte Weg des Blattes in den Arbeitsraum
    // (`erfassen/wege.ts:49`, `Blatt.tsx:1902-1915`) — derselbe, den das Menü „Datei ▾" ruft.
    await mount("/erfassen?weg=formular");
    expect(
      container.querySelector('[data-testid="blatt-arbeitsraum"]'),
      "W4: der Arbeitsraum ist über die Adresse nicht aufgegangen",
    ).not.toBeNull();

    await seitenhilfeOeffnen();
    const text = gelesenerListentext("W4 · Expertenformular, Zahnrad auf");

    const fehlt = fehlendeErklaersaetze(text);
    expect(
      fehlt.length,
      `W4: im Expertenformular fehlen ${fehlt.length} der fünf Erklärsätze in der gezeichneten Zahnrad-Liste — einzeln: ${fehlt.join(" · ")}. Damit trägt die Kette HelpTip → Seitenhilfe → Zahnrad auch dort nicht mehr, wo die Anmeldung überhaupt stattfindet (AiAssistBox.tsx:117). Gelesene Liste: ${leseprobe(text)}`,
    ).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// W5 (JOB 3880) — DIE ANMELDUNG IST ABGELEITET, NICHT ABGESCHRIEBEN.
// ------------------------------------------------------------------------------------------------
// W1/W2 messen die gezeichnete Fläche und wären auch dann grün, wenn im Hilferegister fünf von Hand
// getippte Schlüsselpaare stünden. Das wäre ein ZWEITER Bestand neben `ASSIST_ACTIONS`: käme eine
// sechste Werksaktion dazu, zeichnete die Palette sechs Knöpfe, und die Seitenhilfe erklärte still
// weiter nur fünf. Dieser Fall fordert die Ableitung ein — er nennt KEINE Fünf, sondern misst gegen
// `ASSIST_ACTIONS.length` (Auftrag §5.6).
//
// GEMESSEN WIRD AM REGISTER, NICHT AM DOM: die Frage ist nicht „steht es da?" (das ist W1), sondern
// „stammt es aus der einen Quelle?". Der Namensraum der Erklärsätze wird dafür ebenfalls abgeleitet
// (aus dem Schlüssel der ersten Aktion), damit auch ein stehengebliebener Eintrag einer entfernten
// Aktion auffällt und nicht bloss ein fehlender.
describe("JOB 3880 · W5 · das Hilferegister leitet die Werksaktionen ab, statt sie abzuschreiben", () => {
  it("je Aktion aus ASSIST_ACTIONS genau ein Eintrag mit dessen Label- und Hilfe-Schlüssel — und keiner mehr", () => {
    const ersteAktion = ASSIST_ACTIONS[0];
    expect(ersteAktion, "ASSIST_ACTIONS ist leer — dann misst W5 nichts").toBeDefined();
    if (ersteAktion === undefined) {
      return;
    }
    // `capture.ai.help.` — aus dem Schlüssel der ersten Aktion gewonnen, nicht hier getippt.
    const namensraum = assistActionHelpKey(ersteAktion).slice(
      0,
      assistActionHelpKey(ersteAktion).length - ersteAktion.length,
    );
    expect(
      namensraum.length,
      "der Namensraum der Erklärsätze liess sich nicht ableiten",
    ).toBeGreaterThan(0);

    const angemeldet = BLATT_HILFE_THEMEN.filter((thema) => thema.bodyKey.startsWith(namensraum));
    const erwartet = ASSIST_ACTIONS.map((aktion) => assistActionHelpKey(aktion));
    expect(
      angemeldet.map((thema) => thema.bodyKey).sort(),
      `W5: das Hilferegister des Blattes meldet ${angemeldet.length} Erklärsätze im Namensraum „${namensraum}“ an, ASSIST_ACTIONS führt aber ${ASSIST_ACTIONS.length} Werksaktionen. Angemeldet: ${angemeldet.map((t) => t.bodyKey).join(" · ") || "keiner"}. Erwartet: ${erwartet.join(" · ")}. Eine abgeschriebene Liste erklärt die neue Aktion nicht mit.`,
    ).toEqual([...erwartet].sort());

    for (const aktion of ASSIST_ACTIONS) {
      const treffer = angemeldet.filter((thema) => thema.bodyKey === assistActionHelpKey(aktion));
      expect(
        treffer.length,
        `W5: zur Werksaktion „${aktion}“ steht ${treffer.length}-mal ein Eintrag im Hilferegister; genau einer gehört dorthin.`,
      ).toBe(1);
      expect(
        treffer[0]?.titleKey,
        `W5: der Eintrag zu „${aktion}“ trägt nicht den Label-Schlüssel des Knopfes — dann erklärt die Seitenhilfe unter einer anderen Überschrift als die Palette anbietet.`,
      ).toBe(assistActionLabelKey(aktion));
    }

    // Kennungen kollidieren nicht — weder untereinander noch mit den neun Nachbarn oder der
    // Hilfekarte. Eine doppelte Kennung wäre ein doppelter React-Schlüssel und ein doppelter
    // Testanker `blatt-hilfe-<id>` (`Blatt.tsx:2573`); geprüft, nicht angenommen (Auftrag §5.1).
    const kennungen = BLATT_HILFE_THEMEN.map((thema) => thema.id);
    const doppelt = kennungen.filter((id, i) => kennungen.indexOf(id) !== i);
    expect(
      doppelt,
      `W5: doppelte Kennungen im Hilferegister des Blattes: ${doppelt.join(" · ")}`,
    ).toEqual([]);
  });
});
