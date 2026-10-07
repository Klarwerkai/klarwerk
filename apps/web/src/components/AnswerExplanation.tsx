// ================================================================================================
// R-0293 (W3-C, Erklärfläche) — EIN KLICK ÖFFNET DEN WEG ZUR ANTWORT.
// ================================================================================================
//
// Unter einer Antwort öffnet ein Knopf den GESPEICHERTEN Antwortbeleg
// (`GET /api/klara/answers/:answerId/explanation`): welche Wissenseinheit in welcher Fassung, welche
// Quelle und Fundstelle, welche Freigabe im Prüfbuch, wer beim Antworten zuständig war und ob heute
// ein Widerspruch offen ist — und warum genau diese Quellen (tragend oder nur herangezogen).
//
// WAS HIER NICHT GESCHIEHT: keine Neusuche und keine eigene Rechteentscheidung. Geladen wird erst
// beim Klick, und gezeigt wird genau das, was der Server für diesen Leser herausgibt; geschwärzte
// Zeilen bleiben geschwärzt, ein entwerteter Beleg zeigt keine Einzelheiten.
//
// Die Ableitung (geprüft? Widerspruch? Grund?) steht DOM-frei in `lib/answerExplanation.ts`; die
// Anzeige ist in `AnswerExplanationPanel` von der Abfrage getrennt und dadurch ohne Netz prüfbar.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import type { AnswerExplanationEvidence, AnswerExplanationResponse } from "../api/types";
import { antwortwegLage } from "../lib/answerExplanation";

const KNOPF =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft";
const ZEILE = "text-[12.5px] text-muted";

/** Kennung zu Anzeigenamen — vom Aufrufer (Verzeichnis EINMAL je Seite); ohne ihn die Kennung. */
type NameVon = (kennung: string) => string;

function BelegZeile({
  zeile,
  nameVon,
}: {
  zeile: AnswerExplanationEvidence;
  nameVon: NameVon;
}) {
  const { t } = useTranslation();
  // „Warum genau diese Quelle": tragend heisst, der Antworttext belegt sie mit einer Fussnote.
  const rolle =
    zeile.evidenceRole === "carrying"
      ? "antwortweg.zeile.tragend"
      : "antwortweg.zeile.herangezogen";
  if (zeile.redacted) {
    return (
      <li data-testid="antwortweg-zeile" data-geschwaerzt="true" className={ZEILE}>
        {t(rolle)}
        {" · "}
        {t("antwortweg.zeile.geschwaerzt")}
      </li>
    );
  }
  const ref = zeile.validationDecisionRef;
  return (
    <li data-testid="antwortweg-zeile" data-geschwaerzt="false" className="flex flex-col gap-0.5">
      <span className="text-[13px] text-text">
        {zeile.knowledgeObjectId}
        {" · "}
        {zeile.knowledgeObjectVersion === null
          ? t("antwortweg.zeile.fassungFehlt")
          : t("antwortweg.zeile.fassung", { version: zeile.knowledgeObjectVersion })}
      </span>
      <span className={ZEILE}>{t(rolle)}</span>
      <span className={ZEILE}>
        {zeile.sourceRecordId === null
          ? t("antwortweg.zeile.quelleFehlt", { grund: zeile.sourceRecordIdReason ?? "" })
          : t("antwortweg.zeile.quelle", { quelle: zeile.sourceRecordId })}
      </span>
      <span className={ZEILE}>
        {zeile.locator === null
          ? t("antwortweg.zeile.fundstelleFehlt", { grund: zeile.locatorReason ?? "" })
          : t("antwortweg.zeile.fundstelle", { fundstelle: zeile.locator })}
      </span>
      <span className={ZEILE}>
        {ref === null
          ? t("antwortweg.zeile.freigabeFehlt", {
              grund: zeile.validationReferenceAbsenceReason ?? "",
            })
          : t("antwortweg.zeile.freigabe", {
              seq: ref.auditSeq,
              kurz: ref.auditHash.slice(0, 12),
            })}
      </span>
      <span className={ZEILE}>
        {zeile.confidentialityAtExecution === null
          ? t("antwortweg.zeile.rechteFehlt")
          : t("antwortweg.zeile.rechte", { stufe: zeile.confidentialityAtExecution })}
      </span>
      {zeile.responsibleAtExecution === null ? null : (
        <span className={ZEILE}>
          {t(
            zeile.responsibleKindAtExecution === "author-fallback"
              ? "antwortweg.zeile.zustaendigAutor"
              : "antwortweg.zeile.zustaendig",
            { name: nameVon(zeile.responsibleAtExecution) },
          )}
        </span>
      )}
      {zeile.openConflictToday === true ? (
        <span className="text-[12.5px] text-trust-warn-text">
          {t("antwortweg.zeile.widerspruchOffen")}
        </span>
      ) : null}
    </li>
  );
}

