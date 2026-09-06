// @vitest-environment jsdom
// ================================================================================================
// JOB 3107 · Q5b Teil 1 — EINE VON AUSSEN GEKOMMENE FASSUNG GEHT NICHT VERLOREN
// ================================================================================================
//
// DER BEFUND, den Codex in JOB 3083 eigenständig gemessen und bewusst nicht repariert hat
// (`archiv/3083/runde-1/RUECKGABE.md`, REST, zweiter Punkt): „äußerer Editor fokussiert →
// Studio-Übernahme → `koerper` korrekt, äußeres DOM alt → ein `focusout` → `koerper` wieder auf dem
// alten Stand (leere Bildfußnote + verwaiste `figcaption`)".
//
// Die Ursache liegt an zwei Stellen im `RichTextEditor`, und beide gehören zusammen:
//   (1) Der Fokus-Guard des Wert-Effekts VERWARF eine abweichende Fassung, wenn die Einfügemarke im
//       Editor lag — ohne jeden Nachholweg. Seine Abhängigkeiten sind `[value, mode]`; der
//       Fokuswechsel ist keine davon, der Effekt lief also nie wieder.
//   (2) `onBlur={emit}` liest danach das ALTE DOM, sanitisiert es und meldet es nach oben, weil es
//       vom neueren `value` abweicht — die ältere Fassung ersetzt die neuere.
//
// GEMESSEN WIRD DESHALB IMMER BEIDES: das `innerHTML` des Editors (was die Autorin sieht) UND der
// Wert beim Verbraucher (was gespeichert würde). Ein Anzeigefix ohne Meldung nach oben wäre beim
// nächsten Speichern wieder verloren; eine Meldung ohne Anzeige wäre eine Fläche, die lügt.
//
// Der Host ist der echte Verbraucher: EIN Zustand, den der Editor über `onChange` schreibt und über
// `value` liest — und den eine dritte Quelle (KI-Vorschlag, Vorlage, Studio-Übernahme, Entwurf
// laden, Reset) über `setValue` von außen setzen kann. Genau das ist `hostSetValue`.
//
// react/react-dom liegen nur in `apps/web/node_modules` — relativer Import wie in allen gemounteten
// Editor-Tests seit WP-D8b (`tests/capture/editor-figure-caption-mounted.test.tsx`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALT = "<p>Alter Stand der Autorin</p>";
const FREMD = "<p>Fassung von aussen</p>";

/** Fixture mit Bild-Fußnote — der WP-D8-Fall: die figcaption ist ein eigener Fokusträger im Editor. */
const MIT_FUSSNOTE = [
  "<p>Alter Stand der Autorin</p>",
  '<figure data-image-id="kw-img-3107-1">',
  '<img data-image-id="kw-img-3107-1" alt="Bild" src="/api/objects/x/raw">',
  '<figcaption data-image-id="kw-img-3107-1">Alte Bildunterschrift</figcaption></figure>',
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Ein Fokusziel AUSSERHALB des Editors — „irgendwohin ausserhalb klicken" aus dem Auftrag §1. */
let draussen: HTMLButtonElement;
let hostSetValue: ((next: string) => void) | null = null;
/** Was beim Verbraucher steht — also das, was gespeichert würde. */
let hostValue = "";
/** Jede Emission des Editors, in Reihenfolge. */
let emitted: string[] = [];

function Host({ initial }: { initial: string }): JSX.Element {
  const [value, setValue] = useState(initial);
  hostSetValue = setValue;
  hostValue = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        emitted.push(html);
        setValue(html);
      },
    }),
  );
}

/**
 * DERSELBE EDITOR AN EINEM VERBRAUCHER, DER `onChange` NICHT ZURÜCKGIBT (F8).
 *
 * `Host` oben ist der Regelfall: er schreibt jede Emission sofort als neues `value` zurück
 * (`KnowledgeInputStudio` macht es genauso). Dieser hier hört nur zu. Das ist kein Kunstgriff,
 * sondern die Grenze der Zusage: `onChange` sagt „hier ist der neue Inhalt" — dass er als `value`
 * zurückkommt, verspricht kein Prop. Ein Verbraucher, der bündelt, verzögert oder ablehnt, ist
 * jederzeit erlaubt.
 *
 * Der Unterschied ist messbar: am Regel-Host löscht der Wert-Effekt den Merker ohnehin, sobald die
 * Emission als `value` zurückkommt (`value === lastEmittedRef`). Ohne diese Rückgabe bleibt allein
 * die Löschung in `emit()` — und ohne sie überschriebe die vertagte Fremdfassung beim Fokusverlust
 * den Text, den die Autorin gerade getippt hat.
 */
