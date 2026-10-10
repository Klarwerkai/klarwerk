// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) — SPRECHEN, DIKTIEREN UND VORLESEN IN KLARAS FLÄCHE.
// ================================================================================================
//
// ZWEI SICHTBAR GETRENNTE VORGÄNGE, beide über das VORHANDENE Browser-Diktat (`lib/speechDictation.ts`,
// dieselbe Rekorder-Fabrik wie Fragefeld und Erfassen — nichts wird hochgeladen, keine Tonaufnahme):
//   · „Diktieren“ schreibt Endgültiges ins Eingabefeld. Es sendet NICHTS und führt nichts aus.
//   · „Auftrag sprechen“ sammelt das Gesprochene und zeigt es danach als KARTE: erkannter Text
//     (korrigierbar), Ziel (Seite · Objekt beim Sprechen), Einordnung (Frage oder Arbeitsauftrag) und
//     Rückfragen zu unklaren Namen, Zeiten und Bezügen (`lib/klaraSprache.ts`). Erst „Senden“ schickt
//     den KORRIGIERTEN Text über denselben Weg wie eine getippte Frage (`KlaraVorschau.tsx` →
//     `echt.ts` → `POST /api/ask`, mit Einwilligung, Rechten und zentralen Freigaben).
//   Nach dem Senden bleibt die Karte stehen: gehört, gesendet als, Ziel und das TATSÄCHLICHE Ergebnis.
//   Im Grundschritt ist das Ergebnis immer eine Antwort; ausgeführt wird keine Handlung.
//
// AUSWEGE, die die Texteingabe nie sperren: kein Browser-Diktat (Firefox, iOS) → ehrlicher Satz statt
// Knopf; Mikrofon abgelehnt → ehrlicher Satz; „Aufnahme stoppen“ beendet das Zuhören jederzeit, und
// das Schliessen der Fläche ebenso (Abbau = Stopp).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDirectory } from "../../api/hooks";
import { anfuegen, auftragsArt, klaerungen } from "../../lib/klaraSprache";
import { type SpeechRec, diktatSprache, makeRec } from "../../lib/speechDictation";
import { hasSpeechRecognition, istIosGeraet } from "../../lib/speechSupport";
import { vorlesenMoeglich } from "../../lib/vorlesen";
import type { Fragestand } from "./echt";
import {
  TEMPI,
  type Tempo,
  setzeAutoVorlesen,
  setzeTempo,
  stoppeVorlesen,
  useKlaraVorlesen,
  vorlesenUmschalten,
} from "./vorlesen";
import type { Herkunft } from "./zustand";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";

export type Aufnahmeart = "diktat" | "auftrag";

/** Was aus einem gesendeten Auftrag wurde — `demo` im Demo-Betrieb, sonst der Stand des Fragewegs. */
export type SprachStand = Exclude<Fragestand, "veraltet"> | "demo" | "nicht_gesendet";

export interface SprachZiel {
  seitenName: string;
  objekt: string;
  /** `false`, wenn auf dieser Seite kein Objekt erkannt ist. */
  bekannt: boolean;
  /**
   * Der vollständige Ort beim Sprechen. Mit GENAU diesem Bezug wird der Auftrag gesendet — ein
   * Seitenwechsel bis zum Senden ändert weder die angezeigte Zieldarstellung noch den Gesprächsbezug.
   */
  herkunft: Herkunft;
}

export interface GesprochenerAuftrag {
  id: string;
  /** Der Text, wie er erkannt wurde — bleibt sichtbar, auch nach Korrektur. */
  gehoert: string;
  /** Der korrigierbare Text; genau dieser geht hinaus. */
  text: string;
  ziel: SprachZiel;
  /**
   * Schlüssel der beantworteten Rückfragen — gültig nur für den aktuellen `text`: jede eigene
   * Korrektur leert die Liste (Nacharbeit 3).
   */
  erledigt: string[];
  gesendet: {
    text: string;
    art: "frage" | "aktion";
    stand: SprachStand | "laeuft";
    antwort: string | null;
  } | null;
}

export interface Absendeergebnis {
  stand: SprachStand;
  /** Der Text der Antwort, die daraus wurde — zum Vorlesen. */
  antwort: string | null;
}

