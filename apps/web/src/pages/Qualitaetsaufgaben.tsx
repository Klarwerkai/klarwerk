// ================================================================================================
// ADMIN-10 · QUALITÄTSAUFGABEN UND RÜCKMELDUNGEN — die gemeinsame Übersicht der Verwaltung.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Eine Ansicht auf bestehende Vorgänge, kein zweiter
// Arbeitsort: „Bearbeiten" führt in den vorhandenen Arbeitsweg genau dieses Vorgangs (Prüfseite des
// Beitrags, `/lebenszyklus?fall=…`, `/konflikte?fall=…`, Duplikatvergleich, `/risiko?fall=…`).
// Nur das Übernehmen einer belegten Rückmeldung geschieht hier — es fordert die vorhandene
// Revalidierung an (`POST /api/qualitaetsaufgaben/rueckmeldungen/:id/uebernehmen`).
//
// Liste und Zähler lesen DENSELBEN Abfrageschlüssel und DIESELBE Auswahlregel
// (`lib/qualitaetsaufgaben.ts`). Die Filterwahl steht in der Adresse; Zurück aus dem Arbeitsweg
// bringt sie mit. Die Übersicht wird bei jedem Betreten frisch geholt — ein Abschluss am Ursprung
// ist danach hier sichtbar, ohne dass andere Vorgänge mitgeschlossen werden.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  QUALITAETSAUFGABEN_KEY,
  type QualitaetsVorgang,
  VORGANG_TYPEN,
  VORGANG_ZUSTAENDE,
  type Zustaendig,
  qualitaetsaufgabenApi,
} from "../api/qualitaetsaufgaben";
import { PageHeader } from "../components/ui";
import { formatKoTimestamp } from "../lib/koDates";
import {
  type FilterDimension,
  OHNE,
  alterInTagen,
  einstiegsArt,
  einstiegsBilanz,
  filterAusAdresse,
  filterInAdresse,
  gefiltert,
  zaehleJe,
  zustaendigeIm,
} from "../lib/qualitaetsaufgaben";

/** Die Startseite der Verwaltung (ADMIN-01) — von dort führt der Weg hierher. */
const VERWALTUNG = "/admin";

// Kein eigener Fokusstil: der Ring kommt aus der einen Regel `*:focus-visible` (index.css).
const SELECT_KLASSE =
  "w-full rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-text";

const ZUSTAND_PUNKT: Record<string, string> = {
  offen: "bg-trust-warn-fill",
  in_arbeit: "bg-brand",
  eskaliert: "bg-trust-crit-fill",
  erledigt: "bg-trust-pos-fill",
  unklar: "bg-muted-2",
};

interface Meldung {
  art: "erfolg" | "fehler";
  text: string;
}

