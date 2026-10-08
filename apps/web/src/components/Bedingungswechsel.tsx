// ================================================================================================
// R-1628 (aufnahme:20260922:gesamt-was-waere-wenn) — „WAS WÄRE, WENN …" AUF DER FRAGEN-SEITE.
// ================================================================================================
//
// „Statt 5083-H111 jetzt 6082-T6": die Fläche ordnet den geladenen Bestand nach der EINEN Regel in
// `lib/bedingungswechsel.ts` ein und zeigt je Wissensobjekt die Fundstelle. Sie rechnet sofort
// beim Tippen — es geht nichts hinaus, keine KI wird gefragt, und deshalb steht sie auch dann zur
// Verfügung, wenn die KI-Antwort gesperrt ist.
//
// Zugeklappt stehen KEINE Eingabefelder im Baum — dieselbe Zusage wie `FragekontextWahl`: das
// Fragefeld bleibt das erste Eingabefeld der Seite.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KnowledgeObject } from "../api/types";
import {
  BEDINGUNGS_LAGEN,
  BEDINGUNG_TEXT_MAX,
  type BedingungsEinordnung,
  type Fundstelle,
  bedingungsVorschlaege,
  vergleicheBedingungen,
} from "../lib/bedingungswechsel";
import { TextInput } from "./ui";

function FundZeile({
  begriff,
  fund,
  testid,
}: {
  begriff: string;
  fund: Fundstelle | null;
  testid: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!fund) {
    return null;
  }
  return (
    <p data-testid={testid} data-fundort={fund.fundort} className="text-muted-2">
      <span className="font-semibold">{begriff}</span> ·{" "}
      {t(`bedingungswechsel.fundort.${fund.fundort}`)}: {fund.text}
    </p>
  );
}

function Eintrag({
  e,
  bisher,
  neu,
}: {
  e: BedingungsEinordnung;
  bisher: string;
  neu: string;
}): JSX.Element {
  return (
    <li data-testid="bedingungswechsel-eintrag" data-ko={e.id} className="flex flex-col">
      <Link
        to={`/wissen/${e.id}`}
        className="font-semibold text-brand-text underline-offset-2 hover:underline"
      >
        {e.titel}
      </Link>
      <FundZeile begriff={bisher} fund={e.bisher} testid="bedingungswechsel-fund-bisher" />
      <FundZeile begriff={neu} fund={e.neu} testid="bedingungswechsel-fund-neu" />
    </li>
  );
}

export function Bedingungswechsel({
  kos,
  fehler,
}: {
  /** `undefined` = noch nicht geladen. */
  kos: readonly KnowledgeObject[] | undefined;
  fehler: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const [bisher, setBisher] = useState("");
  const [neu, setNeu] = useState("");
  const [thema, setThema] = useState("");
  const vorschlaege = useMemo(() => bedingungsVorschlaege(kos ?? []), [kos]);
  const ergebnis = useMemo(
    () => (kos ? vergleicheBedingungen(kos, { bisher, neu, thema }) : null),
    [kos, bisher, neu, thema],
  );

  const feld = (
    schluessel: "bisher" | "neu" | "thema",
    wert: string,
    setze: (v: string) => void,
  ): JSX.Element => (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-0.5">
      <label htmlFor={`bedingungswechsel-${schluessel}-feld`}>
        {t(`bedingungswechsel.feld.${schluessel}`)}
      </label>
      <TextInput
        id={`bedingungswechsel-${schluessel}-feld`}
        data-testid={`bedingungswechsel-${schluessel}`}
        {...(schluessel === "thema" ? {} : { list: "bedingungswechsel-vorschlaege" })}
        value={wert}
        maxLength={BEDINGUNG_TEXT_MAX}
        onChange={(e) => setze(e.target.value)}
        className="h-8 text-[12.5px]"
      />
    </div>
  );

  let inhalt: JSX.Element | null = null;
  if (offen) {
    if (fehler && !kos) {
      inhalt = <p className="mt-2">{t("bedingungswechsel.fehler")}</p>;
    } else if (!ergebnis) {
      inhalt = <p className="mt-2">{t("bedingungswechsel.laedt")}</p>;
    } else if (!ergebnis.ok) {
      inhalt = (
        <p data-testid="bedingungswechsel-unvollstaendig" className="mt-2">
          {t(`bedingungswechsel.${ergebnis.grund}`)}
        </p>
      );
    } else {
      const v = ergebnis.vergleich;
      // Ohne Thema wird „nennt keine von beiden" nur gezählt (sonst stünde der halbe Bestand da).
      const lagen = BEDINGUNGS_LAGEN.filter((lage) => lage !== "keine" || v.thema.length > 0);
      const ohneThemaVerdeckt = v.thema.length === 0 ? v.ohneNennungAnzahl : 0;
      inhalt = (
        <div data-testid="bedingungswechsel-ergebnis" className="mt-2 flex flex-col gap-2">
          {lagen.map((lage) => {
            const eintraege = v.gruppen[lage];
            const kopf = t(`bedingungswechsel.lage.${lage}`, { bisher: v.bisher, neu: v.neu });
            return (
              <section key={lage} data-testid="bedingungswechsel-gruppe" data-lage={lage}>
                <p className="font-semibold text-text">{`${kopf} (${eintraege.length})`}</p>
                {eintraege.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-1">
                    {eintraege.map((e) => (
                      <Eintrag key={e.id} e={e} bisher={v.bisher} neu={v.neu} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-2">{t("bedingungswechsel.leer")}</p>
                )}
              </section>
            );
          })}
          {ohneThemaVerdeckt > 0 ? (
            <p data-testid="bedingungswechsel-ohne-nennung">
              {t("bedingungswechsel.ohneNennung", { count: ohneThemaVerdeckt, neu: v.neu })}
            </p>
          ) : null}
        </div>
      );
    }
  }

  return (
    <div
      data-testid="bedingungswechsel"
      className="mb-2 rounded-btn bg-page px-3 py-1.5 text-[12.5px] text-muted"
    >
      <button
        type="button"
        data-testid="bedingungswechsel-umschalten"
        aria-expanded={offen}
        onClick={() => setOffen((x) => !x)}
        className="text-left"
      >
        <span className="font-semibold text-text">{t("bedingungswechsel.titel")}</span>{" "}
        <span>{t(offen ? "bedingungswechsel.offen" : "bedingungswechsel.zu")}</span>
      </button>
      {offen ? (
        <>
          <p className="mt-1 text-muted-2">{t("bedingungswechsel.beispiel")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {feld("bisher", bisher, setBisher)}
            {feld("neu", neu, setNeu)}
            {feld("thema", thema, setThema)}
          </div>
          <datalist id="bedingungswechsel-vorschlaege">
            {vorschlaege.map((eintrag) => (
              <option key={eintrag} value={eintrag} />
            ))}
          </datalist>
          <p className="mt-2 text-muted-2">{t("bedingungswechsel.hinweis")}</p>
          {inhalt}
        </>
      ) : null}
    </div>
  );
}
