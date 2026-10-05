// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · gesamt-bildidentitaet — DIE IDENTITÄT KOMMT VOM BILD, NICHT VON DER HÜLLE.
// ================================================================================================
//
// Aus den Kriterien des Auftrags, nicht aus dem Code abgeleitet:
//   · R-0009: „Jetzt schlägt die Kennung die Reihenfolge, und eine vorhandene Kennung wird nie
//     überschrieben." — gemessen an BEIDEN Stellen, die eine Paarung dauerhaft machen können:
//     der Editor-Verankerung (`ensureImageAnchors`) und dem Server-Sanitizer (`anchorFigures`).
//   · I50 erstens / R-1599 / N8: „nach dem Löschen oder Ersetzen eines Bildes kann eine alte, fremd
//     markierte Fußnote neben genau einem neuen unmarkierten Bild stehen" — das neue Bild erbt die
//     Beschreibung des alten nicht.
//   · Kriterium 2: widersprüchliche Kennungen sichtbar unterscheiden — die fremde Fußnote ist im
//     Editor als „nicht zugeordnet" gekennzeichnet (R-1035), die Galerie zeigt sie nicht am Bild.
//   · Kriterium 3: die bewusste Zuordnung (V7) bleibt nach Speichern und Wiederöffnen erhalten.
//
// „Speichern und Wiederöffnen" heißt hier: Editor-Ausgabe → Client-Sanitizer → Server-Sanitizer →
// frischer Editorbaum → Verankerung. Das ist der Weg, den `emit()` und der Ladeweg nehmen; der
// HTTP-Weg selbst ändert am Körper nichts außer diesem Server-Sanitizer.
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import {
  CAPTION_UNASSIGNED_ATTR,
  type EditableElement,
  captionForImage,
  enhanceFiguresForEditing,
  ensureImageAnchors,
  imageForCaption,
  ordneFussnoteZu,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure/src/sanitize";

interface ElementLike extends EditableElement {
  innerHTML: string;
  textContent: string | null;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
interface DocumentLike {
  createElement(tag: string): ElementLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

const SRC_ALT = "/api/objects/altes-bild/raw";
const SRC_NEU = "/api/objects/neues-bild/raw";
const SRC_B = "/api/objects/bild-b/raw";

function wurzelMit(html: string): ElementLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

/** Wie der Editor lädt: verankern und kennzeichnen, an der einen Stelle. */
function geladen(html: string): ElementLike {
  const el = wurzelMit(html);
  enhanceFiguresForEditing(el, "Platzhalter", "Öffnen", "nicht zugeordnet", "Label");
  return el;
}

/** Wie der Editor speichert und der Server annimmt. */
function gespeichert(el: ElementLike): string {
  return serverSanitize(clientSanitize(el.innerHTML));
}

function bilder(el: ElementLike): ElementLike[] {
  return Array.from(el.querySelectorAll("img"));
}

function fussnoteMitText(el: ElementLike, text: string): ElementLike {
  const treffer = Array.from(el.querySelectorAll("figcaption")).filter(
    (f) => (f.textContent ?? "").trim() === text,
  );
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

function kennungenIm(html: string, tag: string): string[] {
  const aus: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*\\sdata-image-id="([^"]*)"`, "g");
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(html)) !== null) {
    aus.push(m[1] ?? "");
  }
  return aus;
}

// Eine Einheit, wie Server und Editor sie speichern — Hülle, Bild und Fußnote tragen `kw-alt`. Das
// Bild darin ist danach gegen ein neues OHNE Kennung getauscht (gelöscht und in der stehen
// gebliebenen Hülle neu eingefügt).
const ERSETZT = `<figure data-image-id="kw-alt"><img src="${SRC_NEU}"><figcaption data-image-id="kw-alt">Beschreibung des alten Bildes</figcaption></figure>`;

// Dieselbe Lage in einer NIE verankerten Hülle — Altbestand oder fremdes Markup. Die Hülle ist
// dort die einzige Auskunft; der bisherige Vertrag bleibt (Gegenprobe).
const UNVERANKERT = `<figure><img src="${SRC_ALT}"><figcaption data-image-id="kw-cap-1">Beschreibung</figcaption></figure>`;

// R-0009: ein gekennzeichnetes Bild `kw-a` und daneben eine Fußnote mit abweichender Kennung.
const WIDERSPRUCH = `<figure data-image-id="kw-a"><img src="${SRC_ALT}" data-image-id="kw-a"><figcaption data-image-id="kw-b">Fremde Beschreibung</figcaption></figure>`;

