import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useGapAnsprechpartner } from "../api/hooks";
import type { AnsprechpartnerAuskunft, AnsprechpartnerVorschlag } from "../api/types";
import { alphabetischNachName, spurenZeilen } from "../lib/ansprechpartnerView";
import { useAuthorName } from "../lib/useAuthorName";

// R-1663 / R-2178 — „Passende Ansprechpartner nach vorhandenen Wissensspuren" zu EINER offenen
// Lücke. Aufgeklappt wird ausdrücklich; erst dann fragt die Fläche an. Jede Person trägt ihre
// Begründung (Spuren mit Zahl und den Objekten dahinter); es gibt keine Rangfolge und kein „bester
// Experte". Zuweisen ist die bestehende, menschlich ausgelöste Zuweisung der Lücke — dieselbe
// Mutation wie die Auswahlliste daneben, kein zweiter Weg.
export function LueckenAnsprechpartner({
  gapId,
  onAssign,
  assignPending,
}: {
  gapId: string;
  onAssign: (personId: string) => void;
  assignPending: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const auskunft = useGapAnsprechpartner(gapId, offen);

  let inhalt: JSX.Element;
  if (auskunft.isPending) {
    inhalt = <p className="text-[11.5px] text-muted">{t("ansprechpartner.laden")}</p>;
  } else if (auskunft.isError || !auskunft.data) {
    inhalt = <p className="text-[11.5px] text-trust-crit-text">{t("ansprechpartner.fehler")}</p>;
  } else {
    inhalt = (
      <Vorschlagsliste auskunft={auskunft.data} onAssign={onAssign} assignPending={assignPending} />
    );
  }

  return (
    <div className="mt-1" data-testid="luecke-ansprechpartner">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="text-[11.5px] font-semibold text-brand-text hover:underline"
      >
        {offen ? t("ansprechpartner.verbergen") : t("ansprechpartner.zeigen")}
      </button>
      {offen ? (
        <div className="mt-1.5 space-y-2 rounded-btn border border-hairline bg-page px-3 py-2">
          <div className="text-[12px] font-semibold text-text">{t("ansprechpartner.titel")}</div>
          <p className="text-[11px] text-muted-2">{t("ansprechpartner.hinweis")}</p>
          {inhalt}
        </div>
      ) : null}
    </div>
  );
}

function Vorschlagsliste({
  auskunft,
  onAssign,
  assignPending,
}: {
  auskunft: AnsprechpartnerAuskunft;
  onAssign: (personId: string) => void;
  assignPending: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const nameOf = useAuthorName();
  const sortiert = alphabetischNachName(auskunft.vorschlaege, nameOf, i18n.language);

  return (
    <>
      {sortiert.length === 0 ? (
        <p data-testid="ansprechpartner-leer" className="text-[11.5px] text-muted">
          {t("ansprechpartner.leer")}
        </p>
      ) : (
        <ul className="space-y-2">
          {sortiert.map((v) => (
            <Vorschlag
              key={v.personId}
              vorschlag={v}
              name={nameOf(v.personId)}
              onAssign={onAssign}
              assignPending={assignPending}
            />
          ))}
        </ul>
      )}
      <p className="text-[10.5px] text-muted-2">
        {t("ansprechpartner.grundlage", {
          objekte: auskunft.grundlage.objekte,
          luecken: auskunft.grundlage.aehnlicheLuecken,
        })}
      </p>
    </>
  );
}

function Vorschlag({
  vorschlag,
  name,
  onAssign,
  assignPending,
}: {
  vorschlag: AnsprechpartnerVorschlag;
  name: string;
  onAssign: (personId: string) => void;
  assignPending: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-testid="ansprechpartner-vorschlag" className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div data-testid="ansprechpartner-name" className="text-[12.5px] font-medium text-text">
          {name}
        </div>
        <ul className="text-[11.5px] text-muted">
          {spurenZeilen(vorschlag.spuren).map((s) => (
            <li key={s.art} data-testid={`ansprechpartner-spur-${s.art}`}>
              {t(`ansprechpartner.spur.${s.art}`, { count: s.anzahl })}
            </li>
          ))}
        </ul>
        {vorschlag.objekte.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
            {vorschlag.objekte.map((o) => (
              <Link
                key={o.id}
                to={`/wissen/${o.id}`}
                className="max-w-[16rem] truncate text-brand-text hover:underline"
              >
                {o.title}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={assignPending}
        onClick={() => onAssign(vorschlag.personId)}
        className="shrink-0 rounded-btn border border-hairline bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-page disabled:opacity-50"
      >
        {t("ansprechpartner.zuweisen")}
      </button>
    </li>
  );
}
