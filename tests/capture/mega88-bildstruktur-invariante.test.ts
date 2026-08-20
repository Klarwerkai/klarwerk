// @vitest-environment jsdom
// AUFTRAG-mega88 Block B + D — DIE BILDSTRUKTUR-INVARIANTE UND IHRE REISE ÜBER DIE PERSISTENZGRENZE.
//
// DER BEFUND, der diesen Auftrag ausgelöst hat (Hand in mega87, von ben gegen die eingefrorene Basis
// bestätigt und zum Auslieferungsblocker erklärt): `insertImageSrcHtml` erzeugt ein NACKTES `<img>`
// (`apps/web/src/lib/richText.ts:450-454`), und `RichTextEditor.tsx` nutzt diesen Helfer für die
// lokale Dateiauswahl EBENSO WIE für Drop und Einfügen. `enhanceFiguresForEditing` erweiterte nur
// VORHANDENE figure-Strukturen. `openCaptionFormFor` suchte `closest("figure")?.querySelector(
// "figcaption")` und endete ohne Rückmeldung, wenn der Anker fehlte — während die Aktion sichtbar
// blieb. Der Nutzer sah eine Fähigkeit, die auf dem naheliegendsten Weg lautlos nichts tat.
//
// WAS HIER GEMESSEN WIRD UND WAS NICHT:
//   · GEMESSEN wird die WIRKUNG am DOM — für jede Ausgangsform, die in diesem Produkt vorkommt,
//     entsteht `figure` + `img` + stabile `data-image-id` (beidseitig) + zugeordnete `figcaption`.
//     Gepinnt ist nicht, dass eine Funktion existiert, sondern dass sie etwas tut. Die Lehre aus
//     mega86/mega87: eine Zusage über Verhalten wird am Verhalten gemessen.
//   · GEMESSEN wird ebenfalls, dass die entstandene Struktur die Persistenzgrenze ÜBERSTEHT — durch
//     den Server-Sanitizer (autoritativ) und den Client-Sanitizer zurück, unverändert und ohne dass
//     dabei eine neue aktive HTML-Fläche entstünde.
//   · NICHT GEMESSEN wird hier Browserverhalten. Drop und Einfügen sind Browserereignisse; ihre
//     Zusage steht in `tests-smoke/mega88-bildanker-browser.spec.ts` und wird dort im echten Browser
//     gefahren. jsdom kennt weder `execCommand` noch Canvas — was jsdom hier belegt, ist die
//     STRUKTURlogik, und sie wird auch genau so genannt.
//
// jsdom-Hinweis: der Gate-tsc über `services`+`tests` läuft ohne DOM-lib; das zur Laufzeit
// vorhandene `document` wird über einen schmalen, DOM-lib-freien Typ abgegriffen (dasselbe Muster
// wie `tests/capture/editor-figure-caption.test.ts`).
import { describe, expect, it } from "vitest";
import {
  CAPTION_OPEN_ATTR,
  type EditableElement,
  enhanceFiguresForEditing,
  ensureImageAnchors,
} from "../../apps/web/src/lib/editorFigures";
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

const KENNUNG = /^kw-img-[a-z0-9]+-\d+$/;
const TINY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

/** Das Urteil über einen Editor-Inhalt: trägt JEDES Bild seinen Anker? */
interface Urteil {
  bilder: number;
  verankert: number;
  paare: { img: string | null; caption: string | null }[];
}

function urteile(root: ElementLike): Urteil {
  const paare: { img: string | null; caption: string | null }[] = [];
  let verankert = 0;
  let bilder = 0;
  for (const img of root.querySelectorAll("img")) {
    bilder += 1;
    const figure = img.closest("figure");
    const caption = figure?.querySelector(":scope > figcaption") ?? null;
    const imgId = img.getAttribute("data-image-id");
    const capId = caption?.getAttribute("data-image-id") ?? null;
    paare.push({ img: imgId, caption: capId });
    if (figure !== null && caption !== null && imgId !== null && imgId === capId) {
      verankert += 1;
    }
  }
  return { bilder, verankert, paare };
}

