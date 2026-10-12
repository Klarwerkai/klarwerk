// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — DIE FÄHIGKEITEN DER EIGENEN ASSISTENZ.
//
// Unter „Meine Assistenz": welche geprüften Fähigkeiten es gibt, an wen ihre Daten gehen, ob sie
// JETZT verfügbar sind (sonst mit den konkreten Voraussetzungen), die eigenen Favoriten und
// bestätigten Routinen samt Deaktivieren — und ein Aufruf mit Vorschau vor der Ausführung. Alles
// über `/api/me/faehigkeiten`; der bestätigte Stand ist immer die Antwort des Servers.
//
// AUFTRAGSIDENTITÄT (AC08): Eine Ausführung trägt die Kennung und den Fingerabdruck der ANGEZEIGTEN
// Vorschau. Nur ein Versionskonflikt (409) verlangt eine neue Vorschau. Bei jedem anderen Fehler —
// Antwortverlust, Netzfehler, Serverfehler — ist der Ausgang unbekannt: die Wirkung kann schon
// eingetreten sein. Dann bleiben Kennung und Bindung erhalten, die Eingabe ist gesperrt, und es gibt
// nur „Stand abrufen" und „Denselben Auftrag erneut senden" — der Server erkennt die Kennung und
// liefert das gespeicherte Ergebnis statt einer zweiten Wirkung.
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
  // Kennung und Fingerabdruck der ANGEZEIGTEN Vorschau — ausgeführt wird nur genau diese Bindung.
  const [auftragId, setAuftragId] = useState<string | null>(null);
  const [fingerabdruck, setFingerabdruck] = useState<string | null>(null);
  // Ausgang einer gesendeten Ausführung unbekannt: Identität festhalten, keine neue Vorschau.
  const [ungewiss, setUngewiss] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const zweck = f.zwecke[0] ?? "";

  const vorschau = async (): Promise<void> => {
    if (ungewiss) {
      return;
    }
    setFehler(null);
    setHinweis(null);
    setErgebnis(null);
    setLaeuft(true);
    try {
      const a = await faehigkeitenApi.vorschau({
        zweck,
        gewaehlt: f.id,
        eingabe: werte,
        auftragId: neueAuftragId(),
      });
      setVorbereitung(a.vorbereitung);
      setAuftragId(a.auftragId);
      setFingerabdruck(a.fingerabdruck);
    } catch (e) {
      setFehler(grundAus(e));
    } finally {
      setLaeuft(false);
    }
  };

  const ausfuehren = async (): Promise<void> => {
    if (!auftragId || !fingerabdruck) {
      return;
    }
    setFehler(null);
    setHinweis(null);
    setLaeuft(true);
    try {
      const a = await faehigkeitenApi.ausfuehren({
        zweck,
        gewaehlt: f.id,
        eingabe: werte,
        auftragId,
        vorschauFingerabdruck: fingerabdruck,
      });
      setVorbereitung(a.vorbereitung);
      setErgebnis(a.ergebnis);
      setUngewiss(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Versionskonflikt: die Bindung hat sich seit der Vorschau geändert — KEINE Wirkung ist
        // eingetreten; erst die neue Vorschau prüfen.
        setVorbereitung(null);
        setFingerabdruck(null);
        setAuftragId(null);
        setUngewiss(false);
        setFehler(grundAus(e));
        return;
      }
      // Unbekannter Ausgang: Kennung, Fingerabdruck und Vorschau bleiben.
      setUngewiss(true);
      setFehler(grundAus(e));
    } finally {
      setLaeuft(false);
    }
  };

  const standAbrufen = async (): Promise<void> => {
    if (!auftragId) {
      return;
    }
    setFehler(null);
    setHinweis(null);
    setLaeuft(true);
    try {
      const a = await faehigkeitenApi.auftrag(auftragId);
      if (a.auftrag.ergebnis) {
        setErgebnis(a.auftrag.ergebnis);
        setUngewiss(false);
      } else {
        setHinweis(t("assistenz.faehigkeiten.laeuftNoch"));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Nie angekommen: derselbe Auftrag darf unter derselben Kennung gesendet werden.
        setHinweis(t("assistenz.faehigkeiten.nichtAngekommen"));
        return;
      }
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
            data-testid={`faehigkeit-feld-${feld.name}`}
            maxLength={feld.maxLaenge}
            value={werte[feld.name] ?? ""}
            disabled={ungewiss}
            onChange={(e) => {
              setWerte({ ...werte, [feld.name]: e.target.value });
              setVorbereitung(null);
              setFingerabdruck(null);
              setAuftragId(null);
              setErgebnis(null);
            }}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          data-testid="faehigkeit-vorschau"
          disabled={laeuft || ungewiss}
          onClick={() => void vorschau()}
        >
          {t("assistenz.faehigkeiten.vorschau")}
        </Button>
        {vorbereitung?.art === "gebunden" && !ergebnis && !ungewiss ? (
          <Button
            variant="primary"
            data-testid="faehigkeit-ausfuehren"
            disabled={laeuft}
            onClick={() => void ausfuehren()}
          >
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
      {ungewiss ? (
        <div className="space-y-2" data-testid="faehigkeit-ungewiss">
          <p className="text-[12.5px]">{t("assistenz.faehigkeiten.ungewiss")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              data-testid="faehigkeit-stand-abrufen"
              disabled={laeuft}
              onClick={() => void standAbrufen()}
            >
              {t("assistenz.faehigkeiten.standAbrufen")}
            </Button>
            <Button
              variant="primary"
              data-testid="faehigkeit-erneut-senden"
              disabled={laeuft}
              onClick={() => void ausfuehren()}
            >
              {t("assistenz.faehigkeiten.erneutSenden")}
            </Button>
          </div>
        </div>
      ) : null}
      {hinweis ? (
        <output className="block text-[12.5px]" data-testid="faehigkeit-hinweis">
          {hinweis}
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
                  <Button
                    variant="outline"
                    data-testid={`faehigkeit-favorit-${f.id}`}
                    onClick={() => void merke(f.id, "favorit")}
                  >
                    {t("assistenz.faehigkeiten.favorit")}
                  </Button>
                  <Button
                    variant="outline"
                    data-testid={`faehigkeit-routine-${f.id}`}
                    onClick={() => void merke(f.id, "routine")}
                  >
                    {t("assistenz.faehigkeiten.routine")}
                  </Button>
                  {f.verfuegbar ? (
                    <Button
                      variant="ghost"
                      data-testid={`faehigkeit-nutzen-${f.id}`}
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
            <p className="text-[12.5px] text-muted" data-testid="faehigkeiten-keine-vormerkungen">
              {t("assistenz.faehigkeiten.keineVormerkungen")}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="faehigkeiten-vormerkungen">
              {stand.vormerkungen.map((v) => (
                <li
                  key={`${v.vormerkung.faehigkeitId}-${v.vormerkung.art}`}
                  className="flex flex-wrap items-center gap-2 text-[12.5px]"
                  data-testid={`faehigkeit-vormerkung-${v.vormerkung.faehigkeitId}-${v.vormerkung.art}`}
                  data-aktiv={v.vormerkung.aktiv ? "true" : "false"}
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
                      data-testid={`faehigkeit-deaktivieren-${v.vormerkung.faehigkeitId}-${v.vormerkung.art}`}
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
