import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import type { EmpfehlungsGrund, Wissensempfehlungen } from "../../api/types";
import { koDetailPath } from "../../lib/graphNav";
import { MINDESTLESEZEIT_MS, vermerkeGelesen } from "../../lib/lesespur";

// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — IN DER LESESPALTE, OHNE EINEN KLICK.
// ================================================================================================
//
// Wer einen Eintrag liest, sieht darunter bis zu fünf verwandte Einträge, jeden mit seinem Grund:
// zusammen gelesen, gemeinsame Schlagwörter, Konflikt. Die Auskunft rechnet der Server
// (`GET /api/kos/:id/empfehlungen`, sichtbarkeitsgefiltert); diese Fläche zeigt sie nur.
//
// EIN HINWEIS, KEINE PFLICHTAUSKUNFT. Laden, Fehler, fehlende Rechte, eine unlesbare Antwort und
// „nichts zu empfehlen" zeichnen NICHTS: ein Kasten „keine Empfehlung" wäre Rauschen, und ein
// Fehlersatz unter jedem Eintrag wegen einer Nebenauskunft wäre lauter als ihr Nutzen. Die
// Lesefläche bleibt dadurch in jedem dieser Fälle genau die, die sie vorher war.
//
// DIE ABFRAGE STEHT HIER UND NICHT IN `api/hooks.ts`: zahlreiche Prüfstände der Lesespalte ersetzen
// jenes Modul durch eine Attrappe mit fester Exportliste; ein neuer Hook dort fehlte in jeder davon.
// Ohne Wiederholung, damit ein Fehler nicht dreimal am Server klopft.
//
// DAS CO-READING-SIGNAL. Bleibt der Eintrag `MINDESTLESEZEIT_MS` lang offen, vermerkt
// `vermerkeGelesen` ihn in der Lesespur dieses Tabs; gibt es einen Vorgänger aus derselben
// Lesesitzung, meldet die Fläche das PAAR an den Server. Wer vorher weiterblättert, meldet nichts.
// Ein Fehlschlag bleibt still — er verliert nur ein Signal.

function lesbar(data: unknown): data is Wissensempfehlungen {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { empfehlungen?: unknown }).empfehlungen)
  );
}

function grundText(t: TFunction, grund: EmpfehlungsGrund): string {
  if (grund.art === "mitgelesen") {
    return t("wissensempfehlung.grund.mitgelesen", { count: grund.anzahl });
  }
  if (grund.art === "thema") {
    return t("wissensempfehlung.grund.thema", { schlagwoerter: grund.schlagwoerter.join(", ") });
  }
  return t(
    grund.stand === "offen"
      ? "wissensempfehlung.grund.konfliktOffen"
      : "wissensempfehlung.grund.konfliktEntschieden",
  );
}

export function Wissensempfehlung({
  koId,
  mindestlesezeitMs = MINDESTLESEZEIT_MS,
}: {
  koId: string;
  /** Nur für Prüfstände verstellbar; die Lesespalte nutzt die Vorgabe. */
  mindestlesezeitMs?: number;
}): JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["ko-empfehlungen", koId],
    queryFn: () => endpoints.ko.empfehlungen(koId),
    enabled: koId !== "",
    retry: false,
  });

  useEffect(() => {
    const uhr = window.setTimeout(() => {
      const zuvor = vermerkeGelesen(koId);
      if (zuvor === undefined) {
        return;
      }
      try {
        endpoints.ko.mitgelesen(koId, zuvor).catch(() => undefined);
      } catch {
        // Fehlt der Meldeweg (eine Prüfstand-Attrappe von `endpoints`), bleibt das Signal aus.
      }
    }, mindestlesezeitMs);
    return () => window.clearTimeout(uhr);
  }, [koId, mindestlesezeitMs]);

  if (!lesbar(data) || data.koId !== koId || data.empfehlungen.length === 0) {
    return null;
  }
  const zeigtMitgelesen = data.empfehlungen.some((e) =>
    e.gruende.some((g) => g.art === "mitgelesen"),
  );
  return (
    <section
      data-testid="wissensempfehlung"
      aria-labelledby={`wissensempfehlung-titel-${koId}`}
      className="rounded-card border border-hairline bg-surface px-4 py-3 shadow-tile"
    >
      <h3 id={`wissensempfehlung-titel-${koId}`} className="text-[13px] font-semibold text-text">
        {t("wissensempfehlung.titel")}
      </h3>
      <p className="mt-0.5 text-[11.5px] text-muted-2">{t("wissensempfehlung.hinweis")}</p>
      <ul className="mt-2 space-y-2">
        {data.empfehlungen.map((e) => (
          <li key={e.id} data-testid="wissensempfehlung-eintrag" className="text-[12.5px]">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-text">{e.title}</span>
              <Link
                to={koDetailPath(e.id)}
                className="ml-auto shrink-0 text-[11.5px] font-semibold text-ai hover:underline"
                aria-label={`${t("wissensempfehlung.oeffnen")}: ${e.title}`}
              >
                {t("wissensempfehlung.oeffnen")} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="mt-0.5 space-y-0.5 text-[11.5px]">
              {e.gruende.map((g) => (
                <li
                  key={g.art}
                  data-testid={`empfehlung-grund-${g.art}`}
                  className={g.art === "konflikt" ? "text-trust-warn-text" : "text-muted"}
                >
                  {grundText(t, g)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {data.truncated ? (
        <p className="mt-2 text-[11.5px] text-muted-2">
          {t("wissensempfehlung.mehr", { shown: data.empfehlungen.length, total: data.total })}
        </p>
      ) : null}
      {zeigtMitgelesen ? (
        <p data-testid="wissensempfehlung-datenschutz" className="mt-2 text-[11px] text-muted-2">
          {t("wissensempfehlung.datenschutz")}
        </p>
      ) : null}
    </section>
  );
}
