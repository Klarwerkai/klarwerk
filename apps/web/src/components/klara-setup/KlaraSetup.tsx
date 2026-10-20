// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-02/AA-03) — DER BEREICH „KLARA“ IM SETUP.
// ================================================================================================
//
// Einstellungen → Persönliche Einstellungen (`/profil`) → Zeile „Klara“. Die Detailkarte
// (`pages/Profile.tsx`, `MeineAssistenzDetail`) gruppiert hier ALLE im Bestand (AA-01,
// `docs/klara-setup-shortcuts/BESTAND.md`) erfassten Klara-Einstellungen:
//
//   · Name und Erscheinung (E01–E03) und Fähigkeiten (E07) — die gelieferten Formulare, unverändert.
//   · Unterstützung (E05) — dieselbe `KlaraModusWahl` mit derselben Ablage wie im Gespräch; dazu die
//     ruhenden Hinweise (E06) nur lesend, weil „Später“/„Nicht mehr anbieten“ am Hinweis selbst wirken.
//   · Sprachausgabe (E08) — dieselbe `KlaraSprachausgabe`; sie gilt nur für diesen Browser.
//   · Tastenkürzel (AA-03) — `KlaraTastenkuerzelBereich` unten.
//   · Bilder automatisch lesen (OCR-03) — `KlaraBildAutomatikGruppe`, im eigenen Assistenzprofil.
//   · Datenkontrolle (PP-03) — `KlaraDatenkontrolleGruppe`: welche offenen Datenpunkte die Datenlage
//     einzeln aufführt; ebenfalls im eigenen Assistenzprofil, ohne Wirkung auf einen Prüfstand.
//   · Vorgaben der Organisation (O01/O02), Browser-Erweiterung (H02) und Word (H03, W01–W05) — mit
//     klarer Zuständigkeit und direktem Zugang, weil diese Hosts technisch getrennt bleiben.
//
// Kein Wert zieht um: jede Gruppe liest und schreibt über ihren bisherigen Weg, mit denselben Rechten
// (nur eigenes Konto; Verwaltung nur `admin`).
import type { TFunction } from "i18next";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../app/AuthContext";
import { GuardedLink } from "../../app/NavGuardContext";
import { useRole } from "../../app/RoleContext";
import { useAssistenzStand, useAssistenzT } from "../../lib/assistenzProfil";
import { speichereBildAutomatik, useBildAutomatikLage } from "../../lib/bildAutomatikEinstellung";
import {
  type OffenePunkteWahl,
  speichereOffenePunkte,
  useOffenePunkteWahl,
} from "../../lib/datenkontrolleEinstellung";
import { ladeEigeninitiative, useEigeninitiative } from "../../lib/klaraEigeninitiative";
import {
  KLARA_KUERZEL_AKTIONEN,
  type KlaraKuerzelAktion,
  type Konflikt,
  type KuerzelEintrag,
  type KuerzelKombination,
  type SpeicherErgebnis,
  aufnahmeAus,
  kuerzelWorte,
  kuerzelZeichen,
  ladeTastenkuerzel,
  pruefeBelegung,
  setzeAlleKuerzelZurueck,
  setzeKuerzel,
  setzeKuerzelAufnahme,
  tastenkuerzelLage,
  useTastenkuerzel,
  wirksameEintraege,
} from "../../lib/klaraTastenkuerzel";
import { hasSpeechRecognition } from "../../lib/speechSupport";
import { type Plattform, aktuellePlattform } from "../../lib/tastenkuerzel";
import { KlaraModusWahl } from "../klara-vorschau/KlaraEigeninitiative";
import { KlaraSprachausgabe } from "../klara-vorschau/KlaraSprache";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const TEXT = "text-[12.5px] leading-relaxed text-muted";

