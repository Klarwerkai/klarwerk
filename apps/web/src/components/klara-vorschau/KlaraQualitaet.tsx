// ================================================================================================
// KLARA 14 (produkt:20261008:klara-qualitaet) — DIE KARTE „BEFUNDE ZU DIESEM BEITRAG“.
// ================================================================================================
//
// Steht nur, wenn ein echtes Wissensobjekt geöffnet ist (echter Betrieb). „Befunde erklären“ liest
// über `qualitaet.ts` ausschliesslich lesend; je Befund stehen Erklärung, Quelle, Grundlage,
// Unsicherheit und ein konkreter Vorschlag da. Ein Vorschlag ändert nichts:
//   · „Als Auftrag vorbereiten“ legt den Satz ins Eingabefeld (`onVorbereiten`) — erst „Senden“
//     führt ihn über den Ausführungsweg von Klara 05 aus;
//   · „Im Arbeitsweg öffnen“ führt an den vorhandenen Ort, an dem eine Person entscheidet.
// Kein Text dieser Karte wird als Handlung gelesen.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { fehlerGrund } from "./auftrag";
import {
  type Befund,
  type BefundQuelle,
  type Qualitaetslage,
  befundeAus,
  ladeQualitaet,
  leerAussage,
} from "./qualitaet";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const VERWEIS = "font-semibold text-brand-text hover:underline";

/** Der Stand gehört zu genau einem Objekt (`koId`). */
type Stand =
  | { art: "ruhe"; koId: string }
  | { art: "laedt"; koId: string }
  | { art: "fertig"; koId: string; lage: Qualitaetslage }
  | { art: "fehler"; koId: string; meldung: string };

