// @vitest-environment jsdom
// ================================================================================================
// JOB 3135 · H6-D1 — DIE ABFRAGEHÜLLE NENNT DEN STAND, UND ZWAR IM WORTLAUT DER ÜBERSICHT.
// ================================================================================================
//
// DER BEFUND (Codex R-1563, 06.09. 07:27, Live 1.0.0-beta.1.124, Chromium 149): Die Kontenübersicht
// markiert einen Bestand aus einem älteren Abruf ausdrücklich — „Stand von … · nicht aktualisiert"
// (`R-1563-…:56`). Die Detailkarten dahinter rendern denselben Zustand über die `Abfragehuelle`,
// und die nannte bis hierher nur eine Störung, nie die Zeit. Derselbe Zustand hatte damit zwei
// Wortlaute, und der jüngere verschwieg, WIE alt der Bestand ist.
//
// WAS DIESE DATEI PRÜFT — und warum sie die Erwartung nicht abschreibt:
// Der Sollwortlaut wird nicht als Zeichenkette in den Test getippt, sondern aus DEM Bauteil
// abgeleitet, das die Übersicht dafür verwendet (`useWertText` aus `Zeilenkarte.tsx:23-49`). Eine
// abgeschriebene Erwartung wäre grün geblieben, wenn sich die Übersicht ändert und das Detail
// nicht — genau die Doppelung, um die es hier geht.
//
//   H1  gestörte Auffrischung mit Bestand → „Stand von <Zeit> · nicht aktualisiert", WÖRTLICH der
//       Zusatz der Übersicht, und ein Knopf „Erneut versuchen", der wirklich neu abruft.
//   H2  laufende Auffrischung → nur „Stand von <Zeit>", KEIN „nicht aktualisiert", KEIN Knopf.
//   H3  ruhiger Bestand → gar keine Standzeile; die Markierung ist kein Dauerinventar.
//   H4  offline mit Bestand → wie H1, obwohl kein Abruf gescheitert ist (`onlineManager`).
//   H5  die Kinder bleiben in jedem dieser Fälle sichtbar — es wird nie geleert.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { onlineManager } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type Abfrage,
  Abfragehuelle,
} from "../../apps/web/src/components/einstellungen/Abfragehuelle";
import { useWertText } from "../../apps/web/src/components/einstellungen/Zeilenkarte";
import { abfragelage, wertBefund } from "../../apps/web/src/components/einstellungen/zeilenWert";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Bestand, den die Hülle zeigt. Er darf in KEINEM Zustand verschwinden. */
const INHALT = "der weiterhin sichtbare Bestand";
/** Ein fester Zeitpunkt für den letzten erfolgreichen Abruf. */
const STAND_MS = new Date(2026, 8, 6, 7, 24, 0).getTime();
/** Der Platzhalter, an dem der Übersichtstext in Kern und Zusatz zerfällt. */
const KERN = "KERN";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let abrufe = 0;

function abfrage(over: Partial<Abfrage<string>> = {}): Abfrage<string> {
  return {
    data: INHALT,
    isError: false,
    isFetching: false,
    fetchStatus: "idle",
    dataUpdatedAt: STAND_MS,
    refetch: () => {
      abrufe += 1;
      return undefined;
    },
    ...over,
  };
}

function mounten(a: Abfrage<string>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(Abfragehuelle<string>, {
        abfrage: a,
        children: (daten: string) => createElement("p", { "data-testid": "inhalt" }, daten),
      }),
    );
  });
}

/** Die Standzeile der Hülle: der Träger und sein Text (ohne den Knopf). */
function standZeile(): { wurzel: HTMLElement | null; text: string } {
  const wurzel = container.querySelector<HTMLElement>('[data-einst="stand"]');
  return { wurzel, text: wurzel?.querySelector("span")?.textContent?.trim() ?? "" };
}

/**
 * Der Zusatz, den die ÜBERSICHT für dieselbe Lage anhängt — abgeleitet aus `useWertText`, nicht
 * abgeschrieben. `useWertText` liefert „<Kern> · <Zusatz>"; der Kern wird hier wieder abgezogen.
 */
