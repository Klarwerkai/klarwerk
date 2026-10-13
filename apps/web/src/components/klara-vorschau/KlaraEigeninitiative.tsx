// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) — UNTERSTÜTZUNG UND EIGENINITIATIVE EINSTELLEN.
// ================================================================================================
//
// Drei Teile, alle in der vorhandenen Klara-Fläche (`KlaraVorschau.tsx`):
//   · `KlaraModusWahl` — die drei Modi als Auswahl mit je einem Satz, was er bedeutet. Gespeichert
//     wird am eigenen Konto (`lib/klaraEigeninitiative.ts`); angezeigt ist immer der bestätigte Stand.
//   · `KlaraHinweis` — EIN Hinweis neben der Figur, nur im Modus „Passende Hinweise anbieten“. Er
//     bietet die vorhandene Hilfe an („Anleitung zeigen“, „Erklären“); er selbst führt nichts aus.
//     „Später“ und „Nicht mehr anbieten“ legen ihn am Server ab.
//   · `KlaraUebertrageneAufgaben` — im Modus „Ausdrücklich übertragene Aufgaben“ die Liste der
//     Aufträge, die die Person selbst erteilt hat (Klara 05, vom Server nachgelesen, auch nach dem
//     Neuladen), mit ihrem Stand. Ausgeführt wird über die vorhandene Auftragskarte mit den Rechten
//     der Person — diese Liste gibt keine zusätzliche Erlaubnis.
import type { TFunction } from "i18next";
import { type CSSProperties, useId } from "react";
import {
  EIGENINITIATIVE_MODI,
  type EigeninitiativeModus,
} from "../../api/assistenzEigeninitiative";
import {
  type Hinweis,
  useEigeninitiative,
  waehleModus,
  wirksamerModus,
} from "../../lib/klaraEigeninitiative";
import type { Ausfuehrung } from "./auftrag";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_HAUPT =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-ink bg-ink px-2.5 text-[12px] font-semibold text-page hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-klein font-semibold uppercase tracking-wider text-muted-2";

// ------------------------------------------------------------------------------------------------
// Die Wahl des Modus.
// ------------------------------------------------------------------------------------------------