function StummerHost({ initial }: { initial: string }): JSX.Element {
  const [value, setValue] = useState(initial);
  hostSetValue = setValue;
  hostValue = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        emitted.push(html);
      },
    }),
  );
}

function mount(initial: string, welcher: typeof Host = Host): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(welcher, { initial }));
  });
}

function editorEl(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Editor nicht gerendert");
  }
  return el;
}

function figcaptionEl(): HTMLElement {
  const el = container.querySelector("figcaption");
  if (!(el instanceof HTMLElement)) {
    throw new Error("figcaption nicht gerendert");
  }
  return el;
}

/** Der Fokusverlust, wie der Browser ihn liefert: ein BUBBELNDES focusout (React hängt `onBlur`
 *  daran). Wird bewusst am fokussierten Knoten ausgelöst — auch wenn das die figcaption ist.
 *
 *  `relatedTarget` ist der Knoten, der den Fokus BEKOMMT — hier also einer ausserhalb des Editors.
 *  Der Browser setzt ihn immer; `document.activeElement` steht während `focusout` dagegen schon auf
 *  `body`, taugt an dieser Stelle also nicht als Auskunft über das Ziel. */
function verlasseEditor(von: HTMLElement): void {
  act(() => {
    von.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: draussen }));
  });
}

/**
 * DER FOKUS WANDERT INNERHALB DES EDITORS — von der Fläche in eine Bild-Fußnote oder zurück.
 *
 * Das ist KEIN Verlassen des Editors, sieht aber genauso aus: `focusout` bubbelt, React meldet es
 * am contentEditable als `onBlur`, und `document.activeElement` ist in diesem Moment `body`. Die
 * Auskunft, die den Unterschied trägt, ist deshalb `relatedTarget`.
 */
function wechsleFokusInnerhalb(von: HTMLElement, nach: HTMLElement): void {
  act(() => {
    von.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: nach }));
    nach.focus();
  });
}

/** Die Autorin tippt: DOM ändern und `input` feuern — derselbe Weg wie in
 *  `tests/capture/richtext-emission-marker.test.tsx`. */
