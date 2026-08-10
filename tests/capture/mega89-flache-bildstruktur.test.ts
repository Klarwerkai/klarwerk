// @vitest-environment jsdom
// AUFTRAG-mega89 Block A — FLACH STATT VERSCHACHTELT: EINE FIGURE JE BILD.
//
// DER BEFUND (ben in sammel88, der letzte Ship-Blocker; vom Kopf am Quelltext nachgemessen).
// `ensureImageAnchors` prüfte mit `figure.querySelector(":scope > img") === img`, ob ein Bild das
// erste direkte Kind seiner figure ist. Ist es das NICHT — zwei Bilder in EINER figure, wie
// Word-Markup es liefert —, ersetzte `img.outerHTML = "<figure>…</figure>"` das zweite Bild
// INNERHALB der äußeren figure durch eine weitere figure. Es entstand eine VERSCHACHTELUNG, und aus
// ihr folgten zwei Datenschäden:
//
//   · Im Formular: `openCaptionFormFor` suchte `image.closest("figure")?.querySelector("figcaption")`
//     — ohne `:scope >`, also über beliebige Nachfahren. Für das ERSTE Bild konnte damit die INNERE
//     Fußnote des zweiten gefunden werden. Bild 1 bekam die Beschreibung von Bild 2.
//   · In der Galerie: `extractBodyImages` zerlegte mit `/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi` —
//     NICHT-GIERIG, die äußere figure endete also am INNEREN `</figure>`. Das erste Bild wurde mit
//     der ersten inneren Fußnote kombiniert, und der zweite Galerieeintrag ging VERLOREN.
//
// Die vorhandenen Tests sahen das nicht: sie zählten Anker oder arbeiteten mit zwei bereits
// getrennten figures. Diese Datei pinnt die STRUKTUR, die beide Schäden unmöglich macht.
//
// DIE REGEL FÜR VORHANDENEN BESCHREIBUNGSTEXT (Auftrag, wörtlich): eine bereits vorhandene Fußnote
// gehört dem ERSTEN Bild ihrer eingehenden figure; jedes weitere Bild bekommt eine LEERE. Kein
// vorhandener Text geht verloren und keiner wandert an ein anderes Bild. Genau das wird hier
// gemessen — nicht die Anwesenheit einer Funktion.
//
// GRENZE, benannt statt verschwiegen: hier steht STRUKTURlogik in jsdom. Die Aussage über den
// echten Browser (zwei Bilder laden, getrennt beschreiben, speichern, wieder öffnen) steht in
// `tests-smoke/mega89-mehrbild-browser.spec.ts` — die Lehre aus mega87 gilt weiter.
import { describe, expect, it } from "vitest";
import { type EditableElement, ensureImageAnchors } from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
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

/** Was der Nutzer am Ende hat: je Bild eine figure, und was in ihrer Fußnote steht. */
interface Paar {
  src: string | null;
  id: string | null;
  fussnote: string;
  fussnoteId: string | null;
}

/**
 * Liest die FLACHE Struktur aus: nur figures, die selbst keine figure enthalten, und je figure das
 * Bild und die DIREKTE Fußnote. Bewusst so gelesen, dass eine Verschachtelung auffällt statt sich
 * zu verstecken — `verschachtelt` wird getrennt gezählt.
 */
function struktur(root: ElementLike): { paare: Paar[]; verschachtelt: number } {
  const paare: Paar[] = [];
  for (const figure of root.querySelectorAll("figure")) {
    const img = figure.querySelector(":scope > img");
    if (img === null) {
      continue;
    }
    const cap = figure.querySelector(":scope > figcaption");
    paare.push({
      src: img.getAttribute("src"),
      id: img.getAttribute("data-image-id"),
      fussnote: (cap?.textContent ?? "").trim(),
      fussnoteId: cap?.getAttribute("data-image-id") ?? null,
    });
  }
  return { paare, verschachtelt: Array.from(root.querySelectorAll("figure figure")).length };
}

// Genau das Markup, das aus Word kommt: EINE figure, ZWEI Bilder, EINE Fußnote.
const AUS_WORD_ZWEI = [
  "<h2>Befund</h2>",
  '<figure><img src="/api/objects/bild-a/raw" alt="Schiene">',
  '<img src="/api/objects/bild-b/raw" alt="Lager">',
  "<figcaption>Riefen in Laufrichtung</figcaption></figure>",
].join("");

const AUS_WORD_DREI = [
  '<figure><img src="/api/objects/bild-a/raw">',
  '<img src="/api/objects/bild-b/raw">',
  '<img src="/api/objects/bild-c/raw">',
  "<figcaption>Riefen in Laufrichtung</figcaption></figure>",
].join("");

// Der Bestand, den die FEHLERHAFTE Fassung im Arbeitsbaum bereits erzeugt haben kann: die zweite
// figure liegt INNERHALB der ersten. Sie muss beim Öffnen mit aufgelöst werden — dieselbe
// Normalisierung, kein zweiter Mechanismus.
const SCHON_VERSCHACHTELT = [
  '<figure><img src="/api/objects/bild-a/raw" data-image-id="kw-img-alt-1">',
  '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-alt-2">',
  '<figcaption data-image-id="kw-img-alt-2"></figcaption></figure>',
  '<figcaption data-image-id="kw-img-alt-1">Riefen in Laufrichtung</figcaption></figure>',
].join("");

