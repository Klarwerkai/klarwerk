// @vitest-environment jsdom
// ================================================================================================
// JOB 691 · D-021 — DER KOPFVERTRAG DER VIER STUFE-2-SEITEN
// ================================================================================================
//
// GEGENSTAND. Die vier Stufe-2-Seiten trugen im Seitenkopf einen internen Vorgangschip
// `Stufe 2 · SCRUM-…`. Eine Vorgangsnummer ist Werkstattwissen und gehoert nicht in die
// Oberflaeche, die ein Kunde sieht. Dieser Vertrag haelt fest, dass sie dort nicht mehr steht —
// und zwar an der GEMOUNTETEN Seite, nicht an einer Zeichenkette in der Quelle.
//
// WARUM AM MOUNT UND NICHT AM QUELLTEXT. Ein Test, der `Stufe2.tsx` nach einem Muster durchsucht,
// beweist, dass ein Zeichen fehlt — nicht, dass niemand es sieht. Umgekehrt gilt dasselbe: er
// waere auch dann gruen, wenn die Seite ueberhaupt nicht mehr rendert. Genau diese Fehlerklasse
// schliesst Block A1 aus.
//
// DIE KALIBRIERUNG IST DIE HALBE MIETE (A1). Vor jeder Abwesenheitsaussage steht der Nachweis,
// dass der Baum WIRKLICH da ist: jede der vier Seiten muss ihren echten `h1` mit dem
// uebersetzten Seitentitel tragen. Ohne A1 waere „kein Chip gefunden" auch bei einem leeren
// Container gruen — ein nicht gerenderter Baum darf niemals als bestandener Negativfall gelten.
//
// DER HAKENMOCK IST REFERENZSTABIL, UND DAS IST KEIN DETAIL. Ein generischer Proxy liefert bei
// jedem Property-Zugriff eine neue Referenz; React sieht bei jedem Render geaenderte
// Abhaengigkeiten und rendert erneut — eine Schleife ohne Fixpunkt. Genau daran ist der
// Vorlaeuferversuch (D3) nach 300 s Laufzeit gescheitert. Hier gibt jeder Haken DASSELBE
// eingefrorene Objekt zurueck, und die Schluesselmenge kommt ueber `importOriginal()` aus dem
// echten Modul — kein Abschreiben, keine Luecke, wenn spaeter ein Haken dazukommt.
//
// WARUM `isLoading: true` GENUEGT. Der Kopf steht in allen vier Seiten AUSSERHALB jeder
// `QueryState`-Huelle. Er rendert deshalb unabhaengig vom Ladezustand, und die Fixtures duerfen
// minimal und deterministisch bleiben, statt fuer vier Seiten je ein vollstaendiges Datenmodell
// zu erfinden.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// Die Hakenflaeche: vollstaendig, endlich, referenzstabil.
// ------------------------------------------------------------------------------------------------
vi.mock("../api/hooks", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  // EIN eingefrorenes Ergebnis fuer alle Haken. Eingefroren, damit auch ein versehentliches
  // Mutieren im Produktcode die Referenz nicht ersetzt.
  const LADEND = Object.freeze({
    data: undefined,
    isLoading: true,
    isError: false,
    isSuccess: false,
    error: null,
  });
  const stabil = (): typeof LADEND => LADEND;
  const flaeche: Record<string, unknown> = {};
  for (const schluessel of Object.keys(original)) {
    // Nur Haken ersetzen; alles andere (Konstanten, Hilfsfunktionen) bleibt echt.
    flaeche[schluessel] = schluessel.startsWith("use") ? stabil : original[schluessel];
  }
  return flaeche;
});

vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", name: "Pedi", role: "admin" } }),
}));
vi.mock("../app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ComponentType, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { Capital, GraphView, ImportReview, Output } from "./Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der interne Vorgangschip in seiner sichtbaren Form — die eine Sache, die verschwinden muss. */
const CHIP_MUSTER = /Stufe 2 · SCRUM-\d+/;

/** Die Marke am Klara-Pfad-Teaser (Baupflicht 5: minimal testadressierbar, sonst unveraendert). */
const TEASER = '[data-testid="klara-path-teaser"]';

interface Seite {
  readonly name: string;
  readonly Komponente: ComponentType;
  /** Der i18n-Schluessel, den der Kopf als `h1` rendert. */
  readonly titelKey: string;
  /** Die Vorgangsnummer, die diese Seite bis D-021 sichtbar trug. */
  readonly vorgang: string;
  readonly route: string;
}

const SEITEN: readonly Seite[] = [
  {
    name: "Output",
    Komponente: Output,
    titelKey: "nav.output",
    vorgang: "SCRUM-117",
    route: "/auswertungen",
  },
  {
    name: "ImportReview",
    Komponente: ImportReview,
    titelKey: "nav.import",
    vorgang: "SCRUM-116",
    route: "/import",
  },
  {
    name: "Capital",
    Komponente: Capital,
    titelKey: "nav.capital",
    vorgang: "SCRUM-120",
    route: "/kapital",
  },
  {
    name: "GraphView",
    Komponente: GraphView,
    titelKey: "nav.graph",
    vorgang: "SCRUM-119",
    route: "/graph",
  },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(seite: Seite): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [seite.route] },
          createElement(seite.Komponente),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

/** Der deutsche Klartext eines Schluessels — gelesen, nicht abgeschrieben. */
function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function sichtbarerText(): string {
  return container.textContent ?? "";
}

// ================================================================================================
// A1 · KALIBRIERUNG — die Seite rendert wirklich
// ================================================================================================
//
// Diese vier Faelle sind in JEDEM Stand gruen und aendern ihre Farbe nie. Sie sind die
// Voraussetzung, unter der die Abwesenheitsaussagen in A2/A3 ueberhaupt etwas bedeuten.
describe("JOB 691 · D-021 · A1: alle vier Stufe-2-Seiten mounten mit echtem h1", () => {
  for (const seite of SEITEN) {
    it(`${seite.name} rendert einen h1 mit dem uebersetzten Seitentitel`, () => {
      mount(seite);

      const h1 = container.querySelector("h1");
      expect(h1, `${seite.name}: kein h1 im gerenderten Baum`).not.toBeNull();
      expect(h1?.textContent?.trim()).toBe(de(seite.titelKey));
    });
  }

  it("der Kopf traegt zusaetzlich den Stufe-2-Kicker", () => {
    mount(SEITEN[0] as Seite);
    expect(sichtbarerText()).toContain(de("s2.kicker"));
  });
});

// ================================================================================================
// A2 · ZIEL — der interne Vorgangschip ist nirgends sichtbar
// ================================================================================================
//
// Vor dem Umbau ROT, danach GRUEN. Das ist die Aussage, die dauerhaft gehalten werden muss.
describe("JOB 691 · D-021 · A2: kein interner Vorgangschip im sichtbaren Text", () => {
  for (const seite of SEITEN) {
    it(`${seite.name} zeigt kein \`Stufe 2 · SCRUM-…\``, () => {
      mount(seite);

      expect(sichtbarerText()).not.toMatch(CHIP_MUSTER);
    });
  }
});

// ================================================================================================
// A3 · DIE VORGANGSNUMMER SELBST IST NIRGENDS SICHTBAR
// ================================================================================================
//
// HERKUNFT DIESES BLOCKS. Er stand beim Bau als Red-first-GEGENPROBE hier: „jede Seite traegt
// heute exakt `Stufe 2 · <Vorgangsnummer>`". In dieser Form war er vor dem Umbau gruen und
// belegte damit, dass A2 an einer WIRKLICH vorhandenen Sache scheiterte und nicht an einem
// Tippfehler im Selektor. Mit dem Umbau ist er umgeschlagen — gemessen — und steht jetzt in
// seiner Dauerform.
//
// WARUM ER NICHT IN A2 AUFGEHT. A2 sucht die zusammengesetzte Form `Stufe 2 · SCRUM-…`. Wer den
// Chip umbenennt, seine Trennzeichen aendert oder die Nummer an anderer Stelle einblendet, kaeme
// daran vorbei. Dieser Block sucht die NUMMER selbst — die Sache, die nicht nach aussen soll.
describe("JOB 691 · D-021 · A3: keine Vorgangsnummer im sichtbaren Text", () => {
  for (const seite of SEITEN) {
    it(`${seite.name} zeigt \`${seite.vorgang}\` nirgends`, () => {
      mount(seite);

      expect(sichtbarerText()).not.toContain(seite.vorgang);
    });
  }

  it("keine Seite zeigt IRGENDEINE der vier Vorgangsnummern", () => {
    for (const seite of SEITEN) {
      mount(seite);
      const text = sichtbarerText();
      for (const { vorgang } of SEITEN) {
        expect(text, `${seite.name} zeigt ${vorgang}`).not.toContain(vorgang);
      }
      act(() => root.unmount());
      container.remove();
    }
    // Ein stehender Mount fuer das globale afterEach.
    mount(SEITEN[0] as Seite);
    expect(sichtbarerText()).not.toMatch(/SCRUM-/);
  });
});

// ================================================================================================
// A5 · DIE HERKUNFT IST NICHT VERLOREN, SIE IST NUR UMGEZOGEN
// ================================================================================================
//
// Baupflicht 1 verlangt beides: der Chip verschwindet aus der Oberflaeche UND die vier
// Vorgangsnummern bleiben als Herkunftskommentare erhalten. Ohne diesen Block waere „Nummer
// geloescht" von „Nummer in den Kommentar verschoben" nicht unterscheidbar — und die Herkunft
// waere beim naechsten Aufraeumen still weg.
describe("JOB 691 · D-021 · A5: die Vorgangsnummern stehen als Herkunftskommentar in der Quelle", () => {
  // Gelesen ueber die Repo-Wurzel — dasselbe Muster wie `tests/app/stufe2-persistence.test.tsx`.
  // Die Wurzel selbst haelt `tools/check-cwd-contract.mjs` fest, das im Tor vor allem anderen laeuft.
  const quelle = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Stufe2.tsx"), "utf8");

  for (const seite of SEITEN) {
    it(`${seite.name}: \`${seite.vorgang}\` steht als Herkunft im Quelltext`, () => {
      expect(quelle).toContain(`Herkunft: ${seite.vorgang}`);
    });
  }

  it("der Kopf nimmt keinen `ticket`-Prop mehr entgegen", () => {
    expect(quelle).not.toMatch(/ticket\s*[:=]/);
    expect(quelle).not.toContain("Stufe 2 · {ticket}");
  });
});

// ================================================================================================
// A4 · TEASER — der Klara-Pfad bleibt auf ImportReview, und zwar genau einmal
// ================================================================================================
//
// Der Chipabbau darf den Teaser nicht als Kollateralschaden mitnehmen. Gemessen wird an einer
// eigenen Marke statt an Textfragmenten: eine Zaehlung ueber Text waere eine Scheinmessung.
describe("JOB 691 · D-021 · A4: der Klara-Pfad-Teaser bleibt", () => {
  it("ImportReview traegt den Teaser genau einmal", () => {
    mount(SEITEN[1] as Seite);

    expect(container.querySelectorAll(TEASER)).toHaveLength(1);
  });

  it("der Teaser traegt seinen unveraenderten Text aus i18n", () => {
    mount(SEITEN[1] as Seite);

    const teaser = container.querySelector(TEASER);
    expect(teaser?.textContent).toContain(de("klara.path.kicker"));
    expect(teaser?.textContent).toContain(de("klara.path.import.title"));
  });

  it("die drei uebrigen Seiten tragen ihn NICHT — er gehoert genau einer Flaeche", () => {
    for (const seite of [SEITEN[0], SEITEN[2], SEITEN[3]]) {
      mount(seite as Seite);
      expect(container.querySelectorAll(TEASER), `${(seite as Seite).name}`).toHaveLength(0);
      act(() => root.unmount());
      container.remove();
    }
    // Der letzte Mount wird vom globalen afterEach abgeraeumt — deshalb hier einer, der steht.
    mount(SEITEN[0] as Seite);
    expect(container.querySelectorAll(TEASER)).toHaveLength(0);
  });
});
