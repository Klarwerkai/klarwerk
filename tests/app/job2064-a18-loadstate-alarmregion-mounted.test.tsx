// @vitest-environment jsdom
// ================================================================================================
// JOB 2064 · D1 — A18: DIE ALARMREGION VON `LoadErrorState` WIRD AM BAUM GEMESSEN (Register I2).
// ================================================================================================
//
// DIE LUECKE, DIE HIER GESCHLOSSEN WIRD — `OFFEN.md:239`, Anker A18:
//
//   „Die Browsermessungen prüfen Bedienbarkeit, Fokus und `inert`, nicht die Sprachausgabe."
//
// Das A18-Register (`tests/app/a18-ansagen-ereignisse.test.tsx`) fuehrt zwoelf Ereignisse. Es ist
// eine QUELLTEXTPRUEFUNG — es liest Dateien (`readFileSync`, dort `:2`/`:263`) und rechnet ihre
// Eintraege gegeneinander. Es mountet nichts. Von den zwoelf Ereignissen hatte bisher genau EINES
// eine Browsermessung: M2, das mobile Menue (`tests/app/mobile-nav-live-status-mounted.test.tsx`).
//
// Eintrag I2 lautet (a18-ansagen-ereignisse.test.tsx:146-160):
//
//   oberflaeche:     "Kennzahlgruppe"
//   aktion:          "Abruf scheitert dauerhaft"
//   ergebniszustand: "Fehlermeldung in einer Alarmregion"
//   kanal:           'role="alert"'          kanalart: "live"     hoeflichkeit: "assertive"
//   baumzustand:     "genau eine Alarmregion"
//   quellen:         ["components/LoadState.tsx:11"]
//
// Bis heute stand dieser Zustand nur IM REGISTER. Diese Datei misst ihn am gemounteten Baum.
//
// WARUM DIESES EREIGNIS UND KEIN ANDERES — die Wirkung ist gezaehlt, nicht geschaetzt:
// `LoadErrorState` ist ein GEMEINSAMES Bauteil und wird an drei Oberflaechen verwendet
// (`pages/Start.tsx:587`, `pages/Analytics.tsx:166`, `pages/Admin.tsx:1775`). Eine Messung hier
// deckt drei Oberflaechen mit einem Fall; die uebrigen offenen Eintraege haengen je an einer.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRUECKLICH NICHT BEHAUPTET.
// ================================================================================================
//
// Sie belegt KEINE Screenreader-Ausgabe. Ein jsdom-Baum spricht nicht. Belegt wird dreierlei und
// nicht mehr: dass die Alarmregion existiert, dass sie GENAU EINMAL existiert, und dass ihr Text
// nichtleer und aus dem Sprachkatalog ist. Ob NVDA, JAWS oder VoiceOver das tatsaechlich vorlesen,
// haengt an ihrer Ansageheuristik und der Browserkombination und liegt ausserhalb jedes Testfalls.
// Dieselbe Grenze zieht die Schwesterdatei fuer M2 (`mobile-nav-live-status-mounted.test.tsx:19-28`)
// woertlich: „belegt ist die Existenz und der Inhalt des Bereichs — NICHT, dass er vorgelesen wird".
//
// ABGRENZUNG ZU `StaleMarker`: Das zweite Bauteil derselben Datei traegt `<output>` und damit
// implizit `role="status"` (polite), NICHT `role="alert"` (assertive). Die beiden Kanaele duerfen
// nicht ineinander rutschen — ein gescheiterter Abruf, der nur „hoeflich" meldet, kommt bei einer
// Vorlesehilfe unter Umstaenden gar nicht an. B4 unten haelt die Trennung fest.
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { LoadErrorState, StaleMarker } from "../../apps/web/src/components/LoadState";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/**
 * Mountet den Fehlerzustand so, wie ihn die drei Oberflaechen verwenden: bedingt. `zeigen=false`
 * ist der Ausgangszustand („Daten geladen"), `zeigen=true` der Ergebniszustand des Registers.
 */
function mount(zeigen: boolean): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(zeigen ? createElement(LoadErrorState, { onRetry: () => {} }) : null);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const alarmregionen = (): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="alert"]'));

