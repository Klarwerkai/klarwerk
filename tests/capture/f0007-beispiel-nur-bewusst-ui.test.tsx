// @vitest-environment jsdom
// ==================================================================================================
// F-0007 · JOB 2942 · D2 — DER EINREICHEN-KNOPF WIRD GEDRUECKT
// ==================================================================================================
//
// Auftragstext ist BENs rotes Urteil `BEN-PRUEFUNG-JOB-2942-D1.md` (BEZUGSHASH `16625f61…`),
// woertlich:
//
//   „Die Kernfunktionen werden aus `CaptureArbeitsraum.tsx` ausgeschnitten und ausserhalb des
//    React-Zustandszyklus ausgefuehrt; Quelltextmuster pruefen Namen und Verdrahtungsform, aber
//    keinen gerenderten Klickweg. Diese Tests koennen gruen bleiben, obwohl Zustandswechsel,
//    Sichtbarkeit oder Mutation im echten UI-Weg fehlschlagen."
//
// Das war berechtigt. D1 hat die Logik gebaut und isoliert belegt — aber nicht, dass ein Mensch am
// gerenderten Formular mit dem ersten Griff wirklich nicht in den Bestand kommt. Diese Datei
// drueckt den Knopf.
//
// WAS HIER ECHT IST:
//   · die echte Seite `pages/Capture.tsx`, gemountet, mit ihren echten Providern,
//   · der echte Knopf „Beispiel laden", die echten Eingabefelder, der echte Einreichen-Knopf und
//     die echte Rueckfrage — bedient ausschliesslich ueber Nutzerereignisse (click/input/change),
//   · der echte React-Zustandszyklus samt Ableitung `exampleInForm`.
//
// WAS ERSETZT IST: die API-Schicht (`api/endpoints`) und der Modelllauf. Der Modelllauf ist hier
// nicht der Gegenstand — geprueft wird, was mit dem strukturierten Entwurf beim EINREICHEN
// passiert.
//
// ------------------------------------------------------------------------------------------------
// WO DIE MUTATION GEMESSEN WIRD — und warum nicht an `submit.mutate` selbst
// ------------------------------------------------------------------------------------------------
// BEN verlangt einen gestubbten `submit.mutate` und eine Mutationszahl. `submit` ist eine
// `useMutation` INNERHALB der Komponente; sie von aussen zu ersetzen hiesse, `useMutation` selbst
// zu faelschen — und damit genau den Zustandszyklus stillzulegen, dessen Beweis hier faellig ist.
// Gezaehlt wird deshalb eine Tuer weiter aussen, an der letzten Station vor dem Bestand:
// `endpoints.ko.create` (der Weg eines frischen Wissensobjekts, `CaptureArbeitsraum.tsx:1568`). Das ist der
// STAERKERE Messpunkt: er zaehlt nicht, ob eine Absicht ausgeloest wurde, sondern ob etwas im
// Bestand angekommen waere.
//
// DIE FALLE DABEI, und sie ist hier ausdruecklich entschaerft: eine Null kann auch entstehen, weil
// der Weg schon vorher klemmt — gesperrter Knopf, fehlender Entwurf. Eine Null allein waere also
// kein Beleg. Deshalb gilt in jedem Fall unten:
//   1. `einreichKnopf()` wirft, wenn der Knopf gesperrt ist — die Null stammt nie aus einem
//      toten Knopf;
//   2. derselbe Lauf zeigt unmittelbar danach die Eins, ohne jede weitere Vorbereitung. Gleiche
//      Ausgangslage, ein einziger zusaetzlicher Klick Unterschied: damit ist die Null dem Tor
//      zurechenbar und nichts anderem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Jeder Aufruf, der ein Wissensobjekt in den Bestand legen wuerde. */
  koCreates: [] as Record<string, unknown>[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: ok({ id: "d1" }),
        update: ok({ id: "d1" }),
        remove: ok({}),
        promote: ok({ id: "ko-promote" }),
      },
      ko: {
        // DER ZAEHLER. Jeder Aufruf hier waere ein Wissensobjekt im Bestand.
        create: vi.fn(async (p: Record<string, unknown>) => {
          box.koCreates.push(p);
          return { id: `ko-${box.koCreates.length}`, title: String(p.title ?? "") };
        }),
        createFromDocument: vi.fn(async () => ({ id: "ko-doc" })),
        get: ok(null),
      },
      objects: { upload: ok({ objectId: "o1" }) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        // Nur der Modelllauf ist gefaelscht. Titel und Aussage sind noetig, damit
        // `captureReadiness` den Einreichen-Knopf ueberhaupt freigibt (`canSave`).
        structure: vi.fn(async () => ({
          title: "Dosierwert nach Schichtwechsel stabilisieren",
          statement:
            "Vor dem ersten Auftrag den Nullpunkt am HMI pruefen und die Dosierpumpe DP-4 entlueften.",
          conditions: ["Nach Gebindewechsel oder laengerer Pause"],
          measures: ["Nullpunkt am HMI pruefen", "Dosierpumpe DP-4 entlueften"],
          tags: [],
        })),
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_EXAMPLE } from "../../apps/web/src/lib/captureExample";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                  ),
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
  await arbeitsbereichOeffnen();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function alleKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter(
    (b): b is HTMLButtonElement => b instanceof HTMLButtonElement,
  );
}