describe("AUFTRAG-mega89 Block A: zwei Bilder in einer figure werden zwei flache figures", () => {
  it("keine figure liegt mehr in einer figure", () => {
    const root = wurzelMit(AUS_WORD_ZWEI);
    ensureImageAnchors(root);
    expect(
      struktur(root).verschachtelt,
      "Eine figure liegt in einer figure. Genau daraus folgen die falsche Zuordnung im Formular und der verlorene Galerieeintrag.",
    ).toBe(0);
  });

  it("es entstehen zwei figures mit zwei VERSCHIEDENEN Kennungen", () => {
    const root = wurzelMit(AUS_WORD_ZWEI);
    const verankert = ensureImageAnchors(root);
    const { paare } = struktur(root);
    expect(paare.length, "Aus zwei Bildern sind nicht zwei flache figures geworden").toBe(2);
    expect(verankert, "Die Wirkung wird nicht gemeldet").toBeGreaterThan(0);
    for (const p of paare) {
      expect(p.id ?? "").toMatch(KENNUNG);
      expect(p.fussnoteId, "Bild und Fußnote tragen nicht dieselbe Kennung").toBe(p.id);
    }
    expect(new Set(paare.map((p) => p.id)).size, "Beide Bilder tragen dieselbe Kennung").toBe(2);
  });

  it("die vorhandene Fußnote steht am ERSTEN Bild, das zweite hat eine leere", () => {
    const root = wurzelMit(AUS_WORD_ZWEI);
    ensureImageAnchors(root);
    const { paare } = struktur(root);
    expect(paare[0]?.src, "Die ursprüngliche Reihenfolge der Bilder ist verloren").toBe(
      "/api/objects/bild-a/raw",
    );
    expect(paare[1]?.src).toBe("/api/objects/bild-b/raw");
    expect(
      paare[0]?.fussnote,
      "Der vorhandene Beschreibungstext ist nicht beim ersten Bild geblieben",
    ).toBe("Riefen in Laufrichtung");
    expect(
      paare[1]?.fussnote,
      "Der Text des ERSTEN Bildes ist an das zweite gewandert — genau der Datenschaden",
    ).toBe("");
  });

  it("drei Bilder ergeben drei flache figures, Text nur am ersten", () => {
    const root = wurzelMit(AUS_WORD_DREI);
    ensureImageAnchors(root);
    const { paare, verschachtelt } = struktur(root);
    expect(verschachtelt).toBe(0);
    expect(paare.map((p) => p.src)).toEqual([
      "/api/objects/bild-a/raw",
      "/api/objects/bild-b/raw",
      "/api/objects/bild-c/raw",
    ]);
    expect(paare.map((p) => p.fussnote)).toEqual(["Riefen in Laufrichtung", "", ""]);
    expect(new Set(paare.map((p) => p.id)).size).toBe(3);
  });

  it("kein Text geht verloren: der Beschreibungstext kommt genau EINMAL vor", () => {
    const root = wurzelMit(AUS_WORD_ZWEI);
    ensureImageAnchors(root);
    const treffer = root.innerHTML.match(/Riefen in Laufrichtung/g) ?? [];
    expect(treffer.length, "Der vorhandene Text ist verschwunden oder verdoppelt worden").toBe(1);
  });

  it("bereits verschachtelter Bestand wird beim Öffnen MIT aufgelöst — dieselbe Normalisierung", () => {
    const root = wurzelMit(SCHON_VERSCHACHTELT);
    ensureImageAnchors(root);
    const { paare, verschachtelt } = struktur(root);
    expect(verschachtelt, "Die vorhandene Verschachtelung ist geblieben").toBe(0);
    expect(paare.map((p) => p.src)).toEqual(["/api/objects/bild-a/raw", "/api/objects/bild-b/raw"]);
    expect(
      paare.map((p) => p.id),
      "Die schon vergebenen Kennungen wurden neu vergeben — jede offene Bitte der Galerie zeigte danach ins Leere",
    ).toEqual(["kw-img-alt-1", "kw-img-alt-2"]);
    expect(paare.map((p) => p.fussnote)).toEqual(["Riefen in Laufrichtung", ""]);
  });

  it("FIXPUNKT: ein zweiter Lauf ändert nichts mehr", () => {
    const root = wurzelMit(AUS_WORD_DREI);
    ensureImageAnchors(root);
    const einmal = root.innerHTML;
    const nochmal = ensureImageAnchors(root);
    expect(root.innerHTML, "Der zweite Lauf hat die Struktur erneut verändert").toBe(einmal);
    expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
  });

  it("die flache Struktur übersteht beide Sanitizer unverändert", () => {
    const root = wurzelMit(AUS_WORD_ZWEI);
    ensureImageAnchors(root);
    const vorher = struktur(root).paare;
    const rundlauf = sanitizeHtml(serverSanitize(sanitizeHtml(root.innerHTML)));
    const nachher = struktur(wurzelMit(rundlauf));
    expect(nachher.verschachtelt).toBe(0);
    expect(
      nachher.paare.map((p) => ({ src: p.src, id: p.id, fussnote: p.fussnote })),
      "Der Rundlauf über beide Sanitizer hat die Zuordnung verändert",
    ).toEqual(vorher.map((p) => ({ src: p.src, id: p.id, fussnote: p.fussnote })));
  });
});
