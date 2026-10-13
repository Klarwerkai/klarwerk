// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — REALE WERTE DER WISSENSBEWERTUNG ERFASSEN.
// ================================================================================================
//
// Eine Karte, zwei Orte: die Kapital-Sicht (`/kapital`, Bereichswahl über alle sichtbaren Bereiche)
// und die Spaceseite (`/spaces/:id`, fester Bereich, erst beim Aufklappen geladen). Die Karte zeigt
// den gespeicherten Stand mit Zeitraum, Herkunft und Stand, rechnet daraus mit DERSELBEN Formel wie
// die Beispielrechnung (lib/lagebildRechnung.ts) — oder sagt konkret, warum kein Geldwert entsteht.
//
// SCHREIBEN (LWE-06): jede Eingabe trägt den Stand, auf dem sie beruht (`basisVersion`), und eine
// Kennung des Speichervorgangs (`anfrageId`).
//   · 409 — inzwischen geändert: nichts wurde geschrieben, die Eingabe bleibt im Formular; übernommen
//     oder bewusst darüber gespeichert wird erst auf ausdrücklichen Klick.
//   · Netz-/Serverfehler — der Ausgang ist UNBEKANNT und wird so benannt. „Erneut senden" schickt
//     dieselbe Kennung; war der erste Versuch erfolgreich, antwortet der Server mit diesem Stand
//     statt einer zweiten Anlage. Eine geänderte Eingabe bekommt eine neue Kennung.
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useLagebildWerte } from "../api/hooks";
import type {
  LagebildBereich,
  LagebildFeld,
  LagebildWert,
  LagebildWerte,
  LagebildWerteEingabe,
} from "../api/types";
import { DEFAULT_ASSUMPTIONS, formatEur } from "../lib/knowledgeValuation";
import { formatKoTimestamp } from "../lib/koDates";
import {
  LAGEBILD_FELDER,
  type LagebildForm,
  type LagebildFormFeld,
  formAusWerten,
  lagebildRechnung,
  zahlAusText,
} from "../lib/lagebildRechnung";
import { Button, Card, SectionLabel } from "./ui";

const FELD_KLASSE =
  "mt-1 h-9 w-full rounded-input border border-hairline bg-page px-2 text-sm text-text";
const LAGEBILD_SCHLUESSEL = ["management", "lagebild-werte"] as const;