function knopfMit(teil: string): HTMLButtonElement {
  const btn = alleKnoepfe().find((b) => (b.textContent ?? "").replace(/\s+/g, " ").includes(teil));
  if (!btn) {
    throw new Error(`Knopf „${teil}" nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

/** Eine echte Nutzereingabe: nativer Wert plus die Ereignisse, die ein Browser feuert. */
async function tippen(el: HTMLElement, value: string): Promise<void> {
  setNativeValue(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function textareaMitPlatzhalter(ph: string): HTMLTextAreaElement {
  const el = [...container.querySelectorAll("textarea")].find((t) => t.placeholder === ph);
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Textfeld „${ph}" nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return el;
}

/** Alle Textfelder mit genau diesem Wert — so werden die Beispielfelder gefunden, ohne Label-Suche. */
function eingabenMitWert(wert: string): HTMLInputElement[] {
  return [...container.querySelectorAll("input")].filter(
    (i): i is HTMLInputElement => i instanceof HTMLInputElement && i.value === wert,
  );
}

// ------------------------------------------------------------------------------------------------
// SICHTBARKEIT — was der Mensch am Bildschirm sieht, nicht was im Zustand steht
// ------------------------------------------------------------------------------------------------

/** Das Herkunfts-Kennzeichen („Demo-Beispiel" / „Example data" / „Demovoorbeeld"). */
function badgeSichtbar(): boolean {
  return pageText().includes(i18n.t("demo.badge.label"));
}

/** Die Rueckfrage, an ihrem eigenen Text erkannt — nicht an einer Klasse oder einem Testhaken. */
function rueckfrageSichtbar(): boolean {
  return pageText().includes("Das sind Beispieldaten.");
}

function bestaetigungsKnopf(): HTMLButtonElement {
  return knopfMit("Ja, Beispiel einreichen");
}

/**
 * Der ECHTE Einreichen-Knopf. „Pruefen & einreichen" steht auch als Wegmarke in der Schrittleiste;
 * gemeint ist der letzte, der wirklich klickbar ist. Ein gesperrter Knopf ist ein Fehler und keine
 * Messung — sonst waere jede Null hier wertlos.
 */
function einreichKnopf(): HTMLButtonElement {
  const kandidaten = alleKnoepfe().filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const btn = kandidaten[kandidaten.length - 1];
  if (!btn) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  if (btn.disabled) {
    throw new Error(
      `Einreichen ist gesperrt — diese Messung waere wertlos. ${pageText().slice(-900)}`,
    );
  }
  return btn;
}

// ------------------------------------------------------------------------------------------------
// DER KLICKPFAD — genau der, den ein Mensch geht
// ------------------------------------------------------------------------------------------------

/**
 * Die Erfassungsseite startet mit eingeklapptem Arbeitsbereich („Weitere Wege anzeigen"). Ohne
 * dieses Aufklappen gibt es weder Erzaehlfeld noch „Beispiel laden" — der Test klickt also genau
 * das, was ein Mensch auch klicken muss.
 */
async function arbeitsbereichOeffnen(): Promise<void> {
  // Zielorientiert statt nach Beschriftung: der Aufklappzustand ueberlebt den Unmount des
  // vorigen Falls, weshalb derselbe Schalter mal „anzeigen" und mal „einklappen" heisst. Geklickt
  // wird, bis der Erfassungsweg wirklich offen liegt — hoechstens dreimal, damit ein kaputter
  // Schalter nicht als Endlosschleife erscheint.
  for (let versuch = 0; versuch < 3; versuch++) {
    const offen = alleKnoepfe().some((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.loadExample")),
    );
    if (offen) {
      return;
    }
    const schalter = alleKnoepfe().find((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").includes("Weitere Wege"),
    );
    if (!schalter) {
      return;
    }
    await click(schalter);
  }
}

async function beispielLaden(): Promise<void> {
  await click(knopfMit(i18n.t("capture.loadExample")));
}

async function strukturieren(): Promise<void> {
  await click(knopfMit(i18n.t("capture.structure")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.koCreates.length = 0;
  // Jeder Fall startet auf einer frischen Seite. Ohne das truege ein Test den Erfolgsschirm oder
  // den aufgeklappten Arbeitsbereich des vorigen in seine Messung — und die Reihenfolge der Faelle
  // entschiede mit ueber ihr Ergebnis.
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

// ==================================================================================================
// KORREKTURPFLICHT 1 — der reale Komponentenweg, in einer einzigen durchgehenden Klickfolge
// ==================================================================================================
describe("F-0007 UI · Beispielweg: laden, kennzeichnen, zurueckfragen, bewusst einreichen", () => {
  it("Badge sichtbar, erster Klick ohne Mutation, namentliche Rueckfrage, Bestaetigung mit genau einer", async () => {
    await mount();

    // 1 · LADEN. Der Knopf, der fuer das gefahrlose Ausprobieren da ist.
    expect(badgeSichtbar()).toBe(false);
    await beispielLaden();

    // 2 · SICHTBARES KENNZEICHEN. Der Beispielinhalt steht wirklich im Formular — nachgesehen an
    // den Feldwerten, nicht am Fliesstext: Eingabefelder tragen ihren Inhalt in `value`.
    expect(eingabenMitWert(CAPTURE_EXAMPLE.asset)).not.toHaveLength(0);
    expect(textareaMitPlatzhalter(i18n.t("capture.rawPlaceholder")).value).toBe(
      CAPTURE_EXAMPLE.raw,
    );
    // … und er ist als solcher erkennbar.
    expect(badgeSichtbar()).toBe(true);

    // 3 · WEITER BIS ZUR EINREICH-ENTSCHEIDUNG. Die Kennzeichnung ueberlebt den Schrittwechsel —
    // „bis zum Schluss sichtbar" ist die Zusage, nicht „einmal kurz aufgeblitzt".
    await strukturieren();
    expect(badgeSichtbar()).toBe(true);

    // 4 · ERSTER EINREICHGRIFF. Der Knopf ist frei (sonst wirft `einreichKnopf`).
    await click(einreichKnopf());
    expect(box.koCreates).toHaveLength(0);

    // 5 · DIE RUECKFRAGE NENNT ES BEIM NAMEN.
    expect(rueckfrageSichtbar()).toBe(true);
    expect(pageText()).toContain("Wirklich als echtes Wissen einreichen?");

    // 6 · ZWEITER, AUSDRUECKLICHER GRIFF — und jetzt genau eine Mutation.
    await click(bestaetigungsKnopf());
    expect(box.koCreates).toHaveLength(1);
  });

  it("erst der Bestaetigungsklick bewegt etwas — beliebig oft erneut einreichen bleibt bei null", async () => {
    await mount();
    await beispielLaden();
    await strukturieren();

    // Dreimal derselbe Griff. Waere die Sperre nur eine Anzeige, kaeme spaetestens hier etwas durch.
    await click(einreichKnopf());
    await click(einreichKnopf());
    await click(einreichKnopf());
    expect(box.koCreates).toHaveLength(0);
    expect(rueckfrageSichtbar()).toBe(true);

    await click(bestaetigungsKnopf());
    expect(box.koCreates).toHaveLength(1);
  });
});

// ==================================================================================================
// KORREKTURPFLICHT 2 — die drei Gegenfaelle, im selben UI-Niveau
// ==================================================================================================
describe("F-0007 UI · Gegenfall: vollstaendig ueberschrieben", () => {
  it("nach echtem Ueberschreiben aller Beispielfelder: kein Badge, keine Rueckfrage, genau eine Mutation", async () => {
    await mount();
    await beispielLaden();
    expect(badgeSichtbar()).toBe(true);

    // Der Mensch ersetzt das Beispiel Feld fuer Feld durch eigenes Wissen — mit echten
    // Eingabeereignissen, nicht durch Zustandsschreiben.
    await tippen(
      textareaMitPlatzhalter(i18n.t("capture.rawPlaceholder")),
      "An Presse P2 reisst die Folie, wenn die Vorheizung unter 60 Grad steht.",
    );
    // Kategorie und Anlage stehen in den erweiterten Feldern, die `loadExample()` aufgeklappt hat.
    const kategorie = eingabenMitWert(CAPTURE_EXAMPLE.category)[0];
    const anlage = eingabenMitWert(CAPTURE_EXAMPLE.asset)[0];
    if (!kategorie || !anlage) {
      throw new Error(`Beispielfelder nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
    }
    await tippen(kategorie, "Sicherheit");
    await tippen(anlage, "Presse P2");

    // Solange auch nur ein Beispiel-Schlagwort steht, ist das Beispiel nicht ueberschrieben.
    expect(badgeSichtbar()).toBe(true);

    // Die Schlagworte des Beispiels einzeln entfernen — jedes hat seinen eigenen x-Knopf.
    for (const tag of CAPTURE_EXAMPLE.tags) {
      const chip = alleKnoepfe().find(
        (b) =>
          b.getAttribute("aria-label") === i18n.t("capture.listRemove") &&
          (b.parentElement?.textContent ?? "").includes(tag),
      );
      if (!chip) {
        throw new Error(
          `Schlagwort „${tag}" nicht entfernbar. Sichtbar: ${pageText().slice(0, 900)}`,
        );
      }
      await click(chip);
    }

    // Vom Beispiel steht nichts mehr da — also ist es keines mehr.
    expect(badgeSichtbar()).toBe(false);

    await strukturieren();
    expect(badgeSichtbar()).toBe(false);
    await click(einreichKnopf());

    // Ein Griff, ein Wissensobjekt. Keine Rueckfrage fuer selbst geschriebenes Wissen.
    expect(rueckfrageSichtbar()).toBe(false);
    expect(box.koCreates).toHaveLength(1);
  });
});

