// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · gesamt-bildidentitaet, Runde 2 — Bens Gegenproben B2, B3, B4 als Fälle.
// ================================================================================================
//
//   B2 (R-0009/R-0010): eine LOSE Fußnote mit der Kennung eines Bildes verlor sie beim Speichern.
//   B3: die Entdublettierung sah nur die ERSTE direkte Fußnote; stand dort eine fremde, verlor die
//       eigene Beschreibung des getrennten Bildes ihre Zuordnung.
//   B4 (R-0090, Kriterium 2): doppelte und ungültige Kennungen bereinigte der Server ohne Spur; der
//       Editor konnte danach nichts mehr melden.
import { describe, expect, it } from "vitest";
import { extractBodyImages, galerieVorkommen } from "../../apps/web/src/lib/bodyImages";
import {
  type EditableElement,
  type KennungsSpuren,
  captionForImage,
  enhanceFiguresForEditing,
  imageForCaption,
} from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure/src/sanitize";

interface ElementLike extends EditableElement {
  innerHTML: string;
  textContent: string | null;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
const doc = (globalThis as unknown as { document: { createElement(t: string): ElementLike } })
  .document;

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";

/** Wie der Editor lädt (Client-Sanitizer, dann die eine Verankerung) — mit Spurmelder. */
function geladen(html: string): { el: ElementLike; spuren: KennungsSpuren[] } {
  const el = doc.createElement("div");
  el.innerHTML = clientSanitize(html);
  const spuren: KennungsSpuren[] = [];
  enhanceFiguresForEditing(el, "P", "O", "nicht zugeordnet", "L", undefined, (s) =>
    spuren.push({ ...s }),
  );
  return { el, spuren };
}

function fussnote(el: ElementLike, text: string): ElementLike {
  const f = Array.from(el.querySelectorAll("figcaption")).filter(
    (c) => (c.textContent ?? "").trim() === text,
  );
  if (f.length !== 1 || f[0] === undefined) {
    throw new Error(`${f.length} Fußnoten „${text}"`);
  }
  return f[0];
}

describe("B2 · eine lose Fußnote behält die Kennung ihres Bildes", () => {
  const KOERPER = `<figure data-image-id="a"><img src="${A}" data-image-id="a"></figure><figcaption data-image-id="a">Original</figcaption>`;

  it("G1 (Bens Fall) · Server: die Kennung der losen Fußnote bleibt — Fixpunkt", () => {
    const html = serverSanitize(KOERPER);
    expect(html).toContain('<figcaption data-image-id="a">Original</figcaption>');
    expect(serverSanitize(html)).toBe(html);
  });

  it("Galerie: die lose Fußnote ist die Beschreibung dieses Bildes", () => {
    expect(extractBodyImages(serverSanitize(KOERPER))).toEqual([
      { id: "a", src: A, caption: "Original" },
    ]);
  });

  it("Editor: keine zweite leere Fußnote, die lose ist zugeordnet und nicht gekennzeichnet", () => {
    const { el } = geladen(serverSanitize(KOERPER));
    expect(Array.from(el.querySelectorAll("figcaption"))).toHaveLength(1);
    const [bild] = Array.from(el.querySelectorAll("img"));
    const original = fussnote(el, "Original");
    expect(bild === undefined ? null : captionForImage(bild, el)).toBe(original);
    expect(imageForCaption(original, el)).toBe(bild);
    expect(original.getAttribute("data-kw-nicht-zugeordnet")).toBeNull();
  });

  it("Speichern und Wiederöffnen: die Zuordnung übersteht den ganzen Weg", () => {
    const { el } = geladen(serverSanitize(KOERPER));
    const wieder = serverSanitize(clientSanitize(el.innerHTML));
    expect(extractBodyImages(wieder)[0]?.caption).toBe("Original");
  });

  it("Gegenprobe: zwei lose Fußnoten mit derselben Kennung — es wird nicht geraten", () => {
    const html = serverSanitize(`${KOERPER}<figcaption data-image-id="a">Andere</figcaption>`);
    expect(extractBodyImages(html)[0]?.caption).toBe("");
  });
});

describe("B3 · beim Trennen geht die eigene Beschreibung mit, auch hinter einer fremden", () => {
  it("G3 (Bens Fall) · das getrennte Bild findet seine Beschreibung „Zweite“", () => {
    const { el } = geladen(
      `<figure><img src="${A}" data-image-id="a"><figcaption data-image-id="a">Erste</figcaption></figure><figure><img src="${B}" data-image-id="a"><figcaption data-image-id="fremd">Fremd</figcaption><figcaption data-image-id="a">Zweite</figcaption></figure>`,
    );
    const [erstes, zweites] = Array.from(el.querySelectorAll("img"));
    expect(zweites?.getAttribute("data-image-id")).not.toBe("a");
    expect(zweites === undefined ? null : captionForImage(zweites, el)).toBe(
      fussnote(el, "Zweite"),
    );
    expect(erstes === undefined ? null : captionForImage(erstes, el)).toBe(fussnote(el, "Erste"));
    expect(fussnote(el, "Fremd").getAttribute("data-image-id")).toBe("fremd");
  });
});

describe("B4 · R-0090: die Speicherung verschweigt ihre Bereinigung nicht", () => {
  it("doppelt: der Server trennt und hinterlässt die Spur — der Editor meldet sie", () => {
    const html = serverSanitize(
      `<figure><img src="${A}" data-image-id="a"><figcaption data-image-id="a">Erste</figcaption></figure>` +
        `<figure><img src="${B}" data-image-id="a"><figcaption data-image-id="a">Zweite</figcaption></figure>`,
    );
    expect(html.match(/data-kw-kennung="doppelt"/g) ?? []).toHaveLength(1);
    expect(serverSanitize(html), "kein Fixpunkt").toBe(html);
    expect(extractBodyImages(html).map((b) => b.caption)).toEqual(["Erste", "Zweite"]);
    const { el, spuren } = geladen(html);
    expect(spuren).toEqual([{ doppelt: 1, ungueltig: 0 }]);
    // Gemeldet und aus dem Editorinhalt genommen: gespeichert wird danach ohne Spur.
    expect(el.innerHTML).not.toContain("data-kw-kennung");
  });

  it("ungültig: verworfen, mit Spur — im Server und im Client-Spiegel gleich", () => {
    const roh = `<figure><img src="${A}" data-image-id="a b"><figcaption>Text</figcaption></figure>`;
    const server = serverSanitize(roh);
    expect(server).not.toContain('"a b"');
    expect(server).toContain('data-kw-kennung="ungueltig"');
    expect(serverSanitize(server)).toBe(server);
    expect(clientSanitize(roh)).toContain('data-kw-kennung="ungueltig"');
    const { spuren } = geladen(server);
    expect(spuren).toEqual([{ doppelt: 0, ungueltig: 1 }]);
  });

  it("Einfügeweg: eine ungültige Kennung aus der Zwischenablage wird ebenso gemeldet", () => {
    const { spuren } = geladen(`<img src="${A}" data-image-id="&lt;evil&gt;">`);
    expect(spuren).toEqual([{ doppelt: 0, ungueltig: 1 }]);
  });

  it("ein loses Doppelbild verliert seine Kennung nicht mehr spurlos", () => {
    const html = serverSanitize(
      `<figure><img src="${A}" data-image-id="a"></figure><p><img src="${B}" data-image-id="a"></p>`,
    );
    expect(html).toContain(`<img src="${B}" data-kw-kennung="doppelt">`);
    expect(geladen(html).spuren).toEqual([{ doppelt: 1, ungueltig: 0 }]);
  });

  it("Sicherheitsgrenze: die Spur lässt keinen Fremdwert und kein Fremdtag durch", () => {
    expect(serverSanitize(`<img src="${A}" data-kw-kennung="<x>">`)).toBe(`<img src="${A}">`);
    expect(clientSanitize(`<img src="${A}" data-kw-kennung="onerror">`)).toBe(`<img src="${A}">`);
    expect(serverSanitize('<p data-kw-kennung="doppelt">x</p>')).toBe("<p>x</p>");
    expect(clientSanitize('<p data-kw-kennung="doppelt">x</p>')).toBe("<p>x</p>");
  });

  it("ohne Reparatur keine Spur und keine Meldung", () => {
    const html = serverSanitize(
      `<figure><img src="${A}" data-image-id="a"><figcaption data-image-id="a">A</figcaption></figure>`,
    );
    expect(html).not.toContain("data-kw-kennung");
    expect(geladen(html).spuren).toEqual([]);
  });
});

describe("galerieVorkommen · das k-te Bild mit dieser Quelle, über ALLE Bilder gezählt", () => {
  it("ein loses Bild zählt mit, erscheint aber nicht als Eintrag", () => {
    const html = `<p><img src="${A}"></p><figure><img src="${A}" data-image-id="x"></figure><figure><img src="${B}" data-image-id="y"></figure>`;
    expect(extractBodyImages(html).map((b) => b.id)).toEqual(["x", "y"]);
    expect(galerieVorkommen(html)).toEqual([1, 0]);
  });
});
