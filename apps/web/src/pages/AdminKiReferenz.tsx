// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — DER EINSTIEG „REFERENZPRÜFUNG" UNTER
// VERWALTUNG → KI.
// ================================================================================================
//
// Was REF-02 hier vorfand: eine Liste mit Kontrollkästchen in der KI-Karte, die nur „eingerichtet"
// kannte. Es fehlten der zutreffende Zustand je Option, die Sperre samt nächstem Schritt, die Hilfe
// bei gleichem Modell, die Grenzen und ein bewusster Funktionscheck. Diese Karte zeigt das alles. Sie
// liest und schreibt ausschließlich über `GET`/`PUT /api/reasoner/referenzpruefung`. Der Server
// führt dafür denselben Schreibweg samt Protokoll wie die KI-Karte und lässt die übrige Zuordnung,
// wie er sie hält. Eine eigene Schlüsselablage gibt es nicht: die Optionen sind die registrierten
// Zugänge der bestehenden Providerverwaltung.
//
// WAS HIER NIE PASSIERT: kein Modellaufruf beim Öffnen. Der Funktionscheck läuft nur auf Klick, je
// Klick genau ein Aufruf mit fiktivem Prüfstoff. Er gilt nur für das Modell, mit dem er lief.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type {
  ReferenzFunktionscheck,
  ReferenzOption,
  ReferenzVerwaltung,
  ReferenzWahl,
} from "../api/types";
import { useToast } from "../app/ToastContext";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { anbieterName, anbieterUndModell } from "../lib/aiOverview";
import { invalidateAiState } from "../lib/aiStateInvalidate";
import { referenzUmschalten, referenzVorziehen } from "./AdminKiDetails";

/** Der Vorratsschlüssel der Karte — die PUT-Antwort wird dort als bestätigter Stand abgelegt. */
export const REFERENZ_KEY = ["referenzpruefung"] as const;

/** Zustände, die einen Einsatz tragen — Ton der Zustandsmarke. */
const ZUSTAND_TON: Record<ReferenzOption["zustand"], string> = {
  nicht_eingerichtet: "bg-page text-muted-2",
  ausgeschaltet: "bg-page text-muted",
  nicht_verfuegbar: "bg-trust-warn-bg text-trust-warn-text",
  konfiguriert: "bg-page text-text",
  letzte_pruefung_erfolgreich: "bg-trust-pos-bg text-trust-pos-text",
  letzte_pruefung_fehlgeschlagen: "bg-trust-crit-bg text-trust-crit-text",
};

const KNOPF =
  "inline-flex min-h-[36px] items-center rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

/** Die Reihenfolge der Anzeige: erlaubte in ihrem Vorrang, danach die übrigen. */
export function referenzReihe(optionen: readonly ReferenzOption[]): ReferenzOption[] {
  const erlaubt = optionen
    .filter((o) => o.rang !== null)
    .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));
  return [...erlaubt, ...optionen.filter((o) => o.rang === null)];
}

/** Ist wenigstens eine erlaubte Option einsatzbereit (eingerichtet, ohne Sperre)? */
export function einsatzbereit(lage: ReferenzVerwaltung): boolean {
  return lage.optionen.some((o) => o.erlaubt && o.eingerichtet && o.sperre === null);
}

function FunktionscheckZeile({
  eintrag,
  testId,
  aktuellesModell,
}: {
  eintrag: ReferenzFunktionscheck;
  testId: string;
  /** Das heutige Modell der Option — weicht es ab, gilt der Check nicht mehr. */
  aktuellesModell: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  const modell = eintrag.modell ?? t("referenzpruefung.admin.check.keinModell");
  const grund =
    eintrag.grund === null
      ? null
      : eintrag.grund === "falsches_urteil"
        ? t("referenzpruefung.admin.check.grund.falsches_urteil")
        : t(`referenzpruefung.grund.${eintrag.grund}`, {
            defaultValue: t("referenzpruefung.grund.unbekannt"),
          });
  return (
    <div data-testid={testId} data-ergebnis={eintrag.ergebnis} className="text-[12px] text-muted">
      <p>
        {t("referenzpruefung.admin.check.zeile", {
          ergebnis: t(`referenzpruefung.admin.check.ergebnis.${eintrag.ergebnis}`),
          zeit: new Date(eintrag.zeit).toLocaleString(),
          modell,
          dauer: eintrag.dauerMs,
        })}
      </p>
      {grund === null ? null : <p>{grund}</p>}
      <p>
        {!eintrag.modellaufruf
          ? t("referenzpruefung.admin.check.keinAufruf")
          : eintrag.verbrauch
            ? t("referenzpruefung.admin.check.verbrauch", {
                eingabe: eintrag.verbrauch.eingabe,
                ausgabe: eintrag.verbrauch.ausgabe,
              })
            : t("referenzpruefung.admin.check.keinVerbrauch")}
        {" · "}
        {eintrag.kosten
          ? t("referenzpruefung.admin.check.kosten", {
              betrag: eintrag.kosten.betrag.toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }),
              waehrung: eintrag.kosten.waehrung,
            })
          : t("referenzpruefung.admin.check.keineKosten")}
      </p>
      {eintrag.modell !== null && aktuellesModell !== null && eintrag.modell !== aktuellesModell ? (
        <p className="font-semibold">
          {t("referenzpruefung.admin.check.andereModell", { modell: eintrag.modell })}
        </p>
      ) : null}
      {eintrag.gespeichert === false ? (
        <p className="font-semibold">{t("referenzpruefung.admin.check.nichtGespeichert")}</p>
      ) : null}
    </div>
  );
}