function neueAnfrageId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `lb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function zahl(wert: number, sprache: string): string {
  return wert.toLocaleString(sprache);
}

/** Der gespeicherte Stand: je Wert Feldname, Einheit, Angabe und Herkunft; dazu Zeitraum und Stand. */
function LagebildAnzeige({
  werte,
  vonMir,
}: {
  werte: LagebildWerte;
  vonMir: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <div data-testid="lagebild-anzeige" data-version={werte.version} className="mt-2 space-y-1.5">
      <p data-testid="lagebild-zeitraum" className="text-[12px] text-muted">
        {t("lagebildwerte.zeitraum", { von: werte.zeitraumVon, bis: werte.zeitraumBis })}
      </p>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left font-mono text-klein uppercase text-muted-2">
            <th className="py-1">{t("lagebildwerte.spalte.feld")}</th>
            <th className="py-1">{t("lagebildwerte.spalte.angabe")}</th>
            <th className="py-1">{t("lagebildwerte.spalte.herkunft")}</th>
          </tr>
        </thead>
        <tbody>
          {LAGEBILD_FELDER.map((feld) => {
            const w = werte.werte[feld];
            return (
              <tr
                key={feld}
                data-testid="lagebild-zeile"
                data-feld={feld}
                data-herkunft={w?.herkunft ?? "nicht_erfasst"}
                className="border-t border-hairline align-top"
              >
                <td className="py-1.5 pr-2">{t(`lagebildwerte.feld.${feld}`)}</td>
                <td className="py-1.5 pr-2" data-testid="lagebild-angabe">
                  {w ? (
                    <>
                      {zahl(w.wert, i18n.language)} {t(`lagebildwerte.einheit.${feld}`)}
                    </>
                  ) : (
                    <span className="text-muted-2">{t("lagebildwerte.nichtErfasst")}</span>
                  )}
                </td>
                <td className="py-1.5" data-testid="lagebild-herkunft">
                  {w ? t(`lagebildwerte.herkunft.${w.herkunft}`) : null}
                  {w?.beleg ? (
                    <span className="block text-[11.5px] text-muted-2">
                      {t("lagebildwerte.beleg", { beleg: w.beleg })}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p data-testid="lagebild-stand" className="text-[11.5px] text-muted-2">
        {t("lagebildwerte.stand", {
          version: werte.version,
          zeit: formatKoTimestamp(werte.geaendertAm, i18n.language) ?? werte.geaendertAm,
          wer: t(vonMir ? "lagebildwerte.wer.selbst" : "lagebildwerte.wer.andere"),
        })}
      </p>
    </div>
  );
}

/** Der Geldwert aus den realen Werten — oder die konkreten Gründe, warum es keinen gibt. */
function LagebildErgebnis({ bereich }: { bereich: LagebildBereich }): JSX.Element {
  const { t } = useTranslation();
  const r = lagebildRechnung(bereich.fakten, bereich.werte);
  const f = bereich.fakten;
  return (
    <div data-testid="lagebild-ergebnis" data-zustand={r.zustand} className="mt-3">
      <SectionLabel>{t("lagebildwerte.ergebnis.titel")}</SectionLabel>
      {r.zustand === "berechnet" ? (
        <>
          <div data-testid="lagebild-ergebnis-eur" className="text-2xl font-semibold text-ink">
            {formatEur(r.estimateEur)}
          </div>
          <p
            data-testid="lagebild-art"
            data-art={r.art}
            className="mt-1 rounded-card bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
          >
            {t(`lagebildwerte.art.${r.art}`)}
          </p>
          {r.negativ ? (
            <p data-testid="lagebild-negativ" className="mt-1 text-[12px] text-trust-crit-text">
              {t("lagebildwerte.negativ")}
            </p>
          ) : null}
          <div className="mt-1 font-mono text-[11px] text-muted-2">{r.formula}</div>
        </>
      ) : (
        <div data-testid="lagebild-nicht-berechenbar" className="text-[12.5px] text-text">
          <p>{t("lagebildwerte.nichtBerechenbar")}</p>
          <ul className="ml-4 list-disc">
            {r.gruende.map((g) => (
              <li key={g} data-testid="lagebild-grund" data-grund={g}>
                {t(`lagebildwerte.grund.${g}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p data-testid="lagebild-basis" className="mt-1 text-[11px] text-muted-2">
        {t("lagebildwerte.basis", { n: f.validatedKos, total: f.totalKos, trust: f.avgTrust })}
      </p>
      {f.demoKos > 0 ? (
        <p data-testid="lagebild-demo" className="text-[11px] text-trust-warn-text">
          {t("lagebildwerte.demo", { demo: f.demoKos })}
        </p>
      ) : null}
    </div>
  );
}

type Lage =
  | { art: "bereit" }
  | { art: "laeuft" }
  | { art: "unbekannt" }
  | { art: "fehler"; meldungen: string[] }
  | { art: "konflikt"; aktuell: LagebildWerte | null; vonMir: boolean };

const BEISPIEL: Record<LagebildFeld, number> = DEFAULT_ASSUMPTIONS;

