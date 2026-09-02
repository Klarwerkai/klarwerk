import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../api/types";

// SCRUM-127 / Pedi 04.07.: eine gemeinsame Detaildarstellung eines Wissensobjekts
// (Aussage, Bedingungen, Maßnahmen, Quellen). Genutzt im Konflikt-Board, in der
// Gegenüberstellung (Pop-up) und in der Objekt-Auswahl (Vorschau) — eine Quelle der Wahrheit,
// damit die Darstellung überall gleich bleibt.
export function KoView({ ko }: { ko: KnowledgeObject }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[13.5px] font-semibold text-text">{ko.title}</p>
      <p className="text-[12.5px] leading-relaxed text-muted">{ko.statement}</p>
      {ko.conditions.length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("con.conditions")}
          </div>
          <ul className="list-disc pl-4 text-[12px] text-text">
            {ko.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ko.measures.length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("con.measures")}
          </div>
          <ul className="list-disc pl-4 text-[12px] text-text">
            {ko.measures.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {(ko.sources ?? []).length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("con.sources")}
          </div>
          <ul className="space-y-1">
            {(ko.sources ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-1.5 text-[12px] text-text">
                <span>{s.label}</span>
                {/* F-0205 (SCRUM-438): der Herkunfts-Hinweis, und er hängt an der EINEN Bedingung.
                    Bis hierher stand dieser Chip UNBEDINGT an jeder Quelle — auch an einer mit
                    `peerValidated: true`. Das war keine Lücke, sondern eine falsche Aussage: eine
                    von Kollegen bestätigte Quelle trug die Warnung der ungeprüften. Ein Etikett,
                    das an allem klebt, sagt nichts mehr aus.

                    KEINE ABWERTUNG: Die Quelle bleibt an ihrem Platz, in voller Deckkraft, in
                    unveränderter Reihenfolge. Sie stützt das Wissen weiterhin — sie ersetzt nur
                    keine Prüfstimme, und das steht jetzt da.

                    Als TEXT und nicht als `title` oder Farbe: Ein Hinweis, den ein Screenreader
                    nicht vorliest, ist keiner. */}
                {s.peerValidated ? null : (
                  <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text">
                    {t("ko.sourceExternUnchecked")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
