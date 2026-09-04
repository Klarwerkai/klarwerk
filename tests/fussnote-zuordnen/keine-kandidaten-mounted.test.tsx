// @vitest-environment jsdom
// ================================================================================================
// JOB 3055 · I/J/K — KEIN KANDIDAT HEISST EINE EHRLICHE AUSKUNFT, KEINE LEERE LISTE
// ================================================================================================
//
// Die naheliegende Halbheit dieses Auftrags ist ein Abschnitt, der bei null Kandidaten einfach
// nichts zeigt. Der Autor sieht dann eine Überschrift und darunter Leere und weiß nicht, ob es
// kein Bild gibt, ob alle schon beschrieben sind oder ob etwas kaputt ist. Zwei Gründe, zwei
// Sätze — und der dritte Fall (eine Vorschau lädt nicht) ist KEINER von beiden: ein Bild, dessen
// Aussehen fehlt, ist immer noch ein Bild.
//
// WAS JSDOM NICHT KANN: es lädt keine Bilder und feuert deshalb von sich aus kein `error`. Der
// Fehlschlag wird als echtes DOM-Ereignis am Vorschaubild ausgelöst — genau das, was der Browser
// tut, wenn die Quelle ins Leere zeigt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VERWAIST = "Verwaiste Beschreibung";
const LOSE = `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`;

/** I — gar kein Bild im Text. */
const OHNE_BILD = `<p>Ein Satz, der stehen bleibt.</p>${LOSE}`;

/** J — zwei Bilder, beide mit gefüllter Fußnote. */
const ALLE_BESCHRIEBEN = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  LOSE,
  '<figure data-image-id="kw-img-1"><img src="/api/objects/eins/raw" data-image-id="kw-img-1">',
  '<figcaption data-image-id="kw-img-1">Beschreibung eins</figcaption></figure>',
  '<figure data-image-id="kw-img-2"><img src="/api/objects/zwei/raw" data-image-id="kw-img-2">',
  '<figcaption data-image-id="kw-img-2">Beschreibung zwei</figcaption></figure>',
].join("");

/**
 * P — RUNDE 2, bens Korrekturpflicht 3: EIN Bild, dessen Zuordnung nicht belegbar ist. Wörtlich
 * seine Lage: das Bild trägt keine eigene Kennung, und an ihm stehen ZWEI widersprüchliche leere
 * Fußnoten — `ensureImageAnchors` schreibt hier bewusst nichts (huelle4: „es gibt keine Antwort auf
 * die Frage, welche zum Bild gehört"). Runde 1 gab dafür „Alle Bilder … haben schon eine
 * Bildbeschreibung" aus. Das war falsch: beschrieben ist hier gar nichts.
 */
const NICHT_BELEGBAR = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  LOSE,
  '<figure><img src="/api/objects/unklar/raw">',
  "<figcaption></figcaption>",
  '<figcaption data-image-id="kw-fremd"></figcaption></figure>',
].join("");

/** K — ein Kandidat, dessen Quelle ins Leere zeigt. */
const KANDIDAT_OHNE_VORSCHAU = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  LOSE,
  '<figure data-image-id="kw-img-weg"><img src="/api/objects/fehlt/raw" data-image-id="kw-img-weg">',
  '<figcaption data-image-id="kw-img-weg"></figcaption></figure>',
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let inhalt = OHNE_BILD;

function Host(): JSX.Element {
  const [value, setValue] = useState(inhalt);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: setValue,
    }),
    async () => ({ text: "Vorschlag", demo: false }),
  );
}

let montiert = false;

function mount(start: string): void {
  inhalt = start;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
  montiert = true;
}

/**
 * Die Katalogfälle (J2, P2) messen die Übersetzungen und montieren deshalb GAR NICHTS — ein
 * `getFixedT` für eine noch nicht geladene Sprache stößt sonst eine Aktualisierung an einem
 * montierten Baum an, die außerhalb von `act` eintrifft und als Warnung am falschen Fall erscheint.
 */
function abbauen(): void {
  if (!montiert) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  montiert = false;
}

