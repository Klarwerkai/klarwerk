// ================================================================================================
// JOB 3282 · EDITOR-R26 — WOHIN EIN BLOCK GEHÖRT, UND WARUM DAS NICHT DIE ENGINE ENTSCHEIDEN DARF.
// ================================================================================================
//
// DER BELEGTE BEFUND (Codex, Nutzerprüfung review26-ki-editor, 08.09., Live 1.185): „In der
// anschließenden Kombination mit Liste bzw. vorhandenem Hinweisblock erschienen weitere Typen teils
// nur als … oder farbige Spans; nach Reload blieb nur der Hinweisblock."
//
// DIE URSACHE, an der Quelle nachgelesen: `addBlock` fügte das Snippet aus `editorBlocks.ts` über
// `document.execCommand("insertHTML", …)` ein. Dieser Befehl fügt AN DER EINFÜGEMARKE ein, und die
// steht beim beschriebenen Vorgehen in einem `<li>` oder in einem vorhandenen `.panel`. Ein
// `<div>` ist dort kein gültiges Kind im Sinne dessen, was die Engine daraus macht: sie darf den
// Container auflösen und nur den Inhalt („…") oder ein Ersatz-Inline-Element stehen lassen. Was
// nie als `div.panel` im Rumpf steht, kann auch der Sanitizer nicht retten — nach dem Reload war
// deshalb nur noch da, was zufällig ganz oben eingefügt worden war.
//
// DIE ENTSCHEIDUNG: Ein Block ist ein ABSCHNITT, kein Inline-Zeichen. Er wird deshalb nicht „an der
// Marke" eingefügt, sondern als GESCHWISTER hinter dem obersten Abschnitt, in dem die Marke gerade
// steht — bei einer Liste hinter der ganzen `<ul>`, bei einem vorhandenen Block hinter diesem
// Block, bei einem Absatz hinter dem Absatz. Das ist deterministisch, unabhängig von der Engine
// und in jsdom fahrbar; `execCommand` ist an dieser Stelle weder nötig noch verlässlich.
//
// WAS HIER NICHT NEU ENTSTEHT: Klassen und Reihenfolge der Blocktypen bleiben in `editorBlocks.ts`
// (dieselbe Allowlist wie in `richText.ts` und `services/structure/src/sanitize.ts`). Diese Datei
// baut den Knoten nur aus dem, was dort schon entschieden ist — keine zweite Wahrheit über das,
// was ein Block ist.
import { type EditorBlock, editorBlockClass } from "./editorBlocks";

// Derselbe Platzhalter wie bisher (`editorBlockHtml`): ein sichtbares Zeichen, das sagt „hier
// gehört dein Text hin", statt eines leeren Absatzes, in dem die Einfügemarke unsichtbar wäre.
export const EDITOR_BLOCK_PLATZHALTER = "…";

/**
 * Der OBERSTE Abschnitt des Schreibfeldes, in dem `bereich` liegt — also der direkte Kindknoten
 * von `el`, unter dem die Einfügemarke steht. `null` heisst: kein brauchbarer Bezug (kein Bereich,
 * Bereich ausserhalb des Feldes, oder das Feld ist leer). Dann gehört der Block ans Ende.
 */
export function abschnittImSchreibfeld(el: HTMLElement, bereich: Range | null): ChildNode | null {
  if (!bereich || !el.contains(bereich.commonAncestorContainer)) {
    return null;
  }
  // Gemessen wird am ENDE des Bereichs, nicht an seinem gemeinsamen Vorfahren: umspannt die Auswahl
  // mehrere Abschnitte, ist der Vorfahr das Feld selbst und sagt nichts darüber, WO sie aufhört.
  // Der Block gehört hinter das Markierte, also hinter den zuletzt berührten Abschnitt.
  let knoten: Node = bereich.endContainer;
  if (knoten === el) {
    return el.childNodes[Math.max(0, bereich.endOffset - 1)] ?? null;
  }
  while (knoten.parentNode && knoten.parentNode !== el) {
    knoten = knoten.parentNode;
  }
  return knoten.parentNode === el ? (knoten as ChildNode) : null;
}

/**
 * Fügt den Block als eigenständigen Abschnitt ein und gibt ihn zurück. Der Aufrufer setzt danach
 * die Auswahl (und meldet den neuen Stand nach oben) — das ist Sache des Editors, nicht dieser
 * Datei.
 */
export function fuegeBlockEin(
  el: HTMLElement,
  block: EditorBlock,
  bereich: Range | null,
): HTMLElement {
  const dok = el.ownerDocument;
  const huelle = dok.createElement("div");
  huelle.className = editorBlockClass(block);
  const absatz = dok.createElement("p");
  // `textContent` und nicht `innerHTML`: der Platzhalter ist Text, und Text wird hier nicht geparst.
  absatz.textContent = EDITOR_BLOCK_PLATZHALTER;
  huelle.appendChild(absatz);

  const abschnitt = abschnittImSchreibfeld(el, bereich);
  if (abschnitt) {
    abschnitt.after(huelle);
  } else {
    el.appendChild(huelle);
  }
  return huelle;
}
