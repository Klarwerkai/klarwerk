// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — DIE FÄHIGKEITEN DER EIGENEN ASSISTENZ.
//
// Unter „Meine Assistenz": welche geprüften Fähigkeiten es gibt, an wen ihre Daten gehen, ob sie
// JETZT verfügbar sind (sonst mit den konkreten Voraussetzungen), die eigenen Favoriten und
// bestätigten Routinen samt Deaktivieren — und ein Aufruf mit Vorschau vor der Ausführung. Alles
// über `/api/me/faehigkeiten`; der bestätigte Stand ist immer die Antwort des Servers.
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  type FaehigkeitenAntwort,
  type FaehigkeitsEintrag,
  type FaehigkeitsErgebnis,
  type FaehigkeitsVorbereitung,
  faehigkeitenApi,
} from "../../api/faehigkeiten";
import { Button, TextInput } from "../ui";

function grundAus(fehler: unknown): string {
  return fehler instanceof ApiError || fehler instanceof Error ? fehler.message : String(fehler);
}

function neueAuftragId(): string {
  const zufall =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `auftrag-${zufall}`.slice(0, 64);
}

function Aufruf({ f }: { f: FaehigkeitsEintrag }): JSX.Element {
  const { t } = useTranslation();
  const basisId = useId();
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [vorbereitung, setVorbereitung] = useState<FaehigkeitsVorbereitung | null>(null);
  const [ergebnis, setErgebnis] = useState<FaehigkeitsErgebnis | null>(null);
  const [auftragId, setAuftragId] = useState<string>(neueAuftragId);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const zweck = f.zwecke[0] ?? "";

  const vorschau = async (): Promise<void> => {
    setFehler(null);
    setErgebnis(null);
    setLaeuft(true);
    try {
      const a = await faehigkeitenApi.vorschau({ zweck, gewaehlt: f.id, eingabe: werte });
      setVorbereitung(a.vorbereitung);
      setAuftragId(neueAuftragId());
    } catch (e) {
      setFehler(grundAus(e));
    } finally {
      setLaeuft(false);
    }
  };

  const ausfuehren = async (): Promise<void> => {
    setFehler(null);
    setLaeuft(true);
    try {
      const a = await faehigkeitenApi.ausfuehren({
        zweck,
        gewaehlt: f.id,
        eingabe: werte,
        auftragId,
      });
      setVorbereitung(a.vorbereitung);
      setErgebnis(a.ergebnis);
    } catch (e) {
      setFehler(grundAus(e));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="space-y-2" data-testid={`faehigkeit-aufruf-${f.id}`}>
      {f.eingaben.map((feld) => (
        <label key={feld.name} className="block space-y-1" htmlFor={`${basisId}-${feld.name}`}>
          <span className="block text-[12.5px] font-medium text-muted">
            {t(`assistenz.faehigkeiten.feld.${feld.name}`, { defaultValue: feld.name })}
          </span>
          <TextInput
            id={`${basisId}-${feld.name}`}
            maxLength={feld.maxLaenge}
            value={werte[feld.name] ?? ""}
            onChange={(e) => {
              setWerte({ ...werte, [feld.name]: e.target.value });
              setVorbereitung(null);
              setErgebnis(null);
            }}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={laeuft} onClick={() => void vorschau()}>
          {t("assistenz.faehigkeiten.vorschau")}
        </Button>
        {vorbereitung?.art === "gebunden" && !ergebnis ? (
          <Button variant="primary" disabled={laeuft} onClick={() => void ausfuehren()}>
            {t("assistenz.faehigkeiten.ausfuehren")}
          </Button>
        ) : null}
      </div>
      {vorbereitung?.art === "gebunden" ? (
        <pre className="whitespace-pre-wrap rounded-input border border-hairline p-2 text-[12px]">
          {vorbereitung.vorschau}
        </pre>
      ) : null}
      {vorbereitung?.art === "offen" ? (
        <output className="block text-[12.5px] text-trust-crit-text">
          {vorbereitung.erklaerung}
        </output>
      ) : null}
      {ergebnis ? (
        <output className="block space-y-1 text-[12.5px]" data-testid="faehigkeit-ergebnis">
          <p>
            {t("assistenz.faehigkeiten.ergebnis", {
              stand: ergebnis.stand,
              meldung: ergebnis.meldung,
            })}
          </p>
          <ul className="list-disc pl-5">
            {ergebnis.eintraege.map((e, i) => (
              <li key={`${e.url ?? ""}-${i}`}>
                {e.url && /^https?:\/\//.test(e.url) ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {e.titel ?? e.url}
                  </a>
                ) : (
                  (e.titel ?? "")
                )}
                {e.auszug ? <span className="text-muted"> — {e.auszug}</span> : null}
              </li>
            ))}
          </ul>
        </output>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t("assistenz.faehigkeiten.fehler", { grund: fehler })}
        </p>
      ) : null}
    </div>
  );
}

export function FaehigkeitenBereich(): JSX.Element {
  const { t } = useTranslation();
  const [stand, setStand] = useState<FaehigkeitenAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = useCallback(async (): Promise<void> => {
    try {
      setStand(await faehigkeitenApi.lesen());
      setFehler(null);
    } catch {
      setFehler(t("assistenz.faehigkeiten.ladenFehler"));
    }
  }, [t]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const merke = async (faehigkeitId: string, art: "favorit" | "routine"): Promise<void> => {
    try {
      await faehigkeitenApi.vormerken({
        faehigkeitId,
        art,
        ...(art === "routine" ? { bestaetigt: true } : {}),
      });
      await laden();
    } catch (e) {
      setFehler(t("assistenz.faehigkeiten.fehler", { grund: grundAus(e) }));
    }
  };

  const deaktiviere = async (faehigkeitId: string): Promise<void> => {
    try {
      await faehigkeitenApi.deaktivieren(faehigkeitId);
      await laden();
    } catch (e) {
      setFehler(t("assistenz.faehigkeiten.fehler", { grund: grundAus(e) }));
    }
  };

  return (
    <section className="space-y-3" data-testid="assistenz-faehigkeiten">
      <h3 className="text-[14px] font-semibold">{t("assistenz.faehigkeiten.titel")}</h3>
      <p className="text-[12.5px] text-muted">{t("assistenz.faehigkeiten.intro")}</p>
      {fehler ? (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      {stand ? (
        <>
          <ul className="space-y-3">
            {stand.faehigkeiten.map((f) => (
              <li
                key={f.id}
                className="space-y-1 rounded-input border border-hairline p-3"
                data-testid={`faehigkeit-${f.id}`}
              >
                <p className="text-[13px] font-medium">
                  {f.name} <span className="text-muted">({f.fassung})</span>
                </p>
                <p className="text-[12.5px]">{f.beschreibung}</p>
                <p className="text-[12.5px] text-muted">
                  {f.datenempfaenger.art === "intern"
                    ? t("assistenz.faehigkeiten.empfaengerIntern")
                    : t("assistenz.faehigkeiten.empfaengerExtern", {
                        anbieter: f.datenempfaenger.anbieterName,
                      })}
                </p>
                <p className="text-[12.5px]">
                  {f.verfuegbar
                    ? t("assistenz.faehigkeiten.verfuegbar")
                    : t("assistenz.faehigkeiten.nichtVerfuegbar")}
                </p>
                {f.voraussetzungen.length > 0 ? (
                  <ul className="list-disc pl-5 text-[12.5px] text-muted">
                    {f.voraussetzungen.map((v) => (
                      <li key={`${v.art}-${v.text}`}>{v.text}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void merke(f.id, "favorit")}>
                    {t("assistenz.faehigkeiten.favorit")}
                  </Button>
                  <Button variant="outline" onClick={() => void merke(f.id, "routine")}>
                    {t("assistenz.faehigkeiten.routine")}
                  </Button>
                  {f.verfuegbar ? (
                    <Button
                      variant="ghost"
                      aria-expanded={offen === f.id}
                      onClick={() => setOffen(offen === f.id ? null : f.id)}
                    >
                      {t("assistenz.faehigkeiten.nutzen")}
                    </Button>
                  ) : null}
                </div>
                {offen === f.id ? <Aufruf f={f} /> : null}
              </li>
            ))}
          </ul>
          <h4 className="text-[13px] font-semibold">{t("assistenz.faehigkeiten.vormerkungen")}</h4>
          {stand.vormerkungen.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              {t("assistenz.faehigkeiten.keineVormerkungen")}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="faehigkeiten-vormerkungen">
              {stand.vormerkungen.map((v) => (
                <li
                  key={`${v.vormerkung.faehigkeitId}-${v.vormerkung.art}`}
                  className="flex flex-wrap items-center gap-2 text-[12.5px]"
                >
                  <span>
                    {t(`assistenz.faehigkeiten.art.${v.vormerkung.art}`)}:{" "}
                    {stand.faehigkeiten.find((f) => f.id === v.vormerkung.faehigkeitId)?.name ??
                      v.vormerkung.faehigkeitId}
                  </span>
                  <span className="text-muted">{v.hinweis}</span>
                  {v.vormerkung.aktiv ? (
                    <Button
                      variant="ghost"
                      onClick={() => void deaktiviere(v.vormerkung.faehigkeitId)}
                    >
                      {t("assistenz.faehigkeiten.deaktivieren")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
