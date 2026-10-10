import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKoTimestamp } from "../../lib/koDates";
import { leerzustandsZeile } from "../EmptyStateCtas";
import { Button, Card, SectionLabel } from "../ui";
import {
  type EigeneKenntnisnahme,
  type KenntnisnahmeAnforderung,
  type KenntnisnahmeStatus,
  fehlerGrund,
  fristAusDatum,
  kenntnisnahmeApi,
} from "./api";

// ================================================================================================
// KENNTNISNAHME · die Fläche am gelesenen Eintrag.
// ================================================================================================
//
// ZWEI TEILE, ZWEI RECHTE:
//   · der EMPFÄNGER sieht seine eigene Anforderung zu diesem Eintrag und bestätigt sie mit einem
//     ausdrücklichen Klick. Das Öffnen dieser Fläche liest nur — es gibt hier keinen Effekt, der
//     beim Anzeigen, Scrollen oder Verlassen etwas schreibt.
//   · wer das Zuweisungsrecht hat (Controller/Admin), fordert die Kenntnisnahme der gültigen
//     Fassung an und sieht die Übersicht. Die Rolle steuert nur die ANZEIGE; entschieden wird am
//     Server (`ko.assign` + Sichtbarkeit).
//
// Die Fläche nennt das Ergebnis durchgehend „Kenntnisnahme" und sagt, was es nicht ist.

const STATUS_TON: Record<KenntnisnahmeStatus, string> = {
  ausstehend: "bg-hairline-soft text-muted",
  bestaetigt: "bg-trust-pos-bg text-trust-pos-text",
  ueberfaellig: "bg-trust-warn-bg text-trust-warn-text",
  ueberholt: "bg-hairline-soft text-muted-2",
};

const MEINE = ["kenntnisnahmen", "meine"] as const;
const uebersichtSchluessel = (koId: string) => ["kenntnisnahmen", "uebersicht", koId] as const;

function StatusPille({ status }: { status: KenntnisnahmeStatus }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid="kenntnisnahme-status"
      data-status={status}
      className={`rounded-[999px] px-2 py-[2px] text-[11px] font-semibold ${STATUS_TON[status]}`}
    >
      {t(`kenntnisnahme.status.${status}`)}
    </span>
  );
}

function useDatum(): (iso: string) => string {
  const { i18n } = useTranslation();
  return (iso) => formatKoTimestamp(iso, i18n.language) ?? "—";
}

function fehlerText(t: TFunction, fehler: unknown): string {
  const grund = fehlerGrund(fehler);
  const bekannt = [
    "keine_gueltige_fassung",
    "fassung_veraltet",
    "empfaenger_ohne_zugriff",
    "frist_ungueltig",
    "keine_empfaenger",
    "ueberholt",
    "fassung_abweichend",
    "nicht_haltbar",
  ];
  return grund && bekannt.includes(grund)
    ? t(`kenntnisnahme.fehler.${grund}`)
    : t("kenntnisnahme.fehler.allgemein");
}

// ------------------------------------------------------------------------------------------------
// Der Empfänger: die eigene Anforderung, bestätigt nur durch den Klick.
// ------------------------------------------------------------------------------------------------

