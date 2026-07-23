// WP-BILD-1f (Pedi 22.07.): umgebender Dokument-Kontext für den KI-Fußnoten-Vorschlag. Damit die
// vorgeschlagene Fußnote fachsprachlich passt (echte Produkt-/Bauteilnamen statt generischer
// Beschreibung), reicht der Editor beim describe-Aufruf zusätzlich den Klartext-Kontext um das Bild
// mit: Dokument-Titel + nächstliegende Überschrift + einige umgebende Absätze. Der Kontext reist
// AUSSCHLIESSLICH im selben Vision-Aufruf wie das Bild und damit durch dieselbe Vertraulichkeits-/
// Egress-Stelle — dieses Modul baut den Text NUR zusammen und kürzt ihn, es entscheidet nichts über
// Egress. HTML wird gestrippt (nur textContent); ein HARTES Zeichenbudget kappt Überschuss ehrlich.
// DOM-lib-frei (schmale Strukturtypen wie captionAiSuggest) — im Gate-tsc prüfbar und ohne Browser
// testbar; echte DOM-Elemente erfüllen die Strukturtypen strukturell.

// Hartes Client-Budget für den gesamten Kontext-String. Spiegelt den autoritativen Server-Deckel
// (MAX_IMAGE_CONTEXT_LENGTH in services/reasoner/src/provider-model.ts) — schon der Client kürzt, damit
// nichts unnötig ins Netz geht; der Server kappt danach nochmals verbindlich.
export const MAX_IMAGE_CONTEXT_CHARS = 1500;

// Wie viele Absätze rund um das Bild höchstens eingesammelt werden (je Richtung). Klein gehalten:
// der nahe Text trägt die Fachbegriffe; das Zeichenbudget bleibt der harte Backstop.
export const CONTEXT_PARAGRAPHS_EACH_SIDE = 2;

// Zeichenweise Whitespace-Normalisierung (mehrfacher Umbruch/Leerraum → ein Leerzeichen), damit der
// gestrippte HTML-Text kompakt bleibt und das Budget nicht an Layout-Leerraum verschwendet wird.
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export interface ImageContextParts {
  title?: string | null | undefined; // Dokument-Titel (aus dem Formular, kein HTML)
  heading?: string | null | undefined; // nächstliegende Überschrift ÜBER dem Bild (Klartext)
  paragraphs?: readonly string[] | undefined; // umgebende Absätze (Klartext, in Lese-Reihenfolge)
}

// Reine Zusammenstellung + Budgetkürzung — DOM-frei, damit im Gate ohne Browser testbar. Reihenfolge:
// Titel, dann Überschrift, dann Absätze. Jeder Teil wird whitespace-normalisiert; leere Teile fallen
// weg. Das Ergebnis wird HART auf MAX_IMAGE_CONTEXT_CHARS gekappt (Überschuss ehrlich abgeschnitten).
export function buildImageContext(parts: ImageContextParts): string {
  const lines: string[] = [];
  const title = normalizeWhitespace(parts.title ?? "");
  if (title) {
    lines.push(`Titel: ${title}`);
  }
  const heading = normalizeWhitespace(parts.heading ?? "");
  if (heading) {
    lines.push(`Abschnitt: ${heading}`);
  }
  for (const raw of parts.paragraphs ?? []) {
    const paragraph = normalizeWhitespace(raw);
    if (paragraph) {
      lines.push(paragraph);
    }
  }
  return lines.join("\n").slice(0, MAX_IMAGE_CONTEXT_CHARS).trim();
}

// Schmale, DOM-nahe Strukturtypen (statt HTMLElement) — Gate-tsc-tauglich (keine DOM-lib) und im
// jsdom-Test direkt erzeugbar. Nur die Fähigkeiten, die die Sammlung wirklich braucht; ein echtes
// Element/Document erfüllt sie strukturell.
export interface ContextNodeLike {
  readonly tagName: string;
  readonly textContent: string | null;
}
export interface ContextRootLike {
  querySelectorAll(selectors: string): Iterable<ContextNodeLike>;
}

// Sammelt aus dem Editor-DOM die Kontext-Teile rund um die Bild-Fußnote und baut daraus den
// budgetierten Kontext-String. `root` ist der contenteditable-Container, `figure` die <figure> mit dem
// Bild. Nächstliegende Überschrift = die letzte Überschrift VOR der Figur in Dokumentreihenfolge;
// umgebende Absätze = bis zu CONTEXT_PARAGRAPHS_EACH_SIDE <p> davor und danach. Fehlt etwas, wird der
// Teil einfach weggelassen (ehrlich weniger Kontext, nie erfunden).
export function collectImageContext(
  root: ContextRootLike,
  figure: ContextNodeLike,
  title?: string | null,
): string {
  // Alle Block-Kandidaten in Dokumentreihenfolge; die Figur dient als Anker.
  const blocks = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,figure"));
  const anchor = blocks.indexOf(figure);
  if (anchor === -1) {
    // Figur nicht im Baum (z. B. Detachment) → nur der Titel als Kontext.
    return buildImageContext({ title });
  }
  let heading: string | null = null;
  const before: string[] = [];
  for (let i = anchor - 1; i >= 0 && before.length < CONTEXT_PARAGRAPHS_EACH_SIDE; i -= 1) {
    const el = blocks[i];
    if (!el) {
      continue;
    }
    if (isHeading(el)) {
      heading = el.textContent;
      break; // die nächstliegende Überschrift begrenzt den Kontext nach oben
    }
    if (isParagraph(el)) {
      before.unshift(el.textContent ?? "");
    }
  }
  // Ist bis zum Absatz-Limit keine Überschrift aufgetaucht, weiter aufwärts NUR nach der Überschrift
  // suchen (ohne weitere Absätze) — die nächstliegende Überschrift ist der stärkste Fachbegriff-Anker.
  if (heading === null) {
    for (let i = anchor - 1 - before.length; i >= 0; i -= 1) {
      const el = blocks[i];
      if (el && isHeading(el)) {
        heading = el.textContent;
        break;
      }
    }
  }
  const after: string[] = [];
  for (
    let i = anchor + 1;
    i < blocks.length && after.length < CONTEXT_PARAGRAPHS_EACH_SIDE;
    i += 1
  ) {
    const el = blocks[i];
    if (!el) {
      continue;
    }
    if (isHeading(el)) {
      break; // der nächste Abschnitt gehört nicht mehr zum Bild-Kontext
    }
    if (isParagraph(el)) {
      after.push(el.textContent ?? "");
    }
  }
  return buildImageContext({ title, heading, paragraphs: [...before, ...after] });
}

function isHeading(el: ContextNodeLike): boolean {
  return /^h[1-6]$/i.test(el.tagName);
}

function isParagraph(el: ContextNodeLike): boolean {
  return el.tagName.toLowerCase() === "p";
}
