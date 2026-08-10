// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DER VIEW-KERN: ZWEI OBJEKTE, SICHTBAR GETRENNT.
// ================================================================================================
//
// WAS DIESE KOMPONENTE IST: eine Anordnung. Sie holt nichts, sie ruft keine Route, sie startet
// keinen Import (Auftrag „Ziel"). Sie bekommt ein serverseitig geliefertes Resultat als Prop und
// ordnet es in drei Flächen: Laufzustand oben, darunter ORIGINAL und WISSEN nebeneinander.
//
// DIE TRENNUNG IST DER PUNKT. Original und Wissen sind zwei `<section>` mit je eigener Überschrift,
// eigenem Rahmen und eigener Sprache — nie ineinander gerendert (Auftrag §1). Wer in dreissig
// Sekunden hinsieht, soll ohne Erklärung erkennen: hier ist ein Dokument, und daraus sind mehrere
// eigenständige Einheiten entstanden.
//
// Auf breiten Flächen stehen die beiden Blöcke nebeneinander, auf schmalen untereinander — in
// beiden Fällen bleibt die Reihenfolge Original → Wissen, weil sie die Entstehungsrichtung ist.
import { useTranslation } from "react-i18next";
import { type ImportResultViewInput, importResultView } from "../../lib/importResultView";
import { KnowledgeItemList } from "./KnowledgeItemList";
import { RunStateBanner } from "./RunStateBanner";
import { SourceRecordCard } from "./SourceRecordCard";

export interface ImportResultViewProps {
  /** Ausschliesslich serverseitig geliefert. Der View-Kern ergaenzt keinen einzigen Fachwert. */
  result: ImportResultViewInput | null | undefined;
}

export function ImportResultView({ result }: ImportResultViewProps): JSX.Element {
  const { t } = useTranslation();
  const view = importResultView(result);
  return (
    <div data-testid="w2-import-result" className="flex flex-col gap-4">
      <h1 className="sr-only">{t("w2.result.heading")}</h1>
      <RunStateBanner
        state={view.runState}
        failureCode={view.failureCode}
        failureReason={view.failureReason}
      />
      {/* Zwei Spalten ab `lg`, darunter gestapelt. `items-start` verhindert, dass der kuerzere
          Block auf die Hoehe des laengeren gezogen wird — sonst verschwaemme die Trennung. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <SourceRecordCard source={view.source} />
        <KnowledgeItemList knowledge={view.knowledge} />
      </div>
    </div>
  );
}