const katalog = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));

// ------------------------------------------------------------------------------------------------
describe("JOB 2064 · A18/I2 · B1 — die Alarmregion existiert, und zwar genau einmal", () => {
  // Der tragende Fall. Das Register verlangt woertlich „genau eine Alarmregion". Zwei Regionen
  // waeren kein Mehr an Information, sondern eine Doppelansage desselben Sachverhalts — und bei
  // `assertive` unterbricht jede davon, was die Vorlesehilfe gerade sagt.
  it("B1 · im Fehlerzustand steht GENAU EINE Alarmregion im Baum", () => {
    mount(true);
    expect(alarmregionen()).toHaveLength(1);
  });

  // Die Gegenprobe. Ohne sie wuerde B1 auch dann gruen bleiben, wenn die Region dauerhaft im Baum
  // stuende — eine Alarmregion, die immer da ist, meldet kein EREIGNIS mehr.
  it("B2 · ohne Fehlerzustand steht KEINE Alarmregion im Baum", () => {
    mount(false);
    expect(alarmregionen()).toHaveLength(0);
  });
});

describe("JOB 2064 · A18/I2 · B3 — was die Region ansagen wuerde, ist nichtleer und uebersetzt", () => {
  // Eine leere Alarmregion ist der schlimmste Fall: Der Baum behauptet eine Meldung, und die
  // Vorlesehilfe sagt nichts oder nur „Warnung". Deshalb wird der Textinhalt gemessen, nicht die
  // blosse Existenz des Attributs.
  it("B3 · der Text der Region ist nichtleer", () => {
    mount(true);
    const text = alarmregionen()[0]?.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
  });

  // Und er stammt aus dem Sprachkatalog, nicht aus einer hartkodierten Zeichenkette. Sonst waere
  // die Meldung in jeder anderen Sprache stumm oder deutsch.
  it("B3b · der Text ist der Katalogtext `loadstate.error.title`", () => {
    mount(true);
    const erwartet = katalog("loadstate.error.title");
    expect(erwartet.length, "Vorbedingung: der Schluessel existiert im Katalog").toBeGreaterThan(0);
    expect(alarmregionen()[0]?.textContent ?? "").toContain(erwartet);
  });

  // Der Wiederholen-Knopf ist Teil derselben Ansage. Ein Knopf ohne Namen wird als „Schaltflaeche"
  // vorgelesen — der Nutzer hoert, dass es etwas gibt, aber nicht, was es tut.
  it("B3c · der Wiederholen-Knopf traegt einen nichtleeren, uebersetzten Namen", () => {
    mount(true);
    const knopf = container.querySelector("button");
    expect(knopf, "Vorbedingung: der Knopf ist gerendert").not.toBeNull();
    const erwartet = katalog("loadstate.error.retry");
    expect(erwartet.length, "Vorbedingung: der Schluessel existiert im Katalog").toBeGreaterThan(0);
    expect(knopf?.textContent ?? "").toContain(erwartet);
  });
});

describe("JOB 2064 · A18/I2 · B4 — die Region ist fuer Hilfsmittel erreichbar und von `status` getrennt", () => {
  // Eine Alarmregion mit `aria-hidden` ist im Baum sichtbar und fuer die Vorlesehilfe nicht
  // vorhanden. Genau diese Kombination faellt bei einer reinen Sichtpruefung nicht auf.
  it("B4 · die Alarmregion ist nicht vor Hilfsmitteln verborgen", () => {
    mount(true);
    expect(alarmregionen()[0]?.closest("[aria-hidden='true']")).toBeNull();
  });

  // Die Trennung der beiden Kanaele, siehe Kopf. `StaleMarker` meldet hoeflich weiter, waehrend
  // `LoadErrorState` unterbricht — wer das vertauscht, macht aus einem Ausfall eine Randnotiz.
  it("B4b · `StaleMarker` ist KEINE Alarmregion, sondern eine Statusregion", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(createElement(StaleMarker, {}));
    });
    expect(alarmregionen(), "StaleMarker darf nicht assertiv melden").toHaveLength(0);
    expect(container.querySelector("output"), "und traegt seinen Statuskanal nativ").not.toBeNull();
  });
});