function LagebildFormular({
  bereich,
  onGespeichert,
  onAbbrechen,
}: {
  bereich: LagebildBereich;
  onGespeichert: (eintrag: LagebildWerte, wiederholt: boolean) => void;
  onAbbrechen: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const id = useId();
  const [form, setForm] = useState<LagebildForm>(() => formAusWerten(bereich.werte));
  const [basisVersion, setBasisVersion] = useState(bereich.werte?.version ?? 0);
  const [anfrageId, setAnfrageId] = useState<string | null>(null);
  const [lage, setLage] = useState<Lage>({ art: "bereit" });

  // Jede Änderung ist ein NEUER Speichervorgang — eine alte Kennung gehörte zu anderen Werten.
  const aendern = (neu: LagebildForm): void => {
    setForm(neu);
    setAnfrageId(null);
    if (lage.art === "unbekannt" || lage.art === "fehler") {
      setLage({ art: "bereit" });
    }
  };
  const setzeFeld =
    (feld: LagebildFeld, teil: keyof LagebildFormFeld) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const neu = { ...form.felder[feld], [teil]: e.target.value } as LagebildFormFeld;
      aendern({ ...form, felder: { ...form.felder, [feld]: neu } });
    };

  async function senden(basis: number): Promise<void> {
    const meldungen: string[] = [];
    const werte = {} as Record<LagebildFeld, LagebildWert | null>;
    for (const feld of LAGEBILD_FELDER) {
      const eingabe = form.felder[feld];
      const n = zahlAusText(eingabe.wert);
      if (n === undefined) {
        const name = t(`lagebildwerte.feld.${feld}`);
        meldungen.push(t("lagebildwerte.form.keineZahl", { feld: name }));
        werte[feld] = null;
        continue;
      }
      werte[feld] =
        n === null
          ? null
          : { wert: n, herkunft: eingabe.herkunft, beleg: eingabe.beleg.trim() || null };
    }
    if (meldungen.length > 0) {
      setLage({ art: "fehler", meldungen });
      return;
    }
    const kennung = anfrageId ?? neueAnfrageId();
    setAnfrageId(kennung);
    const body: LagebildWerteEingabe = {
      zeitraumVon: form.zeitraumVon,
      zeitraumBis: form.zeitraumBis,
      werte,
      basisVersion: basis,
      anfrageId: kennung,
    };
    setLage({ art: "laeuft" });
    try {
      const antwort = await endpoints.management.setLagebildWerte(bereich.bereich, body);
      await qc.invalidateQueries({ queryKey: LAGEBILD_SCHLUESSEL });
      onGespeichert(antwort.eintrag, antwort.wiederholt);
    } catch (fehler) {
      if (!(fehler instanceof ApiError) || fehler.status >= 500 || fehler.status === 408) {
        // Ausgang unbekannt: Kennung bleibt, damit „Erneut senden" nicht doppelt anlegt.
        setLage({ art: "unbekannt" });
        return;
      }
      setAnfrageId(null);
      if (fehler.status === 409) {
        const aktuell = (fehler.details.aktuell as LagebildWerte | null | undefined) ?? null;
        setLage({ art: "konflikt", aktuell, vonMir: fehler.details.aktuellVonMir === true });
        return;
      }
      const liste = Array.isArray(fehler.details.fehler)
        ? (fehler.details.fehler as { meldung?: unknown }[])
            .map((f) => (typeof f.meldung === "string" ? f.meldung : ""))
            .filter((m) => m !== "")
        : [];
      setLage({ art: "fehler", meldungen: liste.length > 0 ? liste : [fehler.message] });
    }
  }

  const laeuft = lage.art === "laeuft";
  return (
    <form
      data-testid="lagebild-form"
      className="mt-3 space-y-3 rounded-card border border-hairline p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void senden(basisVersion);
      }}
    >
      <SectionLabel>{t("lagebildwerte.form.titel")}</SectionLabel>
      <p className="text-[12px] text-muted">{t("lagebildwerte.form.leerHinweis")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] text-muted" htmlFor={`${id}-von`}>
          {t("lagebildwerte.form.zeitraumVon")}
          <input
            id={`${id}-von`}
            data-testid="lagebild-von"
            type="date"
            value={form.zeitraumVon}
            onChange={(e) => aendern({ ...form, zeitraumVon: e.target.value })}
            className={FELD_KLASSE}
          />
        </label>
        <label className="text-[12px] text-muted" htmlFor={`${id}-bis`}>
          {t("lagebildwerte.form.zeitraumBis")}
          <input
            id={`${id}-bis`}
            data-testid="lagebild-bis"
            type="date"
            value={form.zeitraumBis}
            onChange={(e) => aendern({ ...form, zeitraumBis: e.target.value })}
            className={FELD_KLASSE}
          />
        </label>
      </div>
      <p className="text-[11.5px] text-muted-2">{t("lagebildwerte.form.zeitraumHilfe")}</p>
      {LAGEBILD_FELDER.map((feld) => (
        <fieldset
          key={feld}
          data-testid="lagebild-feld"
          data-feld={feld}
          className="m-0 min-w-0 space-y-1 border-0 border-t border-hairline p-0 pt-2"
        >
          <legend className="text-[12.5px] font-medium text-text">
            {t(`lagebildwerte.feld.${feld}`)} ({t(`lagebildwerte.einheit.${feld}`)})
          </legend>
          <p className="text-[11.5px] text-muted-2">
            {t(`lagebildwerte.hilfe.${feld}`)}{" "}
            {t("lagebildwerte.beispielwert", { wert: zahl(BEISPIEL[feld], i18n.language) })}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[12px] text-muted" htmlFor={`${id}-${feld}-wert`}>
              {t("lagebildwerte.spalte.angabe")}
              <input
                id={`${id}-${feld}-wert`}
                data-testid={`lagebild-eingabe-${feld}`}
                inputMode="decimal"
                value={form.felder[feld].wert}
                onChange={setzeFeld(feld, "wert")}
                className={FELD_KLASSE}
              />
            </label>
            <label className="text-[12px] text-muted" htmlFor={`${id}-${feld}-herkunft`}>
              {t("lagebildwerte.form.herkunft")}
              <select
                id={`${id}-${feld}-herkunft`}
                data-testid={`lagebild-herkunft-${feld}`}
                value={form.felder[feld].herkunft}
                onChange={setzeFeld(feld, "herkunft")}
                className={FELD_KLASSE}
              >
                <option value="eigene_eingabe">{t("lagebildwerte.herkunft.eigene_eingabe")}</option>
                <option value="gemessen">{t("lagebildwerte.herkunft.gemessen")}</option>
              </select>
            </label>
            <label className="text-[12px] text-muted" htmlFor={`${id}-${feld}-beleg`}>
              {t("lagebildwerte.form.beleg")}
              <input
                id={`${id}-${feld}-beleg`}
                data-testid={`lagebild-beleg-${feld}`}
                value={form.felder[feld].beleg}
                maxLength={300}
                onChange={setzeFeld(feld, "beleg")}
                className={FELD_KLASSE}
              />
            </label>
          </div>
        </fieldset>
      ))}
      <p className="text-[11.5px] text-muted-2">{t("lagebildwerte.form.belegHilfe")}</p>

      {lage.art === "fehler" ? (
        <div
          role="alert"
          data-testid="lagebild-fehler"
          className="text-[12.5px] text-trust-crit-text"
        >
          <p>{t("lagebildwerte.form.fehler")}</p>
          <ul className="ml-4 list-disc">
            {lage.meldungen.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {lage.art === "unbekannt" ? (
        <div role="alert" data-testid="lagebild-unbekannt" className="text-[12.5px] text-text">
          <p>{t("lagebildwerte.form.unbekannt")}</p>
          <Button
            type="button"
            data-testid="lagebild-erneut"
            className="mt-1"
            onClick={() => void senden(basisVersion)}
          >
            {t("lagebildwerte.form.erneut")}
          </Button>
        </div>
      ) : null}
      {lage.art === "konflikt" ? (
        <div role="alert" data-testid="lagebild-konflikt" className="text-[12.5px] text-text">
          <p>
            {lage.aktuell
              ? t("lagebildwerte.form.konflikt", {
                  version: lage.aktuell.version,
                  zeit:
                    formatKoTimestamp(lage.aktuell.geaendertAm, i18n.language) ??
                    lage.aktuell.geaendertAm,
                  wer: t(lage.vonMir ? "lagebildwerte.wer.selbst" : "lagebildwerte.wer.andere"),
                })
              : t("lagebildwerte.form.konfliktOhneStand")}
          </p>
          {lage.aktuell ? (
            <>
              <p className="mt-1 text-[12px] text-muted">{t("lagebildwerte.form.aktuell")}</p>
              <LagebildAnzeige werte={lage.aktuell} vonMir={lage.vonMir} />
            </>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" data-testid="lagebild-uebernehmen" onClick={onAbbrechen}>
              {t("lagebildwerte.form.uebernehmen")}
            </Button>
            <Button
              type="button"
              data-testid="lagebild-ueberschreiben"
              onClick={() => {
                const neu = lage.aktuell?.version ?? 0;
                setBasisVersion(neu);
                void senden(neu);
              }}
            >
              {t("lagebildwerte.form.ueberschreiben")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" data-testid="lagebild-speichern" disabled={laeuft}>
          {laeuft ? t("lagebildwerte.form.speichert") : t("lagebildwerte.form.speichern")}
        </Button>
        <Button type="button" data-testid="lagebild-abbrechen" onClick={onAbbrechen}>
          {t("lagebildwerte.form.abbrechen")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Die Karte. `bereich` fest (Spaceseite) oder frei wählbar (Kapital-Sicht); `faltbar` lädt erst
 * beim Aufklappen — die Spaceseite fragt so nicht bei jedem Öffnen nach.
 */
export function LagebildWerteKarte({
  bereich: fest,
  faltbar = false,
}: {
  bereich?: string;
  faltbar?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [offen, setOffen] = useState(!faltbar);
  const [gewaehlt, setGewaehlt] = useState(fest ?? "gesamt");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const abfrage = useLagebildWerte(offen);
  const auswahlId = useId();

  if (!offen) {
    return (
      <Card className="mb-4">
        <Button data-testid="lagebild-space-knopf" onClick={() => setOffen(true)}>
          {t("lagebildwerte.space.knopf")}
        </Button>
      </Card>
    );
  }

  const bereiche = abfrage.data?.bereiche ?? [];
  const aktiv = bereiche.find((b) => b.bereich === (fest ?? gewaehlt));
  const name = (b: LagebildBereich): string => b.name ?? t("lagebildwerte.bereich.gesamt");

  return (
    <Card className="mb-4" data-testid="lagebild-werte" data-bereich={aktiv?.bereich ?? ""}>
      <SectionLabel>{t("lagebildwerte.titel")}</SectionLabel>
      <p className="text-[12px] text-muted">{t("lagebildwerte.einleitung")}</p>
      {abfrage.isError && !abfrage.data ? (
        <p
          role="alert"
          data-testid="lagebild-laden-fehler"
          className="mt-2 text-[12.5px] text-text"
        >
          {t("lagebildwerte.fehler.laden")}
        </p>
      ) : null}
      {!abfrage.data && !abfrage.isError ? (
        <p className="mt-2 text-[12.5px] text-muted">{t("lagebildwerte.laedt")}</p>
      ) : null}
      {abfrage.data && fest === undefined ? (
        <label className="mt-2 block text-[12px] text-muted" htmlFor={auswahlId}>
          {t("lagebildwerte.bereich.label")}
          <select
            id={auswahlId}
            data-testid="lagebild-bereich-wahl"
            value={gewaehlt}
            onChange={(e) => {
              setGewaehlt(e.target.value);
              setBearbeiten(false);
              setMeldung(null);
            }}
            className={FELD_KLASSE}
          >
            {bereiche.map((b) => (
              <option key={b.bereich} value={b.bereich}>
                {name(b)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {abfrage.data && !aktiv ? (
        <p data-testid="lagebild-nicht-sichtbar" className="mt-2 text-[12.5px] text-muted">
          {t("lagebildwerte.nichtSichtbar")}
        </p>
      ) : null}
      {aktiv ? (
        <>
          {aktiv.werte ? (
            <LagebildAnzeige werte={aktiv.werte} vonMir={aktiv.vonMir} />
          ) : (
            <p data-testid="lagebild-leer" className="mt-2 text-[12.5px] text-muted">
              {t("lagebildwerte.leer")}
            </p>
          )}
          <LagebildErgebnis bereich={aktiv} />
          {meldung ? (
            // `<output>` trägt die Rolle `status` selbst (lint/a11y/useSemanticElements).
            <output data-testid="lagebild-meldung" className="mt-2 block text-[12.5px] text-text">
              {meldung}
            </output>
          ) : null}
          {aktiv.darfSchreiben ? (
            bearbeiten ? (
              // Schlüssel NUR der Bereich: eine Hintergrund-Auffrischung mit neuem Stand darf das
              // offene Formular nicht neu aufbauen und die Eingabe still verwerfen (LWE-06).
              <LagebildFormular
                key={aktiv.bereich}
                bereich={aktiv}
                onGespeichert={(eintrag, wiederholt) => {
                  setBearbeiten(false);
                  const schluessel = wiederholt
                    ? "lagebildwerte.form.wiederholt"
                    : "lagebildwerte.form.gespeichert";
                  setMeldung(t(schluessel, { version: eintrag.version }));
                }}
                onAbbrechen={() => {
                  setBearbeiten(false);
                  void qc.invalidateQueries({ queryKey: LAGEBILD_SCHLUESSEL });
                }}
              />
            ) : (
              <Button
                className="mt-3"
                data-testid="lagebild-bearbeiten"
                onClick={() => {
                  setMeldung(null);
                  setBearbeiten(true);
                }}
              >
                {t("lagebildwerte.bearbeiten")}
              </Button>
            )
          ) : (
            <p data-testid="lagebild-nur-lesen" className="mt-3 text-[12px] text-muted-2">
              {t(
                aktiv.bereich === "gesamt"
                  ? "lagebildwerte.nurLesen.gesamt"
                  : "lagebildwerte.nurLesen.space",
              )}
            </p>
          )}
        </>
      ) : null}
    </Card>
  );
}