function uebersichtsZusatz(a: Abfrage<string>, online: boolean): string {
  const befund = wertBefund(abfragelage(a, online), KERN);
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  const probeRoot = createRoot(probe);
  function Probe(): JSX.Element {
    const wertText = useWertText();
    return createElement("span", null, wertText(befund));
  }
  act(() => probeRoot.render(createElement(Probe)));
  const ganz = probe.textContent ?? "";
  act(() => probeRoot.unmount());
  probe.remove();
  const trenner = `${KERN} · `;
  if (!ganz.startsWith(trenner)) {
    throw new Error(`Übersichtstext ohne Zusatz: „${ganz}“`);
  }
  return ganz.slice(trenner.length);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
  abrufe = 0;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onlineManager.setOnline(true);
});

describe("JOB 3135 H6-D1 · die Abfragehülle nennt den Stand", () => {
  it("H1 · gescheiterte Auffrischung: Zeitangabe UND nicht-aktualisiert, wörtlich wie die Übersicht", () => {
    const a = abfrage({ isError: true });
    mounten(a);

    const zeile = standZeile();
    expect(zeile.wurzel, "die Hülle rendert bei gestörter Auffrischung keine Standzeile").not.toBe(
      null,
    );
    // Beide Teile sind wirklich da — und der Test hängt nicht an einem der beiden allein.
    expect(zeile.text).toContain(
      i18n.t("einst.wert.stand", {
        zeit: new Date(STAND_MS).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
    expect(zeile.text).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    // Und zwar in GENAU dem Wortlaut, den die Übersicht eine Ebene höher anhängt.
    expect(zeile.text, "Detail und Übersicht sagen zu demselben Zustand Verschiedenes").toBe(
      uebersichtsZusatz(a, true),
    );
  });

  it("H1b · der Knopf Erneut-versuchen steht dort und ruft wirklich neu ab", () => {
    mounten(abfrage({ isError: true }));

    const knopf = standZeile().wurzel?.querySelector("button");
    expect(knopf?.textContent).toContain(i18n.t("loadstate.error.retry"));
    // Tastaturerreichbar: ein echter Knopf, nicht aus der Reihenfolge genommen.
    expect(knopf?.getAttribute("tabindex")).toBe(null);
    act(() => knopf?.click());
    expect(abrufe).toBe(1);
  });

  it("H2 · laufende Auffrischung: nur die Zeitangabe, kein nicht-aktualisiert, kein Knopf", () => {
    const a = abfrage({ isFetching: true, fetchStatus: "fetching" });
    mounten(a);

    const zeile = standZeile();
    expect(zeile.text).toBe(uebersichtsZusatz(a, true));
    expect(zeile.text).not.toContain(i18n.t("einst.wert.nichtAktualisiert"));
    expect(zeile.wurzel?.querySelector("button")).toBe(null);
  });

  it("H3 · ruhiger Bestand: gar keine Standzeile — die Markierung ist kein Dauerinventar", () => {
    mounten(abfrage());

    expect(container.querySelectorAll('[data-einst="stand"]')).toHaveLength(0);
    expect(container.textContent).not.toContain(i18n.t("einst.wert.nichtAktualisiert"));
  });

  it("H4 · offline mit Bestand: dieselbe Zeile, obwohl kein Abruf gescheitert ist", () => {
    onlineManager.setOnline(false);
    const a = abfrage();
    mounten(a);

    const zeile = standZeile();
    expect(zeile.text).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    expect(zeile.text).toBe(uebersichtsZusatz(a, false));
    // Nicht der Zustand „offline OHNE Bestand": die Fehlerbox gehört hier nicht hin.
    expect(container.querySelectorAll('[data-einst="abfrage-fehler"]')).toHaveLength(0);
  });

  it("H5 · in jedem dieser Zustände bleibt der Bestand sichtbar — es wird nie geleert", () => {
    mounten(abfrage({ isError: true }));
    expect(container.querySelector('[data-testid="inhalt"]')?.textContent).toBe(INHALT);
    act(() => root.unmount());
    container.remove();

    onlineManager.setOnline(false);
    mounten(abfrage());
    expect(container.querySelector('[data-testid="inhalt"]')?.textContent).toBe(INHALT);
  });
});
