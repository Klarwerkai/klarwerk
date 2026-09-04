// @vitest-environment jsdom
// ================================================================================================
// JOB 3055 · F/G/H/L — DER WEG DES AUTORS, AM GEMOUNTETEN EDITOR
// ================================================================================================
//
// WARUM GEMOUNTET: `zuordnung.test.ts` misst, was das Modul kann. Ob daraus ein WEG wird,
// entscheidet der Editor — das Formular muss den Abschnitt zeigen, der Klick muss durch die EINE
// Verankerung laufen, und das Ergebnis muss den Editor über `onChange` verlassen. Nichts davon ist
// ein Attributbefund.
//
// GEMESSEN WIRD BIS ZUM `onChange`-INHALT, nicht bis zum Editor-DOM. Der Auftrag verlangt, dass
// die Zuordnung das Speichern überlebt; der gespeicherte Rumpf ist genau das, was `onChange`
// bekommt — alles davor ist Editor-Zustand und reist nirgendwohin.
//
// WAS JSDOM NICHT KANN, ausdrücklich benannt: es setzt die Tastaturaktivierung eines `<button>`
// (Eingabe-/Leertaste → Klick) nicht selbst um, und es lädt keine Bilder. Gemessen wird deshalb,
// was jsdom ehrlich hergibt und woran der Tastaturweg im Browser hängt: ein echtes `<button>`,
// erreichbarer Fokus, kein `hidden`/`inert`/`disabled` im Pfad — und danach dieselbe Wirkung.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_UNASSIGNED_ATTR } from "../../apps/web/src/lib/editorFigures";
// Die EINE Naht für isoliert gemountete Editor-Tests (mega50 Block A) — nicht eine zweite bauen.
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VERWAIST = "Verwaiste Beschreibung";

/**
 * Der Körper: eine Fußnote, die zu keinem Bild gehört (ihre Kennung trägt kein Bild dieses Textes),
 * dazu ZWEI Bilder — das erste ohne Beschreibung, das zweite mit. Damit ist in EINEM Körper beides
 * belegbar: der Kandidat (F) und das Bild, das nicht angeboten werden darf (H).
 */
const INHALT = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`,
  '<figure data-image-id="kw-img-frei"><img src="/api/objects/frei/raw" data-image-id="kw-img-frei">',
  '<figcaption data-image-id="kw-img-frei"></figcaption></figure>',
  '<figure data-image-id="kw-img-belegt"><img src="/api/objects/belegt/raw" data-image-id="kw-img-belegt">',
  '<figcaption data-image-id="kw-img-belegt">Schon beschrieben</figcaption></figure>',
].join("");

/**
 * RUNDE 2 (bens Korrekturpflicht 1): DERSELBE Körper, aber der leere Platzhalter des freien Bildes
 * steht VOR seinem Bild. Runde 1 ersetzte ihn an seiner Stelle — die Beschreibung stand danach
 * ÜBER dem Bild, und zwar bis in den Inhalt, den `onChange` bekommt.
 */
const PLATZHALTER_VOR_BILD = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`,
  '<figure data-image-id="kw-img-frei"><figcaption data-image-id="kw-img-frei"></figcaption>',
  '<img src="/api/objects/frei/raw" data-image-id="kw-img-frei"></figure>',
].join("");

/**
 * RUNDE 4 (bens Korrekturpflicht 2): Die verwaiste Fußnote ENTHÄLT eine vollständige Bildeinheit,
 * daneben steht ein freies Geschwisterbild. Runde 3 bot das Bild IN der Fußnote als Kandidaten an;
 * der Klick nahm die Fußnote mitsamt ihrem Bild von der Stelle, das Einsetzen griff ins Leere, und
 * der Editor emittierte einen LEEREN Dokumentkörper.
 *
 * Das Geschwisterbild steht mit im Körper, weil es die Schranke schärft: Angeboten wird auch IHM
 * nicht — die Fußnote selbst kann nicht wandern, solange eine Bildeinheit in ihr steht (gemessen:
 * sonst stünde danach eine figure IN einer figcaption, bis in den gespeicherten Rumpf). Der
 * Gegenfall, dass ohne diese Bildeinheit dasselbe Bild sehr wohl angeboten wird, ist S4.
 */
const BILD_IN_DER_FUSSNOTE = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}`,
  '<figure data-image-id="kw-img-innen"><img src="/api/objects/innen/raw" data-image-id="kw-img-innen">',
  '<figcaption data-image-id="kw-img-innen"></figcaption></figure></figcaption>',
  '<figure data-image-id="kw-img-frei"><img src="/api/objects/frei/raw" data-image-id="kw-img-frei">',
  '<figcaption data-image-id="kw-img-frei"></figcaption></figure>',
].join("");

/**
 * RUNDE 5 (bens Korrekturpflicht 2): die ANDERE Seite desselben Schadens. Nicht die verwaiste
 * Fußnote enthält eine Bildeinheit, sondern der PLATZHALTER des Zielbildes — der Platz also, den
 * `ordneFussnoteZu` räumt. Sein Text ist leer; bis Runde 4 galt er deshalb als „leer", wurde als
 * Kandidat angeboten und beim Klick mitsamt seinem inneren Bild gelöscht, bis in `onChange`.
 *
 * Das freie Geschwisterbild steht mit im Körper, weil es die Schranke schärft: es MUSS wählbar
 * bleiben, und seine Zuordnung muss ALLE drei Bilder erhalten.
 */
const BILD_IM_PLATZHALTER = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`,
  '<figure data-image-id="kw-img-ziel"><img src="/api/objects/ziel/raw" data-image-id="kw-img-ziel">',
  '<figcaption data-image-id="kw-img-ziel">',
  '<figure data-image-id="kw-img-innen"><img src="/api/objects/innen/raw" data-image-id="kw-img-innen">',
  '<figcaption data-image-id="kw-img-innen"></figcaption></figure>',
  "</figcaption></figure>",
  '<figure data-image-id="kw-img-frei"><img src="/api/objects/frei/raw" data-image-id="kw-img-frei">',
  '<figcaption data-image-id="kw-img-frei"></figcaption></figure>',
].join("");

