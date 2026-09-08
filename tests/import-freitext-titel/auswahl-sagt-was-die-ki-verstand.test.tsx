// @vitest-environment jsdom
// JOB 3356 (IMPORT-FREITEXT-TITEL) — DIE FLÄCHE, AN DER PEDI OHNE VORWISSEN WEITERKOMMT.
//
// Ein Test, der nur `titleContains` prüft, erfüllt den Wortlaut des Auftrags und nicht seinen Zweck:
// der Nutzen entsteht erst dort, wo der Mensch nach „0 Treffer" LIEST, was die Maschine verstanden
// hat, eine Zahl für seinen eigenen Wortlaut sieht und einen Knopf hat. Deshalb wird hier die echte
// `ImportSelect`-Fläche gemountet (nur das `endpoints`-Modul ist ersetzt).
//
// ARIA-HIDDEN: dieser Test liest `aria-hidden`-Teilbäume AUSDRÜCKLICH NICHT mit (`sichtbarerText`
// unten überspringt sie, ebenso `hidden`, `sr-only`, `display:none`, `visibility:hidden`,
// 0-Pixel-Clip). Begründung (LEHRE JOB 3258): die Zusicherung dieses Auftrags ist SICHTBARKEIT —
// „die Oberfläche sagt in einem Satz …". Ein `container.textContent`, das verborgenen DOM mitliest,
// bewiese nur, dass der Zustand vorhanden ist, nicht dass der Mensch ihn sieht. Die Gegenprobe dazu
// steht in der Rückgabe: mit `sr-only` am Hinweiskasten wird dieser Test rot.
//
// LADEN/FEHLER (Zustandsmodell des Auftrags): die Titelaussage entsteht ausschließlich aus einer
// erfolgreichen Antwort — sie hängt an `preview`, dem latest-wins-Stand der letzten 200er-Antwort.
// Vor der ersten Antwort gibt es weder „0 Treffer" noch eine Titelzahl; der letzte Fall unten hält
// genau das fest.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: { import: { select: vi.fn(), group: vi.fn(), apply: vi.fn() } },
    reasoner: { status: vi.fn().mockResolvedValue({ active: false, mode: "deterministic" }) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;

const GESUCHT = "[DEMO T06] Restoring a customer file";

// Die live beobachtete Antwort: die KI hat gedeutet („ok"), ihre Deutung trifft nichts, und der
// deterministische Titelbefund steht daneben.
const NULL_TREFFER = {
  matched: 0,
  limited: false,
  truncated: false,
  criteria: { themes: ["Customer file restoration"] },
  preview: [],
  inferenceStatus: "ok" as const,
  titleFallback: {
    query: GESUCHT,
    matched: 1,
    criteria: { titleContains: [GESUCHT] },
  },
};

const TITEL_TREFFER = {
  matched: 1,
  limited: false,
  truncated: false,
  criteria: { titleContains: [GESUCHT] },
  preview: [{ id: "t06", title: GESUCHT, hasImage: false, themes: ["Demo"] }],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ImportSelect, { chip: { themes: [], authors: [], spaces: [] } }),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

// Ist dieser Knoten (samt Elternkette) für einen sehenden Menschen da? jsdom rechnet kein Layout —
// geprüft wird deshalb genau das, was die Fläche selbst setzen würde, um etwas zu verbergen.
function verborgen(el: Element): boolean {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const klassen = node.getAttribute("class") ?? "";
    if (/\b(sr-only|invisible|hidden)\b/.test(klassen)) {
      return true;
    }
    const stil = node.getAttribute("style") ?? "";
    if (/display:\s*none|visibility:\s*hidden|clip:\s*rect\(0/.test(stil)) {
      return true;
    }
  }
  return false;
}

// Der Text, den ein sehender Mensch liest — verborgene Teilbäume bleiben draußen (s. Kopfkommentar).
function sichtbarerText(): string {
  const teile: string[] = [];
  const gehe = (el: Element): void => {
    if (verborgen(el)) {
      return;
    }
    for (const kind of el.childNodes) {
      if (kind.nodeType === 3) {
        teile.push(kind.textContent ?? "");
      } else if (kind.nodeType === 1) {
        gehe(kind as Element);
      }
    }
  };
  gehe(container);
  return teile.join(" ");
}

function sichtbarerKnopf(teil: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].filter(
    (b) => (b.textContent ?? "").includes(teil) && !verborgen(b),
  );
  const btn = treffer[0];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Sichtbarer Knopf mit Text „${teil}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return btn;
}

