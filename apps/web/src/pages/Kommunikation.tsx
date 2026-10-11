// ADMIN-12 · Meldungen und Kanäle (`/kommunikation`) — produkt:20261007:veroeffentlichungsoptionen:
// admin-20261009.
//
// EINE Seite für alle angemeldeten Konten, weil jede Person lesen können soll, nach welcher Regel
// sie Meldungen bekommt:
//   · die zentrale Übersicht: Ereignis → Zielgruppe, Kanäle, Häufigkeit, Abwahl, Verbindlichkeit;
//   · die Wirkung von still, normal, hervorgehoben und Aktualisierung;
//   · die eigenen Einstellungen (Abwahl, wo die Vorgabe sie erlaubt);
//   · für die Verwaltung (`users.manage` am Server) die Unternehmensvorgaben samt Protokoll.
//
// NUR ANGESCHLOSSENE KANÄLE SIND WÄHLBAR. Ist Mail nicht eingerichtet, ist das Kästchen gesperrt
// und sagt warum; Push ist nirgends wählbar. Der Server lehnt beides zusätzlich ab — die Fläche ist
// nicht die Schranke, sie erklärt sie.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  type EreignisId,
  type EreignisUebersicht,
  type Haeufigkeit,
  type RegelUebersicht,
  type Vorgabe,
  kommunikationApi,
} from "../api/kommunikation";
import { GuardedLink } from "../app/NavGuardContext";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";
import { formatKoTimestamp } from "../lib/koDates";

const REGELN_KEY = ["kommunikation", "regeln"] as const;
const MEINE_KEY = ["kommunikation", "meine"] as const;
const FASSUNGEN_KEY = ["kommunikation", "fassungen"] as const;

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    const nachCode: Record<string, string> = {
      VERALTET: "kommunikation.fehler.veraltet",
      KANAL_NICHT_EINGERICHTET: "kommunikation.fehler.kanal",
      NICHT_ABWAEHLBAR: "kommunikation.fehler.nichtAbwaehlbar",
      MAIL_NUR_SOFORT: "kommunikation.fehler.mailNurSofort",
      NICHT_HALTBAR: "kommunikation.fehler.nichtHaltbar",
    };
    if (nachCode[fehler.code]) {
      return nachCode[fehler.code] as string;
    }
    if (fehler.status === 401) {
      return "kommunikation.fehler.anmeldung";
    }
    if (fehler.status === 403) {
      return "kommunikation.fehler.berechtigung";
    }
  }
  return "kommunikation.fehler.allgemein";
}

/** Die Zeile eines Ereignisses in der Übersicht — als Beschreibungsliste, die auch 390 px trägt. */
function EreignisZeile({ e }: { e: EreignisUebersicht }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      data-testid="kommunikation-ereignis"
      data-ereignis={e.id}
      className="space-y-1.5 border-b border-hairline py-3 last:border-b-0"
    >
      <h3 className="text-[14px] font-semibold text-ink">{t(`kommunikation.ereignis.${e.id}`)}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-2">{t("kommunikation.spalte.zielgruppe")}</dt>
        <dd data-testid="kommunikation-zielgruppe" className="text-text">
          {t(`kommunikation.zielgruppe.${e.zielgruppe}`)}
        </dd>
        <dt className="text-muted-2">{t("kommunikation.spalte.kanaele")}</dt>
        <dd className="flex flex-wrap gap-1.5">
          {e.kanaele.map((k) => (
            <span
              key={k.kanal}
              data-testid="kommunikation-kanal"
              data-kanal={k.kanal}
              data-zustand={k.zustand}
              className={`rounded-btn border px-1.5 py-0.5 ${
                k.zustand === "aktiv"
                  ? "border-hairline text-text"
                  : "border-dashed border-hairline text-muted-2"
              }`}
            >
              {t(`kommunikation.kanal.${k.kanal}`)}: {t(`kommunikation.zustand.${k.zustand}`)}
            </span>
          ))}
        </dd>
        <dt className="text-muted-2">{t("kommunikation.spalte.haeufigkeit")}</dt>
        <dd data-testid="kommunikation-haeufigkeit" className="text-text">
          {t(`kommunikation.haeufigkeit.${e.haeufigkeit}`)}
          {e.erinnerung ? ` · ${t("kommunikation.erinnerung")}` : ""}
        </dd>
        <dt className="text-muted-2">{t("kommunikation.spalte.abwahl")}</dt>
        <dd data-testid="kommunikation-abwahl" className="text-text">
          {e.verbindlich
            ? t("kommunikation.verbindlich")
            : t(e.abwaehlbar ? "kommunikation.abwahl.ja" : "kommunikation.abwahl.nein")}
        </dd>
      </dl>
    </li>
  );
}