export function KlaraModusWahl({
  kontoId,
  t,
  onGewaehlt,
}: {
  kontoId: string | null;
  t: TFunction;
  onGewaehlt: (modus: EigeninitiativeModus, ok: boolean) => void;
}): JSX.Element {
  const l = useEigeninitiative();
  const name = useId();
  const modus = wirksamerModus(l);
  const gesperrt = !kontoId || l.status === "leer" || l.status === "laedt" || l.speichert;
  const warnung = l.fehler || l.status === "fehler";
  return (
    <fieldset
      data-testid="klara-eigeninitiative"
      data-modus={modus}
      data-stand={l.status}
      className="rounded-card border border-hairline bg-page px-3 py-2"
    >
      <legend className={`${KLEINTITEL} px-1`}>{t("klarainitiative.wahl.titel")}</legend>
      <p className="text-[11.5px] leading-relaxed text-muted">{t("klarainitiative.wahl.intro")}</p>
      <div className="mt-1.5 space-y-1.5">
        {EIGENINITIATIVE_MODI.map((m) => (
          <label
            key={m}
            data-testid={`klara-eigeninitiative-${m}`}
            className="flex cursor-pointer items-start gap-2 rounded-btn px-1 py-0.5 hover:bg-surface"
          >
            <input
              type="radio"
              name={name}
              value={m}
              checked={modus === m}
              disabled={gesperrt}
              onChange={() => {
                if (kontoId) {
                  void waehleModus(kontoId, m).then((ok) => onGewaehlt(m, ok));
                }
              }}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[12.5px] font-semibold text-ink">
                {t(`klarainitiative.modus.${m}.name`)}
              </span>
              <span className="block text-[11.5px] leading-relaxed text-muted">
                {t(`klarainitiative.modus.${m}.text`)}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p
        data-testid="klara-eigeninitiative-stand"
        aria-live="polite"
        className={`mt-1.5 text-[11px] ${warnung ? "text-trust-warn-text" : "text-muted-2"}`}
      >
        {!kontoId
          ? t("klarainitiative.stand.ohneKonto")
          : l.speichert
            ? t("klarainitiative.stand.speichert")
            : l.fehler
              ? t("klarainitiative.stand.fehler")
              : l.status === "fehler"
                ? t("klarainitiative.stand.ladefehler")
                : l.status === "bereit" && l.antwort?.gewaehlt
                  ? t("klarainitiative.stand.gespeichert")
                  : t("klarainitiative.stand.vorgabe")}
      </p>
    </fieldset>
  );
}

// ------------------------------------------------------------------------------------------------
// Ein Hinweis — angeboten, nicht ausgeführt.
// ------------------------------------------------------------------------------------------------

export function KlaraHinweis({
  hinweis,
  ort,
  t,
  stil,
  onAngebot,
  onSpaeter,
  onSchliessen,
}: {
  hinweis: Hinweis;
  /** Seitenname, wie Klara ihn im Gespräch nennt. */
  ort: string;
  t: TFunction;
  stil: CSSProperties;
  onAngebot: () => void;
  onSpaeter: () => void;
  onSchliessen: () => void;
}): JSX.Element {
  const titelId = useId();
  return (
    <section
      data-klara="1"
      data-testid="klara-hinweis"
      data-hinweis={hinweis.schluessel}
      data-art={hinweis.art}
      aria-labelledby={titelId}
      className="fixed z-[61] w-[260px] rounded-card border border-brand bg-surface px-3 py-2 shadow-popover"
      style={stil}
    >
      <p id={titelId} className={KLEINTITEL}>
        {t("klarainitiative.hinweis.titel")}
      </p>
      <p data-testid="klara-hinweis-text" className="mt-0.5 text-[12px] leading-relaxed text-text">
        {t(`klarainitiative.hinweis.${hinweis.art}.text`, { seite: ort })}
      </p>
      <p className="mt-0.5 text-[10.5px] text-muted-2">{t("klarainitiative.hinweis.nurAngebot")}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-hinweis-angebot"
          onClick={onAngebot}
          className={KNOPF_HAUPT}
        >
          {t(`klarainitiative.hinweis.${hinweis.art}.angebot`)}
        </button>
        <button
          type="button"
          data-testid="klara-hinweis-spaeter"
          onClick={onSpaeter}
          className={KNOPF}
        >
          {t("klarainitiative.hinweis.spaeter")}
        </button>
        <button
          type="button"
          data-testid="klara-hinweis-schliessen"
          onClick={onSchliessen}
          className={KNOPF}
        >
          {t("klarainitiative.hinweis.schliessen")}
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------
// Die ausdrücklich übertragenen Aufgaben.
// ------------------------------------------------------------------------------------------------

/** Was noch Aufmerksamkeit braucht: läuft, wartet auf eine Rückfrage oder ist angehalten. */
export function istOffen(a: Ausfuehrung): boolean {
  return (
    a.phase === "pruefen" ||
    a.phase === "laeuft" ||
    a.phase === "rueckfrage" ||
    a.phase === "angehalten"
  );
}

/** Der Stand in Worten — derselbe Wortlaut wie auf der Auftragskarte (Klara 05). */
function standText(a: Ausfuehrung, t: TFunction): string {
  if (a.phase === "rueckfrage") {
    return t("klarainitiative.aufgaben.rueckfrage");
  }
  if (a.phase === "angehalten") {
    return t("klaraauftrag.stand.unklar");
  }
  if (a.phase === "unbekannt" || a.phase === "fehler") {
    return t("klarainitiative.aufgaben.nichtAngelegt");
  }
  const stand = a.auftrag?.stand;
  return stand ? t(`klaraauftrag.stand.${stand}`) : t("klaraauftrag.stand.laeuft");
}

export function KlaraUebertrageneAufgaben({
  liste,
  t,
}: {
  liste: readonly Ausfuehrung[];
  t: TFunction;
}): JSX.Element {
  const offen = liste.filter(istOffen).length;
  return (
    <section
      data-testid="klara-aufgaben"
      data-offen={offen}
      aria-label={t("klarainitiative.aufgaben.titel")}
      className="rounded-card border border-ai/40 bg-page px-3 py-2"
    >
      <p className={KLEINTITEL}>{t("klarainitiative.aufgaben.titel")}</p>
      <p className="text-[11.5px] leading-relaxed text-muted">
        {t("klarainitiative.aufgaben.intro")}
      </p>
      {liste.length === 0 ? (
        <p data-testid="klara-aufgaben-leer" className="mt-1 text-[11.5px] text-muted-2">
          {t("klarainitiative.aufgaben.leer")}
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {liste.map((a) => {
            const schritte = a.auftrag?.schritte ?? [];
            const fertig = schritte.filter(
              (s) => s.stand === "gespeichert" || s.stand === "abgeschlossen",
            ).length;
            const geplant = a.auftrag?.geplanteSchritte ?? a.geplant.length;
            return (
              <li
                key={a.lokalId}
                data-testid="klara-aufgabe"
                data-offen={istOffen(a) ? "true" : "false"}
                data-stand={a.auftrag?.stand ?? a.phase}
                className="rounded-btn border border-hairline bg-surface px-2 py-1"
              >
                <p
                  data-testid="klara-aufgabe-wortlaut"
                  className="text-[12px] font-semibold text-ink"
                >
                  {t("klaraauftrag.wortlaut", { text: a.wortlaut })}
                </p>
                <p data-testid="klara-aufgabe-stand" className="text-[11px] text-text">
                  {standText(a, t)}
                  {geplant > 0
                    ? ` · ${t("klarainitiative.aufgaben.schritte", { fertig, gesamt: geplant })}`
                    : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-[10.5px] text-muted-2">{t("klarainitiative.aufgaben.rechte")}</p>
    </section>
  );
}
