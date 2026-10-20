// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen (KLARA-OFFICE-02) — DIE FLÄCHE DER BEGLEITAPP.
// ================================================================================================
//
// Diese Seite ist, was die native Begleitapp auf dem Mac (`apps/desktop/klara-begleiter`) in ihrem
// frei beweglichen Fenster zeigt. Sie läuft OHNE Hülle (`shell/AppShell.tsx`) und kennt zwei Lagen:
//   · FIGUR — nur die gewählte Figur mit ihrem tatsächlichen Zustand. Das Fenster ist so klein wie
//     die Figur; es verdeckt vom Dokument darunter nichts weiter.
//   · GESPRÄCH — Word-Kontext, das eigene Klara-Gespräch (Klara 01, unverändert über `echt.ts`),
//     Sprechen/Diktieren/Vorlesen (Klara 02, unverändert über `KlaraSprache.tsx`) und die
//     Bedienung der Figur.
// Lage, Ziehen, Andocken, Bildschirmrand und Mehrmonitor gehören der App; die Seite meldet ihr nur
// die gewünschte Lage und Tastaturschritte (`lib/begleiterBruecke.ts`).
//
// DER WORD-KONTEXT kommt AUSSCHLIESSLICH vom Office-Adapter im Word-Fenster (`word-addin/
// begleiter.js`) über den Kanal des eigenen Kontos. Ein inaktives Fenster liefert keine Auswahl;
// Fragen zur Markierung und das Einfügen laufen über dieses Word-Fenster zurück. Das Gespräch hier
// sendet keinen Dokumenttext.
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import type { KlaraObjektbezug } from "../api/klaraGespraech";
import { useSession } from "../app/AuthContext";
import {
  KlaraEchtGespraech,
  useKlaraKiLage,
} from "../components/klara-vorschau/KlaraEchtGespraech";
import {
  type Absendeergebnis,
  KlaraAuftragKarte,
  KlaraSprachLeiste,
  KlaraSprachausgabe,
  type SprachZiel,
  useKlaraSprache,
} from "../components/klara-vorschau/KlaraSprache";
import {
  vergiss as echtVergessen,
  fehlerBild,
  fragen,
  ladeEcht,
  leseEcht,
  stoppen,
  useEchtGespraech,
} from "../components/klara-vorschau/echt";
import { auftrittAus, useAssistenzProfil } from "../components/klara-vorschau/profil";
import {
  leseVorlesen,
  stoppeVorlesen,
  useKlaraVorlesen,
  vorlesen,
} from "../components/klara-vorschau/vorlesen";
import type { Herkunft } from "../components/klara-vorschau/zustand";
import { LegalFooter } from "../legal/LegalPages";
import {
  BEGLEITER_ABRUF_MS,
  type BegleiterAdapter,
  type BegleiterKontext,
  aktionLaeuft,
  begleiterApi,
  bewegungsSchritt,
  figurZustand,
  gueltigeAuswahl,
  waehleAdapter,
} from "../lib/begleiter";
import { anNative, appFassung, hoereAufNative, inBegleitApp } from "../lib/begleiterBruecke";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { APP_VERSION } from "../version";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";

/** Der Ring der Figur je Zustand — Farbe UND Text (der Text steht daneben, nie nur die Farbe). */
const RING: Record<string, string> = {
  ruhe: "ring-hairline",
  wartet: "ring-ai",
  antwortet: "ring-trust-pos-fill",
  fehler: "ring-trust-crit-fill",
  hoert: "ring-brand",
  spricht: "ring-brand",
};

/** Die Bedienvorliebe „reduzierte Bewegung" — im Browser gemerkt, kein Inhalt. */
const REDUZIERT_SPEICHER = "klarwerk.begleiter.reduziert";

