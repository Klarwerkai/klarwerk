// ================================================================================================
// AUFNAHME gesamt-peer-validierung · package:pruefablauf — DIE BAUSTEINE DES VORSCHLAGSWEGS.
// ================================================================================================
//
// Drei Lücken, die Ben am Vorschlagsweg belegt hat (Nacharbeit 3), je ein Baustein:
//   · `PrueferWahl` — die Änderung einer BENANNTEN Person zur Prüfung geben. Zur Wahl steht das
//     Verzeichnis ohne die eigene Person (dasselbe Muster wie der Prüfer-Vorschlag beim Erfassen);
//     ob die gewählte Person freigeben darf, entscheidet der Server und sagt es sonst (400).
//   · `VorschlagRueckfragen` — die Rückfragen am Vorschlag, mit wem, wann und welchem Inhalt.
//   · `EigeneVorschlaege` — der Status des EIGENEN Vorschlags für den Einreicher, auch nach der
//     Entscheidung: übernommen (welche Fassung), abgelehnt (mit Begründung) oder offen (mit
//     Rückfrage). Bis hierher sah ihn nur, wer freigeben darf, und nur solange er offen war.
//
// Alles hier ZEIGT nur, was am Vorschlag gespeichert ist. Kein Baustein rechnet einen Status aus
// etwas anderem als `status`, `rueckfragen`, `decidedBy`/`decidedAt`, `resultVersion` und `note`.
import { useTranslation } from "react-i18next";
import { useDirectory } from "../../api/hooks";
import type { KoProposal } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";

type NameOf = (id: string) => string;

export function PrueferWahl({
  wert,
  onChange,
  eigeneId,
}: {
  wert: string;
  onChange: (id: string) => void;
  eigeneId: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const directory = useDirectory();
  const personen = (Array.isArray(directory.data) ? directory.data : []).filter(
    (p) => p.id !== eigeneId,
  );
  return (
    <label className="flex flex-col gap-1 text-[11.5px] text-muted">
      {t("pruefablauf.pruefer.label")}
      <select
        data-testid="bib-pruefer-wahl"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-card border border-hairline bg-surface px-2 py-1 text-[12.5px] text-text"
      >
        <option value="">{t("pruefablauf.pruefer.keine")}</option>
        {personen.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VorschlagRueckfragen({
  vorschlag,
  nameOf,
}: {
  vorschlag: KoProposal;
  nameOf: NameOf;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const rueckfragen = vorschlag.rueckfragen ?? [];
  if (rueckfragen.length === 0) {
    return null;
  }
  return (
    <ul data-testid="bib-vorschlag-rueckfragen" className="mt-1.5 space-y-1">
      {rueckfragen.map((r) => (
        <li
          key={`${r.von}-${r.at}`}
          data-testid="bib-vorschlag-rueckfrage-eintrag"
          className="rounded-card border border-hairline bg-surface p-2 text-[12px]"
        >
          <p className="text-[11px] text-muted">
            {t("pruefablauf.rueckfrage.von", {
              name: nameOf(r.von),
              zeit: formatKoTimestamp(r.at, i18n.language) ?? r.at,
            })}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-text">{r.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** Der Status eines Vorschlags in Worten — nur aus den gespeicherten Feldern. */
export function vorschlagStatusSchluessel(v: KoProposal): { schluessel: string; n?: string } {
  if (v.status === "uebernommen") {
    return typeof v.resultVersion === "number"
      ? { schluessel: "pruefablauf.status.uebernommen", n: String(v.resultVersion) }
      : { schluessel: "pruefablauf.status.uebernommenOhneFassung" };
  }
  if (v.status === "abgelehnt") {
    return { schluessel: "pruefablauf.status.abgelehnt" };
  }
  return (v.rueckfragen ?? []).length > 0
    ? { schluessel: "pruefablauf.status.offenRueckfrage" }
    : { schluessel: "pruefablauf.status.offen" };
}

export function EigeneVorschlaege({
  vorschlaege,
  nameOf,
}: {
  vorschlaege: readonly KoProposal[];
  nameOf: NameOf;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (vorschlaege.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="bib-eigene-vorschlaege"
      className="rounded-card border border-hairline bg-hairline-soft/40 p-3"
    >
      <h3 className="text-[12.5px] font-semibold text-text">{t("pruefablauf.eigene.titel")}</h3>
      <ul className="mt-2 space-y-2.5">
        {vorschlaege.map((v) => {
          const status = vorschlagStatusSchluessel(v);
          return (
            <li
              key={v.id}
              data-testid="bib-eigener-vorschlag"
              data-vorschlag-id={v.id}
              data-status={v.status}
              className="border-hairline border-t pt-2.5 first:border-t-0 first:pt-0"
            >
              <p
                data-testid="bib-eigener-vorschlag-status"
                className="text-[12px] font-medium text-text"
              >
                {t(status.schluessel, status.n === undefined ? {} : { n: status.n })}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {formatKoTimestamp(v.at, i18n.language) ?? v.at} ·{" "}
                {t("ko.propose.fromVersion", { n: String(v.baseVersion) })}
                {v.pruefer
                  ? ` · ${t("pruefablauf.pruefer.zugeordnet", { name: nameOf(v.pruefer) })}`
                  : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
                {v.statement}
              </p>
              {v.decidedBy && v.decidedAt ? (
                <p
                  data-testid="bib-eigener-vorschlag-entscheidung"
                  className="mt-1 text-[11.5px] text-muted"
                >
                  {t("pruefablauf.entschieden", {
                    name: nameOf(v.decidedBy),
                    zeit: formatKoTimestamp(v.decidedAt, i18n.language) ?? v.decidedAt,
                  })}
                </p>
              ) : null}
              {v.note ? (
                <p
                  data-testid="bib-eigener-vorschlag-begruendung"
                  className="mt-0.5 whitespace-pre-wrap text-[12px] text-text"
                >
                  {t("pruefablauf.begruendung", { text: v.note })}
                </p>
              ) : null}
              <VorschlagRueckfragen vorschlag={v} nameOf={nameOf} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