export interface KlaraSprachSteuerung {
  moeglich: boolean;
  ios: boolean;
  laeuft: Aufnahmeart | null;
  zwischen: string;
  hinweis: string | null;
  starten: (art: Aufnahmeart) => void;
  /** Beendet das Zuhören; das bis dahin Gesprochene wird noch verarbeitet. */
  stoppen: () => void;
  /** Beendet das Zuhören sofort und verwirft das Gesprochene (Klara geschlossen). Stabil. */
  abbrechen: () => void;
  auftrag: GesprochenerAuftrag | null;
  setzeAuftrag: (f: (a: GesprochenerAuftrag | null) => GesprochenerAuftrag | null) => void;
}

let auftragZaehler = 0;

export function useKlaraSprache(optionen: {
  setzeEingabe: (f: (alt: string) => string) => void;
  /** Das Ziel im Augenblick des Sprechens. */
  ziel: () => SprachZiel;
}): KlaraSprachSteuerung {
  const { t, i18n } = useTranslation();
  const moeglich = typeof window !== "undefined" && hasSpeechRecognition(window);
  const ios = typeof window !== "undefined" && istIosGeraet(window);
  const [laeuft, setLaeuft] = useState<Aufnahmeart | null>(null);
  const [zwischen, setZwischen] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [auftrag, setAuftrag] = useState<GesprochenerAuftrag | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const optionenRef = useRef(optionen);
  optionenRef.current = optionen;
  const tRef = useRef(t);
  tRef.current = t;

  const abbrechen = useCallback((): void => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        // schon beendet
      }
      setLaeuft(null);
      setZwischen("");
    }
  }, []);
  // Der Abbau der Fläche beendet das Zuhören; Schliessen und Minimieren rufen `abbrechen` selbst.
  useEffect(() => abbrechen, [abbrechen]);

  const starten = (art: Aufnahmeart): void => {
    if (recRef.current) {
      return;
    }
    // Klara hört sich nicht selbst zu.
    stoppeVorlesen();
    setHinweis(null);
    setZwischen("");
    let gesammelt = "";
    let grund: string | null = null;
    const vorgang: { rec: SpeechRec | null } = { rec: null };
    const rec = makeRec(
      (text) => {
        if (recRef.current !== vorgang.rec) {
          return;
        }
        if (art === "diktat") {
          optionenRef.current.setzeEingabe((alt) => anfuegen(alt, text));
        } else {
          gesammelt = anfuegen(gesammelt, text);
        }
      },
      (beendet) => {
        if (recRef.current !== beendet) {
          return; // spätes Ende einer schon abgelösten Aufnahme
        }
        recRef.current = null;
        setLaeuft(null);
        setZwischen("");
        const tt = tRef.current;
        if (grund === "not-allowed" || grund === "service-not-allowed") {
          setHinweis(tt("klarasprache.fehler.mikrofon"));
        } else if (grund === "audio-capture") {
          setHinweis(tt("klarasprache.fehler.keinMikrofon"));
        } else if (grund && grund !== "aborted" && grund !== "no-speech") {
          setHinweis(tt("klarasprache.fehler.andere", { grund }));
        }
        if (art === "auftrag") {
          const text = gesammelt.trim();
          if (text) {
            auftragZaehler += 1;
            setAuftrag({
              id: `auftrag-${auftragZaehler}`,
              gehoert: text,
              text,
              ziel: optionenRef.current.ziel(),
              erledigt: [],
              gesendet: null,
            });
          } else if (!grund || grund === "no-speech") {
            setHinweis(tt("klarasprache.fehler.nichts"));
          }
        }
      },
      diktatSprache(i18n.language),
      (vorlaeufig) => {
        if (recRef.current === vorgang.rec) {
          setZwischen(vorlaeufig);
        }
      },
      (g) => {
        grund = g;
      },
    );
    if (!rec) {
      setHinweis(t("klarasprache.na"));
      return;
    }
    vorgang.rec = rec;
    if (art === "auftrag") {
      setAuftrag(null);
    }
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setHinweis(t("klarasprache.fehler.start"));
      return;
    }
    setLaeuft(art);
  };

  const stoppen = (): void => {
    const rec = recRef.current;
    if (!rec) {
      return;
    }
    // Der Browser liefert noch das letzte Endgültige und meldet dann `end` — dort wird aufgeräumt.
    try {
      rec.stop();
    } catch {
      rec.onend?.();
    }
  };

  return {
    moeglich,
    ios,
    laeuft,
    zwischen,
    hinweis,
    starten,
    stoppen,
    abbrechen,
    auftrag,
    setzeAuftrag: setAuftrag,
  };
}