describe("AUFTRAG-mega88 Block B: jedes Bild bekommt seinen Anker — an EINER Stelle", () => {
  // Das ist WÖRTLICH das Markup, das die lokale Dateiauswahl, Drop und Einfügen von Bilddateien
  // erzeugen (RichTextEditor.tsx `insertImageFile` → `insertHtmlReliable`). Vor mega88 blieb es so
  // stehen; damit gab es weder Fußnote noch Galerie-Eintrag noch Formular.
  it("das nackte <img> der EINFÜGEWEGE wird umschlossen — Wirkung, nicht Absicht", () => {
    const nackt = insertImageSrcHtml(TINY, "Führungsschiene");
    expect(nackt, "Vorbedingung: der Helfer liefert weiterhin ein nacktes <img>").not.toMatch(
      /<figure/i,
    );

    const root = wurzelMit(`<p>Text</p>${nackt}`);
    expect(urteile(root).verankert, "Vorbedingung: ohne Verankern gibt es keinen Anker").toBe(0);

    enhanceFiguresForEditing(root, "✎ …", "Bildbeschreibung öffnen");

    const u = urteile(root);
    expect(u.bilder).toBe(1);
    expect(u.verankert, "Das eingefügte Bild hat keinen Anker bekommen").toBe(1);
    expect(u.paare[0]?.img ?? "", "Die Bildkennung ist nicht im vereinbarten Format").toMatch(
      KENNUNG,
    );
    // Die Fußnote entsteht LEER — ein Platzhalter ist kein Inhalt (WP-D10, mega84).
    const cap = root.querySelector("figcaption");
    expect(cap?.textContent ?? "").toBe("");
    // …und sie ist sofort das BEDIENELEMENT aus mega84, nicht bloß ein Element.
    expect(cap?.getAttribute(CAPTION_OPEN_ATTR)).toBe("");
    expect(cap?.getAttribute("role")).toBe("button");
  });

  it("auch der Objekt-Store-Weg (Bild aus den Anhängen) wird umschlossen", () => {
    const root = wurzelMit(insertImageHtml("obj-1", "Riefen"));
    enhanceFiguresForEditing(root, "✎ …", "Bildbeschreibung öffnen");
    expect(urteile(root).verankert).toBe(1);
    // Die Bildquelle überlebt das Umhüllen unversehrt — umschlossen wird, nicht neu gebaut.
    expect(root.querySelector("img")?.getAttribute("src")).toBe("/api/objects/obj-1/raw");
  });

  it("mitgebrachte Attribute überleben das Umhüllen (alt, Skalierung)", () => {
    const root = wurzelMit(insertImageSrcHtml(TINY, 'Ring & "Sitz"'));
    enhanceFiguresForEditing(root, "✎ …", "Bildbeschreibung öffnen");
    const img = root.querySelector("img");
    expect(img?.getAttribute("alt")).toBe('Ring & "Sitz"');
    expect(img?.getAttribute("data-kw-scale")).not.toBeNull();
  });

  // Der Altbestand (Block C) ist dieselbe Invariante — deshalb steht er hier und nicht in einer
  // zweiten Bauform: ein bereits gespeichertes nacktes Bild ist beim Laden derselbe Fall.
  it("Altbestand: gespeichertes nacktes Bild bekommt beim Verankern seinen Anker", () => {
    const gespeichert = `<h2>Befund</h2><p>Vor dem Ausbau <img src="${TINY}" alt="Lager"></p>`;
    const root = wurzelMit(gespeichert);
    enhanceFiguresForEditing(root, "✎ …", "Bildbeschreibung öffnen");
    expect(urteile(root).verankert).toBe(1);
  });

  it("halbe Strukturen werden vervollständigt, nicht verdoppelt", () => {
    // figure OHNE Fußnote (so kommt Word-/Web-Markup an).
    const ohneFussnote = wurzelMit(`<figure><img src="${TINY}"></figure>`);
    enhanceFiguresForEditing(ohneFussnote, "✎ …", "L");
    expect(urteile(ohneFussnote).verankert).toBe(1);
    expect(Array.from(ohneFussnote.querySelectorAll("figure")).length).toBe(1);
    expect(Array.from(ohneFussnote.querySelectorAll("figcaption")).length).toBe(1);

    // Fußnote MIT Kennung, Bild ohne — die beidseitige Verankerung (WP-BILD-1b) wird nachgezogen,
    // und die VORHANDENE Kennung gewinnt (sonst verlöre die Galerie ihren Bezug).
    const halb = wurzelMit(
      `<figure><img src="${TINY}"><figcaption data-image-id="kw-img-abc123-7"></figcaption></figure>`,
    );
    enhanceFiguresForEditing(halb, "✎ …", "L");
    expect(urteile(halb).paare[0]).toEqual({
      img: "kw-img-abc123-7",
      caption: "kw-img-abc123-7",
    });
  });

  it("zwei Bilder in EINER figure bekommen zwei Fußnoten, nicht eine geteilte", () => {
    const root = wurzelMit(
      `<figure><img src="${TINY}" alt="a"><img src="${TINY}" alt="b"><figcaption></figcaption></figure>`,
    );
    enhanceFiguresForEditing(root, "✎ …", "L");
    const u = urteile(root);
    expect(u.bilder).toBe(2);
    expect(u.verankert, "Ein Bild ist ohne eigene Fußnote geblieben").toBe(2);
    expect(u.paare[0]?.img).not.toBe(u.paare[1]?.img);
  });

  it("die Kennung ist STABIL: mehrfaches Verankern vergibt sie nicht neu", () => {
    const root = wurzelMit(insertImageSrcHtml(TINY, "Lager"));
    enhanceFiguresForEditing(root, "✎ …", "L");
    const ersteId = root.querySelector("img")?.getAttribute("data-image-id");
    expect(ersteId ?? "").toMatch(KENNUNG);

    // Der Editor verankert nach JEDER Mutation — dreimal ist der Normalfall, nicht die Ausnahme.
    enhanceFiguresForEditing(root, "✎ …", "L");
    enhanceFiguresForEditing(root, "✎ …", "L");
    expect(
      root.querySelector("img")?.getAttribute("data-image-id"),
      "Die Bildkennung hat sich beim erneuten Verankern geändert — jede Bitte der Galerie und jeder laufende KI-Vorschlag zeigten dann ins Leere",
    ).toBe(ersteId);
    expect(ensureImageAnchors(root), "Ein bereits verankertes Bild wurde erneut angefasst").toBe(0);
  });

  it("eine neue Kennung trifft nie eine vorhandene", () => {
    // Zwanzig Bilder auf einmal (Drop mehrerer Dateien) neben einem bereits verankerten.
    const nackte = Array.from({ length: 20 }, () => insertImageSrcHtml(TINY, "x")).join("");
    const root = wurzelMit(
      `<figure><img src="${TINY}" data-image-id="kw-img-zzzzzz-1"><figcaption data-image-id="kw-img-zzzzzz-1"></figcaption></figure>${nackte}`,
    );
    enhanceFiguresForEditing(root, "✎ …", "L");
    const u = urteile(root);
    expect(u.bilder).toBe(21);
    expect(u.verankert).toBe(21);
    const ids = u.paare.map((p) => p.img);
    expect(new Set(ids).size, "Zwei Bilder teilen sich eine Kennung").toBe(21);
    expect(ids).toContain("kw-img-zzzzzz-1");
  });
});