describe("I50 erstens / R-1599 — ein ersetztes Bild erbt die alte Beschreibung nicht", () => {
  it("E1 · Editor: das neue Bild bekommt eine eigene Kennung und eine eigene leere Fußnote", () => {
    const el = geladen(ERSETZT);
    const [neu] = bilder(el);
    const kennung = neu?.getAttribute("data-image-id") ?? "";
    expect(kennung, "das neue Bild hat keine Kennung").not.toBe("");
    expect(kennung, "das neue Bild hat die Kennung des alten geerbt").not.toBe("kw-alt");
    const eigene = neu === undefined ? null : captionForImage(neu, el);
    expect(eigene?.getAttribute("data-image-id")).toBe(kennung);
    expect((eigene?.textContent ?? "").trim(), "das neue Bild trägt die alte Beschreibung").toBe(
      "",
    );
  });

  it("E2 · Editor: die alte Beschreibung bleibt sichtbar, behält ihre Kennung und ist gekennzeichnet", () => {
    const el = geladen(ERSETZT);
    const alt = fussnoteMitText(el, "Beschreibung des alten Bildes");
    expect(alt.getAttribute("data-image-id")).toBe("kw-alt");
    expect(imageForCaption(alt, el), "die alte Beschreibung gilt als die des neuen Bildes").toBe(
      null,
    );
    expect(alt.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe("nicht zugeordnet");
  });

  it("E3 · Server: derselbe Körper über den Speicherweg — keine Vererbung, keine überschriebene Kennung", () => {
    const html = serverSanitize(ERSETZT);
    const [bild] = kennungenIm(html, "img");
    expect(bild).toMatch(/^kw-fig-\d+$/);
    expect(kennungenIm(html, "figcaption")).toEqual(["kw-alt"]);
    expect(kennungenIm(html, "figure")).toEqual([bild]);
    expect(extractBodyImages(html)).toEqual([{ id: bild, src: SRC_NEU, caption: "" }]);
    expect(serverSanitize(html), "der Server-Sanitizer ist kein Fixpunkt mehr").toBe(html);
  });

  it("E4 · Speichern und Wiederöffnen: das neue Bild bleibt ohne die alte Beschreibung", () => {
    const wieder = geladen(gespeichert(geladen(ERSETZT)));
    const [neu] = bilder(wieder);
    expect(neu?.getAttribute("data-image-id")).not.toBe("kw-alt");
    const eigene = neu === undefined ? null : captionForImage(neu, wieder);
    expect((eigene?.textContent ?? "").trim()).toBe("");
    const alt = fussnoteMitText(wieder, "Beschreibung des alten Bildes");
    expect(alt.getAttribute("data-image-id")).toBe("kw-alt");
    expect(alt.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe("nicht zugeordnet");
  });

  it("E5 · Gegenprobe: in einer NIE verankerten Hülle bleibt die bisherige Paarung (Altbestand)", () => {
    // Ohne diesen Fall wäre E1–E4 auch grün, wenn jede Paarung über die Hülle abgeschaltet wäre —
    // und Altbestand ohne Bildkennung verlöre seine Beschreibung.
    const el = geladen(UNVERANKERT);
    const [bild] = bilder(el);
    expect(bild?.getAttribute("data-image-id")).toBe("kw-cap-1");
    expect(fussnoteMitText(el, "Beschreibung").getAttribute(CAPTION_UNASSIGNED_ATTR)).toBeNull();
    const html = serverSanitize(UNVERANKERT);
    expect(kennungenIm(html, "img")).toEqual(["kw-cap-1"]);
    expect(extractBodyImages(html)[0]?.caption).toBe("Beschreibung");
  });
});

describe("R-0009 — eine abweichende Fußnotenkennung wird nirgends überschrieben", () => {
  it("W1 · Server: Bild `kw-a` führt, die Fußnote behält `kw-b`; die Galerie zeigt sie nicht am Bild", () => {
    const html = serverSanitize(WIDERSPRUCH);
    expect(kennungenIm(html, "img")).toEqual(["kw-a"]);
    expect(kennungenIm(html, "figcaption")).toEqual(["kw-b"]);
    expect(extractBodyImages(html)).toEqual([{ id: "kw-a", src: SRC_ALT, caption: "" }]);
    expect(serverSanitize(html)).toBe(html);
  });

  it("W2 · Editor: die fremde Fußnote ist nicht die Beschreibung des Bildes daneben", () => {
    const el = geladen(WIDERSPRUCH);
    const [bild] = bilder(el);
    const fremde = fussnoteMitText(el, "Fremde Beschreibung");
    expect(bild === undefined ? null : captionForImage(bild, el)).not.toBe(fremde);
    expect(imageForCaption(fremde, el)).toBeNull();
    expect(fremde.getAttribute("data-image-id")).toBe("kw-b");
    expect(fremde.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBe("nicht zugeordnet");
  });

  it("W3 · Editor: das Bild bekommt eine eigene leere Fußnote direkt hinter sich — ein zweiter Lauf ändert nichts", () => {
    const el = geladen(WIDERSPRUCH);
    const [bild] = bilder(el);
    const eigene = bild === undefined ? null : captionForImage(bild, el);
    expect(eigene?.getAttribute("data-image-id")).toBe("kw-a");
    expect((eigene?.textContent ?? "").trim()).toBe("");
    const figure = bild?.closest("figure");
    const direkte = Array.from(figure?.querySelectorAll(":scope > figcaption") ?? []);
    expect(direkte[0]).toBe(eigene);
    const einmal = el.innerHTML;
    expect(ensureImageAnchors(el)).toBe(0);
    expect(el.innerHTML).toBe(einmal);
  });

  it("W4 · Speichern und Wiederöffnen: beide Kennungen stehen danach wie vorher", () => {
    const html = gespeichert(geladen(WIDERSPRUCH));
    expect(kennungenIm(html, "img")).toEqual(["kw-a"]);
    expect(kennungenIm(html, "figcaption").sort()).toEqual(["kw-a", "kw-b"]);
    const wieder = geladen(html);
    expect(fussnoteMitText(wieder, "Fremde Beschreibung").getAttribute("data-image-id")).toBe(
      "kw-b",
    );
    expect(extractBodyImages(html)).toEqual([{ id: "kw-a", src: SRC_ALT, caption: "" }]);
  });

  it("W5 · Server: zwei Bilder mit je eigener Fußnote in EINER Hülle bleiben zwei Paare", () => {
    // Bis hierher wurde jede Fußnote der Hülle auf die Kennung des ersten Bildes geschrieben; die
    // Beschreibung von `kw-b` hing danach an `kw-a`.
    const html = serverSanitize(
      `<figure><img src="${SRC_ALT}" data-image-id="kw-a"><figcaption data-image-id="kw-a">A</figcaption>` +
        `<img src="${SRC_B}" data-image-id="kw-b"><figcaption data-image-id="kw-b">B</figcaption></figure>`,
    );
    expect(kennungenIm(html, "img")).toEqual(["kw-a", "kw-b"]);
    expect(kennungenIm(html, "figcaption")).toEqual(["kw-a", "kw-b"]);
    expect(serverSanitize(html)).toBe(html);
  });

  it("W6 · Server: eine kopierte Einheit wird getrennt, und ihre Fußnote geht mit ihrem Bild", () => {
    const einheit = (src: string, text: string): string =>
      `<figure data-image-id="kw-a"><img src="${src}" data-image-id="kw-a"><figcaption data-image-id="kw-a">${text}</figcaption></figure>`;
    const html = serverSanitize(einheit(SRC_ALT, "Erste") + einheit(SRC_B, "Zweite"));
    const [erste, zweite] = kennungenIm(html, "img");
    expect(erste).toBe("kw-a");
    expect(zweite).not.toBe("kw-a");
    expect(kennungenIm(html, "figcaption")).toEqual([erste, zweite]);
    expect(extractBodyImages(html).map((b) => b.caption)).toEqual(["Erste", "Zweite"]);
  });
});

describe("Kriterium 3 / V7 — die bewusste Zuordnung übersteht Speichern und Wiederöffnen", () => {
  it("Z1 · die fremde Fußnote lässt sich dem Bild daneben zuordnen; danach ist sie seine einzige", () => {
    const el = geladen(WIDERSPRUCH);
    const [bild] = bilder(el);
    const fremde = fussnoteMitText(el, "Fremde Beschreibung");
    expect(bild).toBeDefined();
    if (bild === undefined) {
      return;
    }
    expect(ordneFussnoteZu(fremde, bild, el)).toBe(true);
    const figure = bild.closest("figure");
    const direkte = Array.from(figure?.querySelectorAll(":scope > figcaption") ?? []);
    expect(direkte).toHaveLength(1);
    expect(direkte[0]?.getAttribute("data-image-id")).toBe("kw-a");
    expect((direkte[0]?.textContent ?? "").trim()).toBe("Fremde Beschreibung");
  });

  it("Z2 · nach Speichern und Wiederöffnen hängt die zugeordnete Beschreibung am Bild", () => {
    const el = geladen(WIDERSPRUCH);
    const [bild] = bilder(el);
    if (bild === undefined) {
      throw new Error("kein Bild");
    }
    ordneFussnoteZu(fussnoteMitText(el, "Fremde Beschreibung"), bild, el);
    const html = gespeichert(el);
    expect(extractBodyImages(html)).toEqual([
      { id: "kw-a", src: SRC_ALT, caption: "Fremde Beschreibung" },
    ]);
    const wieder = geladen(html);
    const beschreibung = fussnoteMitText(wieder, "Fremde Beschreibung");
    expect(beschreibung.getAttribute(CAPTION_UNASSIGNED_ATTR)).toBeNull();
    expect(imageForCaption(beschreibung, wieder)?.getAttribute("data-image-id")).toBe("kw-a");
  });

  it("Z3 · Gegenprobe: eine WEITERE direkte Fußnote macht die Lage unklar — es wird nicht geraten", () => {
    const el = geladen(
      `<figure data-image-id="kw-a"><img src="${SRC_ALT}" data-image-id="kw-a"><figcaption data-image-id="kw-a">Eigene</figcaption><figcaption data-image-id="kw-b">Fremde Beschreibung</figcaption></figure>`,
    );
    const [bild] = bilder(el);
    if (bild === undefined) {
      throw new Error("kein Bild");
    }
    const vorher = el.innerHTML;
    expect(ordneFussnoteZu(fussnoteMitText(el, "Fremde Beschreibung"), bild, el)).toBe(false);
    expect(el.innerHTML).toBe(vorher);
  });
});
