// @vitest-environment jsdom
// AUFTRAG-huelle2 Block A/B — DIE STRUKTUR BLEIBT, ABER DIE REIHENFOLGE MUSS MIT.
//
// DER BEFUND (ben in sammel96, Ship-Blocker nach `huelle`). Der tagbewusste Schutz hat den
// Strukturverlust geschlossen und dabei eine Grenze VERSCHOBEN: erhaltene Strukturen wurden für die
// Paarung zu undurchsichtigen Einheiten. `paare()` sammelte nur DIREKTE Bilder; ein Bild in einer
// Tabelle war für sie nicht vorhanden. Die eigene, im Modul dokumentierte Regel („unmarkierte
// Fußnote → nächstes unversorgtes Bild IN DOKUMENTREIHENFOLGE") wurde damit gebrochen:
//
//   <figure><table><tbody><tr><td><img B></td></tr></tbody></table><img A><figcaption>…</figcaption></figure>
//
// B steht VOR A — die Fußnote ging trotzdem an A. Kein verwaister Text, sondern ein STILLER
// ZUORDNUNGSFEHLER: die Beschreibung stand unter dem falschen Bild und behauptete, dort hinzugehören.
//
// UND DER EIGENTLICHE LEHRSATZ DIESER RUNDE STEHT IN DEN BÜHNEN, NICHT IM CODE: die Bühnen aus
// `huelle` setzen AUSNAHMSLOS das direkte Bild A vor die Struktur mit Bild B. Sie belegen den
// Strukturgewinn und den Fixpunkt — aber sie vermeiden genau die auslösende Reihenfolge. Eine
// Bühne, die nur die günstige Richtung prüft, ist keine Gegenprobe. Wo eine Reihenfolge das
// Ergebnis beeinflussen kann, werden hier deshalb BEIDE Richtungen gemessen.
//
// Die fünf Pflichtproben aus sammel96 §H1 stehen einzeln und namentlich unten; die fünfte (die
// Browser-Rundreise für die umgekehrte Reihenfolge) steht in
// `tests-smoke/huelle2-reihenfolge-browser.spec.ts` — Browserverhalten wird im Browser gemessen
// und nicht aus der Struktur abgeleitet (I46, die Lehre aus mega87).
import { describe, expect, it } from "vitest";
import {
  type EditableElement,
  captionForImage,
  ensureImageAnchors,
} from "../../apps/web/src/lib/editorFigures";

