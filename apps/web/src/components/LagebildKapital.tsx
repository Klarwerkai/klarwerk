// ================================================================================================
// PETER-20261011-P13 · GELDWERT UND REIFEGRAD IN DER KAPITALSICHT (`pages/Stufe2.tsx`).
// ================================================================================================
//
// Ersetzt die frühere „Wissensbewertung" (validierte Objekte × 60 €/h × 2 h × 3 × Ø-Vertrauen) und
// den firmenweiten Reifegrad aus der Validierungsquote. Beide behaupteten einen Wert, den kein
// gemessener Fall und kein Beleg trug. Die Regeln stehen in `lib/lagebild.ts`.
//
// Der Geldwert rechnet NUR mit eingetragenen, gemessenen Fällen. Es gibt keine Vorgabewerte, nichts
// wird gespeichert, und ohne vollständige Angaben steht „Kein Geldwert" mit dem Grund da.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BERECHNUNGSVERSION,
  type GemessenerFall,
  REIFESTUFEN,
  formatEur,
  geldwert,
} from "../lib/lagebild";

const FELD_KLASSE =
  "mt-1 h-9 w-full rounded-input border border-hairline bg-page px-2 text-sm text-text";
const KNOPF_KLASSE =
  "rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft";
const ZEILE_KLASSE = "grid items-end gap-2 sm:grid-cols-5";
/** Ein negativer Nettowert ist eine Aussage (Mehraufwand) und wird nicht weich gezeichnet. */
const NEGATIV = "text-trust-crit-text";
const HINWEIS_TON: Record<GemessenerFall["messart"], string> = {
  agent: "bg-trust-warn-bg text-trust-warn-text",
  mensch: "bg-page text-muted",
};

interface FallZeile {
  /** Nur für React: Zeilen haben vor der Eingabe keine Fallkennung. */
  nr: number;
  id: string;
  ohne: string;
  mit: string;
  vergleichbar: boolean;
}

const leereZeile = (nr: number): FallZeile => ({
  nr,
  id: "",
  ohne: "",
  mit: "",
  vergleichbar: false,
});

