// ================================================================================================
// R-1643 · DAS ENTSCHEIDUNGS-PROTOKOLL AUF DEM GEDRUCKTEN BLATT.
// ================================================================================================
//
// „Drucken / PDF" ist der PDF-Weg des Produkts (es gibt keinen PDF-Erzeuger, s.
// `tests/legal/mega62-export-kennzeichnung.test.ts`). Gedruckt wurde bis hierher die Antwortkarte —
// und in ihr liegen Quellen, Schritte und Vertrauenswert hinter „Mehr", also NICHT auf dem Blatt.
// Ein PDF „mit allen Quellen, Trust-Werten, Argumentationskette, Zeitstempel, Nutzer-ID" (Roadmap
// 6.1) war so nicht zu bekommen.
//
// Dieser Block steht nur im Druck (`print-only`) und liest DIESELBE Eingabe wie der Markdown-Export
// (`exportEingabe` in `pages/Ask.tsx`) über dieselben Hilfen (`decisionProtocolRows`,
// `sourceFacts`) — Datei und Blatt können damit nichts Verschiedenes über eine Quelle sagen.
import { Fragment } from "react";
import {
  type AnswerExportInput,
  decisionArguments,
  decisionProtocolRows,
  sourceFacts,
} from "../../lib/answerExport";

export function Entscheidungsprotokoll({
  eingabe,
}: {
  eingabe: AnswerExportInput;
}): JSX.Element | null {
  const protokoll = eingabe.protocol;
  if (!protokoll) {
    return null;
  }
  const L = eingabe.labels;
  // Dieselbe Zeile wie „**Antwort** · …" im Markdown.
  const einstufung = [
    eingabe.statusLabel,
    `${L.evidence}: ${eingabe.evidenceLabel}`,
    `${L.trust} ${eingabe.trust}`,
  ]
    .filter((p) => Boolean(p.trim()))
    .join(" · ");
  // Wie im Markdown: trägt keine Quelle ein Kennzeichen, ist die Zuordnung unbekannt — und das
  // steht über der Liste.
  const ohneKennzeichen = eingabe.sources.every((s) => !s.attributionLabel?.trim());
  // R-1643 (Ben, Nacharbeit 2): die Argumentationskette, wie im Markdown — oder der Satz, dass
  // keine vorliegt.
  const kette = decisionArguments(eingabe, protokoll);
  return (
    <section
      data-testid="ask-entscheidungsprotokoll"
      className="print-only mt-2 border-t border-hairline pt-4 text-[12px] leading-relaxed text-text"
    >
      <h2 className="m-0 text-[14px] font-semibold">{protokoll.labels.heading}</h2>
      <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {decisionProtocolRows(eingabe, protokoll).map((zeile) => (
          <Fragment key={zeile.label}>
            <dt className="text-muted">{zeile.label}</dt>
            <dd className={zeile.kennung ? "m-0 font-mono" : "m-0"}>{zeile.value}</dd>
          </Fragment>
        ))}
        <dt className="text-muted">{L.answer}</dt>
        <dd className="m-0">{einstufung}</dd>
      </dl>
      <h3 className="m-0 mt-3 text-[13px] font-semibold">{protokoll.labels.argumentation}</h3>
      {kette ? (
        <ol data-testid="ask-argumentationskette" className="m-0 mt-1 list-decimal pl-5">
          {kette.map((glied) => (
            <li key={`${glied.quelleId}|${glied.aussage}`}>
              „{glied.aussage}“ — {protokoll.labels.supportedBy}:{" "}
              {glied.quelleTitel ? `${glied.quelleTitel} ` : null}
              <span className="font-mono">{glied.quelleId}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 mt-1 italic">{protokoll.labels.argumentationMissing}</p>
      )}
      {eingabe.steps.length > 0 ? (
        <>
          <h3 className="m-0 mt-3 text-[13px] font-semibold">{L.steps}</h3>
          <ul className="m-0 mt-1 list-disc pl-5">
            {eingabe.steps.map((schritt) => (
              <li key={`${schritt.description}|${schritt.snippet ?? ""}`}>
                {schritt.description.trim()}
                {schritt.snippet?.trim() ? (
                  <span className="block text-muted">“{schritt.snippet.trim()}”</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {eingabe.sources.length > 0 ? (
        <>
          <h3 className="m-0 mt-3 text-[13px] font-semibold">{L.sources}</h3>
          {ohneKennzeichen && L.attributionUnknown?.trim() ? (
            <p className="m-0 mt-1 italic">{L.attributionUnknown.trim()}</p>
          ) : null}
          <ul className="m-0 mt-1 list-disc pl-5">
            {eingabe.sources.map((quelle) => {
              const fakten = sourceFacts(quelle, L.trust);
              return (
                <li key={quelle.sourceId}>
                  {quelle.title.trim()}
                  {fakten.length > 0 ? ` — ${fakten.join(" · ")}` : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