function tippe(html: string): void {
  act(() => {
    const el = editorEl();
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function modusKnopf(): HTMLElement {
  const titel = i18n.t("editor.preview");
  const titelZurueck = i18n.t("editor.edit");
  for (const b of container.querySelectorAll("button")) {
    const t = b.getAttribute("title");
    if (t === titel || t === titelZurueck) {
      return b as HTMLElement;
    }
  }
  throw new Error("Modus-Knopf nicht gefunden");
}

beforeEach(() => {
  emitted = [];
  hostValue = "";
  draussen = document.createElement("button");
  draussen.textContent = "draussen";
  document.body.appendChild(draussen);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  draussen.remove();
  hostSetValue = null;
});

describe("JOB 3107 · Q5b Teil 1: die Fremdfassung bei liegender Einfügemarke", () => {
  it("F1: Fokus im Editor → Fassung von aussen → Fokusverlust → die neue Fassung steht im Editor UND beim Verbraucher", () => {
    mount(ALT);
    const el = editorEl();
    act(() => {
      el.focus();
    });
    expect(document.activeElement).toBe(el);

    // Die Fremdquelle setzt den Wert (KI-Vorschlag übernehmen, Vorlage anwenden, Studio-Übernahme).
    act(() => {
      hostSetValue?.(FREMD);
    });
    // Solange die Einfügemarke steht, wird NICHT unter ihr geschrieben — das ist die Zusage aus
    // WP-D8 (Pedis Live-ROT A) und bleibt so. Die Fassung ist damit VERTAGT, nicht verworfen.
    expect(el.innerHTML).toContain("Alter Stand");

    verlasseEditor(el);

    // Jetzt — und erst jetzt — sieht die Autorin die Fassung.
    expect(editorEl().innerHTML).toContain("Fassung von aussen");
    expect(editorEl().innerHTML).not.toContain("Alter Stand");
    // Und der Verbraucher hat sie auch: kein Rückschreiben des alten DOM-Standes.
    expect(hostValue).toContain("Fassung von aussen");
    expect(hostValue).not.toContain("Alter Stand");
    expect(emitted).not.toContain(ALT);
  });

  it("F2: Fokus IN der Bild-Fußnote (WP-D8) → dieselbe Zusage; der fokussierte Knoten überlebt bis zum Fokusverlust", () => {
    mount(MIT_FUSSNOTE);
    const caption = figcaptionEl();
    const el = editorEl();
    act(() => {
      caption.focus();
    });
    // Der Fokus liegt auf einem NACHFAHREN, nicht auf dem Editor-Container — genau die Kante, für
    // die der Guard `contains` prüft und nicht Identität.
    expect(document.activeElement).toBe(caption);
    expect(document.activeElement).not.toBe(el);

    act(() => {
      hostSetValue?.(FREMD);
    });
    // GEGENPROBE ZUM GUARD (Prüfpunkt 4, die naheliegende Halbheit „Guard einfach entfernen"):
    // Solange die Einfügemarke in der Fußnote steht, wird der Teilbaum NICHT neu aufgebaut — der
    // Knoten unter dem Fokus bleibt derselbe und behält den Fokus.
    expect(container.querySelector("figcaption")).toBe(caption);
    expect(caption.isConnected).toBe(true);
    expect(document.activeElement).toBe(caption);

    verlasseEditor(caption);

    expect(container.querySelector("figcaption")).toBeNull();
    expect(caption.isConnected).toBe(false);
    expect(editorEl().innerHTML).toContain("Fassung von aussen");
    expect(hostValue).toContain("Fassung von aussen");
    expect(hostValue).not.toContain("Alte Bildunterschrift");
  });

  it("F3: die Autorin gewinnt — hat sie nach der Fremdfassung getippt, überschreibt diese ihren Text nicht", () => {
    mount(ALT);
    const el = editorEl();
    act(() => {
      el.focus();
    });
    act(() => {
      hostSetValue?.(FREMD);
    });

    // Sie tippt weiter, ohne die Fremdfassung je gesehen zu haben.
    tippe("<p>Selbst geschrieben</p>");

    verlasseEditor(editorEl());

    expect(editorEl().innerHTML).toContain("Selbst geschrieben");
    expect(editorEl().innerHTML).not.toContain("Fassung von aussen");
    expect(hostValue).toContain("Selbst geschrieben");
    expect(hostValue).not.toContain("Fassung von aussen");
  });

  it("F4: der Moduswechsel löscht den Merker — nachgeschrieben wird nie eine überholte Fassung", () => {
    mount(ALT);
    const el = editorEl();
    act(() => {
      el.focus();
    });
    act(() => {
      hostSetValue?.("<p>Zwischenfassung</p>");
    });
    expect(el.innerHTML).toContain("Alter Stand");

    // Statt eines Fokusverlusts: Vorschau an, eine NEUERE Fassung von aussen, Vorschau aus.
    act(() => {
      modusKnopf().click();
    });
    act(() => {
      hostSetValue?.("<p>Aktuellste Fassung</p>");
    });
    act(() => {
      modusKnopf().click();
    });

    expect(editorEl().innerHTML).toContain("Aktuellste Fassung");
    expect(editorEl().innerHTML).not.toContain("Zwischenfassung");

    // Und auch ein späterer Fokusverlust holt die überholte Zwischenfassung nicht mehr nach.
    const neu = editorEl();
    act(() => {
      neu.focus();
    });
    verlasseEditor(neu);
    expect(editorEl().innerHTML).toContain("Aktuellste Fassung");
    expect(hostValue).toContain("Aktuellste Fassung");
    expect(hostValue).not.toContain("Zwischenfassung");
  });

  it("F5: Tippen bei unverändertem `value` setzt das innerHTML nicht neu (Pedis Live-ROT A bleibt zu)", () => {
    mount(MIT_FUSSNOTE);
    const caption = figcaptionEl();
    const bild = container.querySelector("img");
    act(() => {
      caption.focus();
    });

    // Die Autorin arbeitet im Editor: der Rumpf ändert sich durch IHRE Eingabe, nicht von aussen.
    const el = editorEl();
    act(() => {
      el.appendChild(document.createElement("p")).textContent = "Weiterer Absatz";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Der Teilbaum unter der Einfügemarke wurde nicht angefasst: Knoten-Identität und Fokus stehen.
    expect(container.querySelector("figcaption")).toBe(caption);
    expect(container.querySelector("img")).toBe(bild);
    expect(document.activeElement).toBe(caption);
    expect(editorEl().innerHTML).toContain("Weiterer Absatz");

    // Auch der Fokusverlust ohne vertagte Fassung verhält sich wie bisher: der Editor behält, was
    // die Autorin geschrieben hat, und der Verbraucher hat es.
    verlasseEditor(caption);
    expect(editorEl().innerHTML).toContain("Weiterer Absatz");
    expect(hostValue).toContain("Weiterer Absatz");
  });

  it("F7: der Fokus wandert INNERHALB des Editors in die Bild-Fußnote — die Fassung bleibt vertagt, es wird weder unter der Einfügemarke geschrieben noch der alte Stand gemeldet", () => {
    mount(MIT_FUSSNOTE);
    const el = editorEl();
    const caption = figcaptionEl();
    const bild = container.querySelector("img");
    act(() => {
      el.focus();
    });

    act(() => {
      hostSetValue?.(FREMD);
    });
    expect(el.innerHTML).toContain("Alter Stand");

    // SIE KLICKT IN DIE BILDUNTERSCHRIFT. Für den Editor sieht das aus wie ein Fokusverlust:
    // `focusout` bubbelt vom Editor-Container hoch, React meldet `onBlur`, und `activeElement` ist
    // in diesem Moment `body`. Der Editor wurde aber NICHT verlassen — die Einfügemarke steht jetzt
    // in der Fußnote. Würde hier nachgeholt, bräche der Teilbaum unter ihrer Einfügemarke weg:
    // genau Pedis Live-ROT A, wieder aufgerissen von der Reparatur, die ihn schützen soll.
    wechsleFokusInnerhalb(el, caption);

    expect(container.querySelector("figcaption")).toBe(caption);
    expect(container.querySelector("img")).toBe(bild);
    expect(caption.isConnected).toBe(true);
    expect(document.activeElement).toBe(caption);
    expect(editorEl().innerHTML).toContain("Alter Stand");
    // Und der alte DOM-Stand darf ebenso wenig nach oben gemeldet werden: die vertagte Fassung ist
    // die neuere, ein `emit()` von hier würde sie beim Verbraucher durch die ältere ersetzen —
    // exakt der Rückschreibeschaden, gegen den dieser Auftrag gebaut ist.
    expect(emitted).toEqual([]);
    expect(hostValue).toBe(FREMD);

    // ERST das echte Verlassen holt sie nach — die Vertagung hat den Fokuswechsel überlebt.
    verlasseEditor(caption);
    expect(editorEl().innerHTML).toContain("Fassung von aussen");
    expect(hostValue).toContain("Fassung von aussen");
    expect(hostValue).not.toContain("Alte Bildunterschrift");
  });

  it("F8: die Autorin gewinnt auch an einem Verbraucher, der `onChange` nicht als `value` zurückgibt — der Merker stirbt in `emit()`, nicht erst auf dem Rückweg", () => {
    mount(ALT, StummerHost);
    const el = editorEl();
    act(() => {
      el.focus();
    });
    act(() => {
      hostSetValue?.(FREMD);
    });
    expect(el.innerHTML).toContain("Alter Stand");

    // Sie tippt. Der Verbraucher hört die Emission, gibt sie aber NICHT als `value` zurück — der
    // Wert-Effekt läuft deshalb nicht, und sein Zweig `value === lastEmittedRef` kann den Merker
    // nicht löschen. Bleibt er stehen, zieht der Fokusverlust ihr den Text unter der Hand weg.
    tippe("<p>Selbst geschrieben</p>");
    expect(hostValue).toBe(FREMD);
    expect(emitted.at(-1)).toContain("Selbst geschrieben");

    verlasseEditor(editorEl());

    expect(editorEl().innerHTML).toContain("Selbst geschrieben");
    expect(editorEl().innerHTML).not.toContain("Fassung von aussen");
    expect(emitted.at(-1)).toContain("Selbst geschrieben");
  });

  it("F6 (U8 bleibt): ein Fokusverlust OHNE vertagte Fassung verhält sich unverändert — kein onChange, wenn sich nichts geändert hat", () => {
    mount(ALT);
    const el = editorEl();
    act(() => {
      el.focus();
    });
    verlasseEditor(el);
    expect(emitted).toEqual([]);
    expect(editorEl().innerHTML).toContain("Alter Stand");
  });
});