interface ElementLike extends EditableElement {
  innerHTML: string;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
interface DocumentLike {
  createElement(tag: string): ElementLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

function wurzelMit(html: string): ElementLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";
const C = "/api/objects/bild-c/raw";

const TEXT = "Beschreibung für das erste Bild";

// Beide Ableser gehen über `captionForImage` — DIE Funktion, die auch `openCaptionFormFor` benutzt,
// wenn der Nutzer auf eine Bildbeschreibung klickt. Ein eigener Ableser („direktes Kind derselben
// figure") wäre hier eine Zweitkopie mit eigener Meinung, und er läge daneben: bei einem Bild, das
// in einer Tabelle INNERHALB der figure steckt, ist die Fußnote kein Geschwister des Bildes,
// sondern über die gemeinsame Kennung erreichbar. Gemessen wird, was der Nutzer bekommt.

/** Je Bild in DOKUMENTREIHENFOLGE: seine Quelle und der Text der Fußnote, die es findet. */
function zuordnung(root: ElementLike): string[] {
  const aus: string[] = [];
  for (const img of root.querySelectorAll("img")) {
    const cap = captionForImage(img, root);
    aus.push(`${img.getAttribute("src")}|${(cap?.textContent ?? "").trim()}`);
  }
  return aus;
}

/** Fußnoten, die von KEINEM Bild gefunden werden — der sichtbar erhaltene Rest aus Stufe 3. */
function verwaisteFussnoten(root: ElementLike): { id: string | null; text: string }[] {
  const gefunden = new Set<EditableElement>();
  for (const img of root.querySelectorAll("img")) {
    const cap = captionForImage(img, root);
    if (cap !== null) {
      gefunden.add(cap);
    }
  }
  const aus: { id: string | null; text: string }[] = [];
  for (const cap of root.querySelectorAll("figcaption")) {
    if (!gefunden.has(cap)) {
      aus.push({ id: cap.getAttribute("data-image-id"), text: (cap.textContent ?? "").trim() });
    }
  }
  return aus;
}

/**
 * KEINE KENNUNG WIRD DUPLIZIERT. Gemessen wird die stärkere Aussage: jede vergebene
 * `data-image-id` steht an HÖCHSTENS EINEM Bild und HÖCHSTENS EINER Fußnote. Eine zweite figcaption
 * mit derselben Kennung ist genau der Schaden, an dem die naheliegende Reparatur in `huelle`
 * gescheitert wäre — und sie fiele mit einer bloßen Zählung der Elemente nicht auf.
 */
function kennungenSindEindeutig(root: ElementLike): string[] {
  const klagen: string[] = [];
  for (const selektor of ["img", "figcaption"]) {
    const gesehen = new Map<string, number>();
    for (const el of root.querySelectorAll(`${selektor}[data-image-id]`)) {
      const id = el.getAttribute("data-image-id") ?? "";
      gesehen.set(id, (gesehen.get(id) ?? 0) + 1);
    }
    for (const [id, anzahl] of gesehen) {
      if (anzahl > 1) {
        klagen.push(`${anzahl}× <${selektor} data-image-id="${id}">`);
      }
    }
  }
  return klagen;
}

/** Trägt dieses Bild einen vollständigen Anker (figure + Fußnote mit derselben Kennung)? */
function verankert(img: ElementLike): boolean {
  const figure = img.closest("figure");
  const cap = figure?.querySelector(":scope > figcaption") ?? null;
  const id = img.getAttribute("data-image-id");
  return cap !== null && id !== null && id !== "" && cap.getAttribute("data-image-id") === id;
}

/** Der Fixpunkt gehört zu JEDER Bühne: ein zweiter Lauf darf nichts mehr verändern. */
function fixpunkt(html: string): void {
  const root = wurzelMit(html);
  ensureImageAnchors(root);
  const einmal = root.innerHTML;
  const nochmal = ensureImageAnchors(root);
  expect(
    root.innerHTML,
    "Der zweite Lauf hat den Inhalt erneut verändert — bei jedem Öffnen des Entwurfs verschiebt sich etwas",
  ).toBe(einmal);
  expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
}

const ZELLE = (src: string): string => `<td><img src="${src}"></td>`;
const TABELLE = (...zellen: string[]): string =>
  `<table><tbody><tr>${zellen.join("")}</tr></tbody></table>`;

// ── PROBE 1 — die Probe, die bis sammel96 gefehlt hat ─────────────────────────────────────────────

const STRUKTUR_VOR_BILD = `<figure>${TABELLE(ZELLE(B))}<img src="${A}"><figcaption>${TEXT}</figcaption></figure>`;

describe("AUFTRAG-huelle2 Probe 1: Struktur-Bild VOR direktem Bild", () => {
  it("die unmarkierte Fußnote geht an das ERSTE Bild in Dokumentreihenfolge — das in der Tabelle", () => {
    const root = wurzelMit(STRUKTUR_VOR_BILD);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Die Beschriftung ist zum falschen Bild gewandert: sie steht beim direkten Bild A, obwohl Bild B in der Tabelle ihm in Dokumentreihenfolge vorausgeht. Ein stiller fachlicher Zuordnungsfehler — der Nutzer liest die Beschreibung unter dem falschen Bild.",
    ).toEqual([`${B}|${TEXT}`, `${A}|`]);
  });

  it("die Tabelle bleibt dabei vollständig stehen, und das Bild bleibt in ihrer Zelle", () => {
    const root = wurzelMit(STRUKTUR_VOR_BILD);
    ensureImageAnchors(root);
    expect(
      Array.from(root.querySelectorAll("table > tbody > tr > td")).length,
      "Die erhaltene Struktur wurde für die Zuordnung doch wieder aufgelöst — genau das darf der Fix nicht tun",
    ).toBe(1);
    expect(
      Array.from(root.querySelectorAll(`table td img[src="${B}"]`)).length,
      "Das Bild wurde aus der Zelle herausgerissen, statt die Fußnote zu ihm zu bewegen",
    ).toBe(1);
  });

  it("der Text wird VERSCHOBEN, nicht kopiert — genau eine Fußnote trägt ihn, keine Kennung doppelt", () => {
    const root = wurzelMit(STRUKTUR_VOR_BILD);
    ensureImageAnchors(root);
    const mitText = Array.from(root.querySelectorAll("figcaption")).filter(
      (cap) => (cap.textContent ?? "").trim() === TEXT,
    );
    expect(
      mitText.length,
      "Der Beschreibungstext steht mehr als einmal im Dokument — er wurde kopiert statt verschoben",
    ).toBe(1);
    expect(
      verwaisteFussnoten(root),
      "Neben der verschobenen Fußnote ist außerdem eine verwaiste zurückgeblieben",
    ).toEqual([]);
    expect(
      kennungenSindEindeutig(root),
      "Eine data-image-id wurde dupliziert — genau der Schaden, an dem die naheliegende Reparatur scheitern würde",
    ).toEqual([]);
    for (const img of root.querySelectorAll("img")) {
      expect(
        verankert(img),
        `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker — der Klick auf die Bildbeschreibung tut nichts`,
      ).toBe(true);
    }
  });

  it("FIXPUNKT: ein zweiter Lauf ändert nichts mehr", () => {
    fixpunkt(STRUKTUR_VOR_BILD);
  });
});

// ── PROBE 2 — die günstige Richtung bleibt, wie sie gemessen wurde ────────────────────────────────

const BILD_VOR_STRUKTUR = `<figure><img src="${A}">${TABELLE(ZELLE(B))}<figcaption>${TEXT}</figcaption></figure>`;

describe("AUFTRAG-huelle2 Probe 2: direktes Bild VOR Struktur-Bild", () => {
  it("das heute gemessene Verhalten bleibt stabil — die Fußnote gehört dem direkten Bild A", () => {
    const root = wurzelMit(BILD_VOR_STRUKTUR);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Die Zuordnung in der bisher gemessenen Richtung hat sich verändert",
    ).toEqual([`${A}|${TEXT}`, `${B}|`]);
    expect(kennungenSindEindeutig(root), "Eine data-image-id wurde dupliziert").toEqual([]);
  });

  it("FIXPUNKT: ein zweiter Lauf ändert nichts mehr", () => {
    fixpunkt(BILD_VOR_STRUKTUR);
  });
});

