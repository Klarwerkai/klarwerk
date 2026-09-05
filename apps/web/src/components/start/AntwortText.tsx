// ================================================================================================
// JOB 3064 · H5 — DER ANTWORTTEXT DER FRAGENFLÄCHE, MIT FUSSNOTENMARKEN.
// ================================================================================================
//
// WAS HIER ANDERS IST ALS IN `components/AnswerMarkdown.tsx` — UND WARUM ES EIN EIGENES BAUTEIL IST.
//
// Das Zielbild `design/klarwerk/Fragen.dc.html` (Z.40/41) setzt die Quellenmarke im Antworttext als
// HOCHSTELLUNG: 10 px, #9C5009, 700. Das Modell liefert sie bereits, in der Form „[n]", und
// `services/reasoner/src/provider-model.ts:450` liest genau diese Form gegen die Reihenfolge von
// `result.sources` zurück — Chip und Marke meinen dieselbe Quelle. Bis JOB 3064 kam sie als roher
// Fliesstext an und stand als „[1]" mitten im Satz.
//
// Eine Marke ist ein ELEMENT an einer Stelle IM Satz. Sie entsteht deshalb zwangsläufig dort, wo
// der Antworttext zu React-Knoten wird. `components/AnswerMarkdown.tsx` tut das — aber es tut das
// für DREI Flächen: die Fragenseite, `pages/Mobile.tsx` und `components/KlaraAssistant.tsx`. Die
// Fussnote ist eine Zusage des H5-Zielbilds für die FRAGENFLÄCHE; sie dort einzubauen hiesse, zwei
// Flächen mitzuverändern, für die dieser Auftrag nichts sagt und keine Messung mitbringt (§10:
// Klara ist Gegenstand von 3056/3057). Deshalb trägt die Fragenfläche ihren eigenen Textsatz, und
// `AnswerMarkdown` bleibt für die anderen zwei Flächen unangetastet.
//
// WAS NICHT GEDOPPELT IST: die REGELN. Zerlegt wird weiter mit dem EINEN Parser
// (`lib/answerMarkdown.ts`, unverändert importiert) — Überschriften, Listen, fett, kursiv und die
// Sicherheitszusage „nur Textknoten, kein `dangerouslySetInnerHTML`, kein HTML-Sink" stammen aus
// derselben Quelle wie zuvor. Eigen ist hier ausschliesslich das Setzen der Marke.
//
// GEGEN DAS AUSEINANDERLAUFEN: `tests/app/job3064-fussnote-markiert.test.tsx` (G1) rendert für
// markenfreien Text BEIDE Bauteile und vergleicht ihr `innerHTML` Zeichen für Zeichen. Wer eines
// von beiden am anderen vorbei ändert, wird rot. Das ist die Zusicherung, die eine zweite
// Renderstelle überhaupt vertretbar macht.
import type { AnswerInlinePart } from "../../lib/answerMarkdown";
import { markiereFussnoten, parseAnswerMarkdown, splitMarken } from "../../lib/answerMarkdown";

/**
 * Die Marke selbst.
 *
 * `data-fussnote` ist der Anker, an dem `tests/design/zielbild-h5-fragen.test.ts` (V18, V18b) die
 * Auszeichnung in Chromium misst und die Ziffer gegen die Quellen-Chips zurückliest. Der Farbwert
 * steht als Literal und nicht als Theme-Token: das Zielbild nennt ihn ausdrücklich und für BEIDE
 * Themes gleich, und die Token-Datei `styles/themes.css` liegt ausserhalb der Zielpfade dieses
 * Auftrags (s. RUECKGABE). `align-super` ausdrücklich: Tailwinds Preflight setzt `vertical-align`
 * an `sup` zurück, die Marke stünde sonst auf der Grundlinie (gemessen: `"baseline"`).
 */
function Marke({ ziffer }: { ziffer: number }): JSX.Element {
  return (
    <sup
      data-fussnote={String(ziffer)}
      className="mx-px align-super text-[10px] font-bold text-[#9C5009]"
    >
      {ziffer}
    </sup>
  );
}

/**
 * Ein Inline-Teil mit seinen Marken.
 *
 * KORREKTURPFLICHT 1 (Ben, Runde 6): das gilt jetzt für JEDEN Teil, auch für fett und kursiv. Bis
 * Runde 6 wurden nur Text-Teile zerlegt; `**Ventil prüfen [1]**` behielt seine rohe Klammer, weil
 * die Marke innerhalb einer Auszeichnung sass. Bens Gegenprobe (`strong sup[data-fussnote='1']`
 * war `null`) hat genau das getroffen. Die Marke steht deshalb IM `<strong>`/`<em>`, nicht daneben:
 * sie gehört zu der Aussage, die dort ausgezeichnet ist.
 *
 * OHNE MARKE BLEIBT DIE FORM EXAKT DIE ALTE — ein einzelnes Kind, kein Wrapper. Das ist keine
 * Kosmetik: `tests/app/job3064-fussnote-markiert.test.tsx` (G1) vergleicht für markenfreien Text
 * das `innerHTML` mit dem gemeinsamen Renderer `components/AnswerMarkdown.tsx`, Zeichen für
 * Zeichen. Ein zusätzliches `<span>` würde diese Zusicherung brechen.
 */
