import { ChevronDown } from "lucide-react";
// ================================================================================================
// JOB 3061 · H2 — „MEHR": DER INFORMATIONS-ORT UNTER DEM TEXT (Menues.dc.html Z.97–108).
// ================================================================================================
//
// Hierher wandert alles, was ein Prüfer WISSEN können muss, aber nicht dauernd lesen will: Scores,
// Erkennungsweg, Sicherheit, Textdeckung, Vorbehalte, Vertrauen und Stimmen, Kategorie, Wissensart,
// Schlagwörter, Historie. Nichts davon verschwindet — es bekommt einen benannten Ort.
//
// EIN `<details>` UND KEIN EIGENBAU: der Browser trägt Tastaturbedienung, `aria-expanded` und den
// Suchen-im-Text-Sprung von sich aus; zugeklappt liegt der Inhalt nicht im sichtbaren Text, was der
// Textmesser dieses Auftrags misst. Genau dieselbe Bauform benutzt das Produkt bereits an der
// Prüfkarte (`val.more`) — kein zweiter Mechanismus für dieselbe Sache.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function PruefenMehr({
  kennung,
  children,
}: { kennung: string; children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  return (
    <details data-testid={`pruefen-mehr-${kennung}`} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-muted hover:text-text">
        {t("pruefen.more")}
        <ChevronDown size={13} aria-hidden="true" className="group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-[10px] border border-hairline bg-page px-3.5 py-1">
        {children}
      </div>
    </details>
  );
}

/** Eine Zeile im „Mehr": Beschriftung links, Auskunft rechts (Menues.dc.html Z.99).
 *
 *  `kennung`/`lage` sitzen an der GANZEN Zeile, nicht am Wert: eine Auskunft ist Beschriftung UND
 *  Wert zusammen. Der Erfassungsweg zum Beispiel heisst ausdrücklich nicht „Herkunft" (das Wort
 *  trägt auf derselben Seite der Demo-Filter) — wer nur den Wert misst, sieht diesen Unterschied
 *  nicht. Die Lehre steht seit JOB 3027 R4 im Haus. */
export function PruefenMehrZeile({
  beschriftung,
  kennung,
  lage,
  children,
}: {
  beschriftung: string;
  kennung?: string;
  lage?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid={kennung}
      data-lage={lage}
      className="flex items-start justify-between gap-3 border-b border-hairline-soft py-2 last:border-b-0"
    >
      <div className="shrink-0 text-[13px] text-muted">{beschriftung}</div>
      <div className="min-w-0 text-right text-[13px] text-text">{children}</div>
    </div>
  );
}

/** Ein Block im „Mehr" für Fließtext/Zitate, der keine zweispaltige Zeile ist. */
export function PruefenMehrBlock({
  beschriftung,
  children,
}: { beschriftung: string; children: ReactNode }): JSX.Element {
  return (
    <div className="border-b border-hairline-soft py-2 last:border-b-0">
      <div className="text-[13px] text-muted">{beschriftung}</div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-text">{children}</div>
    </div>
  );
}