describe("F-0007 UI · Gegenfall: ohne Beispiel", () => {
  it("der normale Erfassungsweg bleibt einschrittig: kein Badge, keine Rueckfrage, genau eine Mutation", async () => {
    await mount();

    await tippen(
      textareaMitPlatzhalter(i18n.t("capture.rawPlaceholder")),
      "Nach jedem Werkzeugwechsel wird der Anschlag neu vermessen.",
    );
    await strukturieren();

    expect(badgeSichtbar()).toBe(false);
    await click(einreichKnopf());

    // Genau ein Klick — kein zusaetzlicher Griff fuer den, der nie ein Beispiel geladen hat.
    expect(rueckfrageSichtbar()).toBe(false);
    expect(box.koCreates).toHaveLength(1);
  });
});

describe("F-0007 UI · Gegenfall: Abbruch und erneutes Laden", () => {
  it("Abbruch laesst nichts durch und hinterlaesst keinen stehengebliebenen Bestaetigungszustand", async () => {
    await mount();
    await beispielLaden();
    await strukturieren();

    // Rueckfrage oeffnen und wieder schliessen.
    await click(einreichKnopf());
    expect(rueckfrageSichtbar()).toBe(true);
    await click(knopfMit(i18n.t("capture.file.cancel")));
    expect(rueckfrageSichtbar()).toBe(false);
    expect(box.koCreates).toHaveLength(0);

    // Der entscheidende Punkt: der naechste Einreichgriff darf NICHT auf einem stehengebliebenen
    // „schon bestaetigt" reiten. Er muss wieder fragen.
    await click(einreichKnopf());
    expect(rueckfrageSichtbar()).toBe(true);
    expect(box.koCreates).toHaveLength(0);

    // Und der ausdrueckliche Griff funktioniert danach unveraendert.
    await click(bestaetigungsKnopf());
    expect(box.koCreates).toHaveLength(1);
  });

  it("das Beispiel erneut zu laden setzt die Ruecksprache zurueck, statt sie zu ueberspringen", async () => {
    await mount();
    await beispielLaden();
    await strukturieren();
    await click(einreichKnopf());
    expect(rueckfrageSichtbar()).toBe(true);

    // Der Weg zurueck ist der echte: „Beispiel laden" steht im Erzaehl-Schritt, also geht der
    // Mensch dorthin zurueck und laedt neu. Waere `confirmExampleSubmit` dabei stehengeblieben,
    // legte der naechste Einreichgriff das frisch geladene Beispiel ohne jede Frage in den Bestand.
    await click(knopfMit(i18n.t("capture.wizard.back")));
    await beispielLaden();
    expect(badgeSichtbar()).toBe(true);
    expect(rueckfrageSichtbar()).toBe(false);

    await strukturieren();
    expect(rueckfrageSichtbar()).toBe(false);
    await click(einreichKnopf());
    expect(rueckfrageSichtbar()).toBe(true);
    expect(box.koCreates).toHaveLength(0);
  });
});