/** Ein leeres Feld ist „nicht angegeben" — nie 0. */
function zahlOderNull(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function LagebildGeldwert(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [messart, setMessart] = useState<"" | GemessenerFall["messart"]>("");
  const [kostensatz, setKostensatz] = useState("");
  const [zusatz, setZusatz] = useState("");
  const [zeilen, setZeilen] = useState<FallZeile[]>([leereZeile(0)]);
  const naechsteNr = useRef(1);

  const setzeZeile = (nr: number, teil: Partial<FallZeile>): void =>
    setZeilen((alt) => alt.map((z) => (z.nr === nr ? { ...z, ...teil } : z)));
  const hinzufuegen = (): void => {
    const nr = naechsteNr.current;
    naechsteNr.current += 1;
    setZeilen((alt) => [...alt, leereZeile(nr)]);
  };

  // Nur Zeilen mit Kennung sind Fälle; eine angefangene Zeile ohne Kennung zählt nicht mit.
  const faelle: GemessenerFall[] =
    messart === ""
      ? []
      : zeilen
          .filter((z) => z.id.trim() !== "")
          .map((z) => ({
            id: z.id,
            messart,
            minutenOhne: zahlOderNull(z.ohne) ?? Number.NaN,
            minutenMit: zahlOderNull(z.mit) ?? Number.NaN,
            qualitaetVergleichbar: z.vergleichbar,
          }));
  const ergebnis = geldwert({
    faelle,
    kostensatzEurProStunde: zahlOderNull(kostensatz),
    zusatzkostenEur: zahlOderNull(zusatz),
  });
  const eur = (n: number): string => formatEur(n, i18n.language);

  return (
    <div data-testid="p13-geldwert">
      <p className="mt-2 text-[12px] text-muted">{t("lagebild.geld.regel")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-[12px] text-muted">
          {t("lagebild.geld.messart")}
          <select
            data-testid="p13-messart"
            value={messart}
            onChange={(e) => setMessart(e.target.value as typeof messart)}
            className={FELD_KLASSE}
          >
            <option value="">{t("lagebild.geld.messart.waehlen")}</option>
            <option value="agent">{t("lagebild.geld.messart.agent")}</option>
            <option value="mensch">{t("lagebild.geld.messart.mensch")}</option>
          </select>
        </label>
        <label className="text-[12px] text-muted">
          {t("lagebild.geld.kostensatz")}
          <input
            data-testid="p13-kostensatz"
            type="number"
            min={0}
            inputMode="decimal"
            value={kostensatz}
            onChange={(e) => setKostensatz(e.target.value)}
            className={FELD_KLASSE}
          />
        </label>
        <label className="text-[12px] text-muted">
          {t("lagebild.geld.zusatzkosten")}
          <input
            data-testid="p13-zusatzkosten"
            type="number"
            min={0}
            inputMode="decimal"
            value={zusatz}
            onChange={(e) => setZusatz(e.target.value)}
            className={FELD_KLASSE}
          />
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-[12px] font-semibold text-muted-2">
          {t("lagebild.geld.faelle")}
        </legend>
        <div className="space-y-2">
          {zeilen.map((z, i) => (
            <div key={z.nr} data-testid="p13-fall" className={ZEILE_KLASSE}>
              <label className="text-[12px] text-muted">
                {t("lagebild.geld.fall.id")}
                <input
                  data-testid="p13-fall-id"
                  value={z.id}
                  onChange={(e) => setzeZeile(z.nr, { id: e.target.value })}
                  className={FELD_KLASSE}
                />
              </label>
              <label className="text-[12px] text-muted">
                {t("lagebild.geld.fall.ohne")}
                <input
                  data-testid="p13-fall-ohne"
                  type="number"
                  min={0}
                  value={z.ohne}
                  onChange={(e) => setzeZeile(z.nr, { ohne: e.target.value })}
                  className={FELD_KLASSE}
                />
              </label>
              <label className="text-[12px] text-muted">
                {t("lagebild.geld.fall.mit")}
                <input
                  data-testid="p13-fall-mit"
                  type="number"
                  min={0}
                  value={z.mit}
                  onChange={(e) => setzeZeile(z.nr, { mit: e.target.value })}
                  className={FELD_KLASSE}
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-[12px] text-muted">
                <input
                  data-testid="p13-fall-vergleichbar"
                  type="checkbox"
                  checked={z.vergleichbar}
                  onChange={(e) => setzeZeile(z.nr, { vergleichbar: e.target.checked })}
                />
                {t("lagebild.geld.fall.vergleichbar")}
              </label>
              <button
                type="button"
                onClick={() => setZeilen((alt) => alt.filter((x) => x.nr !== z.nr))}
                className={`mb-1 ${KNOPF_KLASSE}`}
              >
                {t("lagebild.geld.fall.entfernen", { nummer: i + 1 })}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          data-testid="p13-fall-hinzufuegen"
          onClick={hinzufuegen}
          className={`mt-2 ${KNOPF_KLASSE}`}
        >
          {t("lagebild.geld.fall.hinzufuegen")}
        </button>
      </fieldset>

      <output data-testid="p13-ergebnis" data-lage={ergebnis.lage} className="mt-3 block">
        {ergebnis.lage === "nicht_berechenbar" ? (
          <>
            <span className="block text-2xl font-semibold text-muted-2">
              {t("lagebild.geld.kein")}
            </span>
            <span data-testid="p13-grund" className="block text-[12px] text-muted">
              {messart === ""
                ? t("lagebild.geld.messartFehlt")
                : t(`lagebild.geld.grund.${ergebnis.grund}`)}
            </span>
          </>
        ) : (
          <>
            <span
              data-testid="p13-netto"
              className={`block text-2xl font-semibold ${ergebnis.nettoEur < 0 ? NEGATIV : "text-ink"}`}
            >
              {t("lagebild.geld.netto")} {eur(ergebnis.nettoEur)}
            </span>
            <span data-testid="p13-formel" className="block font-mono text-[11px] text-muted-2">
              {t("lagebild.geld.formel", {
                fallzahl: ergebnis.fallzahl,
                minuten: ergebnis.minutenDifferenz,
                satz: eur(ergebnis.kostensatzEurProStunde),
                brutto: eur(ergebnis.bruttoEur),
                zusatz: eur(ergebnis.zusatzkostenEur),
              })}
            </span>
            {ergebnis.faelleMitMehraufwand > 0 ? (
              <span
                data-testid="p13-mehraufwand"
                className="block text-[12px] text-trust-warn-text"
              >
                {t("lagebild.geld.mehraufwand", { count: ergebnis.faelleMitMehraufwand })}
              </span>
            ) : null}
            {ergebnis.doppelt > 0 ? (
              <span className="block text-[12px] text-muted-2">
                {t("lagebild.geld.doppelt", { anzahl: ergebnis.doppelt })}
              </span>
            ) : null}
            <span
              data-testid="p13-messart-hinweis"
              data-messart={ergebnis.messart}
              className={`mt-1 block rounded-card px-3 py-2 text-[12px] ${HINWEIS_TON[ergebnis.messart]}`}
            >
              {t(ergebnis.messart === "agent" ? "lagebild.geld.simulation" : "lagebild.geld.echt")}
            </span>
          </>
        )}
        <span className="mt-1 block text-[11px] text-muted-2">
          {t("lagebild.geld.keinUmsatz")}
          {" · "}
          {t("lagebild.geld.version", { version: BERECHNUNGSVERSION })}
        </span>
      </output>
    </div>
  );
}

/**
 * Die Stufen mit ihren Nachweisen — und die ehrliche Aussage, dass ohne Belege je Arbeitsweg kein
 * Reifegrad vergeben wird. Der Bestand führt keine Belege je Arbeitsweg; sie entstehen erst in der
 * PoC-Messung (Agentenprüfung bis „Technisch geprüft", echte Anwender für den Alltag).
 */
export function LagebildReifegrad(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="p13-reifegrad">
      <p className="mt-2 text-[12px] text-muted">{t("lagebild.reife.regel")}</p>
      <table className="mt-2 w-full text-left text-[12px]">
        <thead>
          <tr className="text-muted-2">
            <th className="py-1 pr-3 font-semibold">{t("lagebild.reife.stufe")}</th>
            <th className="py-1 font-semibold">{t("lagebild.reife.nachweis")}</th>
          </tr>
        </thead>
        <tbody>
          {REIFESTUFEN.map((s) => (
            <tr
              key={s}
              data-testid="p13-stufe"
              data-stufe={s}
              className="border-t border-hairline-soft"
            >
              <td className="py-1 pr-3 font-semibold text-text">
                {t(`lagebild.reife.stufe.${s}`)}
              </td>
              <td className="py-1 text-muted">{t(`lagebild.reife.text.${s}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="p13-keine-belege" className="mt-2 text-[12px] text-muted-2">
        {t("lagebild.reife.keineBelege")}
      </p>
    </div>
  );
}