/** Eine Gruppe des Bereichs — Überschrift und Inhalt, für Screenreader als Abschnitt benannt. */
export function KlaraGruppe({
  titel,
  testId,
  children,
}: {
  titel: string;
  testId: string;
  children: ReactNode;
}): JSX.Element {
  const id = useId();
  return (
    <section aria-labelledby={id} data-testid={testId} className="space-y-2">
      <h2 id={id} className="text-[13.5px] font-semibold text-ink">
        {titel}
      </h2>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------
// Unterstützung (E05) und ruhende Hinweise (E06).
// ------------------------------------------------------------------------------------------------

function hinweisArt(schluessel: string): "tutorial" | "ungeprueft" | "seite" | "andere" {
  const art = schluessel.split(":")[0];
  return art === "tutorial" || art === "ungeprueft" || art === "seite" ? art : "andere";
}

export function KlaraUnterstuetzung(): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const { user } = useSession();
  const kontoId = user?.id ?? null;
  const l = useEigeninitiative();
  useEffect(() => {
    if (kontoId && l.kontoId !== kontoId) {
      void ladeEigeninitiative(kontoId);
    }
  }, [kontoId, l.kontoId]);
  const hinweise = l.status === "bereit" ? (l.antwort?.hinweise ?? []) : [];
  return (
    <KlaraGruppe titel={t("klarasetup.gruppe.unterstuetzung")} testId="klara-setup-unterstuetzung">
      {/* Der Speicherstand steht in der Wahl selbst („Für dein Konto gespeichert“). */}
      <KlaraModusWahl kontoId={kontoId} t={t} onGewaehlt={() => undefined} />
      <div data-testid="klara-setup-hinweise">
        <p className="text-[12.5px] font-semibold text-text">{t("klarasetup.hinweise.titel")}</p>
        {hinweise.length === 0 ? (
          <p className={TEXT}>{t("klarasetup.hinweise.leer")}</p>
        ) : (
          <ul className="space-y-0.5">
            {hinweise.map((h) => (
              <li key={h.schluessel} data-testid="klara-setup-hinweis" className={TEXT}>
                {t("klarasetup.hinweise.zeile", {
                  art: t(`klarasetup.hinweise.art.${hinweisArt(h.schluessel)}`),
                  stand: t(`klarasetup.hinweise.stand.${h.stand}`),
                  bis: new Date(h.bis).toLocaleString(i18n.language),
                })}
              </li>
            ))}
          </ul>
        )}
        <p className={TEXT}>{t("klarasetup.hinweise.ort")}</p>
      </div>
    </KlaraGruppe>
  );
}

// ------------------------------------------------------------------------------------------------
// produkt:20261012:klara-bildanalyse-ocr-kontext-setup (OCR-03) — Bilder automatisch lesen.
// Voreinstellung an; gespeichert im eigenen Assistenzprofil (W17), also je Konto und über Neuladen
// und Geräte hinweg. Aus heißt: keine neue automatische Auswertung; Vorhandenes bleibt lesbar.
// ------------------------------------------------------------------------------------------------

export function KlaraBildAutomatikGruppe(): JSX.Element {
  const { t } = useTranslation();
  const stand = useAssistenzStand();
  const lage = useBildAutomatikLage();
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const schalterId = useId();
  const bereit = stand.kontoId !== null && stand.status === "bereit";
  const an = lage === "an";

  const wechsel = async (neu: boolean): Promise<void> => {
    setSpeichert(true);
    setMeldung({ text: t("klarabildkontext.setup.speichert"), fehler: false });
    const r = await speichereBildAutomatik(neu);
    setSpeichert(false);
    if (r === "gespeichert") {
      setMeldung({
        text: neu
          ? t("klarabildkontext.setup.gespeichertAn")
          : t("klarabildkontext.setup.gespeichertAus"),
        fehler: false,
      });
    } else if (r === "konflikt") {
      setMeldung({ text: t("klarabildkontext.setup.konflikt"), fehler: true });
    } else {
      setMeldung({ text: t("klarabildkontext.setup.fehler"), fehler: true });
    }
  };

  return (
    <KlaraGruppe titel={t("klarabildkontext.setup.titel")} testId="klara-setup-bildautomatik">
      <div className="flex items-start gap-2">
        <input
          id={schalterId}
          type="checkbox"
          data-testid="klara-bildautomatik-schalter"
          checked={an}
          disabled={!bereit || speichert}
          onChange={(e) => void wechsel(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <label htmlFor={schalterId} className="text-[13px] font-semibold text-ink">
          {t("klarabildkontext.setup.schalter")}
        </label>
      </div>
      <p className={TEXT}>{t("klarabildkontext.setup.erklaerung")}</p>
      <p data-testid="klara-bildautomatik-stand" data-lage={lage} className={TEXT}>
        {stand.kontoId === null
          ? t("klarabildkontext.setup.ohneKonto")
          : lage === "laedt"
            ? t("klarabildkontext.setup.laedt")
            : lage === "unbekannt"
              ? t("klarabildkontext.setup.unbekannt")
              : an
                ? t("klarabildkontext.setup.an")
                : t("klarabildkontext.setup.aus")}
      </p>
      <p className={TEXT}>{t("klarabildkontext.setup.geltung")}</p>
      <p
        data-testid="klara-bildautomatik-meldung"
        data-fehler={meldung?.fehler ? "true" : "false"}
        role={meldung?.fehler ? "alert" : "status"}
        className={`min-h-[1em] text-[12.5px] ${
          meldung?.fehler ? "text-trust-crit-text" : "text-muted"
        }`}
      >
        {meldung?.text ?? ""}
      </p>
    </KlaraGruppe>
  );
}

// ------------------------------------------------------------------------------------------------
// Datenkontrolle (PP-03, Paket Abschnitt 7) — Sichtbarkeit offener Datenpunkte, Konto.
// ------------------------------------------------------------------------------------------------

const OFFENE_PUNKTE: readonly OffenePunkteWahl[] = ["alle", "nur_klaerung"];

export function KlaraDatenkontrolleGruppe(): JSX.Element {
  const { t } = useTranslation();
  const stand = useAssistenzStand();
  const wahl = useOffenePunkteWahl();
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const name = useId();
  const bereit = stand.kontoId !== null && stand.status === "bereit";
  // `aria-disabled` statt `disabled` (Hausregel wie bei den Tastenkürzeln, Risiko R11): während des
  // Speicherns bleibt die Option fokussierbar; die Wahl wird dann nur nicht ausgelöst.
  const gesperrt = !bereit || speichert;

  const waehle = async (neu: OffenePunkteWahl): Promise<void> => {
    setSpeichert(true);
    setMeldung({ text: t("datenkontrolle.setup.speichert"), fehler: false });
    const r = await speichereOffenePunkte(neu);
    setSpeichert(false);
    setMeldung(
      r === "gespeichert"
        ? { text: t("datenkontrolle.setup.gespeichert"), fehler: false }
        : r === "konflikt"
          ? { text: t("datenkontrolle.setup.konflikt"), fehler: true }
          : { text: t("datenkontrolle.setup.fehler"), fehler: true },
    );
  };

  return (
    <KlaraGruppe titel={t("datenkontrolle.setup.titel")} testId="klara-setup-datenkontrolle">
      <fieldset className="space-y-1">
        <legend className="text-[13px] font-semibold text-ink">
          {t("datenkontrolle.setup.frage")}
        </legend>
        {OFFENE_PUNKTE.map((w) => (
          <label key={w} className="flex items-start gap-2 text-[12.5px] text-text">
            <input
              type="radio"
              name={name}
              value={w}
              data-testid={`klara-datenkontrolle-${w}`}
              checked={wahl === w}
              aria-disabled={gesperrt || undefined}
              onChange={() => {
                if (!gesperrt) {
                  void waehle(w);
                }
              }}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>{t(`datenkontrolle.setup.wahl.${w}`)}</span>
          </label>
        ))}
      </fieldset>
      <p className={TEXT}>{t("datenkontrolle.setup.grenze")}</p>
      {stand.kontoId === null ? (
        <p className={TEXT}>{t("datenkontrolle.setup.ohneKonto")}</p>
      ) : null}
      <p
        data-testid="klara-datenkontrolle-meldung"
        data-fehler={meldung?.fehler ? "true" : "false"}
        role={meldung?.fehler ? "alert" : "status"}
        className={`min-h-[1em] text-[12.5px] ${
          meldung?.fehler ? "text-trust-crit-text" : "text-muted"
        }`}
      >
        {meldung?.text ?? ""}
      </p>
    </KlaraGruppe>
  );
}

// ------------------------------------------------------------------------------------------------
// Sprachausgabe (E08) — Gerät, nicht Konto.
// ------------------------------------------------------------------------------------------------

export function KlaraSprachausgabeGruppe(): JSX.Element {
  const { t } = useTranslation();
  return (
    <KlaraGruppe titel={t("klarasetup.gruppe.sprachausgabe")} testId="klara-setup-sprachausgabe">
      <p className={TEXT}>{t("klarasetup.sprachausgabe.geltung")}</p>
      <KlaraSprachausgabe />
    </KlaraGruppe>
  );
}

// ------------------------------------------------------------------------------------------------
// Getrennte Hosts: Verwaltung, Browser-Erweiterung, Word.
// ------------------------------------------------------------------------------------------------

export function KlaraWeitereOrte(): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  return (
    <>
      <KlaraGruppe titel={t("klarasetup.gruppe.organisation")} testId="klara-setup-organisation">
        <p className={TEXT}>{t("klarasetup.organisation.text")}</p>
        {role === "admin" ? (
          <GuardedLink
            to="/admin"
            data-testid="klara-setup-verwaltung"
            className="inline-flex text-[12.5px] font-semibold text-brand-text hover:underline"
          >
            {t("klarasetup.organisation.admin")}
          </GuardedLink>
        ) : null}
      </KlaraGruppe>
      <KlaraGruppe titel={t("klarasetup.gruppe.browser")} testId="klara-setup-browser">
        <p className={TEXT}>{t("klarasetup.browser.text")}</p>
      </KlaraGruppe>
      <KlaraGruppe titel={t("klarasetup.gruppe.word")} testId="klara-setup-word">
        <p className={TEXT}>{t("klarasetup.word.text")}</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {(["sprache", "mitlesen", "absatzblick", "zustimmung", "dokument"] as const).map((w) => (
            <li key={w} className={TEXT}>
              {t(`klarasetup.word.${w}`)}
            </li>
          ))}
        </ul>
      </KlaraGruppe>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// Tastenkürzel (AA-03): festlegen, ändern, abbrechen, entfernen, zurücksetzen.
// ------------------------------------------------------------------------------------------------

function tastenNamen(t: TFunction, plattform: Plattform) {
  const p = plattform === "apple" ? "apple" : "andere";
  return {
    strg: t(`klarasetup.taste.${p}.strg`),
    alt: t(`klarasetup.taste.${p}.alt`),
    umschalt: t(`klarasetup.taste.${p}.umschalt`),
    meta: t(`klarasetup.taste.${p}.meta`),
  };
}

/** Ein Kürzel sichtbar mit Mac-Symbolen, für Screenreader und Tooltip ausgeschrieben. */
export function KuerzelAnzeige({ k }: { k: KuerzelKombination }): JSX.Element {
  const { t, i18n } = useTranslation();
  const plattform = aktuellePlattform();
  const worte = kuerzelWorte(k, plattform, tastenNamen(t, plattform));
  return (
    <span title={worte} data-testid="klara-kuerzel-anzeige">
      {/* Die Symbolform ist für Screenreader verborgen; sie lesen die ausgeschriebene Form.
          `aria-hidden` sitzt an einer nicht fokussierbaren Hülle, nicht am `kbd`. */}
      <span aria-hidden="true">
        <kbd className="rounded border border-hairline bg-page px-1.5 py-0.5 font-mono text-[12px] text-ink">
          {kuerzelZeichen(k, plattform, i18n.language)}
        </kbd>
      </span>
      <span className="sr-only">{worte}</span>
    </span>
  );
}

interface Meldung {
  readonly text: string;
  readonly fehler: boolean;
}

export function KlaraTastenkuerzelBereich(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const kontoId = user?.id ?? null;
  const lage = useTastenkuerzel();
  const eintraege = wirksameEintraege(lage);
  const plattform = aktuellePlattform();
  const sprachMoeglich = typeof window !== "undefined" && hasSpeechRecognition(window);
  const [aufnahme, setAufnahme] = useState<KlaraKuerzelAktion | null>(null);
  const [aufnahmeHinweis, setAufnahmeHinweis] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [fokusNach, setFokusNach] = useState<KlaraKuerzelAktion | null>(null);
  const ausloeser = useRef(new Map<KlaraKuerzelAktion, HTMLButtonElement>());
  const aufnahmeRef = useRef<HTMLButtonElement | null>(null);
  // Die laufende Aufnahme als Ref: ein spätes `blur` des abgebauten Aufnahmefelds darf eine schon
  // beendete Aufnahme nicht noch einmal als „abgebrochen“ melden.
  const laufendRef = useRef<KlaraKuerzelAktion | null>(null);
  laufendRef.current = aufnahme;
  const hinweisId = useId();

  useEffect(() => {
    if (kontoId && lage.kontoId !== kontoId) {
      void ladeTastenkuerzel(kontoId);
    }
  }, [kontoId, lage.kontoId]);

  // Während der Aufnahme löst kein Kürzel eine Klara-Aktion aus — auch nicht über die Hülle.
  useEffect(() => {
    if (aufnahme === null) {
      return;
    }
    setzeKuerzelAufnahme(true);
    aufnahmeRef.current?.focus();
    return () => setzeKuerzelAufnahme(false);
  }, [aufnahme]);

  useEffect(() => {
    if (fokusNach !== null && aufnahme === null) {
      ausloeser.current.get(fokusNach)?.focus();
      setFokusNach(null);
    }
  }, [fokusNach, aufnahme]);

  const name = (aktion: KlaraKuerzelAktion): string => t(`klarasetup.aktion.${aktion}.name`);
  const zeichen = (k: KuerzelKombination): string => kuerzelZeichen(k, plattform, i18n.language);
  const bereit = Boolean(kontoId) && lage.status === "bereit" && lage.speichert === null;
  // `aria-disabled` statt `disabled`: ein Knopf, der während des Speicherns gesperrt wird, behält so
  // den Tastaturfokus (ein `disabled`-Knopf verliert ihn im Browser).
  const gesperrt = !bereit || aufnahme !== null;
  const knopf = `${KNOPF}${gesperrt ? " opacity-40" : ""}`;

  const beendeAufnahme = (aktion: KlaraKuerzelAktion): void => {
    laufendRef.current = null;
    setAufnahme(null);
    setAufnahmeHinweis(false);
    setFokusNach(aktion);
  };

  const konfliktText = (k: KuerzelKombination, konflikt: Konflikt): string => {
    const grund = t(`klarasetup.konflikt.${konflikt.grund}`, {
      kuerzel: zeichen(k),
      aktion: konflikt.belegtVon ? name(konflikt.belegtVon) : "",
    });
    return `${grund} ${t("klarasetup.konflikt.bleibt")}`;
  };

  const ergebnisMelden = (
    r: SpeicherErgebnis,
    erfolg: string,
    k: KuerzelKombination | null,
  ): void => {
    if (r.ok) {
      // Kam die Antwort nicht an, hat erst der Abgleich die Speicherung bestätigt — das wird gesagt.
      const text = r.abgeglichen ? `${erfolg} ${t("klarasetup.meldung.abgeglichen")}` : erfolg;
      setMeldung({ text, fehler: false });
    } else if (r.art === "unbekannt") {
      setMeldung({ text: t("klarasetup.meldung.unbekannt"), fehler: true });
    } else if (r.art === "doppelt" && k) {
      setMeldung({
        text: konfliktText(k, {
          grund: "doppelt",
          ...(r.belegtVon ? { belegtVon: r.belegtVon } : {}),
        }),
        fehler: true,
      });
    } else {
      const schluessel =
        r.art === "abgelehnt" ? "klarasetup.meldung.abgelehnt" : "klarasetup.meldung.fehler";
      setMeldung({ text: t(schluessel), fehler: true });
    }
  };

  const speichere = async (
    aktion: KlaraKuerzelAktion,
    belegung: KuerzelKombination | null | "standard",
  ): Promise<void> => {
    if (!kontoId) {
      return;
    }
    setMeldung({ text: t("klarasetup.meldung.speichert"), fehler: false });
    const r = await setzeKuerzel(kontoId, aktion, belegung);
    const neu = wirksameEintraege(tastenkuerzelLage()).find((e) => e.aktion === aktion);
    if (belegung === null) {
      ergebnisMelden(r, t("klarasetup.meldung.entfernt", { aktion: name(aktion) }), null);
    } else if (belegung === "standard") {
      const wert = neu?.belegung ? zeichen(neu.belegung) : t("klarasetup.wert.unbelegt");
      ergebnisMelden(r, t("klarasetup.meldung.standard", { aktion: name(aktion), wert }), null);
    } else {
      const text = t("klarasetup.meldung.gespeichert", {
        aktion: name(aktion),
        kuerzel: zeichen(belegung),
      });
      ergebnisMelden(r, text, belegung);
    }
  };

  const beiAufnahmeTaste = (aktion: KlaraKuerzelAktion, e: ReactKeyboardEvent): void => {
    if (e.key === "Tab") {
      return; // Fokus darf die Aufnahme verlassen; das bricht sie ab (onBlur).
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      setMeldung({ text: t("klarasetup.meldung.abgebrochen"), fehler: false });
      beendeAufnahme(aktion);
      return;
    }
    if (e.repeat) {
      return;
    }
    const a = aufnahmeAus(e);
    if (a.art === "nurModifikator") {
      setAufnahmeHinweis(true);
      return;
    }
    if (a.art === "taste") {
      setMeldung({
        text: `${t("klarasetup.konflikt.taste")} ${t("klarasetup.konflikt.bleibt")}`,
        fehler: true,
      });
      beendeAufnahme(aktion);
      return;
    }
    const k = a.kombination;
    const konflikt = pruefeBelegung(k, aktion, eintraege);
    beendeAufnahme(aktion);
    if (konflikt) {
      setMeldung({ text: konfliktText(k, konflikt), fehler: true });
      return;
    }
    void speichere(aktion, k);
  };

  const alleZuruecksetzen = async (): Promise<void> => {
    if (!kontoId) {
      return;
    }
    setMeldung({ text: t("klarasetup.meldung.speichert"), fehler: false });
    const r = await setzeAlleKuerzelZurueck(kontoId);
    ergebnisMelden(r, t("klarasetup.meldung.alleStandard"), null);
  };

  const eintragFuer = (aktion: KlaraKuerzelAktion): KuerzelEintrag | undefined =>
    eintraege.find((e) => e.aktion === aktion);
  const irgendeinEigenes = eintraege.some((e) => e.quelle !== "standard");
  // Solange der Ausgang eines Schreibversuchs abgeglichen wird, heisst er „unklar“ — nicht
  // „gespeichert“ und nicht „nicht gespeichert“.
  const imAbgleich: Meldung = { text: t("klarasetup.meldung.abgleich"), fehler: false };
  const angezeigt: Meldung | null = lage.ausgang === "abgleich" ? imAbgleich : meldung;

  return (
    <KlaraGruppe titel={t("klarasetup.gruppe.tastenkuerzel")} testId="klara-setup-tastenkuerzel">
      <p className={TEXT}>{t("klarasetup.kuerzel.beschreibung")}</p>
      <p data-testid="klara-kuerzel-geltung" className="text-[12.5px] leading-relaxed text-text">
        {t("klarasetup.kuerzel.geltung")}
      </p>
      <p className={TEXT}>{t("klarasetup.kuerzel.keineGarantie")}</p>

      {!kontoId ? <p className={TEXT}>{t("klarasetup.stand.ohneKonto")}</p> : null}
      {kontoId && (lage.status === "laedt" || lage.status === "leer") ? (
        <p data-testid="klara-kuerzel-laedt" className={TEXT}>
          {t("klarasetup.stand.laedt")}
        </p>
      ) : null}
      {kontoId && lage.status === "fehler" ? (
        <div role="alert" data-testid="klara-kuerzel-ladefehler" className="space-y-1">
          <p className="text-[12.5px] text-trust-crit-text">{t("klarasetup.stand.ladefehler")}</p>
          <button type="button" className={KNOPF} onClick={() => void ladeTastenkuerzel(kontoId)}>
            {t("klarasetup.stand.wiederholen")}
          </button>
        </div>
      ) : null}

      {lage.status === "bereit" ? (
        <ul
          aria-label={t("klarasetup.kuerzel.liste")}
          data-testid="klara-kuerzel-liste"
          className="space-y-2"
        >
          {KLARA_KUERZEL_AKTIONEN.map((aktion) => {
            const e = eintragFuer(aktion);
            const belegung = e?.belegung ?? null;
            const quelle = e?.quelle ?? "standard";
            const sprachAktion = aktion === "diktieren" || aktion === "auftragSprechen";
            const festlegen = belegung ? "aendern" : "festlegen";
            return (
              <li
                key={aktion}
                data-testid={`klara-kuerzel-${aktion}`}
                data-quelle={quelle}
                className="rounded-card border border-hairline px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{name(aktion)}</span>
                  <span data-testid="klara-kuerzel-wert" className="text-[12.5px] text-text">
                    {belegung ? <KuerzelAnzeige k={belegung} /> : t("klarasetup.wert.unbelegt")}
                    <span className="ml-1.5 text-[11.5px] text-muted-2">
                      {t(`klarasetup.quelle.${quelle}`)} · {t("klarasetup.kuerzel.geltungKurz")}
                    </span>
                  </span>
                </div>
                <p className={TEXT}>{t(`klarasetup.aktion.${aktion}.text`)}</p>
                {sprachAktion && !sprachMoeglich ? (
                  <p data-testid="klara-kuerzel-voraussetzung" className={TEXT}>
                    {t("klarasetup.voraussetzung.sprache")}
                  </p>
                ) : null}
                {aufnahme === aktion ? (
                  <div className="mt-1.5 space-y-1">
                    <button
                      ref={aufnahmeRef}
                      type="button"
                      data-testid="klara-kuerzel-aufnahme"
                      aria-describedby={hinweisId}
                      onKeyDown={(ev) => beiAufnahmeTaste(aktion, ev)}
                      onBlur={() => {
                        // Fokus verlassen (Tab, Klick daneben) bricht ab; die alte Belegung bleibt.
                        if (laufendRef.current === aktion) {
                          laufendRef.current = null;
                          setMeldung({ text: t("klarasetup.meldung.abgebrochen"), fehler: false });
                          setAufnahme(null);
                          setAufnahmeHinweis(false);
                        }
                      }}
                      className="w-full rounded-btn border-2 border-brand bg-page px-2.5 py-2 text-left text-[12.5px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {t("klarasetup.aufnahme.titel", { aktion: name(aktion) })}
                    </button>
                    <p id={hinweisId} className={TEXT}>
                      {aufnahmeHinweis
                        ? t("klarasetup.aufnahme.nurModifikator")
                        : t("klarasetup.aufnahme.hinweis")}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      ref={(el) => {
                        if (el) {
                          ausloeser.current.set(aktion, el);
                        } else {
                          ausloeser.current.delete(aktion);
                        }
                      }}
                      type="button"
                      data-testid="klara-kuerzel-festlegen"
                      aria-label={t(`klarasetup.knopf.${festlegen}Fuer`, { aktion: name(aktion) })}
                      aria-disabled={gesperrt}
                      onClick={() => {
                        if (gesperrt) {
                          return;
                        }
                        setMeldung(null);
                        setAufnahme(aktion);
                      }}
                      className={knopf}
                    >
                      {t(`klarasetup.knopf.${festlegen}`)}
                    </button>
                    {belegung ? (
                      <button
                        type="button"
                        data-testid="klara-kuerzel-entfernen"
                        aria-label={t("klarasetup.knopf.entfernenFuer", { aktion: name(aktion) })}
                        aria-disabled={gesperrt}
                        onClick={() => {
                          if (gesperrt) {
                            return;
                          }
                          setFokusNach(aktion);
                          void speichere(aktion, null);
                        }}
                        className={knopf}
                      >
                        {t("klarasetup.knopf.entfernen")}
                      </button>
                    ) : null}
                    {quelle !== "standard" ? (
                      <button
                        type="button"
                        data-testid="klara-kuerzel-standard"
                        aria-label={t("klarasetup.knopf.standardFuer", { aktion: name(aktion) })}
                        aria-disabled={gesperrt}
                        onClick={() => {
                          if (gesperrt) {
                            return;
                          }
                          setFokusNach(aktion);
                          void speichere(aktion, "standard");
                        }}
                        className={knopf}
                      >
                        {t("klarasetup.knopf.standard")}
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {lage.status === "bereit" && irgendeinEigenes ? (
        <button
          type="button"
          data-testid="klara-kuerzel-alle-standard"
          aria-disabled={gesperrt}
          onClick={() => {
            if (!gesperrt) {
              void alleZuruecksetzen();
            }
          }}
          className={knopf}
        >
          {t("klarasetup.knopf.alleStandard")}
        </button>
      ) : null}

      <p
        data-testid="klara-kuerzel-meldung"
        data-fehler={angezeigt?.fehler ? "true" : "false"}
        data-ausgang={lage.ausgang ?? ""}
        role={angezeigt?.fehler ? "alert" : "status"}
        className={`min-h-[1em] text-[12.5px] ${
          angezeigt?.fehler ? "text-trust-crit-text" : "text-muted"
        }`}
      >
        {angezeigt?.text ?? ""}
      </p>
      {kontoId && lage.ausgang === "offen" ? (
        <button
          type="button"
          data-testid="klara-kuerzel-abgleichen"
          onClick={() => {
            void ladeTastenkuerzel(kontoId).then(() => {
              if (tastenkuerzelLage().ausgang === null) {
                setMeldung({ text: t("klarasetup.meldung.abgeglichenStand"), fehler: false });
              }
            });
          }}
          className={KNOPF}
        >
          {t("klarasetup.knopf.abgleichen")}
        </button>
      ) : null}
    </KlaraGruppe>
  );
}
