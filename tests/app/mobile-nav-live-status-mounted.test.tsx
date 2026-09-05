// @vitest-environment jsdom
// ================================================================================================
// JOB 1103 · D1 — DAS MOBILE MENUE MELDET OEFFNEN UND SCHLIESSEN ALS DOM-STATUS (JOB 908, M1).
// ================================================================================================
//
// DIE LUECKE, DIE HIER GESCHLOSSEN WIRD, steht in der 908-Rueckgabe als L4 (§3):
//
//   „Keine der vier Modalflaechen traegt einen Ansagebereich, und keine Zusicherung verlangt einen.
//    Oeffnen, Schliessen, Filterergebnis, Bildwechsel in der Galerie — nichts davon wird angesagt."
//
// BEN5 hat daraus Prueflücke 2 gemacht, woertlich: „Mounted-Test je Modalflaeche: Oeffnen/
// Schliessen/Statusaenderung erzeugt nicht-leeren `aria-live`-Text; erwartet: definierter
// Ansagetext im DOM, aber KEINE Behauptung echter Ausgabe."
//
// ================================================================================================
// WAS DIESE DATEI AUSDRUECKLICH NICHT BEHAUPTET — und warum das der Kern des Auftrags ist.
// ================================================================================================
//
// Sie belegt KEINE Screenreader-Ausgabe. Ein jsdom-Baum spricht nicht. Was hier bewiesen wird, ist
// dreierlei und nicht mehr: dass ein Ereignis eintritt, dass ein nichtleerer Text im Baum steht,
// und dass die Region atomar und hoeflich ausgezeichnet ist. Ob NVDA, JAWS oder VoiceOver das
// tatsaechlich vorlesen, haengt an ihrer Ansageheuristik, ihrer Fassung und der Browserkombination
// — das liegt ausserhalb jedes Testfalls und ist nur durch ein protokolliertes manuelles Verfahren
// zu belegen (908-Rueckgabe §4: „Diese Grenze ist technisch und nicht durch mehr Testfaelle
// verschiebbar").
//
// Die 908-Rueckgabe nennt dieselbe Grenze als Abnahmegrenze von F3: „belegt ist die Existenz und
// der Inhalt des Bereichs — NICHT, dass er vorgelesen wird".
//
// ================================================================================================
// GETRENNT VON DER DIALOGROLLE (Lieferung 1).
// ================================================================================================
//
// Der Ansagekanal ist NICHT die Dialogsemantik. `aria-modal` und die implizite Dialogrolle sagen
// „hier ist ein modaler Bereich"; sie sagen nichts ueber ein EREIGNIS. Das ist im bestehenden
// A18-Register auch so verzeichnet (`tests/app/a18-ansagen-ereignisse.test.tsx`, Eintrag M2:
// `kanalart: "nicht-live"`). Deshalb liegt die Live-Region hier bewusst AUSSERHALB des `<dialog>`
// — und zwar nicht aus Stilgruenden, sondern weil sie sonst ihre eigentliche Aufgabe nicht
// erfuellen koennte (L3/L6 unten).
import { afterEach, describe, expect, it, vi } from "vitest";

// Die Menueliste im Panel (JOB 3060 · H1: DrawerMenue — Kopfband-Punkte, Zahnrad- und Konto-
// Eintraege) ist NICHT Gegenstand dieses Tests — sie zieht Rollen-, Auth- und Abfrageprovider mit,
// die ueber den Ansagekanal nichts aussagen. Ersetzt durch einen Platzhalter, damit der Fall genau
// das misst, was er behauptet.
vi.mock("../../apps/web/src/shell/DrawerMenue", () => ({
  DrawerMenue: () => null,
}));

