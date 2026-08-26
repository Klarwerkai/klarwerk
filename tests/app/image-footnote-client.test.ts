// @vitest-environment jsdom
// JOB 2362 · D1 — DIE BILDFUSSNOTE AUF DER CLIENTSEITE. DER DREIFACHANKER ALS ZIELBEZIEHUNG.
//
// HERKUNFT. Dieser Wächter ist die Prüflücke 1 aus `BEN3-PRUEFUNG-JOB-509-D7.md:10`, wörtlich:
// „denselben Bild-/Fußnotenfall durch den Clientpfad in `apps/web/src/lib/richText.ts` führen;
// erwartet werden alle drei Anker, eindeutige Zielbezüge und keine verwaiste Referenz."
// JOB 509 wurde danach geschlossen (`ENTSCHEIDUNGEN/beantwortet/E28.json`), die Auflage zog in die
// K2-Familie um. Gebaut wird sie hier.
//
// WAS SICH SEIT BEN3 GEÄNDERT HAT — gemessen am heutigen Stand, nicht aus der alten Akte:
// BEN3s Befund lautete „einer der drei Anker wird serverseitig gesetzt, jedoch nicht im
// Clientpfad erzeugt" (`:8`). DAS TRÄGT HEUTE NICHT MEHR. `editorFigures.ts:1011-1032` setzt den
// Container-Anker seit dem 10.08.2026 auch im Client; der Block nennt JOB 509 / D5 selbst als
// Herkunft. Alle drei Setter existieren, und alle drei sind bewacht.
//
// WARUM ES DIESEN WÄCHTER TROTZDEM GIBT — und das ist der ganze Grund:
// Der Container-Anker wird heute nur INDIREKT gehalten. `mega88-bildstruktur-invariante.test.ts`
// urteilt über die Verankerung mit einer Hilfsfunktion, die für die `figure` nur prüft, ob es sie
// GIBT (`figure !== null`) — nicht, ob sie den Anker trägt. Rot wird das Entfernen des
// Container-Setters dort erst über den Umweg „Client- und Server-Sanitizer urteilen GLEICH"
// (`:275-278`): der Server SETZT den Anker in `anchorFigures` selbst, der Client dann nicht mehr,
// und die beiden Zeichenketten laufen auseinander. Das ist ein echter Wächter, aber er meldet
// „die Sanitizer sind uneins" — nicht „dem Bild fehlt ein Anker". Verschwände die serverseitige
// Erzeugung, verschwände mit ihr auch die einzige Meldung.
//
// Dieser Wächter sagt die Sache deshalb DIREKT und in einer Achse, die keinen zweiten Erzeuger
// braucht: für jedes Bild müssen `figure`, `img` und `figcaption` DIESELBE Kennung tragen, und
// keine Fußnote darf auf eine Kennung zeigen, die kein Bild hat.
//
// WAS HIER GEMESSEN WIRD UND WAS NICHT:
//   · GEMESSEN wird die WIRKUNG am DOM, über die echten Einfügewege des Editors
//     (`insertImageSrcHtml`, `insertImageHtml`) und den echten Verankerer (`ensureImageAnchors`).
//     Kein Fall pinnt, dass eine Zeichenfolge im Quelltext vorkommt.
//   · GEMESSEN wird die Reise über die Persistenzgrenze: Client-Sanitizer → Server-Sanitizer →
//     zurück. Alle drei Anker müssen sie unverändert überstehen.
//   · NICHT GEMESSEN wird Browserverhalten. Drop und Einfügen sind Browserereignisse; dafür steht
//     `tests-smoke/mega88-bildanker-browser.spec.ts`.
//
// jsdom-Hinweis: der Gate-tsc über `services`+`tests` läuft ohne DOM-lib; das zur Laufzeit
// vorhandene `document` wird über einen schmalen, DOM-lib-freien Typ abgegriffen — dasselbe Muster
// wie `tests/capture/mega88-bildstruktur-invariante.test.ts` und `tests/capture/editor-figure-caption.test.ts`.
import { describe, expect, it } from "vitest";
import { type EditableElement, ensureImageAnchors } from "../../apps/web/src/lib/editorFigures";
import { insertImageHtml, insertImageSrcHtml, sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

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

const TINY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const KENNUNG = /^kw-img-[a-z0-9]+-\d+$/;

/** Ein Bild und die drei Kennungen, die zu ihm gehören sollen. */
interface Bindung {
  figure: string | null;
  img: string | null;
  caption: string | null;
}

/**
 * Die Zielbeziehung JEDES Bildes — alle drei Anker, nicht zwei.
 *
 * Bewusst `:scope >` für Fußnote und Bild: mega89 Block B verbietet die Paarung über einen
 * beliebigen Nachfahren. Bei verschachtelten Strukturen läse ein blosses `querySelector` die
 * Kennung des falschen Kindes und behauptete eine Bindung, die es nicht gibt.
 */
function bindungen(root: ElementLike): Bindung[] {
  const raus: Bindung[] = [];
  for (const img of root.querySelectorAll("img")) {
    const figure = img.closest("figure");
    const caption = figure?.querySelector(":scope > figcaption") ?? null;
    raus.push({
      figure: figure?.getAttribute("data-image-id") ?? null,
      img: img.getAttribute("data-image-id"),
      caption: caption?.getAttribute("data-image-id") ?? null,
    });
  }
  return raus;
}

/** Trägt diese Bindung alle drei Anker, und zwar mit EINER Kennung? */
function istDreifach(b: Bindung): boolean {
  return b.img !== null && b.img === b.figure && b.img === b.caption;
}

/**
 * Die Kennungen, auf die eine Fußnote zeigt, ohne dass ein Bild sie trägt.
 * Das ist BEN3s „verwaiste Referenz", gemessen und nicht behauptet.
 */
function verwaisteFussnoten(root: ElementLike): string[] {
  const bildKennungen = new Set<string>();
  for (const img of root.querySelectorAll("img")) {
    const id = img.getAttribute("data-image-id");
    if (id !== null && id !== "") {
      bildKennungen.add(id);
    }
  }
  const raus: string[] = [];
  for (const cap of root.querySelectorAll("figcaption")) {
    const id = cap.getAttribute("data-image-id");
    if (id !== null && id !== "" && !bildKennungen.has(id)) {
      raus.push(id);
    }
  }
  return raus;
}

describe("JOB 2362 · die drei Anker der Bildfußnote entstehen im Client", () => {
  // Das ist wörtlich das Markup der lokalen Dateiauswahl, von Drop und von Einfügen
  // (`RichTextEditor.tsx` `insertImageFile` → `insertHtmlReliable`).
  it("der Einfügeweg: aus dem nackten <img> entsteht die VOLLE Dreifachbindung", () => {
    const nackt = insertImageSrcHtml(TINY, "Führungsschiene");
    // Vorbedingung, sonst misst der Fall den falschen Ausgangszustand.
    expect(nackt, "Der Helfer liefert nicht mehr das erwartete nackte <img>").not.toMatch(
      /<figure|data-image-id/i,
    );

    const root = wurzelMit(`<p>Vor dem Ausbau:</p>${nackt}`);
    expect(bindungen(root).filter(istDreifach).length, "Vorbedingung: noch nichts verankert").toBe(
      0,
    );

    ensureImageAnchors(root);

    const b = bindungen(root);
    expect(b.length, "Das Bild ist beim Verankern verlorengegangen").toBe(1);
    const eine = b[0];
    expect(eine?.img ?? "", "Die Bildkennung fehlt oder hat nicht das vereinbarte Format").toMatch(
      KENNUNG,
    );
    expect(eine?.figure, "DER CONTAINER trägt den Anker nicht — dritter Anker fehlt").toBe(
      eine?.img,
    );
    expect(eine?.caption, "DIE FUSSNOTE trägt den Anker nicht").toBe(eine?.img);
    expect(verwaisteFussnoten(root), "Es ist eine verwaiste Fußnote entstanden").toEqual([]);
  });

  it("der Objekt-Store-Weg (Bild aus den Anhängen) bindet ebenso dreifach", () => {
    const root = wurzelMit(insertImageHtml("obj-1", "Riefen"));
    ensureImageAnchors(root);
    const eine = bindungen(root)[0];
    expect(eine === undefined ? null : istDreifach(eine), "Keine volle Dreifachbindung").toBe(true);
    // Die Bildquelle überlebt das Umhüllen unversehrt — umschlossen wird, nicht neu gebaut.
    expect(root.querySelector("img")?.getAttribute("src")).toBe("/api/objects/obj-1/raw");
  });

  it("mehrere Bilder: JEDES bekommt seine eigene Dreifachbindung, keine geteilt", () => {
    const root = wurzelMit(
      `${insertImageSrcHtml(TINY, "eins")}<p>dazwischen</p>${insertImageSrcHtml(TINY, "zwei")}`,
    );
    ensureImageAnchors(root);

    const b = bindungen(root);
    expect(b.length).toBe(2);
    expect(b.every(istDreifach), "Nicht jedes Bild ist dreifach gebunden").toBe(true);
    // Eine Kennung gehört GENAU einem Bild (JOB 2084) — sonst beschreibt eine Fußnote zwei Bilder.
    expect(new Set(b.map((x) => x.img)).size, "Zwei Bilder teilen sich eine Kennung").toBe(2);
    expect(verwaisteFussnoten(root)).toEqual([]);
  });

  it("die Bindung ist STABIL: ein zweiter Lauf vergibt sie nicht neu", () => {
    const root = wurzelMit(insertImageSrcHtml(TINY, "Lager"));
    ensureImageAnchors(root);
    const vorher = bindungen(root)[0];
    // Fixpunkt: der geladene Körper wird nicht ein zweites Mal umhüllt.
    expect(ensureImageAnchors(root), "Der bereits verankerte Körper wurde erneut verankert").toBe(
      0,
    );
    expect(bindungen(root)[0]).toEqual(vorher);
  });
});

describe("JOB 2362 · die drei Anker überstehen die Persistenzgrenze", () => {
  /**
   * Ein verankerter Editor-Körper, so wie er beim Speichern das Feld verlässt — mit
   * Beschreibungstext, damit die Grenze auch Inhalt und nicht nur eine leere Hülle trägt.
   */
  function imEditor(): string {
    const root = wurzelMit(`<h2>Befund</h2>${insertImageSrcHtml(TINY, "Führungsschiene")}`);
    ensureImageAnchors(root);
    const cap = root.querySelector("figcaption");
    cap?.insertAdjacentHTML("beforeend", "Riefen in <strong>Laufrichtung</strong>");
    return root.innerHTML;
  }

  it("Client → Server → Client: alle drei Anker kommen unverändert zurück", () => {
    const raus = imEditor();
    const zurueck = sanitizeHtml(serverSanitize(raus));

    const root = wurzelMit(zurueck);
    const eine = bindungen(root)[0];
    expect(
      eine === undefined ? null : istDreifach(eine),
      "Ein Anker hat die Grenze nicht überlebt",
    ).toBe(true);
    expect(eine?.img ?? "").toMatch(KENNUNG);
    expect(verwaisteFussnoten(root), "Die Grenze hat eine verwaiste Fußnote erzeugt").toEqual([]);
  });

  it("und der Rundlauf ist ein FIXPUNKT — noch ein Durchgang ändert nichts", () => {
    const einmal = sanitizeHtml(serverSanitize(imEditor()));
    expect(sanitizeHtml(serverSanitize(einmal))).toBe(einmal);
  });
});

describe("JOB 2362 · keine verwaiste Referenz, und der Client rät nicht", () => {
  // GEMESSEN am heutigen Stand (D1-Sonde): eine Fußnote ohne Bild bleibt stehen. Das ist Absicht
  // und keine Lücke — sie zu entfernen hiesse, geschriebenen Text zu vernichten, und die
  // Text-erhalten-Zusage aus `huelle3` steht über der Aufräumlust. Der Fall hält fest, dass der
  // Client daraus KEINE falsche Bindung erfindet: er hängt die herrenlose Beschreibung nicht an
  // das nächstbeste Bild.
  it("eine Fußnote ohne Bild wird nicht an ein fremdes Bild gehängt", () => {
    const root = wurzelMit(
      `<figure data-image-id="kw-img-tot-1"><figcaption data-image-id="kw-img-tot-1">Beschreibung eines gelöschten Bildes</figcaption></figure>${insertImageSrcHtml(TINY, "ein anderes Bild")}`,
    );
    ensureImageAnchors(root);

    const b = bindungen(root);
    expect(b.length, "Das echte Bild ist verschwunden").toBe(1);
    expect(b[0]?.img, "Das echte Bild hat die Kennung des gelöschten übernommen").not.toBe(
      "kw-img-tot-1",
    );
    expect(
      b[0] === undefined ? null : istDreifach(b[0]),
      "Das echte Bild hat keine saubere eigene Bindung bekommen",
    ).toBe(true);
    // Der Text der herrenlosen Beschreibung steht weiterhin genau einmal da.
    expect((root.innerHTML.match(/Beschreibung eines gelöschten Bildes/g) ?? []).length).toBe(1);
  });

  it("widersprüchliche Kennungen werden NICHT überschrieben — eine falsche Bindung ist schlimmer als keine", () => {
    // Bild und direkte Fußnote tragen zwei verschiedene, nicht leere Kennungen. `gemeinsameKennung`
    // gibt hier bewusst auf, statt eine Seite zur Wahrheit zu erklären: eine überschriebene
    // Zuordnung ist nicht reparierbar, eine danebenstehende schon (`editorFigures.ts:985-987`).
    const root = wurzelMit(
      `<figure><img src="${TINY}" data-image-id="kw-img-eins-1"><figcaption data-image-id="kw-img-zwei-1">Fremde Beschreibung</figcaption></figure>`,
    );
    expect(ensureImageAnchors(root), "Der Konflikt wurde als Verankerung gezählt").toBe(0);

    const eine = bindungen(root)[0];
    expect(eine?.img, "Die Bildkennung wurde überschrieben").toBe("kw-img-eins-1");
    expect(eine?.caption, "Die Fußnotenkennung wurde überschrieben").toBe("kw-img-zwei-1");
  });
});
