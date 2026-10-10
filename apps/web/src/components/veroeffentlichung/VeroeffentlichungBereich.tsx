import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button, Card, SectionLabel } from "../ui";
import {
  MELDUNGSWAHLEN,
  type Meldungswahl,
  type Meldungswirkung,
  fehlerGrund,
  veroeffentlichungApi,
} from "./api";

// ================================================================================================
// VERÖFFENTLICHUNG · die Fläche am gelesenen Eintrag (produkt:20261007:veroeffentlichungsoptionen).
// ================================================================================================
//
// JEDER LESER sieht, welche Fassung veröffentlicht ist und ob die aktuelle Fassung davon abweicht
// (Entwurf/in Prüfung oder gültig, aber noch nicht veröffentlicht) — samt Verlauf.
//
// WER FREIGEBEN DARF (Controller/Admin, `ko.validate` am Server), wählt die Benachrichtigung
// still/normal/hervorgehoben. Es gibt bewusst KEINE Vorauswahl: erst die Wahl gibt den Knopf frei,
// und in demselben Augenblick steht darunter, was danach gilt — Zustand, Sichtbarkeit und
// Empfänger, aus der Serverauskunft und nicht geraten. Angeforderte Kenntnisnahmen werden genannt,
// damit „still" sie nicht unbemerkt übergeht.
//
// Ein Fehler beim Lesen lässt die Fläche weg: die Lesefläche bleibt dann, wie sie war.

const MAX_NAMEN = 10;

function stufeSchluessel(stufe: string | null): string {
  return stufe === "intern" || stufe === "vertraulich" || stufe === "streng_vertraulich"
    ? `veroeffentlichung.stufe.${stufe}`
    : "veroeffentlichung.stufe.unbekannt";
}

/** ADMIN-12: die Wirkung einer Wahl nach den geltenden Kommunikationsregeln. */
function RegelWirkung({
  wirkung,
  mailEingerichtet,
}: {
  wirkung: Meldungswirkung;
  mailEingerichtet: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="veroeffentlichung-regelwirkung" className="space-y-0.5">
      <p className="font-semibold">{t("veroeffentlichung.regel.titel")}</p>
      <ul className="list-disc pl-5">
        {wirkung.sofort > 0 ? (
          <li data-testid="veroeffentlichung-regel-sofort">
            {t("veroeffentlichung.regel.sofort", { anzahl: wirkung.sofort })}
          </li>
        ) : null}
        {wirkung.zusammenfassung > 0 ? (
          <li data-testid="veroeffentlichung-regel-zusammenfassung">
            {t("veroeffentlichung.regel.zusammenfassung", { anzahl: wirkung.zusammenfassung })}
          </li>
        ) : null}
        {wirkung.abgewaehlt > 0 ? (
          <li data-testid="veroeffentlichung-regel-abgewaehlt">
            {t("veroeffentlichung.regel.abgewaehlt", { anzahl: wirkung.abgewaehlt })}
          </li>
        ) : null}
        <li data-testid="veroeffentlichung-regel-mail">
          {mailEingerichtet
            ? t("veroeffentlichung.regel.mail", { anzahl: wirkung.mail })
            : t("veroeffentlichung.regel.mailNichtEingerichtet")}
        </li>
      </ul>
      <p className="text-[12px] text-muted-2">{t("veroeffentlichung.regel.link")}</p>
    </div>
  );
}