/**
 * RUNDE 6 (bens Korrekturpflicht 2): Der Platzhalter des Zielbildes enthält NUR ein geschütztes
 * Leerzeichen (U+00A0). `trim()` hielt das für Leerraum — der Platzhalter wurde als Kandidat
 * angeboten und beim Klick samt seinem Zeichen gelöscht, bis in das `onChange`-HTML. Das freie
 * Geschwisterbild steht mit im Körper: es muss wählbar bleiben, und U+00A0 muss seine Zuordnung
 * überleben.
 */
const NBSP = " ";
const NBSP_IM_PLATZHALTER = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`,
  '<figure data-image-id="kw-img-ziel"><img src="/api/objects/ziel/raw" data-image-id="kw-img-ziel">',
  `<figcaption data-image-id="kw-img-ziel">${NBSP}</figcaption></figure>`,
  '<figure data-image-id="kw-img-frei"><img src="/api/objects/frei/raw" data-image-id="kw-img-frei">',
  '<figcaption data-image-id="kw-img-frei"></figcaption></figure>',
].join("");

/** Derselbe Körper OHNE das freie Bild — für L, wo es erst später dazukommt. */
const OHNE_FREIES_BILD = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  `<figcaption data-image-id="kw-cap-los">${VERWAIST}</figcaption>`,
  '<figure data-image-id="kw-img-belegt"><img src="/api/objects/belegt/raw" data-image-id="kw-img-belegt">',
  '<figcaption data-image-id="kw-img-belegt">Schon beschrieben</figcaption></figure>',
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let inhalt = INHALT;
/** Jede Emission des Editors in ihrer Reihenfolge — der Weg, auf dem die Zuordnung speichert. */
let emittiert: string[] = [];
let setzeInhalt: (html: string) => void = () => undefined;

function Host(): JSX.Element {
  const [value, setValue] = useState(inhalt);
  setzeInhalt = setValue;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        emittiert.push(html);
        setValue(html);
      },
    }),
    async () => ({ text: "Vorschlag", demo: false }),
  );
}

function mount(start: string = INHALT): void {
  inhalt = start;
  emittiert = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function fussnoten(): HTMLElement[] {
  return Array.from(container.querySelectorAll("figcaption")) as HTMLElement[];
}

/**
 * DER FLIESSTEXT DES EDITORS, nicht der ganze Container. Das Formular daneben zeigt das gewählte
 * Bild als VORSCHAU — auch das ist ein `<img>`, und wer über `container` zählt, zählt es mit. Genau
 * daran ist die erste Fassung von S3 falsch rot geworden.
 */
function rumpf(): HTMLElement {
  const el = container.querySelector(".prose-kw");
  if (!(el instanceof HTMLElement)) {
    throw new Error("der Fließtext des Editors ist nicht gerendert");
  }
  return el;
}

/**
 * DER KONKRETE KNOTEN, über seinen sichtbaren Text — nicht über die Kennzeichnung und nicht über
 * die Paarungsfunktion, deren Irrtum dieser Test finden soll.
 */
function fussnoteMitText(text: string): HTMLElement {
  const treffer = fussnoten().filter((f) => (f.textContent ?? "").trim() === text);
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

function abschnitt(): Element | null {
  return document.querySelector('[data-testid="caption-form-assign"]');
}

function knoepfe(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-testid="caption-form-assign-option"]'),
  ) as HTMLElement[];
}

function formulare(): Element[] {
  return Array.from(document.querySelectorAll("#caption-form-text"));
}

function oeffneUeberKlick(text: string): void {
  act(() => {
    fussnoteMitText(text).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Die letzte Emission als Baum — hier wird gemessen, was wirklich gespeichert würde. */
function letzterKoerper(): HTMLDivElement {
  const html = emittiert[emittiert.length - 1] ?? "";
  const pruef = document.createElement("div");
  pruef.innerHTML = html;
  return pruef;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  mount();
});

afterEach(async () => {
  abbauen();
  await i18n.changeLanguage("de");
});

describe("JOB 3055 · F — der Weg des Autors: zwei Klicks, und die Beschreibung sitzt", () => {
  it("F1 · das Formular der verwaisten Fußnote zeigt den Zuordnungs-Abschnitt", () => {
    // Vorbedingung: sie ist wirklich die gekennzeichnete Fußnote.
    expect(fussnoteMitText(VERWAIST).getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe(
      i18n.t("editor.captionUnassigned"),
    );
    oeffneUeberKlick(VERWAIST);
    expect(formulare().length, "genau EIN Formular").toBe(1);
    expect(abschnitt(), "kein Zuordnungs-Abschnitt im Formular").not.toBeNull();
    expect(abschnitt()?.textContent).toContain(i18n.t("editor.assignHeading"));
  });

  it("F2 · der Klick auf den Kandidaten setzt die Beschreibung an ihr Bild — und sie überlebt das Speichern", () => {
    oeffneUeberKlick(VERWAIST);
    const auswahl = knoepfe();
    expect(auswahl.length, "genau ein Kandidat wird angeboten").toBe(1);
    act(() => auswahl[0]?.click());

    // 1. Im Editor: die Fußnote sitzt bei ihrem Bild, trägt dessen Kennung, ist nicht mehr markiert.
    const jetzt = fussnoteMitText(VERWAIST);
    const figure = jetzt.closest("figure");
    expect(figure, "die Beschreibung steht immer noch außerhalb jeder figure").not.toBeNull();
    expect(figure?.querySelector(":scope > img")?.getAttribute("src")).toBe(
      "/api/objects/frei/raw",
    );
    expect(jetzt.getAttribute("data-image-id")).toBe("kw-img-frei");
    expect(
      jetzt.getAttribute(CAPTION_UNASSIGNED_ATTR),
      "die Kennzeichnung steht noch da, obwohl die Fußnote zugeordnet ist",
    ).toBeNull();

    // 2. Auf dem Speicherweg: derselbe Befund im Inhalt, den `onChange` bekommen hat.
    expect(emittiert.length, "die Zuordnung hat gar nichts emittiert").toBeGreaterThan(0);
    const koerper = letzterKoerper();
    const gespeichert = Array.from(koerper.querySelectorAll("figure")).find(
      (f) => f.querySelector(":scope > img")?.getAttribute("src") === "/api/objects/frei/raw",
    );
    expect(gespeichert, "die figure des freien Bildes fehlt im gespeicherten Rumpf").toBeTruthy();
    expect(gespeichert?.querySelector(":scope > img")?.getAttribute("data-image-id")).toBe(
      "kw-img-frei",
    );
    const caps = Array.from(gespeichert?.querySelectorAll(":scope > figcaption") ?? []);
    expect(caps.length, "die figure trägt nicht genau EINE Fußnote").toBe(1);
    expect(caps[0]?.getAttribute("data-image-id")).toBe("kw-img-frei");
    expect(caps[0]?.textContent).toBe(VERWAIST);
    // Und keine Fußnote steht im gespeicherten Rumpf mehr außerhalb einer figure.
    for (const f of Array.from(koerper.querySelectorAll("figcaption"))) {
      expect(f.closest("figure"), "eine Fußnote steht weiterhin außerhalb").not.toBeNull();
    }
  });

  it("F3 · danach ist der Zuordnungs-Abschnitt weg — die Auskunft hat sich wirklich geändert", () => {
    oeffneUeberKlick(VERWAIST);
    act(() => knoepfe()[0]?.click());
    expect(formulare().length, "das Formular ist verschwunden statt weiterzuarbeiten").toBe(1);
    expect(abschnitt(), "der Abschnitt bietet die Zuordnung ein zweites Mal an").toBeNull();
  });
});

describe("JOB 3055 · G — der Tastaturweg ist dem Mausweg gleichwertig", () => {
  it("G1 · Eingabetaste öffnet dasselbe Formular mit demselben Abschnitt", () => {
    const cap = fussnoteMitText(VERWAIST);
    act(() => cap.focus());
    act(() => {
      cap.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(formulare().length).toBe(1);
    expect(abschnitt()).not.toBeNull();
    expect(knoepfe().length).toBe(1);
  });

  it("G2 · die Kandidatenknöpfe sind mit der Tastatur erreichbar und lösen dort dasselbe aus", () => {
    const cap = fussnoteMitText(VERWAIST);
    act(() => cap.focus());
    act(() => {
      cap.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    const knopf = knoepfe()[0];
    if (knopf === undefined) {
      throw new Error("kein Kandidatenknopf");
    }
    // Ein echtes <button>: es liegt von sich aus in der Tabulator-Reihenfolge und wird von jedem
    // Browser mit Eingabe- und Leertaste ausgelöst. jsdom setzt diese Umsetzung nicht selbst um —
    // gemessen wird deshalb, woran sie hängt.
    expect(knopf.tagName).toBe("BUTTON");
    expect(knopf.hasAttribute("disabled")).toBe(false);
    expect(knopf.getAttribute("tabindex")).not.toBe("-1");
    expect(knopf.getAttribute("aria-label")).toBe(i18n.t("editor.assignOptionLabel", { n: 1 }));
    for (let el: HTMLElement | null = knopf; el && el !== document.body; el = el.parentElement) {
      expect(el.hasAttribute("hidden"), `hidden an ${el.tagName}`).toBe(false);
      expect(el.hasAttribute("inert"), `inert an ${el.tagName}`).toBe(false);
    }
    act(() => knopf.focus());
    expect(document.activeElement).toBe(knopf);
    // Und die Auslösung — das, was Eingabe-/Leertaste am Knopf bewirken — wirkt.
    act(() => knopf.click());
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-frei");
  });
});

describe("JOB 3055 · H — ein beschriebenes Bild wird nicht angeboten", () => {
  it("H1 · nur das Bild ohne Beschreibung steht im Abschnitt", () => {
    oeffneUeberKlick(VERWAIST);
    const beschriftungen = knoepfe().map((k) => k.getAttribute("aria-label"));
    // „Bild 1" ist das freie, „Bild 2" das beschriebene — gezählt in Dokumentreihenfolge.
    expect(beschriftungen).toEqual([i18n.t("editor.assignOptionLabel", { n: 1 })]);
    expect(beschriftungen).not.toContain(i18n.t("editor.assignOptionLabel", { n: 2 }));
    // Und keine der zwei Verneinungen: es gibt ja einen Kandidaten.
    expect(abschnitt()?.textContent).not.toContain(i18n.t("editor.assignNoImage"));
    expect(abschnitt()?.textContent).not.toContain(i18n.t("editor.assignAllDescribed"));
  });

  it("H2 · der Gegenfall: die beschriebene Fußnote bekommt gar keinen Abschnitt", () => {
    // Ohne diesen Fall wäre F1 auch dann grün, wenn JEDES Formular den Abschnitt trüge.
    oeffneUeberKlick("Schon beschrieben");
    expect(formulare().length).toBe(1);
    expect(abschnitt(), "eine zugeordnete Fußnote bekommt den Zuordnungs-Abschnitt").toBeNull();
  });
});

describe("JOB 3055 · L — die Liste wird bei JEDEM Öffnen frisch erhoben", () => {
  // RUNDE 3, bens Korrekturpflicht 2 — DER FRISCHETEST DARF NICHT ERNEUT ÖFFNEN.
  //
  // L1 unten prüft, dass ein NEU geöffnetes Formular den jetzigen Baum beschreibt. Das ist wahr und
  // bleibt stehen, es ist aber kein Schutz gegen Veralten: es erzeugt die frische Liste selbst,
  // indem es noch einmal klickt. Der Befund lag beim OFFENEN Formular — dort standen nach einem
  // externen Inhaltswechsel Kandidatenknöpfe, deren Bilder es nicht mehr gab. L2 misst genau diesen
  // Zustand, ohne das Formular anzufassen.
  it("L2 · externer Inhaltswechsel bei OFFENEM Formular: kein überholter Knopf, sichtbarer Grund", () => {
    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().length, "Vorbedingung: es gibt einen Kandidaten").toBe(1);
    const emissionenVorher = emittiert.length;

    // Der Elternkontext setzt einen neuen Wert (Entwurf geladen, Reset, Vorschlag übernommen).
    // Der Editor baut seinen Inhalt neu auf; jeder Knoten des Formulars ist danach abgelöst.
    act(() => setzeInhalt(OHNE_FREIES_BILD));

    // NICHT erneut geöffnet — gemessen wird der Modalzustand, der jetzt dasteht.
    expect(formulare().length, "das Formular ist noch offen").toBe(1);
    expect(
      knoepfe().length,
      "der alte Kandidatenknopf steht noch da und kann nichts mehr zuordnen",
    ).toBe(0);
    expect(abschnitt(), "der Abschnitt bietet eine überholte Auswahl an").toBeNull();
    expect(
      document.querySelector('[data-testid="caption-form-stale"]'),
      "es steht kein Grund da, warum die Auswahl verschwunden ist",
    ).not.toBeNull();
    expect(emittiert.length, "der Wertwechsel hat etwas gespeichert").toBe(emissionenVorher);
  });

  it("L1 · ein zwischenzeitlich eingefügtes Bild erscheint beim nächsten Öffnen als Kandidat", () => {
    abbauen();
    mount(OHNE_FREIES_BILD);

    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().length, "Vorbedingung: zunächst gibt es keinen Kandidaten").toBe(0);
    expect(abschnitt()?.textContent).toContain(i18n.t("editor.assignAllDescribed"));

    // Ein Bild kommt von AUSSEN in den Text (Entwurf geladen, Reset, Vorschlag übernommen). Der
    // Editor baut seinen Inhalt neu auf; jede Fußnote von eben ist danach ein anderer Knoten.
    act(() => setzeInhalt(INHALT));

    // Erneut geöffnet — und die Liste muss den JETZIGEN Baum beschreiben, nicht den von vorhin.
    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().length, "die Liste stammt aus einem früheren Baum — das neue Bild fehlt").toBe(
      1,
    );
    expect(knoepfe()[0]?.getAttribute("aria-label")).toBe(
      i18n.t("editor.assignOptionLabel", { n: 1 }),
    );
  });
});

describe("JOB 3055 · Q — ein Klick auf einen Kandidaten endet NIE still", () => {
  // RUNDE 3, bens Korrekturpflicht 1: `ordneFussnoteZu` meldete `false` und die Fläche schwieg.
  // Zwei Wege dorthin, und beide sagen ab jetzt etwas — der eine über die vorhandene
  // Geltungsprüfung, der andere über eine frisch erhobene Auswahl mit ihrem Grund.
  it("Q1 · das Ziel ist weggezogen: der Klick nennt es und schreibt nichts", () => {
    oeffneUeberKlick(VERWAIST);
    const knopf = knoepfe()[0];
    if (knopf === undefined) {
      throw new Error("Vorbedingung: es gibt einen Kandidatenknopf");
    }
    // Die Fußnote des Formulars verschwindet aus dem Text — genau der Fall, gegen den die
    // Geltungsprüfung beim Speichern seit mega11 Block D steht.
    act(() => fussnoteMitText(VERWAIST).remove());
    const emissionenVorher = emittiert.length;

    act(() => knopf.click());

    expect(
      document.querySelector('[data-testid="caption-form-stale"]'),
      "der Klick endete still",
    ).not.toBeNull();
    expect(emittiert.length, "es wurde trotzdem gespeichert").toBe(emissionenVorher);
    expect(abschnitt(), "die überholte Auswahl steht weiter da").toBeNull();
  });

  it("Q2 · das Ziel steht, der Kandidat ist weg: der Grund steht da und die Liste ist neu erhoben", () => {
    oeffneUeberKlick(VERWAIST);
    const knopf = knoepfe()[0];
    if (knopf === undefined) {
      throw new Error("Vorbedingung: es gibt einen Kandidatenknopf");
    }
    // NUR das Bild verschwindet. Kennung, Quelle, Fußnotenknoten und Lauf des Formulars sind
    // unverändert — die Geltungsprüfung sagt also „intakt", und trotzdem geht die Zuordnung nicht.
    act(() => container.querySelector('figure[data-image-id="kw-img-frei"]')?.remove());
    const emissionenVorher = emittiert.length;

    act(() => knopf.click());

    expect(
      document.querySelector('[data-testid="caption-form-assign-failed"]')?.textContent,
      "der Klick endete still",
    ).toBe(i18n.t("editor.assignFailed"));
    expect(emittiert.length, "es wurde trotzdem gespeichert").toBe(emissionenVorher);
    // Die Auswahl beschreibt jetzt den JETZIGEN Baum: kein Kandidat mehr, und der Grund dafür.
    expect(knoepfe().length, "der überholte Knopf steht noch da").toBe(0);
    expect(
      document.querySelector('[data-testid="caption-form-assign-all-described"]'),
      "die neu erhobene Lage sagt nicht, was jetzt gilt",
    ).not.toBeNull();
  });
});

describe("JOB 3055 · S — ein Bild IM Teilbaum der Fußnote wird nicht angeboten", () => {
  // RUNDE 4, bens Korrekturpflicht 2: derselbe Befund am gemounteten Editor, mit sanitisiertem
  // Eingangsmarkup — also auf dem Weg, den der Autor wirklich nimmt.
  it("S3 · gar kein Kandidat, ehrlicher Grund — und weder Bild noch Text noch Rumpf gehen verloren", () => {
    abbauen();
    mount(BILD_IN_DER_FUSSNOTE);

    // Vorbedingung: der Körper ist der gemeinte — zwei Bilder, eines davon IN der Fußnote.
    expect(rumpf().querySelectorAll("img").length, "Vorbedingung: zwei Bilder").toBe(2);
    expect(
      fussnoteMitText(VERWAIST).querySelectorAll("img").length,
      "Vorbedingung: eines der Bilder steht in der verwaisten Fußnote",
    ).toBe(1);

    const emissionenVorher = emittiert.length;
    oeffneUeberKlick(VERWAIST);

    // KEIN Knopf — weder für den Nachfahren noch für das Geschwisterbild: die Fußnote selbst kann
    // nicht wandern, solange eine Bildeinheit in ihr steht.
    expect(
      knoepfe().length,
      "es wird ein Kandidat angeboten, den der Klick nicht halten kann",
    ).toBe(0);
    expect(
      abschnitt(),
      "der Abschnitt fehlt ganz — dann steht dort gar keine Auskunft",
    ).not.toBeNull();
    expect(abschnitt()?.textContent).toContain(i18n.t("editor.assignUnclear", { count: 2 }));
    expect(abschnitt()?.textContent).not.toContain(i18n.t("editor.assignAllDescribed"));

    // Und nichts ist verschwunden: beide Bilder, der Text, und es wurde gar nichts emittiert.
    expect(rumpf().querySelectorAll("img").length, "ein Bild wurde gelöscht").toBe(2);
    expect(fussnoteMitText(VERWAIST), "der Text wurde gelöscht").toBeTruthy();
    // Und keine figure ist in eine figcaption gewandert — die Lage, die den Ausschlag gab.
    expect(
      rumpf().querySelectorAll("figcaption figure").length,
      "eine figure steht jetzt IN einer figcaption",
    ).toBe(1);
    expect(emittiert.length, "das bloße Öffnen hat gespeichert").toBe(emissionenVorher);
    for (const html of emittiert) {
      expect(html, "der Editor hat einen LEEREN Dokumentkörper emittiert").not.toBe("");
    }
  });

  it("S4 · der Gegenfall: OHNE die Bildeinheit in der Fußnote wird dasselbe Bild angeboten", () => {
    // Der Körper unterscheidet sich in genau einem Punkt: die verwaiste Fußnote enthält keine
    // Bildeinheit mehr. Ohne diesen Fall wäre S3 auch dann grün, wenn nie mehr etwas angeboten
    // würde. Der Geschwister-Normalfall bleibt damit belegt.
    abbauen();
    mount(
      BILD_IN_DER_FUSSNOTE.replace(
        '<figure data-image-id="kw-img-innen"><img src="/api/objects/innen/raw" data-image-id="kw-img-innen"><figcaption data-image-id="kw-img-innen"></figcaption></figure>',
        "",
      ),
    );
    expect(rumpf().querySelectorAll("img").length, "Vorbedingung: genau ein Bild").toBe(1);
    expect(fussnoteMitText(VERWAIST).querySelectorAll("img").length).toBe(0);

    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().map((k) => k.getAttribute("aria-label"))).toEqual([
      i18n.t("editor.assignOptionLabel", { n: 1 }),
    ]);
    act(() => knoepfe()[0]?.click());
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-frei");
    expect(rumpf().querySelectorAll("img").length).toBe(1);
  });
});

describe("JOB 3055 · T — der zu räumende PLATZHALTER wird nicht ungeprüft gelöscht", () => {
  // RUNDE 5, bens Korrekturpflicht 2: derselbe Befund am gemounteten Editor, mit sanitisiertem
  // Eingangsmarkup — auf dem Weg, den der Autor wirklich nimmt, und bis in das gespeicherte HTML.
  it("T5 · das zerstörerische Ziel wird nicht angeboten, das gültige Geschwisterziel schon", () => {
    abbauen();
    mount(BILD_IM_PLATZHALTER);

    // Vorbedingungen: drei Bilder, eines davon im Platzhalter des Zielbildes — und dieser
    // Platzhalter trägt keinen Text (sonst wäre er längst über `beschrieben` ausgeschlossen und
    // der Fall gar nicht erreichbar).
    expect(rumpf().querySelectorAll("img").length, "Vorbedingung: drei Bilder").toBe(3);
    const platzhalter = rumpf().querySelector('figcaption[data-image-id="kw-img-ziel"]');
    expect(platzhalter, "Vorbedingung: der Platzhalter des Zielbildes steht da").not.toBeNull();
    expect((platzhalter?.textContent ?? "").trim()).toBe("");
    expect(
      platzhalter?.querySelectorAll("img").length,
      "Vorbedingung: im Platzhalter steht eine Bildeinheit",
    ).toBe(1);

    oeffneUeberKlick(VERWAIST);

    // GENAU EIN Knopf, und zwar der für das freie Geschwisterbild — nicht der für das Zielbild
    // (sein Platzhalter würde gelöscht) und nicht der für das innere Bild (die Beschreibung käme
    // in eine figcaption INNERHALB einer figcaption).
    expect(knoepfe().length, "es wird ein Kandidat angeboten, der Inhalt vernichtet").toBe(1);
    const vorschau = knoepfe()[0]?.querySelector("img");
    expect(vorschau?.getAttribute("src"), "angeboten wird das falsche Bild").toBe(
      "/api/objects/frei/raw",
    );

    const bilderVorher = rumpf().querySelectorAll("img").length;
    act(() => knoepfe()[0]?.click());

    // Die Zuordnung greift — und sie kostet kein einziges Bild, weder im Editor …
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-frei");
    expect(fussnoteMitText(VERWAIST).closest("figure")?.getAttribute("data-image-id")).toBe(
      "kw-img-frei",
    );
    expect(rumpf().querySelectorAll("img").length, "ein Bild wurde gelöscht").toBe(bilderVorher);

    // … noch in dem, was `onChange` bekommen hat. Dort zählt es.
    const koerper = letzterKoerper();
    expect(koerper.querySelectorAll("img").length, "gespeichert wurde ein Bild weniger").toBe(3);
    for (const quelle of ["/api/objects/ziel/raw", "/api/objects/innen/raw"]) {
      expect(
        Array.from(koerper.querySelectorAll("img")).some((b) => b.getAttribute("src") === quelle),
        `das Bild ${quelle} fehlt im gespeicherten Rumpf`,
      ).toBe(true);
    }
    const gespeichert = Array.from(koerper.querySelectorAll("figure")).find(
      (f) => f.querySelector(":scope > img")?.getAttribute("src") === "/api/objects/frei/raw",
    );
    expect(
      Array.from(gespeichert?.querySelectorAll(":scope > *") ?? []).map((k) => k.tagName),
    ).toEqual(["IMG", "FIGCAPTION"]);
    expect(gespeichert?.querySelector(":scope > figcaption")?.textContent).toBe(VERWAIST);
  });

  it("T6 · der Gegenfall: OHNE die Bildeinheit im Platzhalter wird dasselbe Zielbild angeboten", () => {
    // Der Körper unterscheidet sich in genau einem Punkt: der Platzhalter des Zielbildes ist leer.
    // Ohne diesen Fall wäre T5 auch dann grün, wenn gar kein Ziel mit Platzhalter mehr ginge.
    abbauen();
    mount(
      BILD_IM_PLATZHALTER.replace(
        '<figure data-image-id="kw-img-innen"><img src="/api/objects/innen/raw" data-image-id="kw-img-innen"><figcaption data-image-id="kw-img-innen"></figcaption></figure>',
        "",
      ),
    );
    expect(rumpf().querySelectorAll("img").length, "Vorbedingung: zwei Bilder").toBe(2);

    oeffneUeberKlick(VERWAIST);
    const quellen = knoepfe().map((k) => k.querySelector("img")?.getAttribute("src"));
    expect(quellen, "das Zielbild mit leerem Platzhalter wird nicht mehr angeboten").toEqual([
      "/api/objects/ziel/raw",
      "/api/objects/frei/raw",
    ]);
    act(() => knoepfe()[0]?.click());
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-ziel");
    expect(rumpf().querySelectorAll("img").length).toBe(2);
  });
});

describe("JOB 3055 · U — U+00A0 im Zielplatzhalter überlebt den Weg des Autors", () => {
  // RUNDE 6, bens Korrekturpflicht 2: derselbe Befund am gemounteten Editor, mit sanitisiertem
  // Eingangsmarkup — und bis in das gespeicherte HTML, denn dort zählt der Verlust.
  it("U4 · das NBSP-Ziel fehlt in der Auswahl, der Geschwisterklick trägt, U+00A0 bleibt erhalten", () => {
    abbauen();
    mount(NBSP_IM_PLATZHALTER);

    // Vorbedingung, die den Fall erst zum Fall macht: das Zeichen hat den Sanitizer überlebt und
    // `trim()` hält es für Leerraum.
    const platzhalter = rumpf().querySelector('figcaption[data-image-id="kw-img-ziel"]');
    expect(platzhalter?.textContent, "Vorbedingung: U+00A0 steht im Platzhalter").toBe(NBSP);
    expect((platzhalter?.textContent ?? "").trim()).toBe("");

    oeffneUeberKlick(VERWAIST);

    // GENAU EIN Knopf — der für das freie Bild, nicht der für das NBSP-Ziel.
    expect(knoepfe().length, "das NBSP-Ziel wird angeboten").toBe(1);
    expect(knoepfe()[0]?.querySelector("img")?.getAttribute("src")).toBe("/api/objects/frei/raw");
    // Und die Fläche nennt es nicht „schon beschrieben" — dort steht nichts zu lesen.
    expect(abschnitt()?.textContent).not.toContain(i18n.t("editor.assignAllDescribed"));

    act(() => knoepfe()[0]?.click());

    // Die Zuordnung greift …
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-frei");
    // … und das fremde Zeichen steht noch, im Editor …
    expect(
      rumpf().querySelector('figcaption[data-image-id="kw-img-ziel"]')?.textContent,
      "U+00A0 wurde aus dem Editor gelöscht",
    ).toBe(NBSP);
    // … wie in dem, was `onChange` bekommen hat. Gemessen am Textinhalt: die Serialisierung
    // schreibt U+00A0 als Entität `&nbsp;`, das Zeichen selbst stünde nicht in der Zeichenkette.
    const koerper = letzterKoerper();
    expect(
      koerper.querySelector('figcaption[data-image-id="kw-img-ziel"]')?.textContent,
      "U+00A0 fehlt im gespeicherten Rumpf",
    ).toBe(NBSP);
    expect(koerper.querySelectorAll("img").length).toBe(2);
  });

  it("U5 · der Gegenfall: OHNE das Zeichen wird dasselbe Zielbild angeboten", () => {
    // Ohne diesen Fall wäre U4 auch dann grün, wenn gar kein Ziel mit Platzhalter mehr ginge.
    // Der Körper unterscheidet sich in genau einem Zeichen.
    abbauen();
    mount(NBSP_IM_PLATZHALTER.replace(NBSP, ""));
    expect(
      rumpf().querySelector('figcaption[data-image-id="kw-img-ziel"]')?.textContent,
      "Vorbedingung: der Platzhalter ist jetzt wirklich leer",
    ).toBe("");

    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().map((k) => k.querySelector("img")?.getAttribute("src"))).toEqual([
      "/api/objects/ziel/raw",
      "/api/objects/frei/raw",
    ]);
    act(() => knoepfe()[0]?.click());
    expect(fussnoteMitText(VERWAIST).getAttribute("data-image-id")).toBe("kw-img-ziel");
  });
});

describe("JOB 3055 · V — der AUTOMATISCHE Weg löscht keinen Elementinhalt, bis in onChange", () => {
  // RUNDE 7, bens Korrekturpflicht 2. Der Unterschied zu allen anderen Fällen dieser Datei: hier
  // klickt niemand. Der Editor verankert bei jedem Eingabelauf (`RichTextEditor.tsx:631`,
  // `onEditorInput → emit → ensureImageAnchors → sanitizeHtml → onChange`), und genau dieser Lauf
  // hat die textleere Ankerfußnote mit ihrer eingebetteten Bildeinheit überschrieben. Der Verlust
  // erreichte den gespeicherten Rumpf, ohne dass der Autor etwas anderes getan hätte als zu tippen.
  const ANKER_MIT_BILD_IN_DER_FUSSNOTE = [
    "<p>Ein Satz, der stehen bleibt.</p>",
    "<figure>",
    '<figure><img src="/api/objects/aussen/raw"><figcaption>',
    '<figure><img src="/api/objects/innen/raw"><figcaption></figcaption></figure>',
    "</figcaption></figure>",
    "<figcaption>Wandernde Beschreibung</figcaption></figure>",
  ].join("");

  it("V4 · beide Bildquellen und die wandernde Beschreibung stehen im emittierten HTML", () => {
    abbauen();
    mount(ANKER_MIT_BILD_IN_DER_FUSSNOTE);

    // Vorbedingung: der Körper ist so im Editor angekommen, wie er gemeint war.
    expect(rumpf().querySelectorAll("img").length, "Vorbedingung: zwei Bilder").toBe(2);

    // Der Verankerungslauf, den jede Eingabe auslöst — kein Klick, keine Zuordnung.
    const feld = rumpf();
    act(() => feld.dispatchEvent(new InputEvent("input", { bubbles: true })));

    // Im Editor steht alles noch.
    for (const quelle of ["/api/objects/aussen/raw", "/api/objects/innen/raw"]) {
      expect(
        Array.from(rumpf().querySelectorAll("img")).some((b) => b.getAttribute("src") === quelle),
        `${quelle} wurde beim Verankern aus dem Editor gelöscht`,
      ).toBe(true);
    }
    expect(rumpf().textContent, "die wandernde Beschreibung ist weg").toContain(
      "Wandernde Beschreibung",
    );

    // Und in dem, was `onChange` bekommen hat — dort zählt der Verlust.
    expect(emittiert.length, "der Eingabelauf hat gar nicht emittiert").toBeGreaterThan(0);
    const koerper = letzterKoerper();
    for (const quelle of ["/api/objects/aussen/raw", "/api/objects/innen/raw"]) {
      expect(
        Array.from(koerper.querySelectorAll("img")).some((b) => b.getAttribute("src") === quelle),
        `${quelle} fehlt im gespeicherten Rumpf`,
      ).toBe(true);
    }
    expect(
      koerper.textContent,
      "die wandernde Beschreibung fehlt im gespeicherten Rumpf",
    ).toContain("Wandernde Beschreibung");
  });

  it("V5 · der Gegenfall: eine WIRKLICH leere Ankerfußnote nimmt die Beschreibung auf", () => {
    // Ohne diesen Fall wäre V4 auch mit einem `offenerAnker` grün, der nie mehr etwas freigibt —
    // dann käme keine Beschreibung mehr an ihr Bild, und der ganze Auftrag wäre entwertet.
    abbauen();
    mount(
      [
        "<p>Ein Satz, der stehen bleibt.</p>",
        "<figure>",
        '<figure><img src="/api/objects/aussen/raw"><figcaption></figcaption></figure>',
        "<figcaption>Wandernde Beschreibung</figcaption></figure>",
      ].join(""),
    );
    const figure = Array.from(rumpf().querySelectorAll("figure")).find(
      (f) => f.querySelector(":scope > img")?.getAttribute("src") === "/api/objects/aussen/raw",
    );
    expect(
      figure?.querySelector(":scope > figcaption")?.textContent?.trim(),
      "der leere Anker hat die wandernde Beschreibung nicht aufgenommen",
    ).toBe("Wandernde Beschreibung");
  });
});

describe("JOB 3055 · M — die Beschreibung steht auch beim Speichern HINTER dem Bild", () => {
  // BENS KORREKTURPFLICHT 1, am gemounteten Editor und am gespeicherten Inhalt gemessen. F2 prüfte
  // Kindschaft und Kennungen, aber nicht die REIHENFOLGE — und alle Zielkörper trugen ohnehin
  // `img → figcaption`. Hier steht der leere Platzhalter eingehend VOR dem Bild.
  it("M1 · eingehend `figcaption → img`: danach exakt `IMG, FIGCAPTION` im Editor UND in onChange", () => {
    abbauen();
    mount(PLATZHALTER_VOR_BILD);

    // Vorbedingung, die den Fall erst zum Fall macht.
    const figureVorher = container.querySelector('figure[data-image-id="kw-img-frei"]');
    expect(
      Array.from(figureVorher?.querySelectorAll(":scope > *") ?? []).map((k) => k.tagName),
      "Vorbedingung: eingehend steht die leere Fußnote vor dem Bild",
    ).toEqual(["FIGCAPTION", "IMG"]);

    oeffneUeberKlick(VERWAIST);
    expect(knoepfe().length, "genau ein Kandidat").toBe(1);
    act(() => knoepfe()[0]?.click());

    // Im Editor.
    const figure = fussnoteMitText(VERWAIST).closest("figure");
    expect(figure, "die Beschreibung steht immer noch außerhalb jeder figure").not.toBeNull();
    expect(
      Array.from(figure?.querySelectorAll(":scope > *") ?? []).map((k) => k.tagName),
      "die Beschreibung steht über dem Bild — genau bens Befund an Runde 1",
    ).toEqual(["IMG", "FIGCAPTION"]);

    // Und im Inhalt, den `onChange` bekommen hat — dort zählt es.
    const koerper = letzterKoerper();
    const gespeichert = Array.from(koerper.querySelectorAll("figure")).find(
      (f) => f.querySelector(":scope > img")?.getAttribute("src") === "/api/objects/frei/raw",
    );
    expect(gespeichert, "die figure des freien Bildes fehlt im gespeicherten Rumpf").toBeTruthy();
    expect(
      Array.from(gespeichert?.querySelectorAll(":scope > *") ?? []).map((k) => k.tagName),
      "gespeichert wurde die falsche sichtbare Reihenfolge",
    ).toEqual(["IMG", "FIGCAPTION"]);
    expect(gespeichert?.querySelector(":scope > figcaption")?.getAttribute("data-image-id")).toBe(
      "kw-img-frei",
    );
    expect(gespeichert?.querySelector(":scope > figcaption")?.textContent).toBe(VERWAIST);
  });
});
