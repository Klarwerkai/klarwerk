// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DIE BELASTBARKEIT DIREKT AN DER ANTWORT.
// ================================================================================================
//
// Diese Datei ZEICHNET, was der Server über die Antwort entschieden hat
// (`services/ask/src/answer-belastbarkeit.ts`): Lage, Begründung, Vertrauenswert samt Herleitung,
// je tragender Quelle Aktualität, Verantwortung und Quellenqualität, und bei einem Widerspruch
// beide Seiten mit ihren Belegen. Sie rechnet nichts nach und wählt nichts aus (R-0318: „die Werte
// kommen mit Begründung vom Server, nicht aus einer hübschen Zahl im Browser").
//
// Bewusst KEINE Prozentangabe und kein Balken: der Vertrauenswert ist eine Belastbarkeitsangabe
// der Quelle, kein Wahrheitsgrad (R-0260). Der Hinweis dazu steht immer mit da.
import { useTranslation } from "react-i18next";
import type {
  AntwortBelastbarkeit,
  AskPruefrahmen,
  KonfliktSeite,
  QuellenBelastbarkeit,
} from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";

const LAGE_TON: Record<AntwortBelastbarkeit["lage"], string> = {
  belegt: "bg-trust-pos-bg text-trust-pos-text",
  belegt_zustaendig_fehlt: "bg-trust-warn-bg text-trust-warn-text",
  belegt_mit_konflikt: "bg-trust-crit-bg text-trust-crit-text",
  wissensluecke: "bg-trust-warn-bg text-trust-warn-text",
  technischer_fehler: "bg-trust-crit-bg text-trust-crit-text",
  geschwaerzt: "bg-page text-muted",
};

function Verantwortung({ q }: { q: QuellenBelastbarkeit }): JSX.Element {
  const { t } = useTranslation();
  const v = q.verantwortung;
  const wer = v.person ? (v.person.name ?? v.person.id) : null;
  const erreichbar =
    v.erreichbar === true
      ? t("ask.belastbarkeit.erreichbar.ja")
      : v.erreichbar === false
        ? t("ask.belastbarkeit.erreichbar.nein")
        : t("ask.belastbarkeit.erreichbar.unbekannt");
  return (
    <span
      data-testid="ask-belastbarkeit-verantwortung"
      className={v.erreichbar === false ? "text-trust-warn-text" : undefined}
    >
      {t(
        v.art === "owner"
          ? "ask.belastbarkeit.verantwortung.eigentuemer"
          : "ask.belastbarkeit.verantwortung.autor",
      )}
      {wer ? `: ${wer}` : ""} · {erreichbar}
    </span>
  );
}

function Seite({ seite, nummer }: { seite: KonfliktSeite; nummer: 1 | 2 }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="ask-belastbarkeit-konfliktseite"
      className="min-w-0 flex-1 rounded-btn border border-hairline bg-surface p-2"
    >
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("ask.belastbarkeit.konflikt.seite", { nummer })}
        {seite.traegtAntwort ? ` · ${t("ask.belastbarkeit.konflikt.traegt")}` : ""}
      </div>
      {seite.einsehbar ? (
        <>
          <p className="mt-0.5 text-[12.5px] font-semibold text-text">{seite.titel}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{seite.aussage}</p>
          <p className="mt-0.5 text-[11px] text-muted-2">
            {t("ask.belastbarkeit.vertrauenswertKurz", { wert: seite.vertrauenswert })} ·{" "}
            {t(
              seite.validiert
                ? "ask.belastbarkeit.quelle.validiert"
                : "ask.belastbarkeit.quelle.nichtValidiert",
            )}{" "}
            · v{seite.version}
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-[12px] text-muted">
          {t("ask.belastbarkeit.konflikt.nichtEinsehbar")}
        </p>
      )}
    </div>
  );
}

