// @vitest-environment jsdom
// ================================================================================================
// D-045 — GEPLANTE FORMATE SIND STANDARDMÄSSIG EINGEKLAPPT, UND DER WEG DORTHIN IST BENANNT
// ================================================================================================
//
// Gebunden an `_relay/kopf/outbox/BEN-PRUEFUNG-JOB-1021-D4.md` (SHA-256
// `2c758994a4f42dacdcb32fde989fb8d4d03faaf9d8b92cea754b09f582a4e287`) und die dort übernommenen
// sechs Korrekturpflichten des D3-Urteils. Drei Verträge, drei getrennte Blöcke:
//
//   R1  ohne Prop  → geplante Kacheln initial eingeklappt, Schalter mit Anzahl und `aria-expanded="false"`
//   R2/R3          → Maus und Tastatur klappen auf, Fokus bleibt, alle geplanten Kacheln erscheinen
//   R4             → DE/EN/NL liefern echte Texte, keine Schlüsselstrings
//   R5  `collapsePlanned={false}` → Altmodus: alles sofort sichtbar, KEIN Schalter
//
// WARUM DIE i18n VOR ALLEM ANDEREN INITIALISIERT WIRD: D3 hatte den Stolperstein benannt — die
// Aufklappfälle scheiterten zuvor an fehlender i18n-Initialisierung, nicht an der Sache. Der
// `beforeEach` unten stellt die Sprache deshalb ausdrücklich und abgewartet ein; ohne das misst der
// Test Schlüsselnamen statt Wirkung.
//
// ZUR TASTATUR, GENAU: Der Aufklapper ist ein natives `<button type="button">`. Genau daher kommt
// die Enter-/Leertasten-Aktivierung — die Plattform erzeugt daraus ein `click`. jsdom synthetisiert
// diese Aktivierungsschritte NICHT aus einem `keydown`. Geprüft wird deshalb beides getrennt und
// ehrlich: (a) dass es wirklich ein natives Button-Element ist (die strukturelle Zusage), und
// (b) dass der Aktivierungsweg tastenunabhängig ist und den Fokus behält. Was NICHT geprüft wird,
// ist die Aktivierung durch jsdom selbst; das kann diese Umgebung nicht.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FileTypePicker } from "../../apps/web/src/components/FileTypePicker";
import i18n from "../../apps/web/src/i18n";
import { FILE_SOURCES } from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const GEPLANT = FILE_SOURCES.filter((s) => s.state === "planned");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(props: Record<string, unknown> = {}): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => {
    r.render(
      createElement(FileTypePicker, {
        sources: FILE_SOURCES,
        onActivate: () => {},
        ...props,
      }),
    );
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;
  }
  await i18n.changeLanguage("de");
});

function schalter(): HTMLButtonElement | null {
  return container.querySelector('[data-testid="planned-disclosure"]');
}

/** Die tatsächlich gerenderten „geplant"-Kacheln — nicht die Quelldaten. */
function geplanteKacheln(): HTMLButtonElement[] {
  return [...container.querySelectorAll('button[data-state="planned"]')] as HTMLButtonElement[];
}

// `opts` ist bewusst PFLICHT, nicht optional: unter `exactOptionalPropertyTypes` (nur `./tools/check`
// prüft damit) darf ein optionaler Parameter nicht als `undefined` weitergereicht werden. Alle
// Aufrufer hier führen ohnehin einen Zähler mit.
function wort(sprache: Sprache, key: string, opts: Record<string, unknown>): string {
  return String(i18n.getFixedT(sprache)(key, opts));
}

describe("D-045 · R1 — ohne Prop sind geplante Formate initial eingeklappt", () => {
  it("die Quelldaten enthalten überhaupt geplante Formate (sonst prüfte alles Weitere nichts)", () => {
    // Kalibrierung: ohne diesen Fall wäre ein leerer Aufklapper von einem korrekt eingeklappten
    // nicht zu unterscheiden, und R1–R3 wären still bedeutungslos.
    expect(GEPLANT.length).toBeGreaterThan(0);
  });

  it("keine einzige geplante Kachel ist gerendert", () => {
    mount();
    expect(geplanteKacheln()).toHaveLength(0);
  });

  it('stattdessen steht ein Aufklapper da — mit `aria-expanded="false"`', () => {
    mount();
    const s = schalter();
    expect(s, "der Aufklapper fehlt — geplante Formate wären damit unerreichbar").toBeTruthy();
    expect(s?.getAttribute("aria-expanded")).toBe("false");
  });

  it("sein zugänglicher Name nennt Zweck UND Anzahl", () => {
    mount();
    // Der Name entsteht aus dem Textinhalt; das Chevron ist `aria-hidden`.
    expect((schalter()?.textContent ?? "").trim()).toBe(
      wort("de", "imp.gallery.plannedGroup", { count: GEPLANT.length }),
    );
    // Die Anzahl steht wirklich darin — sonst wüsste niemand, was sich dahinter verbirgt.
    expect(schalter()?.textContent).toContain(String(GEPLANT.length));
  });

  it("die aktiven und nicht-geplanten Kacheln bleiben unangetastet sichtbar", () => {
    mount();
    for (const quelle of FILE_SOURCES.filter((s) => s.state !== "planned")) {
      expect(
        container.querySelector(`button[data-id="${quelle.id}"]`),
        `${quelle.id} (${quelle.state}) darf nicht mit eingeklappt werden`,
      ).toBeTruthy();
    }
  });
});