import { act, createElement, createRef, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import i18n from "../../apps/web/src/i18n";
import { MobileNavDrawer, menueAnsage } from "../../apps/web/src/shell/MobileNavDrawer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let setOpen: (offen: boolean) => void;

/** Mountet den Drawer in einem Schalter, damit Oeffnen und Schliessen ECHTE Zustandswechsel sind. */
function mount(startOffen: boolean): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const trigger = createRef<HTMLButtonElement>();

  function Huelle(): JSX.Element {
    const [offen, setOffen] = useState(startOffen);
    setOpen = setOffen;
    return createElement(
      ModalBoundaryProvider,
      null,
      createElement("button", { type: "button", ref: trigger }, "Ausloeser"),
      createElement(MobileNavDrawer, {
        open: offen,
        onClose: () => setOffen(false),
        triggerRef: trigger,
      }),
    );
  }

  act(() => {
    root.render(createElement(MemoryRouter, null, createElement(Huelle)));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const live = (): HTMLElement | null =>
  container.querySelector('[data-testid="drawer-live-status"]');
const dialog = (): HTMLElement | null => container.querySelector("dialog");
const menuename = (): string => String(i18n.getResource("de", "translation", "topbar.menuLabel"));

describe("JOB 1103 · L6 — die Region ist dauerhaft montiert", () => {
  // DER TRAGENDE FALL, und er ist der Grund fuer den ganzen Bau. Bis hierher gab der Drawer bei
  // geschlossenem Menue `null` zurueck — die gesamte Komponente verschwand aus dem Baum. Eine
  // Live-Region, die beim Schliessen mitverschwindet, kann das Schliessen nicht melden: eine
  // Ansage entsteht aus einer AENDERUNG in einer vorhandenen Region, nicht aus ihrem Verschwinden.
  it("bei geschlossenem Menue existiert die Region trotzdem im Baum", () => {
    mount(false);
    expect(live()).not.toBeNull();
    // …und der Dialog eben NICHT.
    expect(dialog()).toBeNull();
  });

  it("beim ersten Rendern ist sie LEER — das Laden der Seite sagt nichts an", () => {
    mount(false);
    expect(live()?.textContent?.trim()).toBe("");
  });
});

describe("JOB 1103 · L1/L2 — Ereignis und Text (Lieferung 2)", () => {
  it("Oeffnen erzeugt einen nichtleeren Text, der das Menue benennt", () => {
    mount(false);
    act(() => {
      setOpen(true);
    });
    const text = live()?.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(menueAnsage(menuename(), true));
    // Der Text benennt, WORUM es geht — eine blosse Zustandsansage ohne Gegenstand waere fuer
    // jemanden, der die Seite nicht sieht, nicht zuordenbar.
    expect(text).toContain(menuename());
  });

  it("Schliessen erzeugt einen nichtleeren Text — und die Region bleibt im Baum", () => {
    mount(true);
    act(() => {
      setOpen(false);
    });
    const text = live()?.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(menueAnsage(menuename(), false));
    expect(text).toContain(menuename());
    // Das ist die Zusage aus L6, jetzt am Ereignis: der Traeger der Ansage ueberlebt das Schliessen.
    expect(live()).not.toBeNull();
    expect(dialog()).toBeNull();
  });

  it("die beiden Ansagen unterscheiden sich — sonst waere der Wechsel nicht hoerbar", () => {
    expect(menueAnsage(menuename(), true)).not.toBe(menueAnsage(menuename(), false));
  });

  it("ein Wechsel hin und zurueck fuehrt zu der jeweils passenden Ansage", () => {
    mount(false);
    act(() => {
      setOpen(true);
    });
    expect(live()?.textContent?.trim()).toBe(menueAnsage(menuename(), true));
    act(() => {
      setOpen(false);
    });
    expect(live()?.textContent?.trim()).toBe(menueAnsage(menuename(), false));
    act(() => {
      setOpen(true);
    });
    expect(live()?.textContent?.trim()).toBe(menueAnsage(menuename(), true));
  });
});

describe("JOB 1103 · L5 — Hoeflichkeit und Atomizitaet (Lieferung 3)", () => {
  it("die Region ist polite und atomar ausgezeichnet", () => {
    mount(false);
    const bereich = live();
    expect(bereich?.getAttribute("aria-live")).toBe("polite");
    // `aria-atomic="true"`: die Region wird als GANZES vorgetragen. Ohne sie traegt ein Werkzeug
    // je nach Heuristik nur den geaenderten Teilknoten vor — bei einem vollstaendig ersetzten Text
    // ist das derselbe Satz, bei einem spaeter ergaenzten Zusatz nicht mehr.
    expect(bereich?.getAttribute("aria-atomic")).toBe("true");
  });

  it("der Traeger ist ein <output> — die Statusrolle haengt nicht an EINEM Attribut", () => {
    mount(false);
    // Dieselbe Bauform, die das A18-Register als Fall B1 fuer Live-Regionen festhaelt: `<output>`
    // traegt die Statusrolle NATIV. Ein `<div role="status">` verloere sie, sobald jemand das
    // Attribut entfernt; hier muesste er das Element austauschen.
    expect(live()?.tagName).toBe("OUTPUT");
  });

  it("sie ist sichtbar unauffaellig, aber nicht vor Hilfsmitteln verborgen", () => {
    mount(false);
    const bereich = live();
    // `aria-hidden` naehme sie aus dem Baum — dann waere die ganze Zusage wertlos.
    expect(bereich?.getAttribute("aria-hidden")).toBeNull();
    expect(bereich?.hasAttribute("hidden")).toBe(false);
  });
});

describe("JOB 1103 · L4 — getrennt von der Dialogrolle (Lieferung 1)", () => {
  it("die Region liegt AUSSERHALB des dialog-Elements", () => {
    mount(true);
    const bereich = live();
    const d = dialog();
    expect(bereich).not.toBeNull();
    expect(d).not.toBeNull();
    // Laege sie im Dialog, verschwaende sie mit ihm — und der Kanal waere wieder an die
    // Dialogsemantik gekoppelt, die der Auftrag ausdruecklich trennt.
    expect(d?.contains(bereich as Node)).toBe(false);
  });

  it("der Dialog behaelt seine eigene Semantik unveraendert", () => {
    mount(true);
    const d = dialog();
    expect(d?.getAttribute("aria-modal")).toBe("true");
    expect(d?.getAttribute("aria-label")).toBe(menuename());
    // Der Ansagekanal hat die Dialogauszeichnung NICHT ersetzt und nicht doubliert.
    expect(d?.getAttribute("aria-live")).toBeNull();
    expect(d?.getAttribute("role")).toBeNull();
  });
});