function fussnoteMitText(text: string): HTMLElement {
  const treffer = (Array.from(container.querySelectorAll("figcaption")) as HTMLElement[]).filter(
    (f) => (f.textContent ?? "").trim() === text,
  );
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

function oeffnen(): void {
  act(() => {
    fussnoteMitText(VERWAIST).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function abschnittText(): string {
  return document.querySelector('[data-testid="caption-form-assign"]')?.textContent ?? "";
}

function knoepfe(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-testid="caption-form-assign-option"]'),
  ) as HTMLElement[];
}

/**
 * Der Sprachwechsel läuft durch `act`, auch wenn er hier nur zurückstellt: i18next benachrichtigt
 * seine Zuhörer asynchron, und ein Zustandswechsel, der nach dem Test eintrifft, erscheint als
 * „not wrapped in act(...)" am NÄCHSTEN Fall — eine Warnung, die auf den Falschen zeigt.
 */
async function spracheZurueck(): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage("de");
  });
}

beforeEach(async () => {
  await spracheZurueck();
});

afterEach(async () => {
  abbauen();
  await spracheZurueck();
});

describe("JOB 3055 · I — es gibt in diesem Text überhaupt kein Bild", () => {
  it("I1 · Satz (a) statt leerer Liste, und kein einziger Knopf", () => {
    mount(OHNE_BILD);
    oeffnen();
    expect(
      document.querySelector('[data-testid="caption-form-assign"]'),
      "der Abschnitt fehlt ganz — dann steht dort gar keine Auskunft",
    ).not.toBeNull();
    expect(knoepfe().length).toBe(0);
    expect(abschnittText()).toContain(i18n.t("editor.assignNoImage"));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignAllDescribed"));
  });
});

describe("JOB 3055 · J — alle Bilder haben schon eine Beschreibung", () => {
  it("J1 · Satz (b), wörtlich verschieden von Satz (a)", () => {
    mount(ALLE_BESCHRIEBEN);
    oeffnen();
    expect(knoepfe().length).toBe(0);
    expect(abschnittText()).toContain(i18n.t("editor.assignAllDescribed"));
    expect(
      abschnittText(),
      "beide Gründe werden mit demselben Satz beantwortet — eine Sammelformulierung",
    ).not.toContain(i18n.t("editor.assignNoImage"));
    // Und die zwei Sätze sind wirklich zwei: ein gemeinsamer Text wäre keine Unterscheidung.
    expect(i18n.t("editor.assignAllDescribed")).not.toBe(i18n.t("editor.assignNoImage"));
  });

  it("J2 · in allen drei Sprachen zwei verschiedene, nicht leere Sätze", () => {
    // Ein Katalogfall: er misst die drei Sprachen, nicht die Fläche — deshalb kein Mount.
    for (const lng of ["de", "en", "nl"]) {
      const t = i18n.getFixedT(lng);
      const a = String(t("editor.assignNoImage"));
      const b = String(t("editor.assignAllDescribed"));
      expect(a.length, `Satz (a) fehlt in ${lng}`).toBeGreaterThan(10);
      expect(b.length, `Satz (b) fehlt in ${lng}`).toBeGreaterThan(10);
      expect(a, `beide Sätze sind in ${lng} derselbe`).not.toBe(b);
      // Und der Schlüssel ist wirklich übersetzt, nicht durchgereicht.
      expect(a).not.toBe("editor.assignNoImage");
      expect(b).not.toBe("editor.assignAllDescribed");
    }
  });
});

