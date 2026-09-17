// Paket 4 (nacht24, C1/C2/E1 — Pedis Befund „Quellendarstellung zu schwach"): die Detail-Zeile
// einer Antwort-Quelle. Zeigt je Quelle: Status-Badge KONSISTENT zur Validierung (StatusPill/
// deriveStatus) + Trust-Wert, den bestehenden Pulldown-Summary-Aufklapper (KoSummaryDisclosure,
// E2-Baustein wiederverwendet) und auf Klick den AUSZUG IM DOKUMENT-FORMAT über die bestehende
// sichere Render-Kette (SanitizedHtml — Allowlist-Sanitizer unangetastet; Formatierung inkl.
// Bilder, sofern das KO sie trägt). Kein neuer Egress: ausschließlich bereits geladene,
// berechtigte KO-Daten.
// ================================================================================================
// JOB 4224 · D5 — UND JETZT FÜHRT DER BELEG BIS ZUM ORIGINAL.
// ================================================================================================
//
// Bis hierher endete die Belegkette an `ko.bodyHtml` (der Auszug unten). Wer wissen wollte, WORAUS
// dieses Wissen stammt, fand hier keine Tür: weder die hinterlegte Originaldatei noch die
// Originaladresse der Quelle. Gemessen im Cloud-Lauf dd9ef2e8… (F1/F2 rot, kein einziger
// `answer-source-original` im Baum).
//
// DIE ENTSCHEIDUNG, WAS ERREICHBAR IST, FÄLLT NICHT HIER, sondern in `originalweg`
// (`lib/askCitedSources.ts`) — der einen Ableitung, die dafür `quellennachweis` und `objectRawHref`
// zusammenführt. Diese Datei zeichnet nur, was dort steht.
//
// WARUM NICHT `SourceLink` (components/ko/SourceEvidence.tsx) WIEDERVERWENDET WIRD — die Frage
// gehört beantwortet, weil das Bauteil genau für „eine anklickbare Quelle" gebaut ist:
//   · Es kann den ANKER nicht. Es kennt nur `source.url`; die hinterlegte Originaldatei, um die es
//     diesem Auftrag geht, erreicht es baulich nicht.
//   · Es beurteilt die Adresse mit `safeHttpUrl`, der Quellennachweis dieses Hauses mit
//     `isSavableSourceUrl` (der Spiegel der Server-Allowlist). Beide nebeneinander auf EINER Zeile
//     wären zwei Urteile über dieselbe Adresse. Weil die Datei und die Adresse hier zusammen
//     entschieden werden, gilt die Regel, die auch die Datei trägt.
// Es entsteht dadurch KEINE zweite Quellendarstellung: `AnswerSourceDetails` bleibt die eine
// Quellenzeile der Fragenfläche, sie bekommt nur ihr fehlendes Ende.
import { ChevronDown, FileText, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../api/types";
import { originalweg } from "../lib/askCitedSources";
import { deriveStatus } from "../lib/displayStatus";
import { KoSummaryDisclosure } from "./KoSummaryDisclosure";
import { SanitizedHtml } from "./SanitizedHtml";
import { StatusPill } from "./trust/StatusPill";
import { cx } from "./ui";

/** Die eine Klassenkette der Belegzeilen — literal, damit der Klassenbindungs-Wächter sie auflöst. */
const BELEG_LINK =
  "inline-flex items-center gap-1 text-[11.5px] font-medium text-ai hover:underline";
const BELEG_TEXT = "inline-flex items-center gap-1 text-[11.5px] text-muted";

export function AnswerSourceDetails({
  ko,
  authorName,
  standBestaetigt = true,
}: {
  ko: KnowledgeObject;
  // FUNKE F1 (nacht24 Paket 6): der Wissensträger wird sichtbar gewürdigt — „aus dem Wissen von
  // <Name>". Der Name kommt vom Aufrufer (Directory-Auflösung EINMAL je Seite; Fallback bleibt
  // ehrlich die Autor-Id, nie erfunden). Die Komponente bleibt dadurch netz-/hookfrei mountbar.
  authorName?: string | undefined;
  // ==============================================================================================
  // JOB 4224 · RUNDE 3, BEN-KORREKTURPFLICHT 1 — EIN ANGEBOT IST EINE AUSSAGE ÜBER DAS JETZT.
  // ==============================================================================================
  //
  // BENS MESSUNG (Cloud-Lauf 3608655f…): Rechteentzug, danach ein Serverfehler auf der
  // Auffrischung. `Ask.tsx` behält bei gleicher Frage das stehende Ergebnis (`onMutate`) — und
  // damit blieb der Originallink der GESPERRTEN Quelle als Weg angeboten. Wörtlich: „die Fläche
  // bietet das Original der gesperrten Quelle weiter an: expected true to be false".
  //
  // DIE UNTERSCHEIDUNG, auf der die Reparatur steht: die ANTWORT darf stehen bleiben — sie war
  // einmal richtig, und §9 verlangt ausdrücklich, dass sie bei gescheiterter Auffrischung nicht
  // verschwindet. Ein LINK ist etwas anderes: er sagt „das kannst du jetzt öffnen" und leitet damit
  // eine fortbestehende Berechtigung aus einem Zustand ab, den gerade niemand bestätigt hat.
  // §9 sagt für den Fehlerfall „der Quellenstand ist UNBEKANNT" und für den gescheiterten Cache
  // „kein stiller alter Beleg als Tatsache … ein zwischenzeitlicher Rechteentzug darf NIE durch
  // einen Cache überspielt werden". Genau das setzt dieser Schalter durch.
  //
  // WAS ER NICHT TUT, und das ist die zweite Hälfte der Ehrlichkeit: er erfindet KEINE Sperre. Aus
  // einem Fehler folgt weder „gesperrt" noch „kein Original vorhanden" — beides wären Tatsachen,
  // die niemand geprüft hat. Es bleibt die dritte, wahre Aussage: der Stand ist nicht bestätigt.
  // Kommt die nächste Auffrischung durch, steht der Weg wieder da (gemessen in F5).
  //
  // WARUM NUR DAS ANGEBOT UND NICHT AUCH DER AUSZUG: der Auszug und die Kurzvorschau zeigen
  // Inhalt, den dieser Mensch bereits berechtigt erhalten hat — sie leiten keine Berechtigung ab,
  // sie stellen keine dar. Sie zurückzunehmen hiesse, ihm etwas wegzunehmen, was er hat, ohne dass
  // damit irgendetwas geschützt würde. Die Grenze verläuft an der HANDLUNG, nicht an der Anzeige.
  //
  // VORGABE `true`: ein Aufrufer, der die Frage nicht stellt, bekommt das bisherige Verhalten. Das
  // ist hier vertretbar, weil der EINZIGE Aufrufer im Produkt (`pages/Ask.tsx`) sie ausdrücklich
  // beantwortet; ein fail-closed Vorgabewert würde dagegen jeden gemounteten Bestandstest der
  // Komponente in eine Aussage zwingen, die er nie getroffen hat.
  standBestaetigt?: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [excerptOpen, setExcerptOpen] = useState(false);
  const body = (ko.bodyHtml ?? "").trim();
  const weg = originalweg(ko, i18n.language);
  return (
    <div className="mt-1 w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status + Trust — dieselbe Sprache wie Bibliothek/Validierung, kein neues Vokabular. */}
        <StatusPill status={deriveStatus(ko)} />
        <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
          {t("answerSource.trust", { n: ko.trust })}
        </span>
        {authorName ? (
          <span className="text-[11px] text-muted-2">
            {t("funke.sourceAuthor", { name: authorName })}
          </span>
        ) : null}
      </div>
      {/* E2-Baustein wiederverwendet: kurze Inhaltsvorschau (Kernaussage) als Pulldown. */}
      <KoSummaryDisclosure source={ko} className="mt-1" />
      {/* ==========================================================================================
          DER WEG ZUM ORIGINAL — offen, nicht hinter einem zweiten Aufklapper.
          ==========================================================================================
          Bewusst KEINE weitere Faltung: das fehlende Ende der Belegkette hinter einen zusätzlichen
          Klick zu legen wäre dieselbe Halbheit noch einmal. Die Zeilen sind kurz, sie stehen da.
          Ohne jedes erreichbare Original steht der ehrliche Satz — kein leerer Platz, der wie ein
          noch nicht geladener Beleg aussähe, und keine angedeutete Tür. */}
      <div data-testid="answer-source-originals" className="mt-1">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-2">
          {t("answerSource.originalsTitle")}
        </div>
        {!standBestaetigt ? (
          <p
            data-testid="answer-source-original-unbestaetigt"
            className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text"
          >
            {t("answerSource.originalUnconfirmed")}
          </p>
        ) : weg.erreichbar ? (
          <ul className="mt-0.5 space-y-0.5">
            {weg.quellen.map((q) => (
              <li key={q.quelle.id} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[11.5px] text-text">{q.quelle.label}</span>
                {q.datei ? (
                  <a
                    data-testid="answer-source-original"
                    href={q.datei.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={t("answerSource.originalFile")}
                    className={BELEG_LINK}
                  >
                    <FileText size={11} aria-hidden="true" />
                    {q.datei.name}
                  </a>
                ) : null}
                {/* Die Adresse tritt NEBEN die Datei, sie ersetzt sie nicht: eine Quelle kann
                    beides tragen, und dann sind es zwei verschiedene Originale. */}
                {q.adresse?.verlinkbar ? (
                  <a
                    data-testid="answer-source-original"
                    href={q.adresse.voll}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={t("answerSource.originalAddress")}
                    className={BELEG_LINK}
                  >
                    <Link2 size={11} aria-hidden="true" />
                    {q.adresse.kurz}
                  </a>
                ) : null}
                {/* Eine Papierfundstelle (oder ein `javascript:`-Altwert) bleibt SICHTBAR, aber
                    Text — ein toter Link wäre ein Versprechen ohne Deckung. */}
                {q.adresse && !q.adresse.verlinkbar ? (
                  <span
                    data-testid="answer-source-reference"
                    title={t("answerSource.originalReference")}
                    className={BELEG_TEXT}
                  >
                    {q.adresse.kurz}
                  </span>
                ) : null}
              </li>
            ))}
            {/* Hinterlegte Originale, auf die keine Quelle zeigt (Anhänge von vor JOB 4077, Importe
                ohne Belegstelle). Sie zu verschweigen wäre ein neuer blinder Fleck. */}
            {weg.freieDateien.map((d) => (
              <li key={d.objectId}>
                <a
                  data-testid="answer-source-original"
                  href={d.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={t("answerSource.originalFile")}
                  className={BELEG_LINK}
                >
                  <FileText size={11} aria-hidden="true" />
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p
            data-testid="answer-source-no-original"
            className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2"
          >
            {t("answerSource.noOriginal")}
          </p>
        )}
      </div>
      {/* Auszug im DOKUMENT-Format — nur wenn das KO einen formatierten Inhalt trägt (ehrlich:
          ohne bodyHtml gibt es keinen Dokument-Auszug, es wird nichts erfunden). */}
      {body.length > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            aria-expanded={excerptOpen}
            onClick={() => setExcerptOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ai hover:opacity-80"
          >
            <ChevronDown
              size={12}
              className={cx("transition-transform", excerptOpen ? "rotate-180" : "")}
            />
            {excerptOpen ? t("answerSource.excerptHide") : t("answerSource.excerptShow")}
          </button>
          {excerptOpen ? (
            <div className="mt-1.5 rounded-card border border-hairline bg-surface p-3">
              {/* Dieselbe sichere Kette wie die KO-Leseansicht (KoRead): SanitizedHtml + prose-kw. */}
              <SanitizedHtml
                html={body}
                className="prose-kw text-[13.5px] leading-relaxed text-text"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