describe("AUFTRAG-mega88 Block D: die Struktur übersteht die Persistenzgrenze unverändert", () => {
  // Die Bühne: genau das, was der Editor nach dem Verankern eines frisch eingefügten Bildes hält —
  // mit einer vom Nutzer geschriebenen, formatierten Beschreibung (mega84/85: die Fußnote trägt
  // Auszeichnung).
  function verankerterBody(): string {
    const root = wurzelMit(insertImageSrcHtml(TINY, "Führungsschiene"));
    enhanceFiguresForEditing(root, "✎ …", "L");
    const cap = root.querySelector("figcaption") as ElementLike | null;
    if (cap === null) {
      throw new Error("Die Verankerung hat keine Fußnote erzeugt — die Bühne steht nicht");
    }
    cap.setAttribute("data-egal", "x"); // Editier-Beiwerk, das der Sanitizer wegnehmen MUSS
    cap.innerHTML = "Riefen in <strong>Laufrichtung</strong>";
    return root.innerHTML;
  }

  it("Client → Server → Client: Struktur, Kennung und Beschreibung kommen unverändert zurück", () => {
    const imEditor = verankerterBody();
    const raus = sanitizeHtml(imEditor); // emit()
    const amServer = serverSanitize(raus); // autoritativ, beim Speichern
    const zurueck = sanitizeHtml(amServer); // beim Laden in den Editor

    for (const [name, html] of [
      ["emit()", raus],
      ["Server", amServer],
      ["zurück im Editor", zurueck],
    ] as const) {
      // 10.08.2026 (JOB 509 / D5): war `/<figure>/` und prüfte damit die Serialisierung statt der
      // Substanz. Seit dem Dreifachanker trägt der Container `data-image-id`, und die alte Fassung
      // wurde rot, obwohl die figure sehr wohl da ist. `/<figure[\s>]/` beweist weiterhin genau
      // das, wofür der Fall geschrieben wurde — dass die figure die Grenze übersteht — und bricht
      // nicht mehr am nächsten Attribut.
      expect(html, `${name}: die figure ist verlorengegangen`).toMatch(/<figure[\s>]/);
      expect(html, `${name}: die Fußnote ist verlorengegangen`).toMatch(/<figcaption\b/);
      expect(html, `${name}: die Bildkennung ist verlorengegangen`).toMatch(
        /<img[^>]*\bdata-image-id="kw-img-[a-z0-9]+-1"/,
      );
      expect(html, `${name}: die Fußnote hat ihre Kennung verloren`).toMatch(
        /<figcaption data-image-id="kw-img-[a-z0-9]+-1"/,
      );
      expect(html, `${name}: die Beschreibung ist verlorengegangen`).toContain(
        "Riefen in <strong>Laufrichtung</strong>",
      );
    }

    // Und der Rundlauf ist ein FIXPUNKT: noch ein Durchgang ändert nichts mehr.
    expect(sanitizeHtml(serverSanitize(zurueck))).toBe(zurueck);

    // Die verankerte Struktur ist wieder DIESELBE, wenn sie zurück in den Editor kommt — der
    // Altbestand-Durchlauf darf sie nicht ein zweites Mal umhüllen.
    const wieder = wurzelMit(zurueck);
    expect(ensureImageAnchors(wieder), "Der geladene Body wurde erneut verankert").toBe(0);
    expect(Array.from(wieder.querySelectorAll("figure")).length).toBe(1);
  });

  it("KEINE neue aktive Fläche: die Verankerung öffnet nichts, was der Sanitizer nicht schon erlaubte", () => {
    const amServer = serverSanitize(sanitizeHtml(verankerterBody()));
    // Editier-Beiwerk und Anzeige-Attribute persistieren nie.
    for (const verboten of [
      /contenteditable/i,
      /\bstyle=/i,
      /\bclass=/i,
      /\bon[a-z]+=/i,
      /data-kw-placeholder/i,
      /data-kw-caption-open/i,
      /data-egal/i,
      /tabindex/i,
      /\brole=/i,
      /aria-label/i,
    ]) {
      expect(amServer, `Der Sanitizer hat ${verboten} durchgelassen`).not.toMatch(verboten);
    }
    // Die figcaption trägt AUSSCHLIESSLICH data-image-id — keine Zeile mehr in der Allowlist.
    const attribute = /<figcaption([^>]*)>/.exec(amServer)?.[1] ?? "";
    expect(attribute.trim()).toMatch(/^data-image-id="kw-img-[a-z0-9]+-1"$/);
  });

  it("Client- und Server-Sanitizer urteilen über die verankerte Struktur GLEICH", () => {
    const imEditor = verankerterBody();
    expect(serverSanitize(imEditor)).toBe(sanitizeHtml(imEditor));
  });
});