// -------------------------------------------------------------------------------------------------
// Die Leiste über dem Eingabefeld: Diktieren · Auftrag sprechen · Aufnahme stoppen · Vorlesen stoppen.
// -------------------------------------------------------------------------------------------------
export function KlaraSprachLeiste({ s }: { s: KlaraSprachSteuerung }): JSX.Element {
  const { t } = useTranslation();
  const vorlesen = useKlaraVorlesen();
  return (
    <div data-testid="klara-sprache" className="w-full space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {s.moeglich ? (
          s.laeuft ? (
            <button
              type="button"
              data-testid="klara-aufnahme-stoppen"
              onClick={s.stoppen}
              className={KNOPF}
            >
              {t("klarasprache.stoppen")}
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="klara-diktieren"
                title={t("klarasprache.diktierenHilfe")}
                onClick={() => s.starten("diktat")}
                className={KNOPF}
              >
                {t("klarasprache.diktieren")}
              </button>
              <button
                type="button"
                data-testid="klara-auftrag-sprechen"
                title={t("klarasprache.auftragSprechenHilfe")}
                onClick={() => s.starten("auftrag")}
                className={KNOPF}
              >
                {t("klarasprache.auftragSprechen")}
              </button>
            </>
          )
        ) : (
          <p data-testid="klara-sprache-na" className="text-[11px] leading-relaxed text-muted-2">
            {t("klarasprache.na")}
            {s.ios ? ` ${t("diktat.iosTastatur")}` : ""}
          </p>
        )}
        {vorlesen.liest !== null ? (
          <button
            type="button"
            data-testid="klara-vorlesen-stoppen"
            onClick={stoppeVorlesen}
            className={KNOPF}
          >
            {t("klarasprache.vorlesenStop")}
          </button>
        ) : null}
      </div>
      {s.laeuft ? (
        <p
          data-testid="klara-aufnahme-laeuft"
          data-art={s.laeuft}
          aria-live="polite"
          className="text-[11px] font-semibold text-ai"
        >
          {t(`klarasprache.laeuft.${s.laeuft}`)}
        </p>
      ) : null}
      {s.zwischen ? (
        <p
          data-testid="klara-aufnahme-zwischen"
          aria-live="polite"
          className="text-[11.5px] italic text-muted"
        >
          {s.zwischen}
        </p>
      ) : null}
      {s.hinweis ? (
        <output
          data-testid="klara-sprache-hinweis"
          className="block rounded-btn bg-trust-warn-bg px-2 py-1 text-[11px] leading-relaxed text-trust-warn-text"
        >
          {s.hinweis}
        </output>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Die Karte des gesprochenen Auftrags — vor dem Senden korrigierbar, danach mit dem Ergebnis.
// -------------------------------------------------------------------------------------------------
export function KlaraAuftragKarte({
  s,
  sendebereit,
  absenden,
}: {
  s: KlaraSprachSteuerung;
  sendebereit: boolean;
  absenden: (text: string, ziel: SprachZiel) => Promise<Absendeergebnis>;
}): JSX.Element | null {
  const a = s.auftrag;
  if (!a) {
    return null;
  }
  return a.gesendet ? (
    <AuftragErgebnis a={a} s={s} />
  ) : (
    <AuftragEntwurf a={a} s={s} sendebereit={sendebereit} absenden={absenden} />
  );
}

function zielText(z: SprachZiel): string {
  return `${z.seitenName} · ${z.objekt}`;
}

function AuftragEntwurf({
  a,
  s,
  sendebereit,
  absenden,
}: {
  a: GesprochenerAuftrag;
  s: KlaraSprachSteuerung;
  sendebereit: boolean;
  absenden: (text: string, ziel: SprachZiel) => Promise<Absendeergebnis>;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const feldId = useId();
  const personen = useDirectory();
  const bezug = a.ziel.bekannt ? t("klarasprache.bezug", { ziel: zielText(a.ziel) }) : null;
  const offen = klaerungen(a.text, {
    personen: personen.data ?? [],
    jetzt: new Date(),
    sprache: i18n.language,
    bezug,
  }).filter((k) => !a.erledigt.includes(k.schluessel));
  const art = auftragsArt(a.text);
  const leer = a.text.trim().length === 0;
  const aendere = (f: (x: GesprochenerAuftrag) => GesprochenerAuftrag): void =>
    s.setzeAuftrag((x) => (x && x.id === a.id ? f(x) : x));

  const senden = (): void => {
    const text = a.text.trim();
    if (!text || offen.length > 0 || !sendebereit) {
      return;
    }
    aendere((x) => ({ ...x, gesendet: { text, art, stand: "laeuft", antwort: null } }));
    // Nacharbeit 3: gesendet wird mit dem Ziel dieser Karte, nicht mit dem Ort, an dem Klara jetzt ist.
    void absenden(text, a.ziel).then((r) => {
      aendere((x) =>
        x.gesendet ? { ...x, gesendet: { ...x.gesendet, stand: r.stand, antwort: r.antwort } } : x,
      );
    });
  };

  return (
    <section
      data-testid="klara-auftrag"
      data-art={art}
      className="rounded-card border border-ai/40 bg-surface px-3 py-2.5"
    >
      <h3 className="text-[12px] font-semibold text-ink">{t("klarasprache.auftrag.titel")}</h3>
      <p data-testid="klara-auftrag-gehoert" className="mt-0.5 text-[11px] text-muted">
        {t("klarasprache.auftrag.gehoert", { text: a.gehoert })}
      </p>
      <label htmlFor={feldId} className={`${KLEINTITEL} mt-1.5 block`}>
        {t("klarasprache.auftrag.text")}
      </label>
      <textarea
        id={feldId}
        data-testid="klara-auftrag-text"
        value={a.text}
        rows={2}
        onChange={(e) => {
          const text = e.target.value;
          // Nacharbeit 3 (Bens Befund): eine Rückfragen-Entscheidung gilt nur für den Text, für den
          // sie getroffen wurde. Eine eigene Korrektur kann eine schon geklärte Stelle wieder
          // mehrdeutig machen („um 15:00“ → „um drei“) — deshalb verfallen alle Entscheidungen, und
          // `klaerungen` fragt neu, was im korrigierten Text noch unklar ist. Ersetzte Stellen
          // („Anna“ → „Anna Kramer“) bleiben dabei geklärt, weil sie gar nicht mehr unklar sind.
          aendere((x) => ({ ...x, text, erledigt: [] }));
        }}
        className="mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30"
      />
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
        <dt className={KLEINTITEL}>{t("klarasprache.auftrag.ziel")}</dt>
        <dd data-testid="klara-auftrag-ziel" className="text-text">
          {zielText(a.ziel)}
        </dd>
        <dt className={KLEINTITEL}>{t("klarasprache.auftrag.artLabel")}</dt>
        <dd data-testid="klara-auftrag-art" data-art={art} className="font-semibold text-text">
          {t(`klarasprache.auftrag.art.${art}`)}
        </dd>
      </dl>
      {art === "aktion" ? (
        <p
          data-testid="klara-auftrag-aktion-hinweis"
          className="mt-1 text-[11px] leading-relaxed text-muted-2"
        >
          {t("klarasprache.auftrag.aktionHinweis")}
        </p>
      ) : null}

      {offen.length > 0 ? (
        <section data-testid="klara-klaerungen" className="mt-2 space-y-1.5">
          <p className={KLEINTITEL}>{t("klarasprache.klaerung.titel")}</p>
          {offen.map((k) => (
            <div key={k.schluessel} data-testid="klara-klaerung" data-art={k.art}>
              <p className="text-[11.5px] text-text">
                {t(`klarasprache.klaerung.${k.art}`, { fund: k.fund })}
              </p>
              {k.art === "ziel" && !bezug ? (
                <p className="text-[11px] text-muted-2">
                  {t("klarasprache.klaerung.zielUnbekannt")}
                </p>
              ) : null}
              <div className="mt-0.5 flex flex-wrap gap-1">
                {k.optionen.map((o) => (
                  <button
                    key={o.wert ?? "-"}
                    type="button"
                    data-testid="klara-klaerung-option"
                    data-wert={o.wert ?? ""}
                    onClick={() =>
                      aendere((x) => ({
                        ...x,
                        text: o.text,
                        erledigt: [...x.erledigt, k.schluessel],
                      }))
                    }
                    className={KNOPF}
                  >
                    {o.wert ??
                      (k.art === "ziel"
                        ? t("klarasprache.klaerung.ohneBezug")
                        : t("klarasprache.klaerung.soLassen"))}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {leer ? (
        <p className="mt-1 text-[11px] text-trust-crit-text">{t("klarasprache.auftrag.leer")}</p>
      ) : offen.length > 0 ? (
        <p data-testid="klara-auftrag-offen" className="mt-1 text-[11px] text-muted-2">
          {t("klarasprache.auftrag.offen")}
        </p>
      ) : !sendebereit ? (
        <p data-testid="klara-auftrag-nicht-bereit" className="mt-1 text-[11px] text-muted-2">
          {t("klarasprache.auftrag.nichtBereit")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-auftrag-senden"
          disabled={leer || offen.length > 0 || !sendebereit}
          onClick={senden}
          className={KNOPF_KI}
        >
          {t("klarasprache.auftrag.senden")}
        </button>
        <button
          type="button"
          data-testid="klara-auftrag-verwerfen"
          onClick={() => s.setzeAuftrag(() => null)}
          className={KNOPF}
        >
          {t("klarasprache.auftrag.verwerfen")}
        </button>
      </div>
    </section>
  );
}

function AuftragErgebnis({
  a,
  s,
}: {
  a: GesprochenerAuftrag;
  s: KlaraSprachSteuerung;
}): JSX.Element | null {
  const { t } = useTranslation();
  const g = a.gesendet;
  if (!g) {
    return null;
  }
  return (
    <section
      data-testid="klara-auftrag-ergebnis"
      data-stand={g.stand}
      data-art={g.art}
      className="rounded-card border border-hairline bg-page px-3 py-2.5"
    >
      <h3 className="text-[12px] font-semibold text-ink">{t("klarasprache.ergebnis.titel")}</h3>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
        <dt className={KLEINTITEL}>{t("klarasprache.ergebnis.gehoert")}</dt>
        <dd data-testid="klara-ergebnis-gehoert" className="text-text">
          {a.gehoert}
        </dd>
        <dt className={KLEINTITEL}>{t("klarasprache.ergebnis.gesendet")}</dt>
        <dd data-testid="klara-ergebnis-gesendet" className="text-text">
          {g.text}
        </dd>
        <dt className={KLEINTITEL}>{t("klarasprache.ergebnis.ziel")}</dt>
        <dd data-testid="klara-ergebnis-ziel" className="text-text">
          {zielText(a.ziel)}
        </dd>
        <dt className={KLEINTITEL}>{t("klarasprache.ergebnis.ergebnis")}</dt>
        <dd data-testid="klara-ergebnis-stand" className="font-semibold text-text">
          {t(`klarasprache.ergebnis.stand.${g.stand}`)}
          {g.art === "aktion" ? ` ${t("klarasprache.ergebnis.keineAktion")}` : ""}
        </dd>
      </dl>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {g.antwort ? <VorlesenKnopf id={`${a.id}-antwort`} text={g.antwort} /> : null}
        <button
          type="button"
          data-testid="klara-auftrag-schliessen"
          onClick={() => s.setzeAuftrag(() => null)}
          className={KNOPF}
        >
          {t("klarasprache.ergebnis.schliessen")}
        </button>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------------------------------------
// Vorlesen: ein Knopf je Antwort, und die Einstellungen.
// -------------------------------------------------------------------------------------------------
export function VorlesenKnopf({ id, text }: { id: string; text: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const v = useKlaraVorlesen();
  if (!vorlesenMoeglich()) {
    return null;
  }
  const liest = v.liest === id;
  return (
    <button
      type="button"
      data-testid="klara-vorlesen"
      aria-pressed={liest}
      onClick={() => vorlesenUmschalten(id, text, i18n.language)}
      className={`${KNOPF} h-7 px-2 text-[11px]`}
    >
      {liest ? t("klarasprache.vorlesenStop") : t("klarasprache.vorlesen")}
    </button>
  );
}

export function KlaraSprachausgabe(): JSX.Element {
  const { t } = useTranslation();
  const v = useKlaraVorlesen();
  const tempoId = useId();
  if (!vorlesenMoeglich()) {
    return (
      <p data-testid="klara-vorlesen-na" className="text-[11px] leading-relaxed text-muted-2">
        {t("klarasprache.vorlesenNa")}
      </p>
    );
  }
  return (
    <details data-testid="klara-sprachausgabe" className="rounded-card border border-hairline">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[12px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        {t("klarasprache.ausgabe.titel")}
      </summary>
      <div className="space-y-1.5 px-2.5 pb-2 text-[11.5px] text-text">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            data-testid="klara-vorlesen-auto"
            checked={v.auto}
            onChange={(e) => setzeAutoVorlesen(e.target.checked)}
          />
          {t("klarasprache.ausgabe.auto")}
        </label>
        <label htmlFor={tempoId} className="flex items-center gap-1.5">
          {t("klarasprache.ausgabe.tempoLabel")}
          <select
            id={tempoId}
            data-testid="klara-vorlesen-tempo"
            value={v.tempo}
            onChange={(e) => setzeTempo(e.target.value as Tempo)}
            className="h-7 rounded-input border border-hairline bg-surface px-1.5 text-[11.5px]"
          >
            {TEMPI.map((x) => (
              <option key={x} value={x}>
                {t(`klarasprache.ausgabe.tempo.${x}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}