function MeineEinstellungen({ regeln }: { regeln: RegelUebersicht }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meine = useQuery({ queryKey: MEINE_KEY, queryFn: kommunikationApi.meine });
  const setzen = useMutation({
    mutationFn: (eingabe: { ereignis: EreignisId; abgewaehlt: boolean }) =>
      kommunikationApi.meineSetzen(eingabe.ereignis, eingabe.abgewaehlt),
    onSuccess: (daten) => qc.setQueryData(MEINE_KEY, daten),
    onError: () => void qc.invalidateQueries({ queryKey: MEINE_KEY }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  // Angeboten werden die Ereignisse, die überhaupt abwählbar sein KÖNNEN, und die verbindliche
  // Kenntnisnahme — damit sichtbar ist, dass sie nicht abwählbar ist.
  const zeilen = (meine.data?.zeilen ?? []).filter((z) => {
    const e = regeln.ereignisse.find((x) => x.id === z.ereignis);
    return e !== undefined && (e.einstellbar.abwahl || e.verbindlich);
  });
  return (
    <Card interactive={false} className="space-y-3" data-testid="kommunikation-meine">
      <h2 className="text-[16px] font-semibold text-ink">{t("kommunikation.meine.titel")}</h2>
      <p className="text-[12.5px] text-muted">{t("kommunikation.meine.erklaerung")}</p>
      {meine.isPending ? <p className="text-sm text-muted">{t("kommunikation.laedt")}</p> : null}
      {meine.isError ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(meine.error))}
        </p>
      ) : null}
      <ul className="space-y-2">
        {zeilen.map((z) => {
          const id = `meine-${z.ereignis}`;
          return (
            <li key={z.ereignis} data-testid="kommunikation-meine-zeile" data-ereignis={z.ereignis}>
              <div className="flex items-start gap-2">
                <input
                  id={id}
                  type="checkbox"
                  data-testid="kommunikation-meine-erhalten"
                  className="mt-0.5"
                  checked={!z.wirksam}
                  disabled={!z.abwaehlbar || setzen.isPending}
                  onChange={(ereignis) =>
                    setzen.mutate({ ereignis: z.ereignis, abgewaehlt: !ereignis.target.checked })
                  }
                />
                <label htmlFor={id} className="text-[13px] text-text">
                  {t(`kommunikation.ereignis.${z.ereignis}`)} — {t("kommunikation.meine.erhalten")}
                  {z.verbindlich ? (
                    <span className="block text-[12px] text-muted-2">
                      {t("kommunikation.verbindlich")}
                    </span>
                  ) : !z.abwaehlbar ? (
                    <span className="block text-[12px] text-muted-2">
                      {t("kommunikation.meine.nichtAbwaehlbar")}
                    </span>
                  ) : null}
                  {z.abgewaehlt && !z.wirksam ? (
                    <span
                      data-testid="kommunikation-meine-unwirksam"
                      className="block text-[12px] text-trust-warn-text"
                    >
                      {t("kommunikation.meine.unwirksam")}
                    </span>
                  ) : null}
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {setzen.isSuccess ? (
        <output data-testid="kommunikation-meine-gespeichert" className="block text-[12.5px]">
          {t("kommunikation.meine.gespeichert")}
        </output>
      ) : null}
      {setzen.isError ? (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t(fehlerSchluessel(setzen.error))}
        </p>
      ) : null}
    </Card>
  );
}

type Entwurf = Partial<Record<EreignisId, Vorgabe>>;

function entwurfAus(regeln: RegelUebersicht): Entwurf {
  const entwurf: Entwurf = {};
  for (const e of regeln.ereignisse) {
    if (e.einstellbar.abwahl || e.einstellbar.zusammenfassung || e.einstellbar.mail) {
      entwurf[e.id] = { ...e.vorgabe };
    }
  }
  return entwurf;
}

function Unternehmensvorgaben({ regeln }: { regeln: RegelUebersicht }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [entwurf, setEntwurf] = useState<Entwurf>(() => entwurfAus(regeln));
  // Eine neue Fassung (eigene oder fremde nach Neuladen) setzt den Entwurf auf den Serverstand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur bei neuer Fassung.
  useEffect(() => {
    setEntwurf(entwurfAus(regeln));
  }, [regeln.version]);
  const fassungen = useQuery({ queryKey: FASSUNGEN_KEY, queryFn: kommunikationApi.fassungen });
  const speichern = useMutation({
    mutationFn: () => kommunikationApi.speichern(regeln.version, entwurf),
    onSuccess: (daten) => {
      qc.setQueryData(REGELN_KEY, daten);
      void qc.invalidateQueries({ queryKey: FASSUNGEN_KEY });
      void qc.invalidateQueries({ queryKey: MEINE_KEY });
    },
  });
  const einstellbar = regeln.ereignisse.filter((e) => entwurf[e.id] !== undefined);
  const aendere = (id: EreignisId, teil: Partial<Vorgabe>): void => {
    speichern.reset();
    setEntwurf((alt) => ({ ...alt, [id]: { ...(alt[id] as Vorgabe), ...teil } }));
  };
  const datum = (iso: string | null): string =>
    iso ? (formatKoTimestamp(iso, i18n.language) ?? "—") : "—";

  return (
    <Card interactive={false} className="space-y-3" data-testid="kommunikation-vorgaben">
      <h2 className="text-[16px] font-semibold text-ink">{t("kommunikation.vorgabe.titel")}</h2>
      <p data-testid="kommunikation-vorgaben-stand" className="text-[12.5px] text-muted">
        {regeln.version === 0
          ? t("kommunikation.vorgabe.werk")
          : t("kommunikation.vorgabe.stand", {
              version: regeln.version,
              name: regeln.geaendertVon?.name ?? "—",
              datum: datum(regeln.geaendertAm),
            })}
      </p>
      <form
        className="space-y-3"
        onSubmit={(ereignis) => {
          ereignis.preventDefault();
          if (!speichern.isPending) {
            speichern.mutate();
          }
        }}
      >
        {einstellbar.map((e) => {
          const v = entwurf[e.id] as Vorgabe;
          const kennung = `vorgabe-${e.id}`;
          return (
            <fieldset
              key={e.id}
              data-testid="kommunikation-vorgabe"
              data-ereignis={e.id}
              className="space-y-1.5 rounded-btn border border-hairline px-3 py-2"
            >
              <legend className="px-1 text-[13px] font-semibold text-text">
                {t(`kommunikation.ereignis.${e.id}`)}
              </legend>
              {e.einstellbar.abwahl ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <input
                    id={`${kennung}-abwahl`}
                    type="checkbox"
                    data-testid="kommunikation-vorgabe-abwaehlbar"
                    checked={v.abwaehlbar}
                    onChange={(x) => aendere(e.id, { abwaehlbar: x.target.checked })}
                  />
                  <label htmlFor={`${kennung}-abwahl`}>
                    {t("kommunikation.vorgabe.abwaehlbar")}
                  </label>
                </div>
              ) : null}
              {e.einstellbar.zusammenfassung ? (
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <label htmlFor={`${kennung}-haeufigkeit`}>
                    {t("kommunikation.vorgabe.haeufigkeit")}
                  </label>
                  <select
                    id={`${kennung}-haeufigkeit`}
                    data-testid="kommunikation-vorgabe-haeufigkeit"
                    className="rounded-btn border border-hairline bg-transparent px-1.5 py-0.5"
                    value={v.haeufigkeit}
                    onChange={(x) => {
                      const haeufigkeit = x.target.value as Haeufigkeit;
                      // Mail gibt es nur bei sofortiger Meldung — die Fläche nimmt sie mit weg.
                      const ohneMail = haeufigkeit === "taeglich";
                      aendere(e.id, ohneMail ? { haeufigkeit, mail: false } : { haeufigkeit });
                    }}
                  >
                    <option value="sofort">{t("kommunikation.haeufigkeit.sofort")}</option>
                    <option value="taeglich">{t("kommunikation.haeufigkeit.taeglich")}</option>
                  </select>
                </div>
              ) : null}
              {e.einstellbar.mail ? (
                <div className="space-y-0.5 text-[13px]">
                  <div className="flex items-center gap-2">
                    <input
                      id={`${kennung}-mail`}
                      type="checkbox"
                      data-testid="kommunikation-vorgabe-mail"
                      checked={v.mail}
                      disabled={!regeln.mailEingerichtet || v.haeufigkeit === "taeglich"}
                      aria-describedby={
                        regeln.mailEingerichtet ? undefined : `${kennung}-mail-grund`
                      }
                      onChange={(x) => aendere(e.id, { mail: x.target.checked })}
                    />
                    <label htmlFor={`${kennung}-mail`}>{t("kommunikation.vorgabe.mail")}</label>
                  </div>
                  {regeln.mailEingerichtet ? null : (
                    <p id={`${kennung}-mail-grund`} className="text-[12px] text-muted-2">
                      {t("kommunikation.vorgabe.mailNichtEingerichtet")}
                    </p>
                  )}
                </div>
              ) : null}
            </fieldset>
          );
        })}
        <p className="text-[12px] text-muted-2">
          {t("kommunikation.vorgabe.pushNichtAngeschlossen")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            data-testid="kommunikation-vorgaben-speichern"
            disabled={speichern.isPending}
          >
            {speichern.isPending
              ? t("kommunikation.vorgabe.speichert")
              : t("kommunikation.vorgabe.speichern")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="kommunikation-vorgaben-verwerfen"
            onClick={() => {
              speichern.reset();
              setEntwurf(entwurfAus(regeln));
            }}
          >
            {t("kommunikation.vorgabe.verwerfen")}
          </Button>
        </div>
      </form>
      {speichern.isSuccess ? (
        <output data-testid="kommunikation-vorgaben-ergebnis" className="block text-[12.5px]">
          {speichern.data.geaendert
            ? t("kommunikation.vorgabe.gespeichert", { version: speichern.data.version })
            : t("kommunikation.vorgabe.unveraendert")}
        </output>
      ) : null}
      {speichern.isError ? (
        <p
          role="alert"
          data-testid="kommunikation-vorgaben-fehler"
          className="text-[12.5px] text-trust-crit-text"
        >
          {t(fehlerSchluessel(speichern.error))}
        </p>
      ) : null}
      <div>
        <SectionLabel>{t("kommunikation.protokoll.titel")}</SectionLabel>
        {fassungen.isError ? (
          <p role="alert" className="text-[12.5px] text-trust-crit-text">
            {t(fehlerSchluessel(fassungen.error))}
          </p>
        ) : null}
        {fassungen.isSuccess && fassungen.data.fassungen.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("kommunikation.protokoll.leer")}</p>
        ) : null}
        <ul className="space-y-0.5">
          {(fassungen.data?.fassungen ?? []).map((f) => (
            <li
              key={f.version}
              data-testid="kommunikation-protokoll-zeile"
              className="text-[12.5px] text-muted"
            >
              {t("kommunikation.protokoll.zeile", {
                version: f.version,
                name: f.name || "—",
                datum: datum(f.geaendertAm),
              })}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function Kommunikation(): JSX.Element {
  const { t } = useTranslation();
  const regeln = useQuery({ queryKey: REGELN_KEY, queryFn: kommunikationApi.regeln });
  const daten = regeln.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        pageKey="kommunikation"
        title={t("kommunikation.titel")}
        lead={t("kommunikation.lead")}
      />
      {daten?.darfAendern ? (
        <GuardedLink
          to="/admin"
          data-testid="kommunikation-zurueck"
          className="inline-block rounded-btn text-[12.5px] text-muted underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t("kommunikation.zurueck")}
        </GuardedLink>
      ) : null}
      {regeln.isPending ? <p className="text-sm text-muted">{t("kommunikation.laedt")}</p> : null}
      {regeln.isError ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(regeln.error))}
        </p>
      ) : null}
      {daten ? (
        <>
          <Card interactive={false} className="space-y-2" data-testid="kommunikation-wirkung">
            <h2 className="text-[16px] font-semibold text-ink">
              {t("kommunikation.wirkung.titel")}
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-text">
              {(
                [
                  "still",
                  "normal",
                  "hervorgehoben",
                  "aktualisierung",
                  "unabhaengig",
                  "zusammenfassung",
                  "kenntnisnahme",
                ] as const
              ).map((k) => (
                <li key={k} data-testid="kommunikation-wirkung-zeile" data-wirkung={k}>
                  {t(`kommunikation.wirkung.${k}`)}
                </li>
              ))}
            </ul>
          </Card>
          <Card interactive={false} data-testid="kommunikation-uebersicht">
            <h2 className="text-[16px] font-semibold text-ink">
              {t("kommunikation.uebersicht.titel")}
            </h2>
            <ul>
              {daten.ereignisse.map((e) => (
                <EreignisZeile key={e.id} e={e} />
              ))}
            </ul>
          </Card>
          <MeineEinstellungen regeln={daten} />
          {daten.darfAendern ? (
            <Unternehmensvorgaben regeln={daten} />
          ) : (
            <p data-testid="kommunikation-nur-lesen" className="text-[12.5px] text-muted">
              {t("kommunikation.vorgabe.nurLesen")}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