// ================================================================================================
// JOB 1183 · D1 — DIE INVARIANTE WIRD GERUFEN, ABER NICHT ERZWUNGEN (I47, erstens).
// ================================================================================================
//
// DER BEFUND, den ben in `sammel88` benannt und ausdrücklich als NICHT-Blocker eingeordnet hat:
// „Die Invariante wird an allen bekannten Editor-Wegen gerufen, aber nicht an der Emissionsgrenze
// erzwungen — `emit()` ruft sie nicht; ein künftiger Weg über `appendChild`, `replaceChildren` oder
// `Range.insertNode` könnte an ihr vorbei schreiben. Der Sammler ist Diagnose, nicht Garantie."
//
// DIE EMISSIONSGRENZE, in diesem Durchgang belegt und nicht behauptet:
//
//     apps/web/src/components/RichTextEditor.tsx:448-455
//       const emit = (): void => {
//         const next = sanitizeHtml(ref.current?.innerHTML ?? "");
//         …
//       };
//
// `emit()` liest `innerHTML` und sanitisiert. `verankereFiguren` — die EINE Aufrufstelle der
// Invariante (`:464`) — kommt darin NICHT vor. Die Verankerung hängt an fünf getrennten Aufrufern
// (`:444`, `:508`, `:735`, `:1042`, `:1059`); wer an ihnen vorbei schreibt und dann `emit()` ruft,
// emittiert unverankerte Struktur.
//
// WAS DIESE FÄLLE TUN — und was sie ausdrücklich NICHT tun: Sie stellen den heutigen Zustand für
// JEDE der drei genannten Schreibformen EINZELN fest (eine Form allein bewiese nur sich selbst).
// Sie ERZWINGEN nichts: der Verschluss läge in `emit()`, und `emit()` ist in diesem Durchgang
// ausdrücklich nicht geleast. Was hier steht, ist die Diagnose in ihrer belegten Form — damit ein
// späterer Durchgang sie nicht noch einmal erheben muss.
describe("JOB 1183: die Emissionsgrenze erzwingt die Invariante nicht", () => {
  /** Ein Bild in einen Editor-Body bringen — auf einem Weg, der KEINE Zuweisung an innerHTML ist. */
  const WEGE: Array<{ name: string; schreibe: (root: ElementLike) => void }> = [
    {
      name: "appendChild",
      schreibe: (root) => {
        const img = doc.createElement("img");
        img.setAttribute("src", TINY);
        img.setAttribute("alt", "über appendChild");
        (root as unknown as { appendChild(k: unknown): void }).appendChild(img);
      },
    },
    {
      name: "replaceChildren",
      schreibe: (root) => {
        const img = doc.createElement("img");
        img.setAttribute("src", TINY);
        img.setAttribute("alt", "über replaceChildren");
        (root as unknown as { replaceChildren(...k: unknown[]): void }).replaceChildren(img);
      },
    },
    {
      name: "Range.insertNode",
      schreibe: (root) => {
        const img = doc.createElement("img");
        img.setAttribute("src", TINY);
        img.setAttribute("alt", "über Range.insertNode");
        const bereich = (
          globalThis as unknown as { document: { createRange(): unknown } }
        ).document.createRange() as {
          selectNodeContents(n: unknown): void;
          collapse(b: boolean): void;
          insertNode(n: unknown): void;
        };
        bereich.selectNodeContents(root);
        bereich.collapse(false);
        bereich.insertNode(img);
      },
    },
  ];

  for (const weg of WEGE) {
    it(`${weg.name}: schreibt an der Invariante vorbei — und emit() holt sie NICHT nach`, () => {
      const root = wurzelMit("<p>Text</p>");
      weg.schreibe(root);

      // 1. Das Bild ist da und UNVERANKERT — kein Editor-Weg hat die Invariante gerufen.
      const nachSchreiben = urteile(root);
      expect(nachSchreiben.bilder, `${weg.name}: das Bild ist gar nicht angekommen`).toBe(1);
      expect(
        nachSchreiben.verankert,
        `${weg.name}: unerwartet bereits verankert — dann erzwingt etwas die Invariante, das dieser Fall nicht kennt`,
      ).toBe(0);

      // 2. DIE EMISSIONSGRENZE: genau das, was `emit()` tut — `sanitizeHtml` über `innerHTML`.
      //    Sie stellt die Invariante NICHT her; das unverankerte Bild verlässt den Editor so.
      const emittiert = sanitizeHtml(root.innerHTML);
      expect(
        emittiert,
        `${weg.name}: das Bild ist beim Emittieren verschwunden — dann misst dieser Fall nicht, was er soll`,
      ).toMatch(/<img[\s>]/);
      expect(
        /data-image-id/.test(emittiert),
        `${weg.name}: emit() hat die Verankerung nachgeholt — dann ist der Befund I47 (erstens) überholt und gehört ins Register`,
      ).toBe(false);

      // 3. Die Invariante WIRKT — sobald jemand sie ruft. Sie ist nicht kaputt, sie ist ungebunden.
      enhanceFiguresForEditing(root, "✎ …", "L");
      expect(
        urteile(root).verankert,
        `${weg.name}: die Invariante greift auf diesem Weg auch dann nicht, wenn sie gerufen wird`,
      ).toBe(1);
    });
  }

  it("UNAUFGELOEST: die Erzwingung an der Emissionsgrenze ist mit diesem Waechter nicht herstellbar", () => {
    // Lieferung 4 des Auftrags: was die Erhebung nicht sieht, wird ausdrücklich unaufgelöst
    // gemeldet statt still durchgelassen. Dieser Fall ist die Meldung — er hält fest, WAS fehlt und
    // WO der Verschluss läge, ohne ihn zu bauen.
    //
    // Der Verschluss wäre eine Zeile in `emit()` (RichTextEditor.tsx:448-455): dort die Verankerung
    // aufrufen, bevor `sanitizeHtml` läuft. Das ist Produktcode und in diesem Durchgang NICHT
    // geleast — und es ist womöglich eine Architekturfrage, weil `emit()` heute bewusst nur liest.
    //
    // Solange das offen ist, gilt bens Satz unverändert: der Sammler ist Diagnose, nicht Garantie.
    // Dieser Fall ist grün, weil er eine RICHTIGE Aussage über den heutigen Zustand macht — er
    // behauptet keine Erzwingung.
    const root = wurzelMit("<p>Text</p>");
    const img = doc.createElement("img");
    img.setAttribute("src", TINY);
    (root as unknown as { appendChild(k: unknown): void }).appendChild(img);

    expect(
      /data-image-id/.test(sanitizeHtml(root.innerHTML)),
      "Die Emissionsgrenze verankert inzwischen doch — dann ist I47 (erstens) erledigt und dieser " +
        "Fall gehört ersetzt, nicht angepasst",
    ).toBe(false);
  });
});