// ── PROBE 3 — das einzige innere Bild, das bis hierher verwaiste ──────────────────────────────────
//
// `huelle` hat diese Lage gemeldet und als unlösbar eingestuft: der naheliegende Weg über eine
// gemeinsame Kennung erzeugte eine ZWEITE figcaption mit derselben `data-image-id`. Das Verwerfen
// war richtig; bens dritter Weg vermeidet die Dublette, indem die vorhandene äußere Fußnote
// VERBRAUCHT und in den inneren Anker verschoben wird.

const NUR_STRUKTURBILDER = `<figure>${TABELLE(ZELLE(B), ZELLE(C))}<figcaption>${TEXT}</figcaption></figure>`;

const INNERE_FIGURE = [
  "<figure><table><tbody><tr><td>",
  `<figure><img src="${B}"><figcaption></figcaption></figure>`,
  `</td></tr></tbody></table><figcaption>${TEXT}</figcaption></figure>`,
].join("");

// Die dritte Lage, und sie ist bewusst dabei: EIN Bild in einer Struktur OHNE innere figure. Sie
// gilt nach `istFlacheFigur` als flach, wird also gar nicht umgebaut — sie hängt am
// Umhüllungszweig, nicht an der Paarung. Ohne sie behauptete die Probe für einen Fall etwas, den
// sie nicht misst.
const EIN_BILD_FLACH = `<figure>${TABELLE(ZELLE(B))}<figcaption>${TEXT}</figcaption></figure>`;