function EigeneAnforderung({ eintrag }: { eintrag: EigeneKenntnisnahme }): JSX.Element {
  const { t } = useTranslation();
  const datum = useDatum();
  const queryClient = useQueryClient();
  // Die Sperre gegen den Doppelklick greift SOFORT beim ersten Klick. `isPending` der Mutation
  // kommt erst im nächsten Takt an (Benachrichtigungsplaner von TanStack Query); ein zweiter Klick
  // davor schickte sonst einen zweiten Request. Der Ref schützt synchron, der Zustand sperrt den
  // Knopf schon im selben Rendern.
  const laeuft = useRef(false);
  const [gesendet, setGesendet] = useState(false);
  const bestaetigen = useMutation({
    mutationFn: () => kenntnisnahmeApi.bestaetigen(eintrag.anforderungId, eintrag.fassung),
    // Nach Erfolg bleibt der Knopf gesperrt, bis der neu gelesene Stand ihn ersetzt. Nur ein
    // Fehler gibt ihn für einen erneuten Versuch frei.
    onError: () => {
      laeuft.current = false;
      setGesendet(false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MEINE }),
  });
  const absenden = (): void => {
    if (laeuft.current) {
      return;
    }
    laeuft.current = true;
    setGesendet(true);
    bestaetigen.mutate();
  };
  const sperrt = gesendet || bestaetigen.isPending;
  const offen = eintrag.status === "ausstehend" || eintrag.status === "ueberfaellig";
  return (
    <div data-testid="kenntnisnahme-eigen" className="space-y-1.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPille status={eintrag.status} />
        <span className="text-muted">
          {eintrag.frist
            ? t("kenntnisnahme.frist", { datum: datum(eintrag.frist) })
            : t("kenntnisnahme.ohneFrist")}
        </span>
      </div>
      <p className="text-text">
        {t("kenntnisnahme.eigen.angefordert", {
          name: eintrag.angefordertVon,
          datum: datum(eintrag.angefordertAm),
          fassung: eintrag.fassung,
        })}
      </p>
      {eintrag.status === "bestaetigt" && eintrag.bestaetigtAm ? (
        <p data-testid="kenntnisnahme-bestaetigt" className="text-trust-pos-text">
          {t("kenntnisnahme.eigen.bestaetigt", {
            fassung: eintrag.fassung,
            datum: datum(eintrag.bestaetigtAm),
          })}
        </p>
      ) : null}
      {eintrag.status === "ueberholt" ? (
        <p className="text-muted">
          {t("kenntnisnahme.eigen.ueberholt", {
            aktuell: eintrag.aktuelleFassung,
            fassung: eintrag.fassung,
          })}
        </p>
      ) : null}
      {offen ? (
        <div className="space-y-1">
          <p className="text-[12px] text-muted">{t("kenntnisnahme.eigen.nichtAutomatisch")}</p>
          <Button
            variant="primary"
            data-testid="kenntnisnahme-bestaetigen"
            disabled={sperrt}
            onClick={absenden}
          >
            {sperrt
              ? t("kenntnisnahme.eigen.laeuft")
              : t("kenntnisnahme.eigen.bestaetigen", { fassung: eintrag.fassung })}
          </Button>
        </div>
      ) : null}
      {bestaetigen.isError ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, bestaetigen.error)}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Der Anfordernde: anfordern und die Übersicht.
// ------------------------------------------------------------------------------------------------

function Anforderungszeile({
  anforderung,
  koId,
}: {
  anforderung: KenntnisnahmeAnforderung;
  koId: string;
}): JSX.Element {
  const { t } = useTranslation();
  const datum = useDatum();
  const queryClient = useQueryClient();
  const erinnern = useMutation({
    mutationFn: () => kenntnisnahmeApi.erinnern(anforderung.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: uebersichtSchluessel(koId) }),
  });
  const offen = anforderung.zaehlung.ausstehend + anforderung.zaehlung.ueberfaellig;
  return (
    <li data-testid="kenntnisnahme-anforderung" className="space-y-1 border-t border-hairline pt-2">
      <p className="text-[13px] font-semibold text-text">
        {t("kenntnisnahme.uebersicht.kopf", {
          fassung: anforderung.fassung,
          name: anforderung.angefordertVon.name,
          datum: datum(anforderung.angefordertAm),
        })}
      </p>
      <p className="text-[12px] text-muted">
        {anforderung.frist
          ? t("kenntnisnahme.frist", { datum: datum(anforderung.frist) })
          : t("kenntnisnahme.ohneFrist")}
        {" · "}
        {t("kenntnisnahme.uebersicht.zaehlung", { ...anforderung.zaehlung })}
      </p>
      <ul className="space-y-0.5">
        {anforderung.empfaenger.map((e) => (
          <li
            key={e.id}
            data-testid="kenntnisnahme-empfaenger"
            className="flex flex-wrap items-center gap-2 text-[12.5px]"
          >
            <span className="text-text">{e.name}</span>
            <StatusPille status={e.status} />
            {e.bestaetigtAm ? (
              <span className="text-muted">
                {t("kenntnisnahme.uebersicht.bestaetigtAm", { datum: datum(e.bestaetigtAm) })}
                {e.nachFrist ? ` · ${t("kenntnisnahme.uebersicht.nachFrist")}` : ""}
              </span>
            ) : null}
            {e.zugriff ? null : (
              <span className="text-trust-warn-text">
                {t("kenntnisnahme.uebersicht.keinZugriff")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        {anforderung.erinnertAm ? (
          <span>
            {t("kenntnisnahme.uebersicht.erinnert", { datum: datum(anforderung.erinnertAm) })}
          </span>
        ) : null}
        {offen > 0 ? (
          <Button
            data-testid="kenntnisnahme-erinnern"
            disabled={erinnern.isPending}
            onClick={() => erinnern.mutate()}
          >
            {t("kenntnisnahme.uebersicht.erinnern")}
          </Button>
        ) : null}
        {erinnern.isSuccess ? (
          <output>
            {t("kenntnisnahme.uebersicht.erinnertAnzahl", { anzahl: erinnern.data.erinnert })}
          </output>
        ) : null}
        {erinnern.isError ? (
          <span role="alert" className="text-trust-warn-text">
            {fehlerText(t, erinnern.error)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function AnfordernUndUebersicht({ koId }: { koId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const uebersicht = useQuery({
    queryKey: uebersichtSchluessel(koId),
    queryFn: () => kenntnisnahmeApi.uebersicht(koId),
    retry: false,
  });
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [fristDatum, setFristDatum] = useState("");
  const anfordern = useMutation({
    mutationFn: (fassung: number) =>
      kenntnisnahmeApi.anfordern(koId, {
        fassung,
        empfaenger: auswahl,
        frist: fristDatum ? fristAusDatum(fristDatum) : null,
      }),
    onSuccess: () => {
      setAuswahl([]);
      setFristDatum("");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: uebersichtSchluessel(koId) }),
  });
  const daten = uebersicht.data;
  if (!daten) {
    return null;
  }
  const umschalten = (id: string): void =>
    setAuswahl((vorher) =>
      vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id],
    );
  return (
    <div data-testid="kenntnisnahme-anfordern" className="space-y-3">
      {daten.gueltig ? (
        <form
          className="space-y-2"
          onSubmit={(ereignis) => {
            ereignis.preventDefault();
            if (!anfordern.isPending) {
              anfordern.mutate(daten.aktuelleFassung);
            }
          }}
        >
          <SectionLabel>{t("kenntnisnahme.anfordern.titel")}</SectionLabel>
          <fieldset className="space-y-1">
            <legend className="text-[12.5px] text-muted">
              {t("kenntnisnahme.anfordern.empfaenger")}
            </legend>
            {daten.moeglicheEmpfaenger.length === 0 ? (
              <p className="text-[12.5px] text-muted">
                {t("kenntnisnahme.anfordern.keineEmpfaenger")}
              </p>
            ) : (
              daten.moeglicheEmpfaenger.map((k) => (
                <label key={k.id} className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="checkbox"
                    data-testid="kenntnisnahme-empfaenger-wahl"
                    value={k.id}
                    checked={auswahl.includes(k.id)}
                    onChange={() => umschalten(k.id)}
                  />
                  {k.name}
                </label>
              ))
            )}
          </fieldset>
          <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            {t("kenntnisnahme.anfordern.frist")}
            <input
              type="date"
              data-testid="kenntnisnahme-frist"
              value={fristDatum}
              onChange={(ereignis) => setFristDatum(ereignis.target.value)}
              className="rounded-btn border border-hairline px-2 py-1 text-[13px] text-text"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            data-testid="kenntnisnahme-anfordern-absenden"
            disabled={auswahl.length === 0 || anfordern.isPending}
          >
            {anfordern.isPending
              ? t("kenntnisnahme.anfordern.laeuft")
              : t("kenntnisnahme.anfordern.absenden", { fassung: daten.aktuelleFassung })}
          </Button>
          {anfordern.isSuccess ? (
            <output
              data-testid="kenntnisnahme-angefordert"
              className="block text-[12.5px] text-muted"
            >
              {[
                anfordern.data.neu.length > 0
                  ? t("kenntnisnahme.anfordern.angelegt", { anzahl: anfordern.data.neu.length })
                  : "",
                anfordern.data.bereits.length > 0
                  ? t("kenntnisnahme.anfordern.bereits", { anzahl: anfordern.data.bereits.length })
                  : "",
              ]
                .filter((satz) => satz.length > 0)
                .join(" ")}
            </output>
          ) : null}
          {anfordern.isError ? (
            <p role="alert" className="text-[12.5px] text-trust-warn-text">
              {fehlerText(t, anfordern.error)}
            </p>
          ) : null}
        </form>
      ) : (
        <p data-testid="kenntnisnahme-entwurf" className="text-[12.5px] text-muted">
          {t("kenntnisnahme.fehler.keine_gueltige_fassung")}
        </p>
      )}
      <div>
        <SectionLabel>{t("kenntnisnahme.uebersicht.titel")}</SectionLabel>
        {daten.anforderungen.length === 0 ? (
          <>
            <p className="text-[12.5px] text-muted">{t("kenntnisnahme.uebersicht.leer")}</p>
            {leerzustandsZeile(t, "objekt")}
          </>
        ) : (
          <ul className="space-y-2">
            {daten.anforderungen.map((a) => (
              <Anforderungszeile key={a.id} anforderung={a} koId={koId} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// LESEN-INHALT-ZUERST · die Fläche steht NACH dem Inhalt, und sie ist nur so gross wie ihr Anlass.
// ------------------------------------------------------------------------------------------------
//
// Beobachtet am 07.10.2026: wer das Zuweisungsrecht hat, sah an JEDEM gültigen Eintrag vor dem Titel
// eine etwa 280 px hohe Karte (Hinweis, Empfängerliste, Frist, Knopf, Übersicht) — ohne dass von ihm
// irgendetwas verlangt war. Jetzt gilt:
//   · KEINE eigene Anforderung → eine zugeklappte Zeile „Kenntnisnahme: anfordern und Übersicht".
//     Anfordern und Übersicht sind unverändert dahinter; gemountet bleiben sie, damit der Stand der
//     Übersicht beim Aufklappen schon da ist (dieselbe eine Abfrage wie bisher).
//   · EIGENE Anforderung (Pflicht) → die Karte steht offen mit Status und Bestätigen-Knopf; das
//     Anfordern für andere liegt darin zugeklappt. Oben in der Lesespalte steht dazu nur EIN Satz
//     mit Sprung hierher (`KenntnisnahmeVerweis`) — die Pflicht bleibt sichtbar, der Inhalt vorn.

function AnfordernZeile({ koId, hinweis }: { koId: string; hinweis: boolean }): JSX.Element {
  const { t } = useTranslation();
  return (
    <details data-testid="kenntnisnahme-verwalten" className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-[13px] font-semibold text-text">
        {t("lesereihenfolge.kenntnisnahme.verwalten")}
        <span aria-hidden className="text-[11px] text-muted-2 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-3 border-t border-hairline-soft py-3">
        {hinweis ? <p className="text-[12px] text-muted">{t("kenntnisnahme.hinweis")}</p> : null}
        <AnfordernUndUebersicht koId={koId} />
      </div>
    </details>
  );
}

const BESTAETIGEN_KNOPF = '[data-testid="kenntnisnahme-bestaetigen"]';

/** Offen heisst: der Empfänger muss noch klicken (ausstehend oder überfällig). */
function istOffen(e: EigeneKenntnisnahme): boolean {
  return e.status === "ausstehend" || e.status === "ueberfaellig";
}

/**
 * Die Kenntnisnahme am gelesenen Eintrag. Ohne eigene Anforderung und ohne Zuweisungsrecht
 * erscheint nichts — die Lesefläche bleibt dann unverändert.
 *
 * `zielId` ist der Sprunganker für `KenntnisnahmeVerweis` oben in der Lesespalte.
 */
export function KenntnisnahmeBereich({
  koId,
  darfAnfordern,
  zielId,
}: {
  koId: string;
  darfAnfordern: boolean;
  zielId?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const meine = useQuery({ queryKey: MEINE, queryFn: kenntnisnahmeApi.meine, retry: false });
  const eigene = (meine.data?.eintraege ?? []).filter((e) => e.koId === koId);
  if (eigene.length === 0 && !darfAnfordern) {
    return null;
  }
  if (eigene.length === 0) {
    // Nur das Zuweisungsrecht, nichts verlangt: eine Zeile, zugeklappt.
    return (
      <div
        id={zielId}
        data-testid="kenntnisnahme-bereich"
        data-kenntnisnahme-lage="nur-anfordern"
        className="rounded-card border border-hairline bg-surface px-4 shadow-tile"
      >
        <AnfordernZeile koId={koId} hinweis />
      </div>
    );
  }
  return (
    <Card
      interactive={false}
      className="space-y-3"
      data-testid="kenntnisnahme-bereich"
      data-kenntnisnahme-lage={eigene.some(istOffen) ? "pflicht-offen" : "eigene"}
      {...(zielId ? { id: zielId } : {})}
    >
      <SectionLabel>{t("kenntnisnahme.titel")}</SectionLabel>
      <p className="text-[12px] text-muted">{t("kenntnisnahme.hinweis")}</p>
      {eigene.map((e) => (
        <EigeneAnforderung key={e.anforderungId} eintrag={e} />
      ))}
      {darfAnfordern ? <AnfordernZeile koId={koId} hinweis={false} /> : null}
    </Card>
  );
}

/**
 * EIN Satz oben in der Lesespalte, nur solange die EIGENE Kenntnisnahme noch aussteht — mit Sprung
 * zum Bestätigen-Knopf unten. Dieselbe Abfrage wie die Fläche (`MEINE`): kein zweiter Abruf, kein
 * zweiter Stand. Er bestätigt nichts; bestätigt wird weiterhin nur durch den Klick unten.
 */
export function KenntnisnahmeVerweis({
  koId,
  zielId,
}: {
  koId: string;
  zielId: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const meine = useQuery({ queryKey: MEINE, queryFn: kenntnisnahmeApi.meine, retry: false });
  const offen = (meine.data?.eintraege ?? []).some((e) => e.koId === koId && istOffen(e));
  if (!offen) {
    return null;
  }
  const springen = (): void => {
    const ziel = document.getElementById(zielId);
    if (!ziel) {
      return;
    }
    if (typeof ziel.scrollIntoView === "function") {
      ziel.scrollIntoView({ block: "center" });
    }
    const knopf = ziel.querySelector<HTMLButtonElement>(BESTAETIGEN_KNOPF);
    (knopf ?? ziel).focus();
  };
  return (
    <p
      data-testid="kenntnisnahme-verweis"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-btn bg-trust-warn-bg px-3 py-1.5 text-[12.5px] text-trust-warn-text"
    >
      <span>{t("lesereihenfolge.kenntnisnahme.offen")}</span>
      <button
        type="button"
        data-testid="kenntnisnahme-verweis-sprung"
        onClick={springen}
        className="font-semibold underline"
      >
        {t("lesereihenfolge.kenntnisnahme.zumBestaetigen")}
      </button>
    </p>
  );
}