export function KiReferenzDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const abfrage = useQuery({
    queryKey: REFERENZ_KEY,
    queryFn: endpoints.reasoner.referenzpruefung,
  });
  // Ein Schreiben zur Zeit — synchron beim Auslösen gezogen, nicht erst im nächsten Bild.
  const schreibt = useRef(false);
  const speichern = useMutation({
    mutationFn: (liste: readonly ReferenzWahl[]) => endpoints.reasoner.setzeReferenzpruefung(liste),
    onMutate: async () => {
      // Ein noch laufender Abruf trüge den Stand von vorher — er darf die Bestätigung nicht überholen.
      await qc.cancelQueries({ queryKey: REFERENZ_KEY });
    },
    onSuccess: (antwort) => {
      qc.setQueryData(REFERENZ_KEY, antwort);
      void qc.invalidateQueries({ queryKey: ["reasonerConfig"] });
      invalidateAiState(qc);
      push("success", t("referenzpruefung.admin.gespeichert"));
    },
    // 409 (ENV-Sperre), 503 (nicht protokollierbar), 400: die Liste hat NICHT gewechselt.
    onError: (e) => {
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
    onSettled: () => {
      schreibt.current = false;
    },
  });
  const check = useMutation({
    mutationFn: (wahl: ReferenzWahl) => endpoints.reasoner.referenzFunktionscheck(wahl),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: REFERENZ_KEY });
    },
  });
  const setzen = (liste: readonly ReferenzWahl[]): void => {
    if (schreibt.current) {
      return;
    }
    schreibt.current = true;
    speichern.mutate(liste);
  };
  const name = (wahl: ReferenzWahl): string =>
    wahl === "local" ? t("adm.ai.choice.local") : anbieterName(wahl);

  return (
    <Detailkarte
      titel={t("referenzpruefung.einstieg.titel")}
      onZurueck={onZurueck}
      testId="detail-ki-referenz"
      hilfe={[
        { titel: t("referenzpruefung.einstieg.titel"), text: t("referenzpruefung.admin.rolle") },
        { titel: t("referenzpruefung.einstieg.titel"), text: t("referenzpruefung.admin.quelle") },
      ]}
    >
      <Abfragehuelle abfrage={abfrage}>
        {(lage) => {
          const gesperrt = lage.policySource === "env" || speichern.isPending;
          const bereit = einsatzbereit(lage);
          return (
            <>
              <p className="text-[12.5px] text-text">{t("referenzpruefung.admin.rolle")}</p>
              <p className="text-[12px] text-muted-2">{t("referenzpruefung.admin.quelle")}</p>
              <p data-testid="ki-referenz-antwortmodell" className="text-[12px] text-muted">
                {lage.antwortmodell
                  ? t("referenzpruefung.admin.antwortmodell", {
                      name: anbieterUndModell(lage.antwortmodell.anbieter),
                    })
                  : t("referenzpruefung.admin.antwortmodellOhne")}
              </p>
              {lage.policySource === "env" ? (
                <output
                  data-testid="ki-referenz-env"
                  className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
                >
                  {t("referenzpruefung.admin.envGesperrt")}
                </output>
              ) : null}

              <fieldset data-testid="ki-referenzpruefung" className="space-y-1.5">
                <legend className="text-[11.5px] font-semibold text-muted">
                  {t("referenzpruefung.admin.legende")}
                </legend>
                {lage.liste.length === 0 ? (
                  <p data-testid="ki-referenzpruefung-leer" className="text-[12px] text-muted-2">
                    {t("referenzpruefung.admin.leer")}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {referenzReihe(lage.optionen).map((o) => {
                    const hilfe =
                      o.sperre !== null && o.eingerichtet
                        ? t(`referenzpruefung.admin.sperre.${o.sperre}`)
                        : !o.eingerichtet
                          ? t("referenzpruefung.admin.hilfe.nicht_eingerichtet")
                          : o.zustand === "konfiguriert"
                            ? t("referenzpruefung.admin.hilfe.konfiguriert")
                            : null;
                    const checkLaeuft = check.isPending && check.variables === o.wahl;
                    return (
                      <li
                        key={o.wahl}
                        data-testid={`ki-referenz-${o.wahl}`}
                        data-zustand={o.zustand}
                        className="space-y-1 rounded-btn border border-hairline px-2.5 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2 text-[13px] text-text">
                            <input
                              type="checkbox"
                              data-testid={`ki-referenz-${o.wahl}-erlaubt`}
                              checked={o.erlaubt}
                              // Eine erlaubte, inzwischen nicht eingerichtete Option bleibt abwählbar.
                              disabled={gesperrt || (!o.erlaubt && !o.eingerichtet)}
                              onChange={() =>
                                setzen(referenzUmschalten(lage.liste, o.wahl) as ReferenzWahl[])
                              }
                              className="h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            />
                            <span className="min-w-0 break-words font-semibold">
                              {name(o.wahl)}
                            </span>
                            {o.rang !== null ? (
                              <span className="shrink-0 text-[11.5px] text-muted-2">
                                {t("referenzpruefung.admin.rang", { rang: o.rang })}
                              </span>
                            ) : null}
                          </label>
                          {o.rang !== null && o.rang > 1 ? (
                            <button
                              type="button"
                              data-testid={`ki-referenz-${o.wahl}-vorziehen`}
                              disabled={gesperrt}
                              onClick={() =>
                                setzen(referenzVorziehen(lage.liste, o.wahl) as ReferenzWahl[])
                              }
                              aria-label={t("referenzpruefung.admin.vorziehen", {
                                name: name(o.wahl),
                              })}
                              className={KNOPF}
                            >
                              ↑
                            </button>
                          ) : null}
                        </div>
                        <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                          <span className="rounded-pill bg-page px-1.5 py-0.5 font-semibold">
                            {t(`referenzpruefung.admin.art.${o.art}`)}
                          </span>
                          <span className="break-all">
                            {o.modell
                              ? t("referenzpruefung.admin.modell", { modell: o.modell })
                              : t("referenzpruefung.admin.modellUnbekannt")}
                          </span>
                          <span
                            data-testid={`ki-referenz-${o.wahl}-zustand`}
                            className={`rounded-pill px-1.5 py-0.5 font-semibold ${ZUSTAND_TON[o.zustand]}`}
                          >
                            {t("referenzpruefung.admin.zustandLabel", {
                              zustand: t(`referenzpruefung.admin.zustand.${o.zustand}`),
                            })}
                          </span>
                        </p>
                        {o.gleichWieAntwortmodell ? (
                          <p
                            data-testid={`ki-referenz-${o.wahl}-gleich`}
                            className="rounded-btn bg-trust-warn-bg px-2 py-1 text-[12px] text-trust-warn-text"
                          >
                            {t("referenzpruefung.admin.gleichesModell")}
                          </p>
                        ) : null}
                        {hilfe === null ? null : (
                          <p
                            data-testid={`ki-referenz-${o.wahl}-hilfe`}
                            className="text-[12px] text-muted-2"
                          >
                            {hilfe}
                          </p>
                        )}
                        {o.letzteFunktionspruefung ? (
                          <FunktionscheckZeile
                            eintrag={o.letzteFunktionspruefung}
                            testId={`ki-referenz-${o.wahl}-letzte`}
                            aktuellesModell={o.modell}
                          />
                        ) : null}
                        {o.eingerichtet ? (
                          <button
                            type="button"
                            data-testid={`ki-referenz-${o.wahl}-check`}
                            disabled={o.sperre !== null || check.isPending}
                            onClick={() => check.mutate(o.wahl)}
                            aria-label={t("referenzpruefung.admin.check.knopfLabel", {
                              name: name(o.wahl),
                            })}
                            className={KNOPF}
                          >
                            {checkLaeuft
                              ? t("referenzpruefung.admin.check.laeuft")
                              : t("referenzpruefung.admin.check.knopf")}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              {speichern.isError ? (
                <p
                  data-testid="ki-referenzpruefung-fehler"
                  role="alert"
                  className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
                >
                  {speichern.error instanceof ApiError ? speichern.error.message : t("state.error")}
                </p>
              ) : null}
              {lage.liste.length > 0 && !bereit ? (
                <output
                  data-testid="ki-referenz-keine"
                  className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
                >
                  {t("referenzpruefung.admin.keineEinsatzbereit")}
                </output>
              ) : null}
              {bereit && !lage.unabhaengigVerfuegbar ? (
                <output
                  data-testid="ki-referenz-konflikt"
                  className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text"
                >
                  {t("referenzpruefung.admin.konflikt")}
                </output>
              ) : null}
              <p data-testid="ki-referenz-keine-bestaetigung" className="text-[12px] text-muted-2">
                {t("referenzpruefung.admin.keineBestaetigung")}
              </p>

              <section
                data-testid="ki-referenz-check"
                className="space-y-1.5 border-t border-hairline pt-2.5"
              >
                <p className="text-[12.5px] font-semibold text-text">
                  {t("referenzpruefung.admin.check.titel")}
                </p>
                <p className="text-[12px] text-muted-2">{t("referenzpruefung.admin.check.text")}</p>
                {/* `<output>` trägt die Rolle „status" selbst (Lint a11y/useSemanticElements). */}
                <output aria-live="polite" className="block">
                  {check.data ? (
                    <FunktionscheckZeile
                      eintrag={check.data}
                      testId="ki-referenz-check-ergebnis"
                      aktuellesModell={check.data.modell}
                    />
                  ) : null}
                  {check.isError ? (
                    <p
                      data-testid="ki-referenz-check-fehler"
                      className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text"
                    >
                      {t("referenzpruefung.admin.check.fehler", {
                        meldung:
                          check.error instanceof ApiError ? check.error.message : t("state.error"),
                      })}
                    </p>
                  ) : null}
                </output>
              </section>

              <section
                data-testid="ki-referenz-freigabe"
                className="space-y-1.5 border-t border-hairline pt-2.5"
              >
                <p className="text-[12.5px] font-semibold text-text">
                  {t("referenzpruefung.admin.freigabe.titel")}
                </p>
                <p className="text-[12px] text-muted-2">
                  {t("referenzpruefung.admin.freigabe.text")}
                </p>
                <p data-testid="ki-referenz-freigabe-stand" className="text-[12px] text-muted">
                  {t("referenzpruefung.admin.freigabe.stand", {
                    oeffentlich: lage.freigabe.oeffentlicheKi
                      ? t("referenzpruefung.admin.freigabe.an")
                      : t("referenzpruefung.admin.freigabe.aus"),
                    vertraulich: lage.freigabe.vertraulicheInhalte
                      ? t("referenzpruefung.admin.freigabe.an")
                      : t("referenzpruefung.admin.freigabe.aus"),
                  })}
                </p>
              </section>

              <section
                data-testid="ki-referenz-grenzen"
                className="space-y-1.5 border-t border-hairline pt-2.5"
              >
                <p className="text-[12.5px] font-semibold text-text">
                  {t("referenzpruefung.admin.grenzen.titel")}
                </p>
                <p className="text-[12px] text-muted">
                  {t("referenzpruefung.admin.grenzen.text", {
                    sekunden: Math.round(lage.grenzen.zeitlimitMs / 1000),
                    token: lage.grenzen.antwortMaxToken,
                    posten: lage.grenzen.postenMax,
                    zeichen: lage.grenzen.eingabeMaxZeichen,
                    erneut: lage.grenzen.erneutMax,
                    richtlinie: lage.grenzen.richtlinie,
                  })}
                </p>
                <p data-testid="ki-referenz-preise" className="text-[12px] text-muted-2">
                  {lage.preise.hinterlegt
                    ? t("referenzpruefung.admin.preise.hinterlegt", {
                        waehrung: lage.preise.waehrung ?? "",
                        stand: lage.preise.preisstand ?? "",
                      })
                    : t("referenzpruefung.admin.preise.fehlt")}
                </p>
              </section>
            </>
          );
        }}
      </Abfragehuelle>
    </Detailkarte>
  );
}