describe("AUFTRAG-huelle2 Probe 3: einziges inneres Bild / innere Figure plus äußere Fußnote", () => {
  for (const [name, html, ziel] of [
    ["zwei Bilder in der Tabelle, keines daneben", NUR_STRUKTURBILDER, B],
    ["eine innere figure mit leerer Fußnote in der Tabelle", INNERE_FIGURE, B],
    ["ein einziges Bild in der Tabelle (flache figure, Umhüllungszweig)", EIN_BILD_FLACH, B],
  ] as const) {
    it(`${name}: genau EINE Fußnote trägt den Text, und sie steht beim richtigen Bild`, () => {
      const root = wurzelMit(html);
      ensureImageAnchors(root);
      const mitText = Array.from(root.querySelectorAll("figcaption")).filter(
        (cap) => (cap.textContent ?? "").trim() === TEXT,
      );
      expect(
        mitText.length,
        "Der Beschreibungstext ist verloren gegangen oder steht doppelt im Dokument",
      ).toBe(1);
      expect(
        zuordnung(root)[0],
        "Die vorhandene Beschreibung hat ihr Bild nicht gefunden — sie stünde verwaist neben der Struktur",
      ).toBe(`${ziel}|${TEXT}`);
      expect(
        verwaisteFussnoten(root),
        "Eine Fußnote steht außerhalb jeder figure mit Bild — der Text ist verwaist",
      ).toEqual([]);
      expect(
        kennungenSindEindeutig(root),
        "Eine data-image-id steht an zwei Bildern oder an zwei Fußnoten",
      ).toEqual([]);
      expect(
        Array.from(root.querySelectorAll("table > tbody > tr > td")).length,
        "Die Tabelle wurde für die Zuordnung aufgelöst",
      ).toBeGreaterThan(0);
      for (const img of root.querySelectorAll("img")) {
        expect(
          verankert(img),
          `Das Bild ${img.getAttribute("src")} hat keinen vollständigen Anker`,
        ).toBe(true);
      }
    });

    it(`${name}: FIXPUNKT`, () => {
      fixpunkt(html);
    });
  }
});

// ── PROBE 4 — wo nicht geraten wird ───────────────────────────────────────────────────────────────

const FREMDE_KENNUNG = [
  `<figure>${TABELLE(ZELLE(B), ZELLE(C))}<img src="${A}">`,
  '<figcaption data-image-id="kw-img-fremd-7">Aus einem anderen Beitrag</figcaption></figure>',
].join("");

const MEHRERE_KANDIDATEN = [
  `<figure>${TABELLE(ZELLE(B), ZELLE(C))}`,
  `<figcaption data-image-id="kw-img-alt-9">${TEXT}</figcaption></figure>`,
].join("");

const ABWEICHENDE_KENNUNGEN = [
  "<figure><table><tbody><tr>",
  `<td><img src="${B}" data-image-id="kw-img-alt-1"></td>${ZELLE(C)}`,
  "</tr></tbody></table>",
  `<figcaption data-image-id="kw-img-alt-9">${TEXT}</figcaption></figure>`,
].join("");

const INNERE_FUSSNOTE_IST_GEFUELLT = [
  "<figure><table><tbody><tr><td>",
  `<figure><img src="${B}"><figcaption>Innen</figcaption></figure>`,
  `</td>${ZELLE(C)}</tr></tbody></table><figcaption>Aussen</figcaption></figure>`,
].join("");