export function KlaraQualitaet({
  koId,
  titel,
  darfBearbeiten,
  onVorbereiten,
}: {
  koId: string;
  titel: string;
  darfBearbeiten: boolean;
  /** Legt den Auftragssatz ins Eingabefeld — ausgeführt wird erst mit „Senden“. */
  onVorbereiten: (satz: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [stand, setStand] = useState<Stand>({ art: "ruhe", koId });
  const aktuell = useRef(koId);
  aktuell.current = koId;

  const lade = async (): Promise<void> => {
    const angefragt = koId;
    setStand({ art: "laedt", koId: angefragt });
    try {
      const daten = await ladeQualitaet(angefragt, darfBearbeiten);
      // Inzwischen ist ein anderes Objekt offen: dieser Befund gilt dort nicht.
      if (aktuell.current !== angefragt) {
        return;
      }
      setStand({ art: "fertig", koId: angefragt, lage: befundeAus(daten, t, i18n.language) });
    } catch (fehler) {
      if (aktuell.current === angefragt) {
        setStand({ art: "fehler", koId: angefragt, meldung: fehlerGrund(fehler, t) });
      }
    }
  };

  // Ein anderes Objekt ist eine andere Frage: der Stand des vorigen gilt hier nicht.
  const sichtbar: Stand = stand.koId === koId ? stand : { art: "ruhe", koId };
  const lage = sichtbar.art === "fertig" ? sichtbar.lage : null;
  return (
    <section
      data-testid="klara-qualitaet"
      data-stand={sichtbar.art}
      aria-label={t("klaraqualitaet.titel")}
      className="rounded-card border border-hairline bg-page px-3 py-2"
    >
      <p className={KLEINTITEL}>{t("klaraqualitaet.titel")}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
        {t("klaraqualitaet.einleitung", { titel })}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-qualitaet-pruefen"
          disabled={sichtbar.art === "laedt"}
          onClick={() => void lade()}
          className={KNOPF}
        >
          {lage ? t("klaraqualitaet.knopfErneut") : t("klaraqualitaet.knopf")}
        </button>
      </div>
      {sichtbar.art === "laedt" ? (
        <output className="mt-1 block text-[11.5px] text-ai">{t("klaraqualitaet.laedt")}</output>
      ) : null}
      {sichtbar.art === "fehler" ? (
        <p data-testid="klara-qualitaet-fehler" className="mt-1 text-[11.5px] text-text">
          {t("klaraqualitaet.fehler", { grund: sichtbar.meldung })}
        </p>
      ) : null}
      {lage ? (
        <div className="mt-1.5 space-y-2">
          {/* „Keine offenen Befunde“ nur, wenn ALLE Prüfwege gelesen wurden — sonst ist der
              Prüfstand unvollständig, und genau das steht da. */}
          {leerAussage(lage) === "keine" ? (
            <p data-testid="klara-qualitaet-keine" className="text-[11.5px] text-text">
              {t("klaraqualitaet.keine")}
            </p>
          ) : null}
          {leerAussage(lage) === "unvollstaendig" ? (
            <p data-testid="klara-qualitaet-unvollstaendig" className="text-[11.5px] text-text">
              {t("klaraqualitaet.unvollstaendig")}
            </p>
          ) : null}
          {lage.befunde.length === 0 ? null : (
            <ul className="space-y-2">
              {lage.befunde.map((b) => (
                <BefundKarte key={b.schluessel} b={b} onVorbereiten={onVorbereiten} />
              ))}
            </ul>
          )}
          {lage.nichtGelesen.length > 0 ? (
            <p data-testid="klara-qualitaet-nicht-gelesen" className="text-[11px] text-muted">
              {t("klaraqualitaet.nichtGelesen", {
                wege: lage.nichtGelesen.map((w) => t(`klaraqualitaet.weg.${w}`)).join(", "),
              })}
            </p>
          ) : null}
          <p data-testid="klara-qualitaet-unveraendert" className="text-[10.5px] text-muted-2">
            {t("klaraqualitaet.unveraendert")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function QuelleZeile({ q }: { q: BefundQuelle }): JSX.Element {
  const { t } = useTranslation();
  let belegt = "unbekannt";
  if (q.belegt !== null) {
    belegt = q.belegt ? "ja" : "nein";
  }
  return (
    <li
      data-testid="klara-befund-quelle"
      data-ko={q.koId}
      data-eigenes={q.eigenes ? "ja" : "nein"}
      data-belegt={belegt}
      className="text-[11.5px] text-text"
    >
      {q.pfad && q.titel ? (
        <Link to={q.pfad} className={VERWEIS}>
          „{q.titel}“
        </Link>
      ) : (
        <span className="text-muted">{t("klaraqualitaet.nichtLesbar")}</span>
      )}
      <span className="text-muted">
        {" · "}
        {q.eigenes ? t("klaraqualitaet.eigenes") : t("klaraqualitaet.gegenseite")}
        {" · "}
        {t(`klaraqualitaet.belegt.${belegt}`)}
      </span>
      {q.zitat ? (
        <blockquote
          data-testid="klara-befund-zitat"
          className="mt-0.5 border-l-2 border-hairline pl-2 text-[11px] italic text-muted"
        >
          {q.zitat}
        </blockquote>
      ) : null}
    </li>
  );
}

function BefundKarte({
  b,
  onVorbereiten,
}: {
  b: Befund;
  onVorbereiten: (satz: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      data-testid="klara-befund"
      data-art={b.art}
      data-grundlage={b.grundlage}
      data-schluessel={b.schluessel}
      className="rounded-card border border-hairline bg-surface px-2.5 py-2"
    >
      <p data-testid="klara-befund-titel" className="text-[12.5px] font-semibold text-ink">
        {b.titel}
      </p>
      <ul
        data-testid="klara-befund-erklaerung"
        className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11.5px] leading-relaxed text-text"
      >
        {b.erklaerung.map((zeile) => (
          <li key={zeile}>{zeile}</li>
        ))}
      </ul>
      <p className={`mt-1 ${KLEINTITEL}`}>{t("klaraqualitaet.quellen")}</p>
      <ul className="space-y-0.5">
        {b.quellen.map((q) => (
          <QuelleZeile key={`${q.koId}-${q.eigenes ? "a" : "b"}`} q={q} />
        ))}
      </ul>
      <p data-testid="klara-befund-grundlage" className="mt-1 text-[11.5px] text-text">
        <span className={KLEINTITEL}>{t("klaraqualitaet.grundlageLabel")}</span>{" "}
        {t(`klaraqualitaet.grundlage.${b.grundlage}`)}
      </p>
      {b.unsicherheit ? (
        <p data-testid="klara-befund-unsicherheit" className="text-[11.5px] text-muted">
          <span className={KLEINTITEL}>{t("klaraqualitaet.unsicherheitLabel")}</span>{" "}
          {b.unsicherheit}
        </p>
      ) : null}
      <div data-testid="klara-befund-vorschlaege" className="mt-1 space-y-1">
        <p className={KLEINTITEL}>{t("klaraqualitaet.vorschlagLabel")}</p>
        {b.vorschlaege.map((v) => {
          if (v.art === "auftrag") {
            return (
              <div key={`auftrag-${v.satz}`} className="space-y-0.5">
                <p className="text-[11.5px] text-text">{v.text}</p>
                <p data-testid="klara-befund-satz" className="text-[11px] italic text-muted">
                  {v.satz}
                </p>
                <button
                  type="button"
                  data-testid="klara-befund-vorbereiten"
                  onClick={() => onVorbereiten(v.satz)}
                  className={KNOPF_KI}
                >
                  {t("klaraqualitaet.vorbereiten")}
                </button>
              </div>
            );
          }
          if (v.art === "arbeitsweg") {
            return (
              <p key={`weg-${v.pfad}-${v.text}`} className="text-[11.5px] text-text">
                {v.text}{" "}
                <Link
                  to={v.pfad}
                  data-testid="klara-befund-arbeitsweg"
                  data-pfad={v.pfad}
                  className={VERWEIS}
                >
                  {t("klaraqualitaet.oeffnen")}
                </Link>
              </p>
            );
          }
          return (
            <p
              key={`hinweis-${v.text}`}
              data-testid="klara-befund-hinweis"
              className="text-[11.5px] text-muted"
            >
              {v.text}
            </p>
          );
        })}
      </div>
    </li>
  );
}
