// ================================================================================================
// JOB 1612 · D1 (M-6, Anker D44) — DIE LEISTE. SIE ENTSCHEIDET NICHTS.
// ================================================================================================
//
// Die gesamte Auswertung liegt in `d44Gliederung.ts` und ist dort ohne Renderlauf geprueft. Diese
// Datei zeigt sie an und springt — mehr nicht.
//
// SIE NIMMT DAS ROHE bodyHtml, nicht die fertige Liste. Wer sie benutzt, kann die Auswertung
// nicht ueberspringen und dabei die Positionszusage verlieren.
//
// KEINE BESCHRIFTUNGEN IM CODE: `i18n.ts` gehoert PRO3. Die zwei Schluessel stehen in
// `D44_TEXTSCHLUESSEL` und sind in der Rueckgabe gemeldet.

import type { JSX } from "react";
import { useTranslation } from "react-i18next";
// Die Logik heisst `d44Struktur` und NICHT `d44Gliederung`: Dieses Dateisystem ist
// case-insensitiv, und `d44Gliederung.ts` neben `D44Gliederung.tsx` loeste den Import auf DIESE
// Datei auf — ein Selbstbezug, der als `undefined` beim Rendern ankam (gemessen).
import { d44Gliederung, d44LeisteZeigen, d44SichtbareEintraege } from "./d44Struktur";

/** Die i18n-Schluessel dieser Leiste. Eintragen darf sie nur PRO3. */
export const D44_TEXTSCHLUESSEL = {
  titel: "studio.d44.gliederung",
  leer: "studio.d44.keineUeberschriften",
} as const;

/**
 * Das Attribut, an dem die Leiste den Editor findet.
 *
 * Ein Attribut auf einem vorhandenen Element und KEIN neuer Wrapper: Ein zusaetzliches `<div>`
 * verschiebt den Pfad des Editors im Bauteilbaum, und `mega84-bildbeschreibungsweg-sammler` fuehrt
 * genau diese Pfade in einer Dispositionstabelle. Ein frueherer Anlauf hat das gemessen — zwei
 * rote Faelle fuer ein Element, das nichts tut.
 */
export const D44_EDITOR_MARKE = "data-kw-d44-flaeche";

export interface D44GliederungProps {
  /** Das rohe Body-HTML des Entwurfs — dieselbe Quelle, die der Editor rendert. */
  readonly bodyHtml: string;
}

export function D44Gliederung({ bodyHtml }: D44GliederungProps): JSX.Element | null {
  const { t } = useTranslation();
  const eintraege = d44Gliederung(bodyHtml);

  if (!d44LeisteZeigen(eintraege)) {
    // ============================================================================================
    // JOB 1860 · D2 — DER NULL-H2-ZWEIG ZEIGT SEINEN SCHLUESSEL.
    // ============================================================================================
    //
    // Hier stand bisher `return null` mit der Begruendung: „Eine leere Leiste waere eine Zusage,
    // die sie nicht halten kann." Der Satz bleibt richtig — und genau deshalb steht hier KEINE
    // leere Leiste, sondern ein Satz. Es gibt nichts anzuspringen, also gibt es auch keine
    // Sprungknoepfe und kein `<nav>`; was es gibt, ist die Auskunft, dass der Beitrag keine
    // Ueberschriften hat.
    //
    // WARUM UEBERHAUPT ETWAS: Ein Bauteil, das in diesem Fall gar nichts anzeigt, laesst den Leser
    // im Ungewissen, ob die Leiste kaputt ist oder das Dokument leer. Und `studio.d44.
    // keineUeberschriften` haette ohne diesen Zweig keinen Leser — genau der unbenutzte Code, den
    // die Aufrufer-Regel verbietet. Der Schluessel steht seit `527ae6b` in `i18n.ts` (dort: Z. 1095,
    // 5709, 9860 fuer DE, EN und NL); diese Datei benutzt ihn, sie legt ihn nicht an.
    //
    // WARUM EIN EIGENER TESTID UND NICHT `d44-gliederung`: `tests/web/d44-sprung-mounted.test.tsx`
    // sichert in M5 zu, dass `[data-testid="d44-gliederung"]` ohne Ueberschrift NICHT im Baum ist.
    // Diese Zusage bleibt unangetastet — der Hinweis ist keine Gliederungsleiste und traegt darum
    // seinen eigenen Traeger.
    //
    // Die `className` ist ein reines Literal, weil `mega47-modale-flaechen-sammler` jede
    // unaufloesbare Klassenbindung zaehlt und ihre Zahl pinnt.
    return (
      <p
        data-testid="d44-keine-ueberschriften"
        className="mb-2 rounded-btn border border-hairline bg-page px-2.5 py-2 text-[12.5px] text-muted"
      >
        {t(D44_TEXTSCHLUESSEL.leer)}
      </p>
    );
  }

  const springeZu = (position: number): void => {
    // Der Editor wird an seiner Marke gesucht, nicht ueber eine Ref: Der contenteditable-Knoten
    // mountet beim Moduswechsel frisch (RichTextEditor.tsx:410) — eine Ref auf den alten Knoten
    // zeigte ins Leere.
    const flaeche = document.querySelector<HTMLElement>(`[${D44_EDITOR_MARKE}]`);
    const ziel = flaeche?.querySelectorAll<HTMLElement>("h2, h3")[position];
    ziel?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label={t(D44_TEXTSCHLUESSEL.titel)}
      data-testid="d44-gliederung"
      className="mb-2 max-h-40 overflow-y-auto rounded-btn border border-hairline bg-page px-2.5 py-2"
    >
      <ul className="space-y-0.5 text-[12.5px]">
        {d44SichtbareEintraege(eintraege).map((eintrag) => (
          <li key={`${eintrag.position}-${eintrag.text}`}>
            {/* Die Einrueckung der h3 steht bewusst NICHT im `className`: `mega47` verlangt, dass
              jede Klassenbindung statisch aufloesbar ist, und ein Ausdruck mit `eintrag` waere
              eine unaufloesbare mehr. Ein Abstandhalter im Kindbereich haelt beide `className`
              als reine Literale. */}
            <button
              type="button"
              data-testid={`d44-sprung-${eintrag.position}`}
              onClick={() => springeZu(eintrag.position)}
              className="block w-full truncate text-left text-muted hover:text-text"
            >
              {eintrag.ebene === 3 ? <span className="inline-block w-4" /> : null}
              {eintrag.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