export function Qualitaetsaufgaben(): JSX.Element {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const abfrage = useQuery({
    queryKey: QUALITAETSAUFGABEN_KEY,
    queryFn: () => qualitaetsaufgabenApi.liste(),
    // Frischer Stand bei jedem Betreten und beim Zurückkehren ins Fenster: ein Abschluss am
    // Ursprung oder die Übernahme durch eine zweite Person steht danach hier.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const [params, setParams] = useSearchParams();
  const filter = filterAusAdresse(params);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);

  const setze = (dimension: FilterDimension, wert: string): void => {
    // `replace`: Filterklicks kosten keinen Zurück-Schritt; der Rückweg aus dem Arbeitsweg landet
    // auf genau dieser Auswahl.
    const neu = wert === "" ? null : wert;
    setParams((vorher) => filterInAdresse(vorher, dimension, neu), { replace: true });
  };
  const zuruecksetzen = (): void => {
    setParams(
      (vorher) => {
        let p = vorher;
        for (const d of ["space", "typ", "zustand", "zustaendig"] as const) {
          p = filterInAdresse(p, d, null);
        }
        return p;
      },
      { replace: true },
    );
  };

  const zeit = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? iso;
  const kalendertag = (tag: string): string => {
    const d = new Date(`${tag}T00:00:00`);
    return Number.isNaN(d.getTime()) ? tag : d.toLocaleDateString(i18n.language);
  };
  const personName = (p: { name: string | null }): string =>
    p.name ?? t("qualitaetsaufgaben.zustaendig.unbekannt");

  const uebernehmen = async (v: QualitaetsVorgang): Promise<void> => {
    setLaeuft(v.ursprung.id);
    setMeldung(null);
    const titel = v.inhalt[0]?.titel ?? "";
    try {
      const e = await qualitaetsaufgabenApi.uebernehmen(v.ursprung.id);
      setMeldung({
        art: "erfolg",
        text:
          e.art === "bereits"
            ? t("qualitaetsaufgaben.uebernahme.bereits", {
                zeit: zeit(e.am),
                wer: personName(e.durch),
              })
            : t(`qualitaetsaufgaben.uebernahme.${e.art}`, { titel }),
      });
    } catch (fehler) {
      setMeldung({
        art: "fehler",
        text:
          fehler instanceof ApiError && fehler.status === 404
            ? t("qualitaetsaufgaben.uebernahme.nichtGefunden")
            : t("qualitaetsaufgaben.uebernahme.fehler", {
                meldung: fehler instanceof Error ? fehler.message : String(fehler),
              }),
      });
    } finally {
      setLaeuft(null);
      // Immer frisch: auch nach „bereits" oder einem Fehler zeigt die Liste den Stand des Servers.
      await queryClient.invalidateQueries({ queryKey: QUALITAETSAUFGABEN_KEY });
    }
  };

  const kopf = (
    <>
      <PageHeader title={t("qualitaetsaufgaben.titel")} lead={t("qualitaetsaufgaben.leitsatz")} />
      <p className="-mt-3 mb-4 text-[13px]">
        <Link to={VERWALTUNG} className="text-brand-text underline">
          {t("qualitaetsaufgaben.zurueck")}
        </Link>
      </p>
    </>
  );

  if (abfrage.data === undefined) {
    const recht = abfrage.error instanceof ApiError && abfrage.error.status === 403;
    return (
      <div className="mx-auto max-w-4xl">
        {kopf}
        <div
          data-testid="qa-ladezustand"
          className="rounded-[14px] border border-hairline bg-surface px-4 py-3 text-[14px]"
        >
          {abfrage.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <span role="alert" className="flex-1">
                {t(recht ? "qualitaetsaufgaben.recht" : "qualitaetsaufgaben.fehler")}
              </span>
              {recht ? null : (
                <button
                  type="button"
                  onClick={() => void abfrage.refetch()}
                  className="rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold"
                >
                  {t("qualitaetsaufgaben.erneut")}
                </button>
              )}
            </div>
          ) : (
            <output>{t("qualitaetsaufgaben.laedt")}</output>
          )}
        </div>
      </div>
    );
  }

  const daten = abfrage.data;
  const alle = daten.vorgaenge;
  const sichtbar = gefiltert(alle, filter);
  const bilanz = einstiegsBilanz(sichtbar);
  const fehlend = VORGANG_TYPEN.filter((typ) => daten.quellen[typ] === "fehler");
  const spaceName = (id: string): string => daten.spaces.find((s) => s.id === id)?.name ?? id;
  const jetztMs = Date.parse(daten.stand);
  const filterAktiv = Object.values(filter).some((w) => w !== null);

  const option = (wert: string, name: string, zaehler: Map<string, number>) => (
    <option key={wert} value={wert}>
      {t("qualitaetsaufgaben.filter.option", { name, anzahl: zaehler.get(wert) ?? 0 })}
    </option>
  );

  const auswahl = (
    dimension: FilterDimension,
    werte: { wert: string; name: string }[],
  ): JSX.Element => {
    const zaehler = zaehleJe(alle, filter, dimension);
    const id = `qa-filter-${dimension}`;
    // Eine Wahl aus der Adresse, die im Bestand (nicht mehr) vorkommt, bleibt als eigene Option
    // sichtbar — sonst zeigte die Auswahl „Alle", während die Liste gefiltert ist.
    const gewaehlt = filter[dimension];
    const optionen =
      gewaehlt !== null && !werte.some((w) => w.wert === gewaehlt)
        ? [...werte, { wert: gewaehlt, name: gewaehlt }]
        : werte;
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-[12px] font-semibold text-muted-2">
          {t(`qualitaetsaufgaben.filter.${dimension}`)}
        </label>
        <select
          id={id}
          data-testid={id}
          value={gewaehlt ?? ""}
          onChange={(e) => setze(dimension, e.target.value)}
          className={SELECT_KLASSE}
        >
          <option value="">{t("qualitaetsaufgaben.filter.alle")}</option>
          {optionen.map((w) => option(w.wert, w.name, zaehler))}
        </select>
      </div>
    );
  };

  const zustaendigText = (z: Zustaendig): string =>
    t(`qualitaetsaufgaben.zustaendig.${z.art}`, { name: personName(z) });

  const fristText = (v: QualitaetsVorgang): string => {
    if (v.frist === null) {
      return t("qualitaetsaufgaben.frist.keine");
    }
    const schluessel = v.ueberfaellig ? "ueberfaellig" : "am";
    return t(`qualitaetsaufgaben.frist.${schluessel}`, { datum: kalendertag(v.frist) });
  };

  const seitText = (v: QualitaetsVorgang): string => {
    const tage = alterInTagen(v.seit, jetztMs);
    if (tage === null) {
      return t("qualitaetsaufgaben.seit.unbekannt");
    }
    return tage === 0
      ? t("qualitaetsaufgaben.seit.heute")
      : t("qualitaetsaufgaben.seit.tage", { anzahl: tage });
  };

  const titelVon = (v: QualitaetsVorgang): string => {
    if (v.inhalt.length > 0) {
      return v.inhalt.map((i) => i.titel).join(" ↔ ");
    }
    return v.titel ?? t("qualitaetsaufgaben.textZurueckgehalten");
  };

  return (
    <div className="mx-auto max-w-4xl">
      {kopf}

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-2">
        <span data-testid="qa-stand">
          {t("qualitaetsaufgaben.stand", { zeit: zeit(daten.stand) })}
        </span>
        <button
          type="button"
          data-testid="qa-aktualisieren"
          onClick={() => void abfrage.refetch()}
          className="rounded-btn border border-hairline px-3 py-1 font-semibold text-text hover:bg-hairline-soft"
        >
          {abfrage.isFetching
            ? t("qualitaetsaufgaben.aktualisiertGerade")
            : t("qualitaetsaufgaben.aktualisieren")}
        </button>
      </div>

      {fehlend.length > 0 ? (
        <p
          role="alert"
          data-testid="qa-quelle-fehlt"
          className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] font-semibold text-trust-warn-text"
        >
          {t("qualitaetsaufgaben.quelleFehlt", {
            liste: fehlend.map((typ) => t(`qualitaetsaufgaben.typ.${typ}`)).join(", "),
          })}
        </p>
      ) : null}

      <fieldset className="mb-4 rounded-[14px] border border-hairline bg-surface p-3">
        <legend className="px-1 text-[12px] font-semibold text-muted-2">
          {t("qualitaetsaufgaben.filter.titel")}
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {auswahl("space", [
            ...daten.spaces.map((s) => ({ wert: s.id, name: s.name })),
            { wert: OHNE, name: t("qualitaetsaufgaben.filter.ohneSpace") },
          ])}
          {auswahl(
            "typ",
            VORGANG_TYPEN.map((typ) => ({ wert: typ, name: t(`qualitaetsaufgaben.typ.${typ}`) })),
          )}
          {auswahl(
            "zustand",
            VORGANG_ZUSTAENDE.map((z) => ({
              wert: z,
              name: t(`qualitaetsaufgaben.zustand.${z}`),
            })),
          )}
          {auswahl("zustaendig", [
            ...zustaendigeIm(alle).map((p) => ({ wert: p.id, name: personName(p) })),
            { wert: OHNE, name: t("qualitaetsaufgaben.filter.niemand") },
          ])}
        </div>
        {filterAktiv ? (
          <button
            type="button"
            data-testid="qa-filter-zuruecksetzen"
            onClick={zuruecksetzen}
            className="mt-3 rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t("qualitaetsaufgaben.filter.zuruecksetzen")}
          </button>
        ) : null}
      </fieldset>

      <p data-testid="qa-bilanz" className="mb-1 text-[13px] font-semibold text-text">
        {t("qualitaetsaufgaben.bilanz", { treffer: sichtbar.length, gesamt: alle.length })}
      </p>
      <p data-testid="qa-einmal-gezaehlt" className="mb-3 text-[12.5px] text-muted-2">
        {t("qualitaetsaufgaben.einmalGezaehlt", bilanz)}
      </p>

      <div aria-live="polite" data-testid="qa-meldung" className="mb-3">
        {meldung ? (
          <p
            className={`rounded-btn px-3 py-2 text-[12.5px] font-semibold ${
              meldung.art === "erfolg"
                ? "bg-trust-pos-bg text-trust-pos-text"
                : "bg-trust-warn-bg text-trust-warn-text"
            }`}
          >
            {meldung.text}
          </p>
        ) : null}
      </div>

      {sichtbar.length === 0 ? (
        <div
          data-testid="qa-leer"
          className="rounded-[14px] border border-hairline bg-surface px-4 py-3 text-[14px]"
        >
          {/* „Nichts offen." ist eine Aussage über den GANZEN Bestand — sie fällt nur, wenn jede
              Quelle geliefert hat. Sonst ist das Leere eine Lücke im Wissen, kein Erledigt. */}
          {filterAktiv
            ? t("qualitaetsaufgaben.leerGefiltert")
            : fehlend.length > 0
              ? t("qualitaetsaufgaben.leerUnvollstaendig")
              : t("qualitaetsaufgaben.leer")}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile">
          {sichtbar.map((v) => {
            const titel = titelVon(v);
            const typName = t(`qualitaetsaufgaben.typ.${v.typ}`);
            return (
              <li
                key={v.schluessel}
                data-testid="qa-zeile"
                data-schluessel={v.schluessel}
                data-typ={v.typ}
                data-zustand={v.zustand}
                className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-hairline-soft px-4 py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ZUSTAND_PUNKT[v.zustand] ?? ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-muted-2">
                    <span className="font-semibold text-text">{typName}</span>
                    {" · "}
                    <span data-testid="qa-zustand">
                      {t(`qualitaetsaufgaben.zustand.${v.zustand}`)}
                    </span>
                    {v.grund ? (
                      <>
                        {" · "}
                        {t(`antwortmeldung.meldung.${v.grund}`)}
                      </>
                    ) : null}
                  </p>
                  <p title={titel} className="line-clamp-2 break-words text-[14px] text-text">
                    {titel}
                  </p>
                  {v.inhalt.length > 0 && v.titel ? (
                    <p className="line-clamp-2 break-words text-[12.5px] text-muted-2">{v.titel}</p>
                  ) : null}
                  <p
                    data-testid="qa-meta"
                    className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-muted-2"
                  >
                    <span data-testid="qa-zustaendig">
                      {v.zustaendig.length === 0
                        ? t("qualitaetsaufgaben.zustaendig.niemand")
                        : t("qualitaetsaufgaben.zustaendigListe", {
                            liste: v.zustaendig.map(zustaendigText).join(", "),
                          })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      data-testid="qa-frist"
                      className={v.ueberfaellig ? "font-semibold text-trust-crit-text" : ""}
                    >
                      {fristText(v)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span data-testid="qa-seit">{seitText(v)}</span>
                    {v.spaces.length > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{v.spaces.map(spaceName).join(", ")}</span>
                      </>
                    ) : null}
                  </p>
                  {v.rueckmeldungen && v.rueckmeldungen.length > 0 ? (
                    <p data-testid="qa-angehaengt" className="text-[12.5px] text-muted-2">
                      {t("qualitaetsaufgaben.rueckmeldungen.angehaengt", {
                        anzahl: v.rueckmeldungen.length,
                      })}{" "}
                      ({v.rueckmeldungen.map((r) => r.meldungId).join(", ")})
                    </p>
                  ) : null}
                  {v.uebernahme ? (
                    <p data-testid="qa-uebernahme" className="text-[12.5px] text-muted-2">
                      {t("qualitaetsaufgaben.rueckmeldung.uebernommen", {
                        zeit: zeit(v.uebernahme.am),
                        wer: personName(v.uebernahme.durch),
                      })}
                    </p>
                  ) : null}
                  {v.ergebnis ? (
                    <p data-testid="qa-ergebnis" className="text-[12.5px] text-trust-pos-text">
                      {v.ergebnis.fassung === null
                        ? t("qualitaetsaufgaben.rueckmeldung.ergebnisOhneFassung", {
                            zeit: zeit(v.ergebnis.am),
                            wer: personName(v.ergebnis.durch),
                          })
                        : t("qualitaetsaufgaben.rueckmeldung.ergebnis", {
                            zeit: zeit(v.ergebnis.am),
                            wer: personName(v.ergebnis.durch),
                            fassung: v.ergebnis.fassung,
                          })}
                    </p>
                  ) : null}
                  {v.zustand === "unklar" ? (
                    <p data-testid="qa-unklar" className="text-[12.5px] text-trust-warn-text">
                      {t("qualitaetsaufgaben.rueckmeldung.unklar")}
                    </p>
                  ) : null}
                  {v.einstiege.length > 1 ? (
                    <details className="mt-1 text-[12px] text-muted-2">
                      <summary data-testid="qa-einstiege" className="cursor-pointer">
                        {t("qualitaetsaufgaben.einstiege", { anzahl: v.einstiege.length })}
                      </summary>
                      <ul className="mt-1 list-disc pl-5">
                        {v.einstiege.map((e) => (
                          <li key={e}>{t(`qualitaetsaufgaben.einstieg.${einstiegsArt(e)}`)}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {v.typ === "rueckmeldung" && v.zustand === "offen" ? (
                    <button
                      type="button"
                      data-testid="qa-uebernehmen"
                      disabled={laeuft !== null}
                      onClick={() => void uebernehmen(v)}
                      className="rounded-btn bg-ink px-3 py-1 text-[12.5px] font-semibold text-white disabled:opacity-60"
                    >
                      {laeuft === v.ursprung.id
                        ? t("qualitaetsaufgaben.uebernehmenLaeuft")
                        : t("qualitaetsaufgaben.uebernehmen")}
                    </button>
                  ) : null}
                  <Link
                    to={v.arbeitsweg}
                    data-testid="qa-oeffnen"
                    aria-label={t("qualitaetsaufgaben.oeffnenLabel", { typ: typName, titel })}
                    className="inline-flex items-center gap-1 rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
                  >
                    {v.typ === "rueckmeldung" && v.zustand !== "offen"
                      ? t("qualitaetsaufgaben.rueckmeldung.rueckbezug")
                      : t("qualitaetsaufgaben.oeffnen")}
                    <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