export function Belastbarkeit({ b }: { b: AntwortBelastbarkeit }): JSX.Element {
  const { t, i18n } = useTranslation();
  const schwaechste = b.quellen.find((q) => q.koId === b.vertrauenswert.schwaechsteQuelle);
  return (
    <section
      data-testid="ask-belastbarkeit"
      data-lage={b.lage}
      className="rounded-card border border-hairline bg-page px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
          {t("ask.belastbarkeit.titel")}
        </span>
        <span
          data-testid="ask-belastbarkeit-lage"
          className={`rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${LAGE_TON[b.lage]}`}
        >
          {t(`ask.belastbarkeit.lage.${b.lage}`)}
        </span>
        <span className="text-[11.5px] text-muted">
          {t("ask.belastbarkeit.anzahl", {
            tragend: b.quellenAnzahl.tragend,
            herangezogen: b.quellenAnzahl.herangezogen,
          })}
        </span>
      </div>
      <p data-testid="ask-belastbarkeit-vertrauenswert" className="mt-1 text-[12px] text-text">
        {b.vertrauenswert.wert !== null && schwaechste
          ? t("ask.belastbarkeit.vertrauenswert", {
              wert: b.vertrauenswert.wert,
              quelle: schwaechste.titel,
            })
          : t("ask.belastbarkeit.vertrauenswertKeiner")}
      </p>
      {b.gruende.length > 0 ? (
        <ul data-testid="ask-belastbarkeit-gruende" className="mt-1 list-disc pl-4">
          {b.gruende.map((g) => (
            <li key={g} className="text-[12px] leading-relaxed text-muted">
              {t(`ask.belastbarkeit.grund.${g}`)}
            </li>
          ))}
        </ul>
      ) : null}
      {b.quellen.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {b.quellen.map((q) => (
            <li
              key={q.koId}
              data-testid="ask-belastbarkeit-quelle"
              className="flex flex-wrap gap-x-2 text-[11.5px] text-muted"
            >
              <span className="font-semibold text-text">{q.titel}</span>
              <span>v{q.version}</span>
              <span>{t("ask.belastbarkeit.vertrauenswertKurz", { wert: q.vertrauenswert })}</span>
              <span>
                {t("ask.belastbarkeit.stand", {
                  datum: formatKoTimestamp(q.stand, i18n.language) ?? q.stand,
                })}
              </span>
              <span>
                {t(
                  q.validiert
                    ? "ask.belastbarkeit.quelle.validiert"
                    : "ask.belastbarkeit.quelle.nichtValidiert",
                )}
                {q.pruefstand === "proven" ? "" : ` · ${t("ask.checkCaveat.badge")}`}
              </span>
              <Verantwortung q={q} />
            </li>
          ))}
        </ul>
      ) : null}
      {b.konflikte.map((k) => (
        <div
          key={k.konfliktId}
          data-testid="ask-belastbarkeit-konflikt"
          className="mt-2 rounded-btn border border-trust-crit-fill bg-trust-crit-bg p-2"
        >
          <p className="text-[12.5px] font-semibold text-trust-crit-text">
            {t("ask.belastbarkeit.konflikt.titel")}
          </p>
          {k.beschreibung ? (
            <p className="mt-0.5 text-[12px] text-trust-crit-text">{k.beschreibung}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Seite seite={k.seiten[0]} nummer={1} />
            <Seite seite={k.seiten[1]} nummer={2} />
          </div>
          <p className="mt-1 text-[11.5px] text-trust-crit-text">
            {t("ask.belastbarkeit.konflikt.keinGewinner")}
          </p>
        </div>
      ))}
      <p className="mt-1.5 text-[11px] text-muted-2">{t("ask.belastbarkeit.hinweis")}</p>
    </section>
  );
}

/** R-0284: der Rahmen einer Wissenslücke — wogegen geprüft wurde, statt einer nackten Null. */
export function PruefrahmenSatz({ rahmen }: { rahmen: AskPruefrahmen }): JSX.Element {
  const { t } = useTranslation();
  return (
    <p data-testid="ask-pruefrahmen" className="mt-1 text-[12.5px] text-muted">
      {t("ask.pruefrahmen.satz", {
        umfang: t(`ask.pruefrahmen.umfang.${rahmen.umfang}`),
        verglichen: rahmen.verglichen,
        hoechstens: rahmen.hoechstens,
      })}
      {rahmen.nurWoertlich ? ` ${t("ask.pruefrahmen.woertlich")}` : ""}
    </p>
  );
}