function leseReduziert(): boolean {
  try {
    const roh = localStorage.getItem(REDUZIERT_SPEICHER);
    if (roh === "an" || roh === "aus") {
      return roh === "an";
    }
  } catch {
    // ohne Speicher: Systemvorgabe
  }
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function merkeReduziert(an: boolean): void {
  try {
    localStorage.setItem(REDUZIERT_SPEICHER, an ? "an" : "aus");
  } catch {
    // gilt dann bis zum Neuladen
  }
}

function kuerze(text: string, max: number): string {
  const glatt = text.replace(/\s+/g, " ").trim();
  return glatt.length > max ? `${glatt.slice(0, max - 1)}…` : glatt;
}

export function Begleiter(): JSX.Element {
  const { t, i18n } = useTranslation();
  const sitzung = useSession();
  const kontoId = sitzung.user?.id ?? null;
  const echt = useEchtGespraech();
  const ki = useKlaraKiLage();
  const vorlese = useKlaraVorlesen();
  const auftritt = auftrittAus(useAssistenzProfil());
  const name = auftritt.name ?? t("klaraprodukt.name.neutral");
  const app = inBegleitApp();
  const appStand = appFassung();
  const eingabeId = useId();
  const frageId = useId();

  const [offen, setOffen] = useState(false);
  const [reduziert, setReduziert] = useState(leseReduziert);
  const [eingabe, setEingabe] = useState("");
  const [wordFrage, setWordFrage] = useState("");
  const [kontext, setKontext] = useState<BegleiterKontext | null>(null);
  const [kontextFehler, setKontextFehler] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const figurRef = useRef<HTMLButtonElement | null>(null);

  // Die Seite ist durchsichtig: in der Lage FIGUR ist nur die Figur zu sehen, nicht ein Kasten.
  useEffect(() => {
    const html = document.documentElement.style.background;
    const body = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = html;
      document.body.style.background = body;
    };
  }, []);

  // BPA-01 AC10: jeder Wechsel der Anmeldung geht an die App — sie entwertet die Browserkarte
  // sofort und gibt sie erst nach eigener Prüfung beim Server wieder frei. Kein Konto im Rumpf.
  const gemeldetesKonto = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (gemeldetesKonto.current !== kontoId) {
      gemeldetesKonto.current = kontoId;
      anNative({ art: "anmeldung" });
    }
  }, [kontoId]);

  // Das eigene Gespräch — dieselbe Ablage wie Klara im Produkt.
  useEffect(() => {
    if (!kontoId) {
      echtVergessen();
      stoppeVorlesen();
      return;
    }
    void ladeEcht(kontoId, t);
  }, [kontoId, t]);

  // Der Word-Kontext — nur unter der eigenen Anmeldung, im Takt gelesen.
  useEffect(() => {
    if (!kontoId) {
      setKontext(null);
      return;
    }
    let beendet = false;
    const lies = async (): Promise<void> => {
      try {
        const k = await begleiterApi.kontext();
        if (!beendet) {
          setKontext(k);
          setKontextFehler(null);
        }
      } catch (fehler) {
        if (!beendet) {
          // Ohne frische Antwort keine Auswahl: der alte Stand wird verworfen, nicht weiter gezeigt.
          setKontext(null);
          setKontextFehler(fehlerBild(fehler, t).text);
        }
      }
      if (!beendet) {
        setJetzt(Date.now());
      }
    };
    void lies();
    const uhr = window.setInterval(() => void lies(), BEGLEITER_ABRUF_MS);
    return () => {
      beendet = true;
      window.clearInterval(uhr);
    };
  }, [kontoId, t]);

  const adapter: BegleiterAdapter | null = waehleAdapter(kontext, gewaehlt);
  const auswahl = gueltigeAuswahl(adapter);

  // Die Lage des Fensters und die Fassung gehen an die App; im Browser bleibt das ohne Wirkung.
  useEffect(() => {
    anNative({ art: "bereit", webFassung: APP_VERSION });
    // Verlässt die Seite die Fläche (abgemeldet → Anmeldemaske), braucht die App ein grosses Fenster:
    // eine Anmeldung in Figurgrösse wäre unbedienbar.
    return () => {
      anNative({ art: "modus", modus: "gespraech" });
    };
  }, []);
  useEffect(() => {
    anNative({ art: "modus", modus: offen ? "gespraech" : "figur" });
  }, [offen]);
  useEffect(() => {
    anNative({ art: "reduziert", an: reduziert });
  }, [reduziert]);

  const setzeReduziert = useCallback((an: boolean): void => {
    setReduziert(an);
    merkeReduziert(an);
  }, []);

  useEffect(
    () =>
      hoereAufNative((befehl) => {
        if (befehl === "figur-klick") {
          setOffen((o) => !o);
        } else if (befehl === "gespraech-oeffnen") {
          setOffen(true);
        } else if (befehl === "gespraech-schliessen") {
          setOffen(false);
        } else if (befehl === "reduziert-an" || befehl === "reduziert-aus") {
          setzeReduziert(befehl === "reduziert-an");
        }
      }),
    [setzeReduziert],
  );

  // Der Griff: die Fläche der Figur, in der die App das Ziehen mit der Maus übernimmt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `offen` verschiebt die Figur im Fenster.
  useEffect(() => {
    const el = figurRef.current;
    if (!el) {
      return;
    }
    const melden = (): void => {
      const r = el.getBoundingClientRect();
      anNative({ art: "griff", x: r.left, y: r.top, breite: r.width, hoehe: r.height });
    };
    melden();
    const spaet = window.setTimeout(melden, 300);
    window.addEventListener("resize", melden);
    return () => {
      window.clearTimeout(spaet);
      window.removeEventListener("resize", melden);
    };
  }, [offen]);

  // Gesprächsbezug: die Begleitapp, mit dem Namen des gebundenen Word-Dokuments als Objekt.
  const objekt = adapter
    ? adapter.dokument.titel || t("begleiter.kontext.ohneTitel")
    : t("begleiter.figur.ohneWord");
  const herkunft: Herkunft = {
    pfad: "/begleiter",
    seite: "andere",
    seitenName: t("begleiter.gespraech.bezug"),
    objekt,
  };
  const bezug: KlaraObjektbezug = {
    pfad: herkunft.pfad,
    seitenName: herkunft.seitenName,
    objekt: herkunft.objekt,
  };
  const herkunftRef = useRef(herkunft);
  herkunftRef.current = herkunft;

  const sendebereit =
    Boolean(echt.gespraech?.einwilligungAm) &&
    !ki.abgeschaltet &&
    echt.laeuftSeit === null &&
    echt.laden === "bereit";

  const fragenSenden = async (text: string, ziel?: Herkunft): Promise<Absendeergebnis> => {
    if (!sendebereit) {
      return { stand: "nicht_gesendet", antwort: null };
    }
    const h = ziel ?? herkunftRef.current;
    const stand = await fragen(
      text,
      { pfad: h.pfad, seitenName: h.seitenName, objekt: h.objekt },
      toReasonerLocale(i18n.language),
      t,
    );
    if (stand === "veraltet") {
      return { stand: "nicht_gesendet", antwort: null };
    }
    const letzte = [...leseEcht().nachrichten].reverse().find((n) => n.von === "klara");
    return { stand, antwort: letzte?.text ?? null };
  };

  const sprechen = useKlaraSprache({
    setzeEingabe: setEingabe,
    ziel: (): SprachZiel => ({
      seitenName: herkunftRef.current.seitenName,
      objekt: herkunftRef.current.objekt,
      bekannt: true,
      herkunft: herkunftRef.current,
    }),
  });
  // Geschlossen hört die Figur nicht mehr zu — kein Mikrofon ohne sichtbaren Stopp.
  const aufnahmeAbbrechen = sprechen.abbrechen;
  useEffect(() => {
    if (!offen) {
      aufnahmeAbbrechen();
    }
  }, [offen, aufnahmeAbbrechen]);

  // „Antworten automatisch vorlesen" (Klara 02) — nur, wenn die Person es eingeschaltet hat.
  const letzteKlara = [...echt.nachrichten].reverse().find((n) => n.von === "klara") ?? null;
  const letzteId = letzteKlara?.id ?? null;
  const gelesenRef = useRef<string | null>(letzteId);
  useEffect(() => {
    if (letzteId === null || letzteId === gelesenRef.current) {
      return;
    }
    gelesenRef.current = letzteId;
    if (
      letzteKlara &&
      (letzteKlara.modus === "ki" || letzteKlara.modus === "ohne_ki") &&
      leseVorlesen().auto
    ) {
      vorlesen(letzteId, letzteKlara.text, i18n.language);
    }
  }, [letzteId, letzteKlara, i18n.language]);

  // Die Figur folgt dem tatsächlichen Zustand.
  const zustand = figurZustand({
    wartet: echt.laeuftSeit !== null || aktionLaeuft(adapter),
    hoert: sprechen.laeuft !== null,
    liest: vorlese.liest !== null,
    letzteModus: letzteKlara?.modus ?? null,
    letzteAm: letzteKlara ? Date.parse(letzteKlara.angelegtAm) : null,
    stoerung: echt.laden === "fehler" || kontextFehler !== null,
    jetzt,
  });
  useEffect(() => {
    anNative({ art: "zustand", zustand });
  }, [zustand]);
  const zustandText = t(`begleiter.figur.zustand.${zustand}`);

  const senden = (e: FormEvent): void => {
    e.preventDefault();
    const frage = eingabe.trim();
    if (!frage || !sendebereit) {
      return;
    }
    setEingabe("");
    void fragenSenden(frage);
  };

  // Was eingefügt würde: die jüngste Antwort aus Word, sonst die jüngste Antwort im Gespräch.
  const wordAntwort =
    [...(adapter?.aktionen ?? [])]
      .reverse()
      .find((a) => a.art === "frage" && a.stand === "erledigt" && a.ergebnis)?.ergebnis ?? null;
  const gespraechAntwort =
    letzteKlara && (letzteKlara.modus === "ki" || letzteKlara.modus === "ohne_ki")
      ? letzteKlara.text
      : null;
  const einfuegeText = wordAntwort ?? gespraechAntwort;

  const beauftrage = async (art: "einfuegen" | "frage", text: string): Promise<void> => {
    if (!adapter) {
      return;
    }
    setAktionFehler(null);
    try {
      await begleiterApi.beauftrage(adapter.instanz, {
        art,
        text,
        auswahlStand: auswahl?.stand ?? 0,
      });
      if (art === "frage") {
        setWordFrage("");
      }
    } catch (fehler) {
      setAktionFehler(
        t("begleiter.aktion.nichtBeauftragt", {
          grund: fehler instanceof ApiError ? fehler.message : fehlerBild(fehler, t).text,
        }),
      );
    }
  };

  const tasteAnFigur = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const schritt = bewegungsSchritt(e.key, e.shiftKey);
    if (schritt) {
      e.preventDefault();
      anNative({ art: "bewegen", ...schritt });
    }
  };

  const figur = (
    <button
      ref={figurRef}
      type="button"
      data-testid="begleiter-figur"
      data-zustand={zustand}
      data-reduziert={reduziert ? "an" : "aus"}
      aria-label={t("begleiter.figur.label", { name })}
      aria-expanded={offen}
      title={`${name} · ${zustandText}`}
      onClick={() => setOffen((o) => !o)}
      onKeyDown={tasteAnFigur}
      className={`relative shrink-0 rounded-full bg-surface ring-4 ${RING[zustand] ?? RING.ruhe} ${
        offen ? "h-12 w-12" : "h-[72px] w-[72px]"
      } ${
        !reduziert && (zustand === "wartet" || zustand === "hoert" || zustand === "spricht")
          ? "animate-pulse"
          : ""
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
    >
      <img
        src={auftritt.avatarUrl}
        alt=""
        draggable={false}
        className="h-full w-full select-none rounded-full object-contain"
      />
      {!adapter?.aktiv ? (
        <span
          data-testid="begleiter-figur-ohne-word"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-muted-2"
        />
      ) : null}
    </button>
  );

  if (!offen) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        {figur}
        <span className="sr-only" aria-live="polite">
          {zustandText}
        </span>
      </div>
    );
  }

  const host = adapter ? t(`begleiter.kontext.host.${adapter.host}`) : null;

  return (
    <div
      data-testid="begleiter-gespraech"
      className="flex h-screen w-screen flex-col overflow-hidden rounded-card border border-hairline bg-page text-text shadow-lg"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOffen(false);
        }
      }}
    >
      <header className="flex items-center gap-2 border-b border-hairline bg-surface px-3 py-2">
        {figur}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p data-testid="begleiter-zustand" aria-live="polite" className="text-[11px] text-muted">
            {zustandText}
          </p>
        </div>
        <button
          type="button"
          data-testid="begleiter-schliessen"
          aria-label={t("begleiter.schliessen")}
          title={t("begleiter.schliessen")}
          onClick={() => setOffen(false)}
          className={KNOPF}
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
        {/* Word-Kontext — nur vom Office-Adapter, mit Herkunft und Aktualität. */}
        <section data-testid="begleiter-kontext" className="space-y-1.5">
          <p className={KLEINTITEL}>{t("begleiter.kontext.titel")}</p>
          {kontextFehler ? (
            <p
              role="alert"
              data-testid="begleiter-kontext-fehler"
              className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] text-trust-crit-text"
            >
              {t("begleiter.kontext.fehler", { grund: kontextFehler })}
            </p>
          ) : kontext === null ? (
            <p className="text-[11.5px] text-muted-2">{t("begleiter.kontext.laden")}</p>
          ) : kontext.adapter.length === 0 ? (
            <p data-testid="begleiter-kontext-leer" className="text-[11.5px] text-muted">
              {t("begleiter.kontext.leer")}
            </p>
          ) : (
            <ul className="space-y-1">
              {kontext.adapter.map((a) => {
                const gebunden = adapter?.instanz === a.instanz;
                return (
                  <li
                    key={a.instanz}
                    data-testid="begleiter-fenster"
                    data-aktiv={a.aktiv ? "ja" : "nein"}
                    data-gebunden={gebunden ? "ja" : "nein"}
                    className={`rounded-btn border px-2.5 py-1.5 text-[11.5px] ${
                      gebunden ? "border-brand bg-surface" : "border-hairline bg-page"
                    }`}
                  >
                    <p className="font-semibold text-ink">
                      {a.dokument.titel || t("begleiter.kontext.ohneTitel")}
                    </p>
                    <p className="text-muted">
                      {t(`begleiter.kontext.host.${a.host}`)}
                      {a.hostFassung
                        ? ` · ${t("begleiter.kontext.fassung", { fassung: a.hostFassung })}`
                        : ""}
                      {" · "}
                      {a.aktiv ? t("begleiter.kontext.aktiv") : t("begleiter.kontext.inaktiv")}
                    </p>
                    {gebunden ? (
                      <p className="text-[11px] font-semibold text-brand-text">
                        {t("begleiter.kontext.gebunden")}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setGewaehlt(a.instanz)}
                        className={`${KNOPF} mt-1`}
                      >
                        {t("begleiter.kontext.binden")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {adapter ? (
            <div
              data-testid="begleiter-auswahl"
              data-host={adapter.host}
              className="space-y-1.5 rounded-card border border-hairline bg-surface px-2.5 py-2"
            >
              <p className={KLEINTITEL}>
                {t("begleiter.kontext.auswahl.titel")}
                {host ? ` · ${host}` : ""}
              </p>
              {auswahl ? (
                <>
                  <p
                    data-testid="begleiter-auswahl-text"
                    className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[12px] text-text"
                  >
                    {kuerze(auswahl.text, 600)}
                  </p>
                  {auswahl.gekuerzt || auswahl.text.length > 600 ? (
                    <p className="text-[11px] text-muted-2">
                      {t("begleiter.kontext.auswahl.gekuerzt", { laenge: auswahl.laenge })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p data-testid="begleiter-auswahl-leer" className="text-[11.5px] text-muted-2">
                  {adapter.aktiv
                    ? t("begleiter.kontext.auswahl.leer")
                    : t("begleiter.kontext.inaktiv")}
                </p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = wordFrage.trim();
                  if (text) {
                    void beauftrage("frage", text);
                  }
                }}
                className="space-y-1"
              >
                <label htmlFor={frageId} className={KLEINTITEL}>
                  {t("begleiter.kontext.frage.label")}
                </label>
                <div className="flex gap-1.5">
                  <input
                    id={frageId}
                    data-testid="begleiter-word-frage"
                    value={wordFrage}
                    onChange={(e) => setWordFrage(e.target.value)}
                    disabled={!adapter.aktiv}
                    className="min-w-0 flex-1 rounded-btn border border-hairline bg-page px-2 py-1 text-[12px]"
                  />
                  <button
                    type="submit"
                    data-testid="begleiter-word-frage-senden"
                    disabled={!adapter.aktiv || wordFrage.trim().length === 0}
                    className={KNOPF_KI}
                  >
                    {t("begleiter.kontext.frage.knopf")}
                  </button>
                </div>
                <p className="text-[11px] text-muted-2">{t("begleiter.kontext.frage.hinweis")}</p>
              </form>

              {einfuegeText ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    data-testid="begleiter-einfuegen"
                    disabled={!auswahl}
                    onClick={() => void beauftrage("einfuegen", einfuegeText)}
                    className={KNOPF}
                  >
                    {t("begleiter.kontext.einfuegen.knopf")}
                  </button>
                  <p className="text-[11px] text-muted-2">
                    {kuerze(einfuegeText, 140)} · {t("begleiter.kontext.einfuegen.hinweis")}
                  </p>
                </div>
              ) : null}

              {aktionFehler ? (
                <p
                  role="alert"
                  data-testid="begleiter-aktion-fehler"
                  className="rounded-btn bg-trust-warn-bg px-2 py-1 text-[11px] text-trust-warn-text"
                >
                  {aktionFehler}
                </p>
              ) : null}

              {adapter.aktionen.length > 0 ? (
                <ol className="space-y-1" data-testid="begleiter-aktionen">
                  {[...adapter.aktionen].reverse().map((a) => (
                    <li
                      key={a.id}
                      data-stand={a.stand}
                      className="rounded-btn bg-page px-2 py-1 text-[11px] text-text"
                    >
                      <span className="font-semibold">{t(`begleiter.aktion.art.${a.art}`)}</span>
                      {" · "}
                      {t(`begleiter.aktion.stand.${a.stand}`)}
                      {a.grund ? ` · ${t("begleiter.aktion.grund", { grund: a.grund })}` : ""}
                      {a.art === "frage" && a.ergebnis ? (
                        <span className="mt-0.5 block whitespace-pre-wrap text-[11.5px]">
                          <span className={KLEINTITEL}>{t("begleiter.aktion.antwort")}</span>{" "}
                          {kuerze(a.ergebnis, 800)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Das eigene Gespräch — unverändert Klara 01, ohne Dokumenttext. */}
        <section className="space-y-2" aria-label={t("begleiter.gespraech.titel")}>
          <p className={KLEINTITEL}>{t("begleiter.gespraech.titel")}</p>
          <p className="text-[11px] text-muted-2">{t("begleiter.gespraech.hinweis")}</p>
          <KlaraSprachausgabe />
          <KlaraEchtGespraech
            kontext={bezug}
            pfad="/begleiter"
            ki={ki}
            sprecher={name}
            onErneutFragen={(text) => {
              void fragenSenden(text);
            }}
            onNeuLaden={() => {
              if (kontoId) {
                void ladeEcht(kontoId, t);
              }
            }}
          />
          <KlaraAuftragKarte
            s={sprechen}
            sendebereit={sendebereit}
            absenden={(text, ziel) => fragenSenden(text, ziel.herkunft)}
          />
        </section>

        {/* Bedienung der Figur — dieselben Wege wie im Menü der App. */}
        <details className="rounded-card border border-hairline bg-surface px-2.5 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-ink">
            {t("begleiter.figur.titel")}
          </summary>
          <div className="mt-1.5 space-y-1.5">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                data-testid="begleiter-reduziert"
                checked={reduziert}
                onChange={(e) => setzeReduziert(e.target.checked)}
              />
              {t("begleiter.figur.reduziert")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!app}
                onClick={() => anNative({ art: "zuruecksetzen" })}
                className={KNOPF}
              >
                {t("begleiter.figur.zuruecksetzen")}
              </button>
              <button
                type="button"
                disabled={!app}
                onClick={() => anNative({ art: "andocken", seite: "links" })}
                className={KNOPF}
              >
                {t("begleiter.figur.links")}
              </button>
              <button
                type="button"
                disabled={!app}
                onClick={() => anNative({ art: "andocken", seite: "rechts" })}
                className={KNOPF}
              >
                {t("begleiter.figur.rechts")}
              </button>
              <button
                type="button"
                disabled={!app}
                onClick={() => anNative({ art: "ausblenden" })}
                className={KNOPF}
              >
                {t("begleiter.figur.ausblenden")}
              </button>
            </div>
            <p className="text-[11px] text-muted-2">{t("begleiter.figur.einblendenHinweis")}</p>
          </div>
        </details>

        <details className="rounded-card border border-hairline bg-surface px-2.5 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-ink">
            {t("begleiter.berechtigung.titel")}
          </summary>
          <p className="mt-1 text-[11.5px] leading-relaxed text-text">
            {t("begleiter.berechtigung.text")}
          </p>
        </details>

        <p data-testid="begleiter-version" className="text-[10.5px] text-muted-2">
          {appStand
            ? t("begleiter.version.app", { web: APP_VERSION, app: appStand })
            : t("begleiter.version.browser", { web: APP_VERSION })}
        </p>
        <LegalFooter />
      </div>

      <form
        data-testid="begleiter-eingabe-form"
        onSubmit={senden}
        className="space-y-1.5 border-t border-hairline bg-surface px-3 py-2"
      >
        {echt.laeuftSeit !== null ? (
          <p className="text-[11px] font-semibold text-ai" aria-live="polite">
            {t("begleiter.eingabe.laeuft")}
          </p>
        ) : null}
        <KlaraSprachLeiste s={sprechen} />
        <label htmlFor={eingabeId} className={KLEINTITEL}>
          {t("begleiter.eingabe.label")}
        </label>
        <div className="flex gap-1.5">
          <input
            id={eingabeId}
            data-testid="begleiter-eingabe"
            value={eingabe}
            enterKeyHint="send"
            onChange={(e) => setEingabe(e.target.value)}
            placeholder={t("begleiter.eingabe.platzhalter")}
            className="min-w-0 flex-1 rounded-btn border border-hairline bg-page px-2 py-1.5 text-[12.5px]"
          />
          {echt.laeuftSeit !== null ? (
            <button
              type="button"
              data-testid="begleiter-stoppen"
              onClick={stoppen}
              className={KNOPF}
            >
              {t("begleiter.eingabe.stoppen")}
            </button>
          ) : (
            <button
              type="submit"
              data-testid="begleiter-senden"
              disabled={!sendebereit || eingabe.trim().length === 0}
              className={KNOPF_KI}
            >
              {t("begleiter.eingabe.senden")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