/** ADMIN-12: der Zustellstatus einer Veröffentlichung — auf Wunsch aufgeklappt, je Empfänger. */
function Zustellstatus({ koId, vermerkId }: { koId: string; vermerkId: string }): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [offen, setOffen] = useState(false);
  const schluessel = ["veroeffentlichung", koId, "zustellung", vermerkId] as const;
  const status = useQuery({
    queryKey: schluessel,
    queryFn: () => veroeffentlichungApi.zustellung(koId, vermerkId),
    enabled: offen,
    retry: false,
  });
  const fortsetzen = useMutation({
    mutationFn: () => veroeffentlichungApi.fortsetzen(koId, vermerkId),
    onSuccess: (daten) => queryClient.setQueryData(schluessel, daten),
  });
  const s = status.data;
  const panelId = `zustellung-${vermerkId}`;
  const statusWort = (wort: string): string => t(`veroeffentlichung.zustellung.status.${wort}`);
  return (
    <div className="mt-1">
      <button
        type="button"
        data-testid="veroeffentlichung-zustellung-umschalten"
        aria-expanded={offen}
        aria-controls={offen ? panelId : undefined}
        onClick={() => setOffen((x) => !x)}
        className="rounded-btn text-[12px] font-semibold text-ai underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t(
          offen ? "veroeffentlichung.zustellung.verbergen" : "veroeffentlichung.zustellung.zeigen",
        )}
      </button>
      {offen ? (
        <div
          id={panelId}
          data-testid="veroeffentlichung-zustellung"
          className="mt-1 space-y-1 rounded-btn border border-hairline px-3 py-2 text-[12.5px] text-text"
        >
          {status.isPending ? <p>{t("veroeffentlichung.zustellung.laedt")}</p> : null}
          {status.isError ? (
            <p role="alert" className="text-trust-warn-text">
              {t("veroeffentlichung.fehler.allgemein")}
            </p>
          ) : null}
          {s && !s.erfasst ? <p>{t("veroeffentlichung.zustellung.nichtErfasst")}</p> : null}
          {s?.erfasst && s.empfaenger.length === 0 ? (
            <p>{t("veroeffentlichung.zustellung.leer")}</p>
          ) : null}
          {s?.erfasst && s.empfaenger.length > 0 ? (
            <>
              <p data-testid="veroeffentlichung-zustellung-glocke">
                {t("veroeffentlichung.zustellung.glocke", s.zaehlung.glocke)}
              </p>
              {s.mailEingerichtet || Object.values(s.zaehlung.mail).some((anzahl) => anzahl > 0) ? (
                <p data-testid="veroeffentlichung-zustellung-mail">
                  {t("veroeffentlichung.zustellung.mail", s.zaehlung.mail)}
                </p>
              ) : null}
              <p data-testid="veroeffentlichung-zustellung-kenntnisnahme">
                {t("veroeffentlichung.zustellung.kenntnisnahme", s.zaehlung.kenntnisnahme)}
              </p>
              <p className="text-[12px] text-muted-2">{t("veroeffentlichung.zustellung.belegt")}</p>
              <ul className="space-y-0.5">
                {s.empfaenger.map((e) => (
                  <li
                    key={e.id}
                    data-testid="veroeffentlichung-zustellung-person"
                    data-glocke={e.glocke ?? ""}
                    data-mail={e.mail?.status ?? ""}
                  >
                    <span className="font-semibold">{e.name}</span>
                    {" · "}
                    {t("veroeffentlichung.zustellung.person.glocke")}:{" "}
                    {e.glocke ? statusWort(e.glocke) : "—"}
                    {e.hinweis
                      ? ` (${t(`veroeffentlichung.zustellung.hinweis.${e.hinweis}`)})`
                      : ""}
                    {e.mail ? (
                      <>
                        {" · "}
                        {t("veroeffentlichung.zustellung.person.mail")}: {statusWort(e.mail.status)}
                        {e.mail.grund
                          ? ` (${t(`veroeffentlichung.zustellung.grund.${e.mail.grund}`)})`
                          : ""}
                      </>
                    ) : null}
                    {e.kenntnisnahme ? (
                      <>
                        {" · "}
                        {t("veroeffentlichung.zustellung.person.kenntnisnahme")}:{" "}
                        {statusWort(e.kenntnisnahme)}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              {s.zaehlung.mail.angelegt > 0 ? (
                <Button
                  type="button"
                  data-testid="veroeffentlichung-zustellung-fortsetzen"
                  disabled={fortsetzen.isPending}
                  onClick={() => fortsetzen.mutate()}
                >
                  {t("veroeffentlichung.zustellung.fortsetzen")}
                </Button>
              ) : null}
              {fortsetzen.isError ? (
                <p role="alert" className="text-trust-warn-text">
                  {t("veroeffentlichung.fehler.allgemein")}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Die Veröffentlichung am gelesenen Eintrag — Stand für alle, Wahl und Vorschau für Freigebende. */
export function VeroeffentlichungBereich({ koId }: { koId: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const schluessel = ["veroeffentlichung", koId] as const;
  const stand = useQuery({
    queryKey: schluessel,
    queryFn: () => veroeffentlichungApi.stand(koId),
    retry: false,
  });
  const [wahl, setWahl] = useState<Meldungswahl | null>(null);
  // Die Sperre gegen den Doppelklick greift SOFORT beim ersten Klick — derselbe Grund wie an der
  // Kenntnisnahme: `isPending` kommt erst im nächsten Takt an.
  const laeuft = useRef(false);
  const veroeffentlichen = useMutation({
    mutationFn: (eingabe: { fassung: number; meldung: Meldungswahl }) =>
      veroeffentlichungApi.veroeffentlichen(koId, eingabe),
    onSuccess: () => setWahl(null),
    onSettled: () => {
      laeuft.current = false;
      void queryClient.invalidateQueries({ queryKey: schluessel });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const daten = stand.data;
  if (!daten) {
    return null;
  }
  const datum = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? "—";
  const letzte = daten.verlauf[0];
  const aktuellSatz = daten.aktuelleIstVeroeffentlicht
    ? t("veroeffentlichung.stand.aktuellVeroeffentlicht", { aktuell: daten.aktuelleFassung })
    : daten.gueltig
      ? t("veroeffentlichung.stand.aktuellGueltig", { aktuell: daten.aktuelleFassung })
      : t("veroeffentlichung.stand.aktuellEntwurf", { aktuell: daten.aktuelleFassung });
  const fehlerText = (fehler: unknown): string => {
    const grund = fehlerGrund(fehler);
    return grund === "keine_gueltige_fassung" ||
      grund === "bereits_veroeffentlicht" ||
      grund === "fassung_veraltet"
      ? t(`veroeffentlichung.fehler.${grund}`)
      : t("veroeffentlichung.fehler.allgemein");
  };

  return (
    <Card interactive={false} className="space-y-3" data-testid="veroeffentlichung-bereich">
      <SectionLabel>{t("veroeffentlichung.titel")}</SectionLabel>
      <p className="text-[12px] text-muted">{t("veroeffentlichung.hinweis")}</p>
      <p data-testid="veroeffentlichung-stand" className="text-[13px] text-text">
        {letzte
          ? t("veroeffentlichung.stand.veroeffentlicht", {
              fassung: letzte.fassung,
              datum: datum(letzte.am),
              name: letzte.von.name,
            })
          : t("veroeffentlichung.stand.nie")}
      </p>
      <p data-testid="veroeffentlichung-aktuell" className="text-[12.5px] text-muted">
        {aktuellSatz}
      </p>

      {daten.darfVeroeffentlichen ? (
        daten.hinderungsgrund ? (
          <p data-testid="veroeffentlichung-hindernis" className="text-[12.5px] text-muted">
            {t(`veroeffentlichung.fehler.${daten.hinderungsgrund}`)}
          </p>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(ereignis) => {
              ereignis.preventDefault();
              if (wahl === null || laeuft.current) {
                return;
              }
              laeuft.current = true;
              veroeffentlichen.mutate({ fassung: daten.aktuelleFassung, meldung: wahl });
            }}
          >
            <fieldset className="space-y-1">
              <legend className="text-[12.5px] font-semibold text-text">
                {t("veroeffentlichung.wahl.titel")}
              </legend>
              {MELDUNGSWAHLEN.map((m) => (
                <label key={m} className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="radio"
                    name={`veroeffentlichung-wahl-${koId}`}
                    data-testid="veroeffentlichung-wahl"
                    value={m}
                    checked={wahl === m}
                    onChange={() => setWahl(m)}
                  />
                  {t(`veroeffentlichung.wahl.${m}`)}
                </label>
              ))}
            </fieldset>
            {wahl ? (
              <div
                data-testid="veroeffentlichung-wirkung"
                data-wahl={wahl}
                className="space-y-1 rounded-btn border border-hairline px-3 py-2 text-[12.5px] text-text"
              >
                <p className="font-semibold">{t("veroeffentlichung.wirkung.titel")}</p>
                <p data-testid="veroeffentlichung-wirkung-zustand">
                  {t("veroeffentlichung.wirkung.zustand", {
                    fassung: daten.aktuelleFassung,
                    art: t(`veroeffentlichung.art.${daten.art}`),
                  })}
                </p>
                <p data-testid="veroeffentlichung-wirkung-sichtbarkeit">
                  {t("veroeffentlichung.wirkung.sichtbarkeit", {
                    anzahl: daten.sichtbarkeit.leser,
                    stufe: t(stufeSchluessel(daten.sichtbarkeit.stufe)),
                  })}
                  {daten.sichtbarkeit.spaceId ? ` ${t("veroeffentlichung.wirkung.space")}` : ""}
                </p>
                <p data-testid="veroeffentlichung-wirkung-empfaenger">
                  {wahl === "still"
                    ? t("veroeffentlichung.wirkung.still")
                    : daten.empfaenger.length === 0
                      ? t("veroeffentlichung.wirkung.niemandSonst")
                      : t(`veroeffentlichung.wirkung.${wahl}`, {
                          anzahl: daten.empfaenger.length,
                          namen: [
                            ...daten.empfaenger.slice(0, MAX_NAMEN).map((k) => k.name),
                            ...(daten.empfaenger.length > MAX_NAMEN ? ["…"] : []),
                          ].join(", "),
                        })}
                </p>
                {/* ADMIN-12: was die geltenden Kommunikationsregeln aus dieser Wahl machen —
                    persönliche Abwahl, Zusammenfassung und Mail, gezählt am Server. */}
                {wahl !== "still" && daten.empfaenger.length > 0 ? (
                  <RegelWirkung
                    wirkung={daten.meldungswirkung[wahl]}
                    mailEingerichtet={daten.mailEingerichtet}
                  />
                ) : null}
              </div>
            ) : null}
            {daten.kenntnisnahmen.offen > 0 ? (
              <p data-testid="veroeffentlichung-kenntnisnahme-offen" className="text-[12.5px]">
                {t("veroeffentlichung.kenntnisnahme.offen", {
                  anzahl: daten.kenntnisnahmen.offen,
                })}
              </p>
            ) : null}
            {daten.kenntnisnahmen.ueberholt > 0 ? (
              <p
                data-testid="veroeffentlichung-kenntnisnahme-ueberholt"
                className="text-[12.5px] text-trust-warn-text"
              >
                {t("veroeffentlichung.kenntnisnahme.ueberholt", {
                  anzahl: daten.kenntnisnahmen.ueberholt,
                  fassung: daten.aktuelleFassung,
                })}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              data-testid="veroeffentlichung-absenden"
              disabled={wahl === null || veroeffentlichen.isPending}
            >
              {veroeffentlichen.isPending
                ? t("veroeffentlichung.laeuft")
                : t("veroeffentlichung.absenden", {
                    fassung: daten.aktuelleFassung,
                    wahl: wahl ? t(`veroeffentlichung.wahl.${wahl}`) : "…",
                  })}
            </Button>
          </form>
        )
      ) : null}
      {veroeffentlichen.isSuccess ? (
        <output data-testid="veroeffentlichung-erfolg" className="block text-[12.5px] text-muted">
          {t("veroeffentlichung.erfolg", {
            fassung: veroeffentlichen.data.vermerk.fassung,
            anzahl: veroeffentlichen.data.vermerk.empfaenger,
          })}
        </output>
      ) : null}
      {veroeffentlichen.isError ? (
        <p role="alert" className="text-[12.5px] text-trust-warn-text">
          {fehlerText(veroeffentlichen.error)}
        </p>
      ) : null}

      {daten.verlauf.length > 0 ? (
        <div>
          <SectionLabel>{t("veroeffentlichung.verlauf.titel")}</SectionLabel>
          <ul className="space-y-0.5">
            {daten.verlauf.map((v) => (
              <li
                key={v.id}
                data-testid="veroeffentlichung-verlauf-zeile"
                data-meldung={v.meldung}
                className="text-[12.5px] text-muted"
              >
                {t("veroeffentlichung.verlauf.zeile", {
                  fassung: v.fassung,
                  art: t(`veroeffentlichung.art.${v.art}`),
                  wahl: t(`veroeffentlichung.wahl.${v.meldung}`),
                  name: v.von.name,
                  datum: datum(v.am),
                  anzahl: v.empfaenger,
                })}
                {/* ADMIN-12: der Zustellstatus — nur für Freigebende (der Server prüft dasselbe). */}
                {daten.darfVeroeffentlichen ? <Zustellstatus koId={koId} vermerkId={v.id} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
