// WP-UX-WOW-1 U1: sichere Darstellung der Modell-Antwort. Rendert AUSSCHLIESSLICH die geparsten
// Subset-Segmente (lib/answerMarkdown) als React-Elemente — kein dangerouslySetInnerHTML, kein
// HTML-Sink: jeder Textteil wird als React-TEXT-Knoten gerendert, Script/HTML im Antworttext
// erscheint wörtlich (escaped). Kopieren/Export nutzen weiter den Rohtext (unverändert im Aufrufer).
import type { AnswerInlinePart } from "../lib/answerMarkdown";
import { parseAnswerMarkdown } from "../lib/answerMarkdown";

function Inline({ parts }: { parts: AnswerInlinePart[] }): JSX.Element {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "bold" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
          <strong key={i}>{part.text}</strong>
        ) : part.kind === "italic" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
          <em key={i}>{part.text}</em>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function AnswerMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}): JSX.Element {
  const segments = parseAnswerMarkdown(text);
  return (
    <div className={className}>
      {segments.map((segment, i) => {
        if (segment.kind === "heading") {
          return segment.level === 3 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <h3 key={i} className="mt-3 text-[14px] font-semibold text-ink first:mt-0">
              <Inline parts={segment.parts} />
            </h3>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <h4 key={i} className="mt-2.5 text-[13px] font-semibold text-ink first:mt-0">
              <Inline parts={segment.parts} />
            </h4>
          );
        }
        if (segment.kind === "list") {
          const items = segment.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische, nicht umsortierte Segmentliste.
            <li key={j}>
              <Inline parts={item} />
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
            <Inline parts={segment.parts} />
          </p>
        );
      })}
    </div>
  );
}