describe("D-045 · R2 — Maus klappt auf, der Fokus bleibt", () => {
  it('nach dem Klick steht `aria-expanded="true"` und ALLE geplanten Kacheln erscheinen', () => {
    mount();
    const s = schalter();
    if (!s) {
      throw new Error("Aufklapper fehlt");
    }
    act(() => {
      s.click();
    });
    expect(schalter()?.getAttribute("aria-expanded")).toBe("true");
    expect(geplanteKacheln()).toHaveLength(GEPLANT.length);
    // Nicht nur die Anzahl — jede einzelne Kennung ist da.
    const gerendert = new Set(geplanteKacheln().map((b) => b.getAttribute("data-id")));
    for (const quelle of GEPLANT) {
      expect(gerendert.has(quelle.id), `${quelle.id} fehlt nach dem Aufklappen`).toBe(true);
    }
  });

  it("der Fokus bleibt auf dem Schalter — er springt nicht in den geöffneten Bereich", () => {
    mount();
    const s = schalter();
    s?.focus();
    expect(document.activeElement).toBe(s);
    act(() => {
      s?.click();
    });
    expect(document.activeElement).toBe(schalter());
  });

  it("erneutes Aktivieren klappt wieder zu — der Weg ist in beide Richtungen begehbar", () => {
    mount();
    act(() => {
      schalter()?.click();
    });
    expect(geplanteKacheln()).toHaveLength(GEPLANT.length);
    act(() => {
      schalter()?.click();
    });
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
    expect(geplanteKacheln()).toHaveLength(0);
  });
});

describe("D-045 · R3 — die Tastatur erreicht denselben Vertrag", () => {
  it('der Aufklapper ist ein natives `<button type="button">` — daher Enter und Leertaste', () => {
    mount();
    const s = schalter();
    // Das ist die strukturelle Zusage, aus der die Plattform die Tastaturaktivierung ableitet.
    // Ein `<div onClick>` sähe identisch aus und wäre mit der Tastatur nicht bedienbar.
    expect(s?.tagName).toBe("BUTTON");
    expect(s?.getAttribute("type")).toBe("button");
    // Fokussierbar ohne künstliches `tabindex`.
    s?.focus();
    expect(document.activeElement).toBe(s);
  });

  it("Enter und Leertaste lösen keinen Sonderweg aus — der Handler ist tastenunabhängig", () => {
    mount();
    const s = schalter();
    s?.focus();
    // jsdom erzeugt aus diesen Ereignissen KEINE Aktivierung; geprüft wird deshalb, dass sie den
    // Zustand auch nicht auf einem eigenen Weg verändern (kein doppelt verdrahteter Tastenhandler,
    // der in einem echten Browser zweimal auslösen würde).
    for (const key of ["Enter", " "]) {
      act(() => {
        s?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        s?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
      });
    }
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
    expect(geplanteKacheln()).toHaveLength(0);

    // Und die Aktivierung selbst — genau das, was die Plattform aus Enter/Leertaste macht —
    // erfüllt den Vertrag und behält den Fokus.
    act(() => {
      s?.click();
    });
    expect(schalter()?.getAttribute("aria-expanded")).toBe("true");
    expect(geplanteKacheln()).toHaveLength(GEPLANT.length);
    expect(document.activeElement).toBe(schalter());
  });
});

describe("D-045 · R4 — DE/EN/NL liefern echte Texte, keine Schlüssel", () => {
  it.each(SPRACHEN)("%s: der Schaltername ist übersetzt und trägt die Anzahl", async (sprache) => {
    await act(async () => {
      await i18n.changeLanguage(sprache);
    });
    mount();
    const name = (schalter()?.textContent ?? "").trim();
    expect(name).toBe(wort(sprache, "imp.gallery.plannedGroup", { count: GEPLANT.length }));
    // Ein unaufgelöster Schlüssel wäre der Schlüsselname selbst — genau der Fehler, den D3 als
    // Stolperstein benannt hat.
    expect(name).not.toBe("imp.gallery.plannedGroup");
    expect(name).not.toContain("imp.gallery");
    expect(name).toContain(String(GEPLANT.length));
  });

  it("die drei Sprachen sagen es wirklich verschieden — sonst wäre nichts übersetzt", () => {
    const namen = SPRACHEN.map((s) => wort(s, "imp.gallery.plannedGroup", { count: 3 }));
    expect(new Set(namen).size).toBeGreaterThan(1);
  });
});

describe("D-045 · R5 — der explizite Altmodus bleibt erhalten", () => {
  it("`collapsePlanned={false}`: alle geplanten Kacheln sind sofort sichtbar", () => {
    mount({ collapsePlanned: false });
    expect(geplanteKacheln()).toHaveLength(GEPLANT.length);
  });

  it("`collapsePlanned={false}`: es erscheint KEIN Aufklapper", () => {
    mount({ collapsePlanned: false });
    expect(schalter(), "im Altmodus darf kein Disclosure-Schalter entstehen").toBeNull();
  });

  it("die beiden Modi unterscheiden sich messbar — der Default ist nicht der Altmodus", () => {
    // Ohne diesen Vergleich könnte ein Default, der versehentlich auf dem Altwert steht, alle
    // R5-Fälle grün lassen und trotzdem falsch sein.
    mount();
    const ohneProp = { kacheln: geplanteKacheln().length, schalter: schalter() !== null };
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;

    mount({ collapsePlanned: false });
    const altmodus = { kacheln: geplanteKacheln().length, schalter: schalter() !== null };

    expect(ohneProp).toEqual({ kacheln: 0, schalter: true });
    expect(altmodus).toEqual({ kacheln: GEPLANT.length, schalter: false });
  });
});