describe("AUFTRAG-huelle2 Probe 4: mehrdeutig oder widersprüchlich — es wird nicht geraten", () => {
  it("eine fremd gekennzeichnete Fußnote wird keinem der drei Bilder untergeschoben", () => {
    const root = wurzelMit(FREMDE_KENNUNG);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Der fremde Text ist an ein Bild gewandert — er gehört zu keinem von ihnen",
    ).toEqual([`${B}|`, `${C}|`, `${A}|`]);
    expect(
      verwaisteFussnoten(root),
      "Der Text der fremd gekennzeichneten Fußnote ist verschwunden oder hat seine Kennung verloren",
    ).toEqual([{ id: "kw-img-fremd-7", text: "Aus einem anderen Beitrag" }]);
  });

  it("bei MEHREREN Kandidaten in der Struktur greift Stufe 2b nicht — die Fußnote bleibt sichtbar", () => {
    const root = wurzelMit(MEHRERE_KANDIDATEN);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Eine markierte Fußnote wurde bei zwei möglichen Bildern doch einem davon zugeteilt",
    ).toEqual([`${B}|`, `${C}|`]);
    expect(verwaisteFussnoten(root), "Der Text ist verschwunden").toEqual([
      { id: "kw-img-alt-9", text: TEXT },
    ]);
  });

  it("zwei ABWEICHENDE Kennungen werden auch über eine Struktur hinweg nicht verrechnet", () => {
    const root = wurzelMit(ABWEICHENDE_KENNUNGEN);
    ensureImageAnchors(root);
    const bild = Array.from(root.querySelectorAll(`img[src="${B}"]`))[0];
    expect(
      bild?.getAttribute("data-image-id"),
      "Die vorhandene Kennung des Bildes in der Struktur wurde überschrieben",
    ).toBe("kw-img-alt-1");
    expect(
      verwaisteFussnoten(root),
      "Die abweichend gekennzeichnete Fußnote wurde gepaart",
    ).toEqual([{ id: "kw-img-alt-9", text: TEXT }]);
  });

  it("eine GEFÜLLTE innere Fußnote wird nicht verdrängt — die äußere geht an das nächste offene Bild", () => {
    const root = wurzelMit(INNERE_FUSSNOTE_IST_GEFUELLT);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Die äußere Fußnote hat die vorhandene innere Beschreibung verdrängt oder ist am falschen Bild gelandet",
    ).toEqual([`${B}|Innen`, `${C}|Aussen`]);
    expect(kennungenSindEindeutig(root), "Eine data-image-id wurde dupliziert").toEqual([]);
  });

  for (const [name, html] of [
    ["FREMDE_KENNUNG", FREMDE_KENNUNG],
    ["MEHRERE_KANDIDATEN", MEHRERE_KANDIDATEN],
    ["ABWEICHENDE_KENNUNGEN", ABWEICHENDE_KENNUNGEN],
    ["INNERE_FUSSNOTE_IST_GEFUELLT", INNERE_FUSSNOTE_IST_GEFUELLT],
  ] as const) {
    it(`${name}: FIXPUNKT`, () => {
      fixpunkt(html);
    });
  }
});

// ── DIESELBE KANTE EINE ETAGE WEITER: die innere figure ───────────────────────────────────────────
//
// Eine `figur`-Einheit ist keine erhaltene Hülle, sondern wird rekursiv flach gemacht. Für die
// REIHENFOLGE gilt trotzdem dasselbe: steht sie vor dem direkten Bild, geht die unmarkierte Fußnote
// an IHR Bild. Ohne diesen Fall stünde der identische Zuordnungsfehler eine Zeile weiter im selben
// Modul.

const INNERE_FIGURE_VOR_BILD = [
  `<figure><figure><img src="${B}"></figure>`,
  `<img src="${A}"><figcaption>${TEXT}</figcaption></figure>`,
].join("");

describe("AUFTRAG-huelle2: die innere figure trägt dieselbe Reihenfolgeregel", () => {
  it("eine innere figure VOR dem direkten Bild bekommt die unmarkierte Fußnote", () => {
    const root = wurzelMit(INNERE_FIGURE_VOR_BILD);
    ensureImageAnchors(root);
    expect(
      zuordnung(root),
      "Die Fußnote ist am direkten Bild gelandet, obwohl die innere figure ihm vorausgeht",
    ).toEqual([`${B}|${TEXT}`, `${A}|`]);
    expect(
      Array.from(root.querySelectorAll("figure figure")).length,
      "Eine figure liegt noch in einer figure",
    ).toBe(0);
    expect(kennungenSindEindeutig(root), "Eine data-image-id wurde dupliziert").toEqual([]);
  });

  it("FIXPUNKT: ein zweiter Lauf ändert nichts mehr", () => {
    fixpunkt(INNERE_FIGURE_VOR_BILD);
  });
});
