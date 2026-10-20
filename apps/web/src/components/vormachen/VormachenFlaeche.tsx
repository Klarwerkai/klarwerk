// ================================================================================================
// produkt:20261011:peter-p06 — VORMACHEN UND ROUTINEN in den persönlichen Einstellungen.
// ================================================================================================
//
// Ein Weg in vier Schritten, jeder sichtbar und vom Menschen ausgelöst:
//   1. Anwendung, Vorgänge, Zweck und Abbruchregel wählen → „Mitschreiben starten" (AC01, AC06).
//   2. Zustand sehen, sofort pausieren, fortsetzen oder abbrechen (AC02).
//   3. Lernnotiz und Vorschau ansehen, Schritte ändern oder herausnehmen, bestätigen (AC03, AC04).
//   4. Routinen: Schritte als Ergebnis zur Prüfung vorbereiten; ein Schritt mit Außenwirkung
//      braucht die Bestätigung genau dieser Ausführung (AC05). Übergabe an die Firma als Entwurf;
//      „Alles Private löschen" lässt übergebene Entwürfe unberührt (AC07).
//   5. BPA-06 (`RoutineLauf`): Routine pausieren oder mit den Eingaben dieses Laufs ausführen.
// Der Server entscheidet alles; diese Fläche zeigt nur, was er bestätigt hat.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  type Ausfuehrung,
  type KorrekturEingabe,
  type Lernsitzung,
  type Routine,
  type RoutineSchritt,
  type VormachenAbbruchRegel,
  type VormachenHost,
  type VormachenUebersicht,
  type Vorschau,
  vormachenApi,
} from "../../api/vormachen";
import { useSession } from "../../app/AuthContext";
import { meldeVormachen, useVormachenStand } from "../../lib/vormachenAnzeige";
import { Button, Field, TextInput } from "../ui";
import { KorrekturSatzFeld } from "./KorrekturSatzFeld";
import { RoutineLauf } from "./RoutineLauf";

/** Nur eine Antwort in der vereinbarten Form wird zur angeforderten Ausführung. */
function istAusfuehrung(wert: unknown): wert is Ausfuehrung {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const a = wert as Partial<Record<keyof Ausfuehrung, unknown>>;
  return (
    typeof a.id === "string" && typeof a.routineId === "string" && typeof a.schrittId === "string"
  );
}

/**
 * EQF-06-K08: `nurFunktionen` ist der Einstieg „Meine Funktionen“ — dieselbe Fläche aus derselben
 * Routinenablage, nur ohne Lernstart, Lernnotizen und Löschen. Keine zweite Registry.
 */