function setValue(el: HTMLInputElement, value: string): void {
  // React verfolgt den Wert über einen internen Value-Tracker; der native Prototyp-Setter umgeht ihn.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function satzEingeben(satz: string): void {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Freitext-Feld nicht gefunden");
  }
  setValue(feld, satz);
}

async function klicken(teil: string): Promise<void> {
  await act(async () => {
    sichtbarerKnopf(teil).click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function letzterAufruf(): { prompt: string; criteria: Record<string, unknown> } {
  return selectMock.mock.calls.at(-1)?.[0] as {
    prompt: string;
    criteria: Record<string, unknown>;
  };
}

describe("JOB 3356: die Auswahlfläche sagt, was die KI verstand — und bietet den Titelweg an", () => {
  it("0 Treffer nach einem Satz: Deutung, Titelzahl und Knopf sind SICHTBAR; der Knopf schaltet um", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");
    expect(letzterAufruf().prompt).toBe(GESUCHT);

    const text = sichtbarerText();
    // (a) WAS die KI verstanden hat — die effektiv benutzten Kriterien, über den bestehenden Weg.
    expect(text).toContain("Themen: Customer file restoration");
    expect(text).toContain("So hat die KI deinen Satz gedeutet");
    // (b) die deterministische Zahl zum eigenen Wortlaut.
    expect(text).toContain(`1 Seite trägt „${GESUCHT}“ im Titel.`);
    // Die Vorschau selbst bleibt ehrlich leer (die KI-Deutung wird nicht beschönigt).
    expect(text).toContain("Kein Treffer für diese Eingrenzung.");

    // (c) der Knopf fordert die Vorschau mit GENAU den Server-Kriterien an — ohne Satz, damit die
    // KI-Deutung nicht über UND wieder dazukommt, und ohne die KI-Kriterien.
    selectMock.mockResolvedValue(TITEL_TREFFER);
    await klicken("Diese 1 Seite zeigen");
    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(letzterAufruf().criteria).toEqual({ titleContains: [GESUCHT] });
    expect(letzterAufruf().criteria.themes).toBeUndefined();
    expect(letzterAufruf().prompt).toBe("");

    // Danach steht die Seite da — und die Kriterienzeile sagt ehrlich, WONACH gefiltert wurde.
    const danach = sichtbarerText();
    expect(danach).toContain(GESUCHT);
    expect(danach).toContain(`Titel enthält: ${GESUCHT}`);
    expect(danach).not.toContain("Keine Eingrenzung — alles würde passen.");
    // Der Hinweis ist weg: es gibt keine 0 mehr zu erklären.
    expect(danach).not.toContain("So hat die KI deinen Satz gedeutet");
  });

  it("keine stille Ausweitung: ohne Knopfdruck bleibt die Vorschau die angeforderte (0 Treffer)", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");
    // Genau EIN Aufruf; die gefundene Titelseite taucht NIRGENDS in der Trefferliste auf.
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(sichtbarerText()).toContain("0 von 0 Treffern");
    expect(
      [...container.querySelectorAll("input[type=checkbox]")].some(
        (el) => el.getAttribute("aria-label") === GESUCHT,
      ),
    ).toBe(false);
  });

  it("matched 0: die ehrliche Gegenaussage steht da, und es gibt KEINEN Knopf", async () => {
    selectMock.mockResolvedValue({
      ...NULL_TREFFER,
      titleFallback: {
        query: "Hydraulik am Kran",
        matched: 0,
        criteria: { titleContains: ["Hydraulik am Kran"] },
      },
    });
    mount();
    satzEingeben("Hydraulik am Kran");
    await klicken("Weiter: Eingrenzen");
    expect(sichtbarerText()).toContain(
      "Auch im Titel steht „Hydraulik am Kran“ auf keiner der geladenen Seiten.",
    );
    // Kein Umschaltknopf — es gibt nichts umzuschalten. Geprüft am GESAMTEN DOM (nicht nur am
    // sichtbaren Teil): der Knopf darf auch nicht verborgen dastehen.
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent ?? "").join(" | "),
    ).not.toMatch(/Seite[n]? zeigen/);
  });

  it("KI-Ausfall: die Fläche behauptet KEINE Deutung — die Titelzahl steht trotzdem daneben", async () => {
    selectMock.mockResolvedValue({
      ...NULL_TREFFER,
      criteria: {},
      inferenceStatus: "unavailable" as const,
      fallbackReason: "no-model",
    });
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");
    const text = sichtbarerText();
    expect(text).not.toContain("So hat die KI deinen Satz gedeutet");
    expect(text).toContain(`1 Seite trägt „${GESUCHT}“ im Titel.`);
    // Der bestehende Ausfall-Hinweis bleibt der, der die KI erklärt.
    expect(text).toContain("KI-Auswahl derzeit nicht verfügbar");
  });

  it("EN: dieselbe Auskunft auf Englisch (die Vorführung läuft auf Englisch)", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    try {
      selectMock.mockResolvedValue(NULL_TREFFER);
      mount();
      const feld = [...container.querySelectorAll("input")].find(
        (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
      ) as HTMLInputElement;
      setValue(feld, GESUCHT);
      await klicken(i18n.t("imp.select.previewCta"));
      const text = sichtbarerText();
      expect(text).toContain("This is how the AI read your sentence");
      expect(text).toContain(`1 page carries “${GESUCHT}” in its title.`);
      selectMock.mockResolvedValue(TITEL_TREFFER);
      await klicken("Show that 1 page");
      expect(letzterAufruf().criteria).toEqual({ titleContains: [GESUCHT] });
      expect(sichtbarerText()).toContain(`Title contains: ${GESUCHT}`);
    } finally {
      await act(async () => {
        await i18n.changeLanguage("de");
      });
    }
  });

  it("vor der ersten Antwort gibt es weder Trefferzahl noch Titelaussage", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    const text = sichtbarerText();
    expect(text).not.toContain("im Titel.");
    expect(text).not.toContain("Treffern");
  });

  // ============================================================================================
  // RUNDE 2 (BEN-Korrekturpflicht 1+2, Nachführung der Steuerung 08.09. 22:21) — DIE FOLGEANFRAGE.
  // ============================================================================================
  //
  // Der Fall, den Runde 1 NICHT gemessen hat: eine 0-Treffer-Vorschau steht mit ihrer Titelaussage
  // da, der Mensch ändert den Satz und fordert neu an. Solange die neue Anfrage läuft oder
  // gescheitert ist, gibt es keine geprüfte Grundlage für die alte Zahl — sie darf sich nicht als
  // Aussage über den neuen Satz lesen. Regel der Steuerung: ausblenden ODER sichtbar dem alten Satz
  // zuordnen („Ergebnis für: <alter Satz>" + Laden/Fehler), nie ein erfundener neuer Treffer.
  // Gebaut ist die Zuordnung, weil die zuletzt ERFOLGREICH geholte Auskunft nach dem Zustandsmodell
  // des Auftrags stehen bleiben darf — sie darf nur nicht als neu gelten.

  // Ein Aufruf, der bewusst offen bleibt: so ist der Ladezustand messbar, ohne auf Zeit zu warten.
  function schwebenderAufruf(): { aufloesen: (wert: unknown) => void } {
    let aufloesen: (wert: unknown) => void = () => {};
    selectMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          aufloesen = res as (wert: unknown) => void;
        }),
    );
    return {
      aufloesen: (wert) => {
        aufloesen(wert);
      },
    };
  }

  const ZWEITE_ANTWORT = {
    ...NULL_TREFFER,
    titleFallback: {
      query: "Hydraulik am Kran",
      matched: 3,
      criteria: { titleContains: ["Hydraulik am Kran"] },
    },
  };

  it("R2-a: Folgeanfrage SCHWEBT → der Kasten ist dem alten Satz zugeordnet, ohne Umschaltknopf", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");
    expect(sichtbarerText()).toContain(`1 Seite trägt „${GESUCHT}“ im Titel.`);

    // Neuer Satz, neue Anfrage — die Antwort steht noch aus.
    const schwebt = schwebenderAufruf();
    satzEingeben("Hydraulik am Kran");
    await klicken("Vorschau aktualisieren");

    const text = sichtbarerText();
    expect(text).toContain(`Ergebnis für: „${GESUCHT}“.`);
    expect(text).toContain("Die neue Vorschau läuft noch");
    // Die alte Zahl bleibt LESBAR, aber sie steht unter der Zuordnung — und der Knopf, der auf sie
    // umstellen würde, ist weg (er hätte gerade keine geprüfte Grundlage).
    expect(text).toContain(`1 Seite trägt „${GESUCHT}“ im Titel.`);
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent ?? "").join(" | "),
    ).not.toMatch(/Seite[n]? zeigen/);

    // Kommt die Antwort, ist die Zuordnung weg und die NEUE Auskunft steht da.
    await act(async () => {
      schwebt.aufloesen(ZWEITE_ANTWORT);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const danach = sichtbarerText();
    expect(danach).not.toContain("Ergebnis für:");
    expect(danach).not.toContain("Die neue Vorschau läuft noch");
    expect(danach).toContain("3 Seiten tragen „Hydraulik am Kran“ im Titel.");
    expect(sichtbarerKnopf("Diese 3 Seiten zeigen")).toBeInstanceOf(HTMLButtonElement);
  });

  it("R2-b: Folgeanfrage SCHEITERT → Zuordnung mit Fehlergrund, kein Umschaltknopf", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");

    selectMock.mockRejectedValueOnce(new Error("Netz weg"));
    satzEingeben("Hydraulik am Kran");
    await klicken("Vorschau aktualisieren");

    const text = sichtbarerText();
    expect(text).toContain(`Ergebnis für: „${GESUCHT}“.`);
    expect(text).toContain("Die neue Vorschau ist fehlgeschlagen");
    // Der bestehende Fehlerweg der Fläche gilt unverändert daneben.
    expect(text).toContain("Etwas ist schiefgelaufen.");
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent ?? "").join(" | "),
    ).not.toMatch(/Seite[n]? zeigen/);
    // Nichts wird erfunden: die alte Zahl steht mit ihrem eigenen Wortlaut da, nicht mit dem neuen.
    expect(text).toContain(`1 Seite trägt „${GESUCHT}“ im Titel.`);
    expect(text).not.toContain("Hydraulik am Kran“ im Titel");
  });

  it("R2-c: Satz im Feld geändert, aber noch nicht angefordert → ebenfalls zugeordnet", async () => {
    selectMock.mockResolvedValue(NULL_TREFFER);
    mount();
    satzEingeben(GESUCHT);
    await klicken("Weiter: Eingrenzen");
    expect(sichtbarerText()).not.toContain("Ergebnis für:");

    satzEingeben("Hydraulik am Kran");
    const text = sichtbarerText();
    expect(text).toContain(`Ergebnis für: „${GESUCHT}“.`);
    expect(text).toContain("Der Satz im Feld ist inzwischen ein anderer");
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent ?? "").join(" | "),
    ).not.toMatch(/Seite[n]? zeigen/);
  });

  it("R2-d: EN — die Zuordnung gibt es auch auf Englisch", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    try {
      selectMock.mockResolvedValue(NULL_TREFFER);
      mount();
      const feld = [...container.querySelectorAll("input")].find(
        (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
      ) as HTMLInputElement;
      setValue(feld, GESUCHT);
      await klicken(i18n.t("imp.select.previewCta"));
      selectMock.mockRejectedValueOnce(new Error("Netz weg"));
      setValue(feld, "Hydraulik am Kran");
      await klicken(i18n.t("imp.select.previewAgain"));
      const text = sichtbarerText();
      expect(text).toContain(`Result for: “${GESUCHT}”.`);
      expect(text).toContain("The new preview failed");
    } finally {
      await act(async () => {
        await i18n.changeLanguage("de");
      });
    }
  });
});
