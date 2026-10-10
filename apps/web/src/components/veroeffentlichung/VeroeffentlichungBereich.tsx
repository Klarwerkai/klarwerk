import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button, Card, SectionLabel } from "../ui";
import { MELDUNGSWAHLEN, type Meldungswahl, fehlerGrund, veroeffentlichungApi } from "./api";

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
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