export function VormachenFlaeche({
  nurFunktionen = false,
}: {
  nurFunktionen?: boolean;
} = {}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const kontoId = user?.id ?? null;
  const { fassung } = useVormachenStand(kontoId);
  const [daten, setDaten] = useState<VormachenUebersicht | null>(null);
  const [ladefehler, setLadefehler] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [host, setHost] = useState<VormachenHost>("klarwerk_web");
  const [vorgaenge, setVorgaenge] = useState<string[]>([]);
  const [zweck, setZweck] = useState("");
  const [regel, setRegel] = useState<VormachenAbbruchRegel>("alles_verwerfen");
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [korrektur, setKorrektur] = useState<{ nr: number; text: string } | null>(null);
  const [privatFrage, setPrivatFrage] = useState(false);
  const [angefordert, setAngefordert] = useState<Ausfuehrung | null>(null);

  const lade = useCallback(async (): Promise<void> => {
    try {
      const u = await vormachenApi.uebersicht();
      setDaten(u);
      setLadefehler(false);
    } catch {
      setLadefehler(true);
    }
  }, []);

  // Jede gemeldete Änderung (auch aus der Lernanzeige) liest den Stand neu.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst auf jede gemeldete Änderung neu lesen.
  useEffect(() => {
    void lade();
  }, [lade, fassung]);

  /** Führt eine Aktion aus und meldet sie; ein Fehler steht mit dem Grund des Servers da. */
  const tu = async (aktion: () => Promise<string | null>, nochOffen: boolean): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      setMeldung(await aktion());
      meldeVormachen(nochOffen, kontoId);
    } catch (e) {
      setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLaeuft(false);
    }
  };

  if (ladefehler) {
    return (
      <div role="alert" className="space-y-2 text-[12.5px] text-trust-crit-text">
        <p>{t("vormachen.laden.fehler")}</p>
      </div>
    );
  }
  if (!daten) {
    return <p className="text-[13px] text-muted">{t("vormachen.intro")}</p>;
  }

  const katalog = daten.katalog;
  const offen = daten.sitzungen.find((s) => s.zustand !== "abgebrochen") ?? null;
  const notizen = daten.sitzungen.filter((s) => s.zustand === "abgebrochen");
  const vorgangText = (v: string): string => t(`vormachen.vorgang.${v}`);
  const istAussen = (v: string): boolean => katalog.vorgaenge[v]?.aussenwirkung === true;
  const hostVorgaenge = Object.keys(katalog.vorgaenge).filter(
    (v) => katalog.vorgaenge[v]?.host === host,
  );
  const nichtAufgenommen = offen
    ? Object.values(offen.nichtAufgenommen).reduce((summe, n) => summe + n, 0)
    : 0;
  const mitAnzeige = (h: VormachenHost): boolean => katalog.hostsMitAnzeige.includes(h);

  const starten = (): Promise<void> =>
    tu(async () => {
      await vormachenApi.starte({ host, vorgaenge, zweck, abbruchRegel: regel });
      setVorschau(null);
      return null;
    }, true);

  const zeigeVorschau = (s: Lernsitzung): Promise<void> =>
    tu(async () => {
      setVorschau((await vormachenApi.vorschau(s.id)).vorschau);
      return null;
    }, true);

  const korrigiere = (s: Lernsitzung, eingabe: KorrekturEingabe) =>
    tu(async () => {
      setVorschau((await vormachenApi.korrigiere(s.id, eingabe)).vorschau);
      setKorrektur(null);
      return null;
    }, true);

  const gibFrei = (r: Routine, schritt: RoutineSchritt, ausfuehrung?: string) =>
    tu(async () => {
      const { freigabe } = await vormachenApi.gibFrei(r, schritt, ausfuehrung);
      setAngefordert(null);
      return freigabe.art === "aussenaktion_bestaetigt"
        ? t("vormachen.freigabe.aussen", { schritt: schritt.beschreibung })
        : t("vormachen.freigabe.pruefung", { schritt: schritt.beschreibung });
    }, offen !== null);

  /**
   * Außenschritt, erster Zug: der Server fordert genau EINE Ausführung an und antwortet 409 mit
   * ihrer Kennung. Erst der zweite Klick bestätigt sie — einmal, für diesen Schritt.
   */
  const fordereAn = (r: Routine, schritt: RoutineSchritt) =>
    tu(async () => {
      try {
        await vormachenApi.gibFrei(r, schritt);
      } catch (e) {
        const a = e instanceof ApiError ? e.details.ausfuehrung : undefined;
        if (e instanceof ApiError && e.status === 409 && istAusfuehrung(a)) {
          setAngefordert(a);
          return null;
        }
        throw e;
      }
      return null;
    }, offen !== null);

  return (
    <div
      className="space-y-5 text-[13px]"
      data-testid="vormachen-flaeche"
      data-nur-funktionen={nurFunktionen ? "ja" : undefined}
    >
      <p className="text-muted">
        {t(nurFunktionen ? "vormachen.funktionen.intro" : "vormachen.intro")}
      </p>
      {fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      {meldung ? (
        <output className="block" data-testid="vormachen-meldung">
          {meldung}
        </output>
      ) : null}

      {nurFunktionen ? null : offen === null ? (
        <form
          className="space-y-3"
          data-testid="vormachen-start"
          onSubmit={(e) => {
            e.preventDefault();
            void starten();
          }}
        >
          <Field label={t("vormachen.host.label")}>
            <select
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3"
              value={host}
              onChange={(e) => {
                setHost(e.target.value as VormachenHost);
                setVorgaenge([]);
              }}
              data-testid="vormachen-host"
            >
              {katalog.hosts.map((h) => (
                <option key={h} value={h} disabled={!mitAnzeige(h)}>
                  {t(`vormachen.host.${h}`)}
                </option>
              ))}
            </select>
          </Field>
          {katalog.hosts.some((h) => !mitAnzeige(h)) ? (
            <p className="text-muted" data-testid="vormachen-host-ohne-anzeige">
              {t("vormachen.host.ohneAnzeige")}
            </p>
          ) : null}
          <Field label={t("vormachen.vorgaenge.label")} gruppe>
            {hostVorgaenge.map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={vorgaenge.includes(v)}
                  onChange={(e) =>
                    setVorgaenge((alt) =>
                      e.target.checked ? [...alt, v] : alt.filter((x) => x !== v),
                    )
                  }
                  data-testid={`vormachen-vorgang-${v}`}
                />
                <span>{vorgangText(v)}</span>
                {istAussen(v) ? (
                  <span className="text-trust-warn-text">{t("vormachen.vorgang.aussen")}</span>
                ) : null}
              </label>
            ))}
          </Field>
          <Field label={t("vormachen.zweck.label")}>
            <TextInput
              value={zweck}
              maxLength={300}
              onChange={(e) => setZweck(e.target.value)}
              data-testid="vormachen-zweck"
            />
          </Field>
          <Field label={t("vormachen.regel.label")}>
            <select
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3"
              value={regel}
              onChange={(e) => setRegel(e.target.value as VormachenAbbruchRegel)}
              data-testid="vormachen-regel"
            >
              {katalog.abbruchRegeln.map((r) => (
                <option key={r} value={r}>
                  {t(`vormachen.regel.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-muted">
            {t("vormachen.frist", { stunden: katalog.rohdatenFristStunden })}
          </p>
          <Button
            type="submit"
            variant="primary"
            disabled={laeuft || vorgaenge.length === 0 || zweck.trim() === ""}
            data-testid="vormachen-starten"
          >
            {t("vormachen.starten")}
          </Button>
        </form>
      ) : (
        <section className="space-y-3" data-testid="vormachen-sitzung">
          <output className="block" data-testid="vormachen-zustand" data-zustand={offen.zustand}>
            {offen.zustand === "pausiert"
              ? t("vormachen.zustand.pausiert")
              : t("vormachen.zustand.lernt", { anzahl: offen.beobachtet })}
          </output>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={offen.zustand === "pausiert" ? "primary" : "outline"}
              disabled={laeuft}
              data-testid="vormachen-pause"
              onClick={() =>
                void tu(async () => {
                  const ziel = offen.zustand === "pausiert" ? "lernt" : "pausiert";
                  await vormachenApi.setzeZustand(offen.id, ziel);
                  return null;
                }, true)
              }
            >
              {offen.zustand === "pausiert" ? t("vormachen.fortsetzen") : t("vormachen.pause")}
            </Button>
            <Button
              variant="danger"
              disabled={laeuft}
              data-testid="vormachen-abbrechen"
              onClick={() =>
                void tu(async () => {
                  await vormachenApi.brecheAb(offen.id);
                  setVorschau(null);
                  return null;
                }, false)
              }
            >
              {t("vormachen.abbrechen")}
            </Button>
          </div>
          {nichtAufgenommen > 0 ? (
            <p className="text-muted" data-testid="vormachen-nicht-aufgenommen">
              {t("vormachen.nichtAufgenommen", { anzahl: nichtAufgenommen })}
            </p>
          ) : null}
          <Button
            variant="outline"
            disabled={laeuft}
            data-testid="vormachen-vorschau-laden"
            onClick={() => void zeigeVorschau(offen)}
          >
            {t("vormachen.vorschau.laden")}
          </Button>
          {vorschau?.sitzungId === offen.id ? (
            <section className="space-y-2" data-testid="vormachen-vorschau">
              <h3 className="font-medium">{t("vormachen.vorschau.titel")}</h3>
              <p className="text-muted">{t("vormachen.vorschau.modus")}</p>
              {vorschau.schritte.length === 0 ? (
                <p className="text-muted">{t("vormachen.vorschau.leer")}</p>
              ) : (
                <ol className="list-decimal space-y-2 pl-5">
                  {vorschau.schritte.map((x) => (
                    <li key={x.beleg} data-testid={`vormachen-vorschau-schritt-${x.nr}`}>
                      {korrektur?.nr === x.beleg ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <TextInput
                            aria-label={t("vormachen.korrektur.feld", { nr: x.nr })}
                            value={korrektur.text}
                            maxLength={300}
                            onChange={(e) => setKorrektur({ nr: x.beleg, text: e.target.value })}
                          />
                          <Button
                            variant="primary"
                            disabled={laeuft || korrektur.text.trim() === ""}
                            onClick={() =>
                              void korrigiere(offen, { nr: x.beleg, beschreibung: korrektur.text })
                            }
                          >
                            {t("vormachen.korrektur.uebernehmen")}
                          </Button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <span>{x.beschreibung}</span>
                          <span className="text-muted">
                            {vorgangText(x.vorgang)}
                            {" · "}
                            {t("vormachen.vorschau.beleg", { nr: x.beleg })}
                          </span>
                          {x.korrigiert ? (
                            <span className="text-muted">{t("vormachen.vorschau.korrigiert")}</span>
                          ) : null}
                          {x.aussenwirkung ? (
                            <span className="text-trust-warn-text">
                              {t("vormachen.vorgang.aussen")}
                            </span>
                          ) : null}
                          <Button
                            variant="ghost"
                            disabled={laeuft}
                            onClick={() => setKorrektur({ nr: x.beleg, text: x.beschreibung })}
                          >
                            {t("vormachen.korrigieren")}
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={laeuft}
                            onClick={() => void korrigiere(offen, { nr: x.beleg, entfernen: true })}
                          >
                            {t("vormachen.entfernen")}
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {vorschau.ableitung ? (
                <section className="space-y-2" data-testid="vormachen-ableitung">
                  <h4 className="font-medium">
                    {t("vormachen.ableitung.titel", { anzahl: vorschau.ableitung.vorfuehrungen })}
                  </h4>
                  {vorschau.ableitung.erklaerung.map((a) => (
                    <div key={a.ueberschrift}>
                      <p className="font-medium">{a.ueberschrift}</p>
                      <ul className="list-disc pl-5">
                        {a.zeilen.map((z) => (
                          <li key={z}>{z}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {vorschau.ableitung.schritte.map((x) => (
                      <Button
                        key={x.nr}
                        variant="ghost"
                        disabled={laeuft}
                        data-testid={`vormachen-ableitung-entfernen-${x.nr}`}
                        onClick={() =>
                          void korrigiere(offen, {
                            ableitung: { art: "schritt_entfernen", nr: x.nr },
                          })
                        }
                      >
                        {t("vormachen.ableitung.herausnehmen", { nr: x.nr })}
                      </Button>
                    ))}
                  </div>
                  {/* EQF-06-K03: Korrektur in eigenen Worten — gedeutet, mit Quelle. */}
                  <KorrekturSatzFeld
                    testid="vormachen-ableitung-korrektur"
                    schritte={vorschau.ableitung.schritte.map((x) => ({
                      nr: x.nr,
                      text: x.ziel?.name ?? x.frage ?? x.art,
                    }))}
                    sende={async (k) => {
                      const antwort = await vormachenApi.korrigiere(offen.id, { ableitung: k });
                      setVorschau(antwort.vorschau);
                      return t("vormachen.korrektur.uebernommen");
                    }}
                  />
                </section>
              ) : null}
              <Button
                variant="primary"
                disabled={laeuft || vorschau.schritte.length === 0}
                data-testid="vormachen-bestaetigen"
                onClick={() =>
                  void tu(async () => {
                    await vormachenApi.bestaetige(offen.id, vorschau.stand);
                    setVorschau(null);
                    return null;
                  }, false)
                }
              >
                {t("vormachen.bestaetigen")}
              </Button>
            </section>
          ) : null}
        </section>
      )}

      {(nurFunktionen ? [] : notizen).map((n) => (
        <section key={n.id} className="space-y-2" data-testid="vormachen-notiz">
          <h3 className="font-medium">{t("vormachen.notiz.titel", { zweck: n.zweck })}</h3>
          <p className="text-muted">{t("vormachen.zustand.abgebrochen")}</p>
          <ol className="list-decimal pl-5">
            {n.lernnotiz.schritte
              .filter((x) => !x.entfernt)
              .map((x) => (
                <li key={x.nr}>{x.beschreibung}</li>
              ))}
          </ol>
          <Button
            variant="outline"
            disabled={laeuft}
            onClick={() =>
              void tu(async () => {
                await vormachenApi.verwerfeNotiz(n.id);
                return null;
              }, offen !== null)
            }
          >
            {t("vormachen.notiz.loeschen")}
          </Button>
        </section>
      ))}

      <section className="space-y-3" data-testid="vormachen-routinen">
        <h3 className="font-medium">{t("vormachen.routinen.titel")}</h3>
        {daten.routinen.length === 0 ? (
          <p className="text-muted">{t("vormachen.routinen.leer")}</p>
        ) : null}
        {daten.routinen.map((r) => (
          <article key={r.id} className="space-y-2" data-testid="vormachen-routine">
            <h4 className="font-medium">{r.titel}</h4>
            <p className="text-muted">{t("vormachen.vorschau.modus")}</p>
            <ol className="list-decimal space-y-2 pl-5">
              {r.schritte.map((x) => (
                <li key={x.id} className="space-y-1">
                  <span>{x.beschreibung}</span>
                  {x.aussenwirkung ? (
                    <span className="block space-y-1">
                      <span className="block text-trust-warn-text">
                        {t("vormachen.aussen.hinweis")}
                      </span>
                      {angefordert?.routineId === r.id && angefordert.schrittId === x.id ? (
                        <span className="block space-y-1">
                          <span className="block" data-testid={`vormachen-aussen-offen-${x.id}`}>
                            {t("vormachen.aussen.offen", { schritt: x.beschreibung })}
                          </span>
                          <Button
                            variant="primary"
                            disabled={laeuft}
                            data-testid={`vormachen-aussen-bestaetigen-${x.id}`}
                            onClick={() => void gibFrei(r, x, angefordert.id)}
                          >
                            {t("vormachen.aussen.bestaetigen")}
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={laeuft}
                          data-testid={`vormachen-aussen-${x.id}`}
                          onClick={() => void fordereAn(r, x)}
                        >
                          {t("vormachen.aussen.anfordern")}
                        </Button>
                      )}
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={laeuft}
                      data-testid={`vormachen-freigabe-${x.id}`}
                      onClick={() => void gibFrei(r, x)}
                    >
                      {t("vormachen.schritt.freigeben")}
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            {r.firmenuebergabe ? (
              <p className="text-muted">{t("vormachen.uebergeben.erfolgt")}</p>
            ) : (
              <Button
                variant="outline"
                disabled={laeuft}
                data-testid="vormachen-uebergeben"
                onClick={() =>
                  void tu(async () => {
                    await vormachenApi.uebergib(r.id);
                    return t("vormachen.uebergeben.erfolgt");
                  }, offen !== null)
                }
              >
                {t("vormachen.uebergeben")}
              </Button>
            )}
            {/* BPA-06: die bestätigte Routine mit den Eingaben dieses Laufs ausführen. */}
            <RoutineLauf routine={r} onGeaendert={() => void lade()} />
          </article>
        ))}
      </section>

      {nurFunktionen ? null : (
        <section className="space-y-2" data-testid="vormachen-privat">
          <p className="text-muted">{t("vormachen.privat.hinweis")}</p>
          {privatFrage ? (
            <Button
              variant="danger"
              disabled={laeuft}
              data-testid="vormachen-privat-bestaetigen"
              onClick={() =>
                void tu(async () => {
                  const { geloescht } = await vormachenApi.privatLoeschen();
                  setPrivatFrage(false);
                  setVorschau(null);
                  return t("vormachen.privat.erledigt", geloescht);
                }, false)
              }
            >
              {t("vormachen.privat.bestaetigen")}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={laeuft}
              data-testid="vormachen-privat-loeschen"
              onClick={() => setPrivatFrage(true)}
            >
              {t("vormachen.privat.loeschen")}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