/** Die Anzeige eines geladenen Belegs — ohne Abfrage, damit sie ohne Netz prüfbar ist. */
export function AnswerExplanationPanel({
  erklaerung,
  nameVon = (kennung) => kennung,
}: {
  erklaerung: AnswerExplanationResponse;
  nameVon?: NameVon;
}) {
  const { t } = useTranslation();
  if (erklaerung.state === "NO_SNAPSHOT") {
    return (
      <p data-testid="antwortweg-kein-beleg" className={ZEILE}>
        {t("antwortweg.keinBeleg")}
      </p>
    );
  }
  const lage = antwortwegLage(erklaerung);
  return (
    <div data-testid="antwortweg" className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text">{t("antwortweg.titel")}</p>
      <p className={ZEILE}>{t("antwortweg.hinweis")}</p>
      <p data-testid="antwortweg-zustand" data-zustand={erklaerung.integrity} className={ZEILE}>
        {t(`antwortweg.zustand.${erklaerung.integrity}`)}
        {" · "}
        {t("antwortweg.anzahl", { count: erklaerung.evidenceCount })}
      </p>
      {lage.grundSchluessel === null ? null : (
        <p data-testid="antwortweg-grund" className="text-[12.5px] text-trust-warn-text">
          {t("antwortweg.grundTitel", { grund: t(lage.grundSchluessel) })}
        </p>
      )}
      {lage.entwertetOhneGrund ? (
        <p data-testid="antwortweg-ohne-grund" className="text-[12.5px] text-trust-warn-text">
          {t("antwortweg.entwertetOhneGrund")}
        </p>
      ) : null}
      <p data-testid="antwortweg-geprueft" data-wert={lage.geprueft} className={ZEILE}>
        {t(`antwortweg.geprueft.${lage.geprueft}`)}
      </p>
      <p data-testid="antwortweg-widerspruch" data-wert={lage.widerspruch} className={ZEILE}>
        {t(`antwortweg.widerspruch.${lage.widerspruch}`)}
      </p>
      {erklaerung.generationMode === null ? null : (
        <p className={ZEILE}>{t(`antwortweg.erzeugung.${erklaerung.generationMode}`)}</p>
      )}
      {erklaerung.evidence.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {erklaerung.evidence.map((zeile, index) => (
            // Geschwärzte Zeilen tragen keine Kennung — die Stelle im Beleg ist der einzige Schlüssel.
            // biome-ignore lint/suspicious/noArrayIndexKey: Die Belegreihenfolge ändert sich nie.
            <BelegZeile key={index} zeile={zeile} nameVon={nameVon} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Der Knopf unter der Antwort — und auf Klick der geladene Beleg. */
export function AnswerExplanation({
  answerId,
  nameVon,
}: {
  answerId: string | null;
  nameVon?: NameVon;
}) {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const abfrage = useQuery({
    queryKey: ["ask", "explanation", answerId],
    queryFn: () => endpoints.ask.explanation(answerId ?? ""),
    enabled: offen && answerId !== null,
    // Der Beleg ändert sich nie, wohl aber Rechte und Konfliktlage — bei jedem Öffnen neu lesen.
    staleTime: 0,
  });
  // Ohne Beleg-Kennung gibt es nichts zu öffnen; ein toter Knopf wäre eine falsche Zusage.
  if (answerId === null) {
    return null;
  }
  return (
    <div className="basis-full flex flex-col gap-2">
      <button
        type="button"
        data-testid="antwortweg-oeffnen"
        aria-expanded={offen}
        onClick={() => setOffen((wert) => !wert)}
        className={KNOPF}
      >
        {t(offen ? "antwortweg.schliessen" : "antwortweg.oeffnen")}
      </button>
      {offen ? (
        abfrage.isPending ? (
          <p className={ZEILE}>{t("antwortweg.laedt")}</p>
        ) : abfrage.isError || abfrage.data === undefined ? (
          <p data-testid="antwortweg-fehler" className="text-[12.5px] text-trust-warn-text">
            {t("antwortweg.fehler")}
          </p>
        ) : (
          <AnswerExplanationPanel erklaerung={abfrage.data} nameVon={nameVon} />
        )
      ) : null}
    </div>
  );
}