function Teil({ teil, zeichen }: { teil: AnswerInlinePart; zeichen: string }): JSX.Element {
  const stuecke = splitMarken(teil.text, zeichen);
  const ohneMarke = stuecke.every((s) => s.art === "text");
  const inhalt = ohneMarke ? (
    teil.text
  ) : (
    <>
      {stuecke.map((s, i) =>
        s.art === "marke" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Stückliste.
          <Marke key={i} ziffer={s.ziffer} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Stückliste.
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
  if (teil.kind === "bold") {
    return <strong>{inhalt}</strong>;
  }
  if (teil.kind === "italic") {
    return <em>{inhalt}</em>;
  }
  return <span>{inhalt}</span>;
}

function Inline({ parts, zeichen }: { parts: AnswerInlinePart[]; zeichen: string }): JSX.Element {
  return (
    <>
      {parts.map((teil, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
        <Teil key={i} teil={teil} zeichen={zeichen} />
      ))}
    </>
  );
}

/**
 * Der Antworttext der Fragenfläche. Gerendert wird AUSSCHLIESSLICH über React-Elemente und
 * Textknoten — Script/HTML im Antworttext erscheint wörtlich (escaped), genau wie bei
 * `AnswerMarkdown`. Kopieren, Drucken und Export bleiben unberührt: sie nutzen weiter den ROHEN
 * Antworttext, in dem die Marke ihre Klammern behält („vermeiden [1]." statt „vermeiden 1.").
 */
export function AntwortText({
  text,
  quellen,
  tragend,
  className,
}: {
  text: string;
  /**
   * Wie viele Quellen die Antwort trägt — die Chips sind 1-basiert danach nummeriert.
   * Nur Zahlen aus diesem Bereich werden zu Marken; genau wie der Reasoner eine Nummer ausserhalb
   * seiner Kandidatenliste verwirft, statt sie zu biegen. Ohne Quellen gibt es keine Marken.
   */
  quellen: number;
  /**
   * Die Stellen der TRAGENDEN Quellen (`citedSources` als Positionen in `sources`, 1-basiert).
   *
   * KORREKTURPFLICHT 1 (Ben, Runde 9): der Deckungsrückfall des Reasoners liefert eine beantwortete,
   * zitierte Antwort, deren Text KEINE `[n]`-Klammer enthält — der Wortlaut der tragenden Quelle.
   * Ist diese Liste da, ist sie massgeblich: jede Nummer daraus wird sichtbar (nötigenfalls am Ende
   * angehängt), und keine andere. Fehlt sie (Zuordnung unbekannt), gilt der blosse Bereich
   * 1..`quellen` wie zuvor. Begründung und Messung: `lib/answerMarkdown.ts`, Block
   * „DER DECKUNGSRÜCKFALL".
   */
  // `| undefined` ausdrücklich: der Build fährt mit `exactOptionalPropertyTypes`, und die
  // Fragenfläche REICHT den Zustand „unbekannt" durch, statt das Attribut wegzulassen.
  tragend?: readonly number[] | undefined;
  className?: string;
}): JSX.Element {
  // KORREKTURPFLICHT 1 (Ben, Runde 8): ERST die Marken binden, DANN die Blöcke bilden. Andersherum
  // zerriss eine Leerzeile, eine Überschrift oder ein Listenpunkt die Gruppe `[1,\n2]`, die der
  // Reasoner als zwei Quellen liest — und die Chips standen ohne Marke im Text da.
  const { text: markiert, zeichen } = markiereFussnoten(text, quellen, tragend);
  const segments = parseAnswerMarkdown(markiert);
  return (
    <div className={className}>
      {segments.map((segment, i) => {
        if (segment.kind === "heading") {
          return segment.level === 3 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <h3 key={i} className="mt-3 text-[14px] font-semibold text-ink first:mt-0">
              <Inline parts={segment.parts} zeichen={zeichen} />
            </h3>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <h4 key={i} className="mt-2.5 text-[13px] font-semibold text-ink first:mt-0">
              <Inline parts={segment.parts} zeichen={zeichen} />
            </h4>
          );
        }
        if (segment.kind === "list") {
          const items = segment.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <li key={j}>
              <Inline parts={item} zeichen={zeichen} />
            </li>
          ));
          return segment.ordered ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <ol key={i} className="mt-1.5 list-decimal space-y-1 pl-5">
              {items}
            </ol>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <ul key={i} className="mt-1.5 list-disc space-y-1 pl-5">
              {items}
            </ul>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
          <p key={i} className="mt-1.5 first:mt-0">
            <Inline parts={segment.parts} zeichen={zeichen} />
          </p>
        );
      })}
    </div>
  );
}