describe("JOB 3055 · P — nicht belegbar ist nicht „schon beschrieben“", () => {
  it("P1 · eigener Satz, kein Kandidat, und ausdrücklich NICHT „alle beschrieben“", () => {
    mount(NICHT_BELEGBAR);
    oeffnen();
    expect(knoepfe().length, "ein nicht belegbares Bild wird als Kandidat angeboten").toBe(0);
    // Vorbedingung: es gibt überhaupt ein Bild — sonst wäre Satz (a) richtig und P prüfte nichts.
    expect(container.querySelectorAll("img").length).toBe(1);
    expect(abschnittText()).toContain(i18n.t("editor.assignUnclear", { count: 1 }));
    expect(
      abschnittText(),
      "ein Bild ohne belegbare Zuordnung wird als „schon beschrieben“ ausgegeben — genau bens Befund",
    ).not.toContain(i18n.t("editor.assignAllDescribed"));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignNoImage"));
  });

  it("P2 · in allen drei Sprachen ein eigener, nicht leerer Satz", () => {
    // Katalogfall wie J2 — er misst die Übersetzungen, nicht die Fläche.
    for (const lng of ["de", "en", "nl"]) {
      const t = i18n.getFixedT(lng);
      const c = String(t("editor.assignUnclear", { count: 1 }));
      const cMehr = String(t("editor.assignUnclear", { count: 3 }));
      expect(c.length, `Satz (c) fehlt in ${lng}`).toBeGreaterThan(10);
      expect(c).not.toBe("editor.assignUnclear");
      expect(c, `Satz (c) fällt in ${lng} mit Satz (b) zusammen`).not.toBe(
        String(t("editor.assignAllDescribed")),
      );
      expect(c, `Satz (c) fällt in ${lng} mit Satz (a) zusammen`).not.toBe(
        String(t("editor.assignNoImage")),
      );
      // Die Zahl steht wirklich drin — sonst behauptete der Satz eine Menge, die er nicht kennt.
      expect(c).toContain("1");
      expect(cMehr).toContain("3");
    }
  });

  it("P4 · und der Grund eines verweigerten Klicks steht ebenfalls in allen drei Sprachen", () => {
    // Katalogfall wie P2. Der Satz gehört zu RUNDE 3 (bens Korrekturpflicht 1): ein Klick, der
    // nichts bewirkt, muss den Grund nennen — und zwar überall, nicht nur auf Deutsch.
    for (const lng of ["de", "en", "nl"]) {
      const t = i18n.getFixedT(lng);
      const f = String(t("editor.assignFailed"));
      expect(f.length, `der Satz fehlt in ${lng}`).toBeGreaterThan(10);
      expect(f).not.toBe("editor.assignFailed");
      for (const anderer of [
        "editor.assignNoImage",
        "editor.assignAllDescribed",
        "editor.assignHeading",
      ]) {
        expect(f, `der Satz fällt in ${lng} mit ${anderer} zusammen`).not.toBe(String(t(anderer)));
      }
    }
  });

  it("P3 · der Gegenfall bleibt: wirklich beschriebene Bilder melden weiterhin Satz (b)", () => {
    // Ohne diesen Fall wäre P1 auch dann grün, wenn Satz (b) nie mehr vorkäme.
    mount(ALLE_BESCHRIEBEN);
    oeffnen();
    expect(abschnittText()).toContain(i18n.t("editor.assignAllDescribed"));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignUnclear", { count: 1 }));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignUnclear", { count: 2 }));
  });
});

describe("JOB 3055 · K — eine gescheiterte Bildvorschau ist kein fehlendes Bild", () => {
  it("K1 · der Knopf bleibt bedienbar und benannt, und keiner der zwei Sätze erscheint", () => {
    mount(KANDIDAT_OHNE_VORSCHAU);
    oeffnen();
    const knopf = knoepfe()[0];
    if (knopf === undefined) {
      throw new Error("Vorbedingung: es gibt genau einen Kandidaten");
    }
    const vorschau = knopf.querySelector("img");
    expect(vorschau, "der Kandidat trägt gar kein Vorschaubild").not.toBeNull();

    act(() => {
      vorschau?.dispatchEvent(new Event("error"));
    });

    // Der Knopf ist noch da, noch benannt, noch auslösbar.
    const nachher = knoepfe()[0];
    expect(nachher, "der Kandidat verschwindet, wenn seine Vorschau nicht lädt").toBeDefined();
    expect(nachher?.getAttribute("aria-label")).toBe(i18n.t("editor.assignOptionLabel", { n: 1 }));
    expect(nachher?.hasAttribute("disabled")).toBe(false);
    expect(nachher?.textContent).toContain(i18n.t("editor.assignImageName", { n: 1 }));
    // Statt des Bildes steht der eigene, dritte Satz da — nicht eine der zwei Verneinungen.
    expect(abschnittText()).toContain(i18n.t("editor.assignPreviewMissing"));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignNoImage"));
    expect(abschnittText()).not.toContain(i18n.t("editor.assignAllDescribed"));

    // Und die Zuordnung hängt nicht daran, dass das Bild sichtbar ist.
    act(() => nachher?.click());
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-weg");
  });
});
